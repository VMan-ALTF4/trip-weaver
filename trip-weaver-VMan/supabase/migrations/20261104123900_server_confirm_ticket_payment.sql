ALTER TABLE public.ticket
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS ticket_issue_status text,
  ADD COLUMN IF NOT EXISTS addons jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.ticket
SET order_id = gen_random_uuid()
WHERE order_id IS NULL;

ALTER TABLE public.ticket
  ALTER COLUMN order_id SET NOT NULL,
  ALTER COLUMN addons SET DEFAULT '[]'::jsonb,
  ADD CONSTRAINT ticket_addons_array_check
    CHECK (jsonb_typeof(addons) = 'array'),
  ADD CONSTRAINT ticket_issue_status_check
    CHECK (ticket_issue_status IS NULL OR ticket_issue_status IN ('pending_issue', 'issued'));

CREATE INDEX IF NOT EXISTS ticket_order_id_idx
  ON public.ticket (order_id, created_at);

CREATE OR REPLACE FUNCTION public.set_authoritative_ticket_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tour_price numeric;
  tour_travel_date date;
BEGIN
  IF NEW.order_id IS NULL THEN
    RAISE EXCEPTION 'An order ID is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.order_id::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.ticket existing
    WHERE existing.order_id = NEW.order_id
      AND (
        existing.user_id IS DISTINCT FROM NEW.user_id
        OR existing.tour_id IS DISTINCT FROM NEW.tour_id
        OR existing.travel_date IS DISTINCT FROM NEW.travel_date
        OR existing.ticket_status <> 'pending'
      )
  ) THEN
    RAISE EXCEPTION 'This order is closed or its booking details do not match';
  END IF;

  SELECT tour.price::numeric, tour.travel_date::date
  INTO tour_price, tour_travel_date
  FROM public."Tour" AS tour
  WHERE tour.tour_id::text = NEW.tour_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This tour is unavailable';
  END IF;

  NEW.ticket_status := 'pending';
  NEW.price := tour_price;
  NEW.travel_date := tour_travel_date;
  NEW.payment_method := NULL;
  NEW.payment_at := NULL;
  NEW.ticket_issue_status := NULL;
  NEW.addons := COALESCE(NEW.addons, '[]'::jsonb);

  IF jsonb_typeof(NEW.addons) <> 'array' THEN
    RAISE EXCEPTION 'Ticket add-ons must be a JSON array';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ticket_authoritative_fields_before_insert ON public.ticket;
CREATE TRIGGER ticket_authoritative_fields_before_insert
  BEFORE INSERT ON public.ticket
  FOR EACH ROW
  EXECUTE FUNCTION public.set_authoritative_ticket_fields();
REVOKE ALL ON FUNCTION public.set_authoritative_ticket_fields() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Users update own tickets" ON public.ticket;
CREATE POLICY "Users update own pending tickets"
  ON public.ticket
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND ticket_status = 'pending')
  WITH CHECK (
    user_id = auth.uid()
    AND ticket_status IN ('pending', 'cancelled', 'expired')
  );

