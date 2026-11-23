-- Allow paypal in ticket payment method constraint
ALTER TABLE public.ticket
  DROP CONSTRAINT IF EXISTS ticket_payment_method_check;

ALTER TABLE public.ticket
  ADD CONSTRAINT ticket_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method IN ('vnpay', 'momo', 'card', 'bank_transfer', 'paypal')
  );

-- Update confirm_ticket_payment RPC to accept paypal
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
  IF p_payment_method NOT IN ('vnpay', 'momo', 'card', 'bank_transfer', 'paypal') THEN
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
