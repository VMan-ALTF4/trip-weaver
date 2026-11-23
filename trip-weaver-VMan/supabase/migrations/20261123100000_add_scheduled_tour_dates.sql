ALTER TABLE public."Tour"
  ADD COLUMN IF NOT EXISTS travel_dates date[] NOT NULL DEFAULT '{}';

UPDATE public."Tour"
SET travel_dates = ARRAY[travel_date::date]
WHERE cardinality(travel_dates) = 0
  AND travel_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_authoritative_ticket_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tour_price numeric;
  tour_travel_date date;
  tour_travel_dates date[];
BEGIN
  IF NEW.order_id IS NULL THEN
    RAISE EXCEPTION 'An order ID is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.order_id::text, 0));

  SELECT tour.price::numeric, tour.travel_date::date, tour.travel_dates
  INTO tour_price, tour_travel_date, tour_travel_dates
  FROM public."Tour" AS tour
  WHERE tour.tour_id::text = NEW.tour_id::text;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This tour is unavailable';
  END IF;

  NEW.travel_date := COALESCE(NEW.travel_date, tour_travel_dates[1], tour_travel_date);

  IF NEW.travel_date IS NULL
     OR (cardinality(tour_travel_dates) > 0 AND NOT NEW.travel_date = ANY(tour_travel_dates))
     OR (cardinality(tour_travel_dates) = 0 AND NEW.travel_date IS DISTINCT FROM tour_travel_date)
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

REVOKE ALL ON FUNCTION public.set_authoritative_ticket_fields() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'close-expired-tours';

  PERFORM cron.schedule(
    'close-expired-tours',
    '0 * * * *',
    $job$
      UPDATE public."Tour"
      SET status_tour = 'tạm đóng'
      WHERE cardinality(travel_dates) > 0
        AND NOT EXISTS (
          SELECT 1
          FROM unnest(travel_dates) AS dates(departure_date)
          WHERE departure_date >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
        )
        AND (
          status_tour IS NULL
          OR lower(btrim(status_tour::text)) IN ('còn bán', 'đang hoạt động', 'active')
        );
    $job$
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