CREATE OR REPLACE FUNCTION public.validate_ticket_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  trusted_server boolean := current_user IN ('postgres', 'service_role', 'supabase_admin');
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.tour_id IS DISTINCT FROM OLD.tour_id
     OR NEW.price IS DISTINCT FROM OLD.price
     OR NEW.pickup_location IS DISTINCT FROM OLD.pickup_location
     OR NEW.passengers IS DISTINCT FROM OLD.passengers
     OR NEW.seat_numbers IS DISTINCT FROM OLD.seat_numbers
     OR NEW.travel_date IS DISTINCT FROM OLD.travel_date
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.addons IS DISTINCT FROM OLD.addons THEN
    RAISE EXCEPTION 'Ticket booking details cannot be changed';
  END IF;

  IF NOT trusted_server AND (
    NEW.payment_method IS DISTINCT FROM OLD.payment_method
    OR NEW.payment_at IS DISTINCT FROM OLD.payment_at
    OR NEW.ticket_issue_status IS DISTINCT FROM OLD.ticket_issue_status
  ) THEN
    RAISE EXCEPTION 'Payment details can only be changed by the server';
  END IF;

  IF NEW.ticket_status IS DISTINCT FROM OLD.ticket_status THEN
    IF OLD.ticket_status <> 'pending' THEN
      RAISE EXCEPTION 'Only pending tickets can be completed or cancelled';
    END IF;

    IF NEW.ticket_status = 'sold' THEN
      IF NOT trusted_server OR NEW.payment_method IS NULL OR NEW.payment_at IS NULL THEN
        RAISE EXCEPTION 'Only the payment server can confirm a paid ticket';
      END IF;
    ELSIF NEW.ticket_status = 'expired' THEN
      IF NOT trusted_server AND OLD.created_at > now() - interval '10 minutes' THEN
        RAISE EXCEPTION 'The ticket hold has not expired';
      END IF;
    ELSIF NEW.ticket_status <> 'cancelled' THEN
      RAISE EXCEPTION 'Only pending tickets can be completed or cancelled';
    END IF;
  END IF;

  IF NEW.ticket_status = 'sold' AND NEW.payment_method IS NULL THEN
    RAISE EXCEPTION 'A payment method is required to complete the ticket';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_ticket_update() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.confirm_ticket_payment(
  p_order_id uuid,
  p_user_id uuid,
  p_payment_method text
)
RETURNS TABLE (
  result text,
  ticket_count integer,
  total_price numeric,
  ticket_issue_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  total_count integer;
  owned_count integer;
  pending_count integer;
  sold_count integer;
  mixed_tours boolean;
  earliest_created_at timestamptz;
  updated_count integer;
  current_issue_status text;
  current_total numeric;
BEGIN
  IF p_payment_method NOT IN ('vnpay', 'momo', 'card', 'bank_transfer') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));

  PERFORM 1
  FROM public.ticket AS held_ticket
  WHERE held_ticket.order_id = p_order_id
  ORDER BY held_ticket.id
  FOR UPDATE;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE held_ticket.user_id = p_user_id)::integer,
    count(*) FILTER (WHERE held_ticket.ticket_status = 'pending')::integer,
    count(*) FILTER (WHERE held_ticket.ticket_status = 'sold')::integer,
    count(DISTINCT held_ticket.tour_id) > 1,
    min(held_ticket.created_at),
    COALESCE(sum(held_ticket.price), 0),
    max(held_ticket.ticket_issue_status)
  INTO
    total_count,
    owned_count,
    pending_count,
    sold_count,
    mixed_tours,
    earliest_created_at,
    current_total,
    current_issue_status
  FROM public.ticket AS held_ticket
  WHERE held_ticket.order_id = p_order_id;

  IF total_count = 0 THEN
    RETURN QUERY SELECT 'not_found', 0, 0::numeric, NULL::text;
    RETURN;
  END IF;

  IF owned_count = 0 THEN
    RETURN QUERY SELECT 'forbidden', 0, 0::numeric, NULL::text;
    RETURN;
  END IF;

  IF owned_count <> total_count OR mixed_tours THEN
    RETURN QUERY SELECT 'conflict', total_count, current_total, current_issue_status;
    RETURN;
  END IF;

  IF sold_count = total_count THEN
    RETURN QUERY SELECT 'already_paid', total_count, current_total, current_issue_status;
    RETURN;
  END IF;

  IF pending_count <> total_count THEN
    RETURN QUERY SELECT 'conflict', total_count, current_total, current_issue_status;
    RETURN;
  END IF;

  IF earliest_created_at <= now() - interval '10 minutes' THEN
    UPDATE public.ticket
    SET ticket_status = 'expired'
    WHERE order_id = p_order_id
      AND user_id = p_user_id
      AND ticket_status = 'pending';

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count <> total_count THEN
      RAISE EXCEPTION 'The ticket order changed while it was expiring';
    END IF;

    RETURN QUERY SELECT 'expired', total_count, current_total, NULL::text;
    RETURN;
  END IF;

  UPDATE public.ticket
  SET
    ticket_status = 'sold',
    payment_method = p_payment_method,
    payment_at = now(),
    ticket_issue_status = 'pending_issue'
  WHERE order_id = p_order_id
    AND user_id = p_user_id
    AND ticket_status = 'pending'
    AND created_at > now() - interval '10 minutes';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> total_count THEN
    RAISE EXCEPTION 'The ticket order changed while payment was being confirmed';
  END IF;

  RETURN QUERY SELECT 'paid', total_count, current_total, 'pending_issue'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_ticket_payment(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_ticket_payment(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.close_ticket_order(
  p_order_id uuid,
  p_user_id uuid,
  p_status text
)
RETURNS TABLE (result text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  total_count integer;
  owned_count integer;
  pending_count integer;
  target_count integer;
  earliest_created_at timestamptz;
  updated_count integer;
BEGIN
  IF p_status NOT IN ('cancelled', 'expired') THEN
    RAISE EXCEPTION 'Invalid ticket order status';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));

  PERFORM 1
  FROM public.ticket AS held_ticket
  WHERE held_ticket.order_id = p_order_id
  ORDER BY held_ticket.id
  FOR UPDATE;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE held_ticket.user_id = p_user_id)::integer,
    count(*) FILTER (WHERE held_ticket.ticket_status = 'pending')::integer,
    count(*) FILTER (WHERE held_ticket.ticket_status = p_status)::integer,
    min(held_ticket.created_at)
  INTO total_count, owned_count, pending_count, target_count, earliest_created_at
  FROM public.ticket AS held_ticket
  WHERE held_ticket.order_id = p_order_id;

  IF total_count = 0 THEN
    RETURN QUERY SELECT 'not_found';
    RETURN;
  END IF;

  IF owned_count = 0 THEN
    RETURN QUERY SELECT 'forbidden';
    RETURN;
  END IF;

  IF owned_count <> total_count THEN
    RETURN QUERY SELECT 'conflict';
    RETURN;
  END IF;

  IF target_count = total_count THEN
    RETURN QUERY SELECT p_status;
    RETURN;
  END IF;

  IF pending_count <> total_count THEN
    RETURN QUERY SELECT 'conflict';
    RETURN;
  END IF;

  IF p_status = 'expired'
     AND earliest_created_at > now() - interval '10 minutes' THEN
    RETURN QUERY SELECT 'pending';
    RETURN;
  END IF;

  UPDATE public.ticket
  SET ticket_status = p_status
  WHERE order_id = p_order_id
    AND user_id = p_user_id
    AND ticket_status = 'pending';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> total_count THEN
    RAISE EXCEPTION 'The ticket order changed while it was being closed';
  END IF;

  RETURN QUERY SELECT p_status;
