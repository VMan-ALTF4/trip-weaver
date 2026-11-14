CREATE OR REPLACE FUNCTION public.reserve_tour_slot_for_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reserved_tour_id text;
BEGIN
  NEW.created_at := now();

  IF NEW.ticket_status = 'pending' THEN
    UPDATE public."Tour"
    SET available_slot = available_slot - 1
    WHERE tour_id::text = NEW.tour_id::text
      AND available_slot > 0
    RETURNING tour_id::text INTO reserved_tour_id;

    IF reserved_tour_id IS NULL THEN
      RAISE EXCEPTION 'This tour is sold out or unavailable'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_tour_slot_for_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.ticket_status = 'pending' THEN
      UPDATE public."Tour"
      SET available_slot = available_slot + 1
      WHERE tour_id::text = OLD.tour_id::text;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.ticket_status = 'pending'
     AND NEW.ticket_status IN ('expired', 'cancelled') THEN
    UPDATE public."Tour"
    SET available_slot = available_slot + 1
    WHERE tour_id::text = OLD.tour_id::text;
  END IF;
  RETURN NEW;
END;
$$;

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
        OR existing.tour_id::text IS DISTINCT FROM NEW.tour_id::text
        OR existing.travel_date IS DISTINCT FROM NEW.travel_date
        OR existing.ticket_status <> 'pending'
      )
  ) THEN
    RAISE EXCEPTION 'This order is closed or its booking details do not match';
  END IF;

  SELECT tour.price::numeric, tour.travel_date::date
  INTO tour_price, tour_travel_date
  FROM public."Tour" AS tour
  WHERE tour.tour_id::text = NEW.tour_id::text;

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

DROP POLICY IF EXISTS "Users can view tours in their bookings" ON public."Tour";
CREATE POLICY "Users can view tours in their bookings"
  ON public."Tour"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ticket
      WHERE ticket.tour_id::text = "Tour".tour_id::text
        AND ticket.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
