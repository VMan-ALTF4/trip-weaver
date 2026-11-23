ALTER TABLE public.ticket
  ADD COLUMN IF NOT EXISTS pickup_time text;

CREATE OR REPLACE FUNCTION public.ensure_cancelled_eticket_code(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  source_ticket public.ticket%ROWTYPE;
  source_tour_name text;
  source_travel_date date;
  source_holder_name text;
  generated_code text;
  code_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  inserted_eticket_id uuid;
  attempt integer;
  character_index integer;
BEGIN
  SELECT ticket.*
  INTO source_ticket
  FROM public.ticket AS ticket
  WHERE ticket.id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND OR source_ticket.ticket_status <> 'cancelled' THEN
    RETURN;
  END IF;

  UPDATE public.eticket
  SET status = 'cancelled'
  WHERE ticket_id = source_ticket.id
    AND status <> 'cancelled';

  IF FOUND OR EXISTS (
    SELECT 1
    FROM public.eticket AS existing
    WHERE existing.ticket_id = source_ticket.id
  ) THEN
    RETURN;
  END IF;

  SELECT
    NULLIF(btrim(tour.tour_name::text), ''),
    COALESCE(source_ticket.travel_date, tour.travel_date::date)
  INTO source_tour_name, source_travel_date
  FROM public."Tour" AS tour
  WHERE tour.tour_id::text = source_ticket.tour_id::text;

  source_tour_name := COALESCE(source_tour_name, 'Tour booking');
  source_travel_date := COALESCE(source_travel_date, source_ticket.travel_date, CURRENT_DATE);

  SELECT COALESCE(
    NULLIF(btrim(profile.name), ''),
    NULLIF(btrim(profile.email), '')
  )
  INTO source_holder_name
  FROM public.profiles AS profile
  WHERE profile.id = source_ticket.user_id;

  FOR attempt IN 1..20 LOOP
    generated_code := 'TAT-';
    FOR character_index IN 1..6 LOOP
      generated_code := generated_code || substr(
        code_alphabet,
        floor(random() * length(code_alphabet))::integer + 1,
        1
      );
    END LOOP;

    INSERT INTO public.eticket (
      ticket_id,
      user_id,
      ticket_code,
      status,
      tour_name,
      travel_date,
      pickup_location,
      pickup_time,
      seat_no,
      holder_name,
      expires_at
    )
    VALUES (
      source_ticket.id,
      source_ticket.user_id,
      generated_code,
      'cancelled',
      source_tour_name,
      source_travel_date,
      source_ticket.pickup_location,
      source_ticket.pickup_time,
      source_ticket.seat_numbers[1],
      source_holder_name,
      (source_travel_date + 2)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'
    )
    ON CONFLICT DO NOTHING
    RETURNING id
    INTO inserted_eticket_id;

    IF FOUND THEN
      RETURN;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.eticket AS existing
      WHERE existing.ticket_id = source_ticket.id
    ) THEN
      RETURN;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'Could not generate a unique e-ticket code for cancelled ticket %', p_ticket_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_cancelled_eticket_code_after_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.ensure_cancelled_eticket_code(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_cancelled_eticket_code(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_cancelled_eticket_code_after_status_update()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ticket_create_cancelled_eticket_code_after_status_update ON public.ticket;
CREATE TRIGGER ticket_create_cancelled_eticket_code_after_status_update
  AFTER UPDATE OF ticket_status ON public.ticket
  FOR EACH ROW
  WHEN (OLD.ticket_status IS DISTINCT FROM NEW.ticket_status AND NEW.ticket_status = 'cancelled')
  EXECUTE FUNCTION public.create_cancelled_eticket_code_after_status_update();

DO $$
DECLARE
  cancelled_ticket record;
BEGIN
  FOR cancelled_ticket IN
    SELECT ticket.id
    FROM public.ticket AS ticket
    WHERE ticket.ticket_status = 'cancelled'
  LOOP
    PERFORM public.ensure_cancelled_eticket_code(cancelled_ticket.id);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