END;
$$;

REVOKE ALL ON FUNCTION public.close_ticket_order(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_ticket_order(uuid, uuid, text) TO service_role;

-- Hoàn tác thủ công: gỡ RPC/trigger/cột mới và khôi phục policy + validate_ticket_update
-- từ migration 20261101130000_preserve_ticket_status_history.sql.
-- Cảnh báo: policy cũ cho phép client tự đổi vé sang sold; chỉ rollback khi đã chấp nhận rủi ro này.
-- DROP FUNCTION public.confirm_ticket_payment(uuid, uuid, text);
-- DROP FUNCTION public.close_ticket_order(uuid, uuid, text);
-- DROP TRIGGER ticket_authoritative_fields_before_insert ON public.ticket;
-- DROP FUNCTION public.set_authoritative_ticket_fields();
-- DROP POLICY "Users update own pending tickets" ON public.ticket;
-- CREATE POLICY "Users update own tickets" ON public.ticket FOR UPDATE TO authenticated
--   USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- CREATE OR REPLACE FUNCTION public.validate_ticket_update()
-- RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $rollback$
-- BEGIN
--   IF NEW.user_id IS DISTINCT FROM OLD.user_id
--      OR NEW.tour_id IS DISTINCT FROM OLD.tour_id
--      OR NEW.price IS DISTINCT FROM OLD.price
--      OR NEW.pickup_location IS DISTINCT FROM OLD.pickup_location
--      OR NEW.passengers IS DISTINCT FROM OLD.passengers
--      OR NEW.seat_numbers IS DISTINCT FROM OLD.seat_numbers
--      OR NEW.travel_date IS DISTINCT FROM OLD.travel_date
--      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
--     RAISE EXCEPTION 'Ticket booking details cannot be changed';
--   END IF;
--   IF OLD.ticket_status <> 'pending'
--      OR NEW.ticket_status NOT IN ('sold', 'expired', 'cancelled') THEN
--     RAISE EXCEPTION 'Only pending tickets can be completed or closed';
--   END IF;
--   IF NEW.ticket_status = 'sold' AND NEW.payment_method IS NULL THEN
--     RAISE EXCEPTION 'A payment method is required to complete the ticket';
--   END IF;
--   RETURN NEW;
-- END;
-- $rollback$;
-- REVOKE ALL ON FUNCTION public.validate_ticket_update() FROM PUBLIC, anon, authenticated;
-- DROP INDEX IF EXISTS public.ticket_order_id_idx;
-- ALTER TABLE public.ticket DROP CONSTRAINT ticket_addons_array_check,
--   DROP CONSTRAINT ticket_issue_status_check, DROP COLUMN order_id,
--   DROP COLUMN payment_at, DROP COLUMN ticket_issue_status, DROP COLUMN addons;
