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

  SELECT tour.price::numeric, tour.travel_date::date
  INTO tour_price, tour_travel_date
  FROM public."Tour" AS tour
  WHERE tour.tour_id::text = NEW.tour_id::text;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This tour is unavailable';
  END IF;

  NEW.travel_date := COALESCE(NEW.travel_date, tour_travel_date);

  IF NEW.travel_date IS NULL
     OR NEW.travel_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RAISE EXCEPTION 'This departure date is unavailable';
  END IF;

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

  NEW.ticket_status := 'pending';
  NEW.price := tour_price;
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
