ALTER TABLE public.ticket
  DROP CONSTRAINT IF EXISTS ticket_ticket_status_check;

ALTER TABLE public.ticket
  ADD CONSTRAINT ticket_ticket_status_check
  CHECK (ticket_status IN ('pending', 'sold', 'expired', 'cancelled'));

DROP POLICY IF EXISTS "Users delete own pending tickets" ON public.ticket;
REVOKE DELETE ON public.ticket FROM authenticated;

DROP POLICY IF EXISTS "Users can view tours in their bookings" ON public."Tour";
CREATE POLICY "Users can view tours in their bookings"
  ON public."Tour"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ticket
      WHERE ticket.tour_id = "Tour".tour_id::text
        AND ticket.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.validate_ticket_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.tour_id IS DISTINCT FROM OLD.tour_id
     OR NEW.price IS DISTINCT FROM OLD.price
     OR NEW.pickup_location IS DISTINCT FROM OLD.pickup_location
     OR NEW.passengers IS DISTINCT FROM OLD.passengers
     OR NEW.seat_numbers IS DISTINCT FROM OLD.seat_numbers
     OR NEW.travel_date IS DISTINCT FROM OLD.travel_date
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Ticket booking details cannot be changed';
  END IF;

  IF OLD.ticket_status <> 'pending'
     OR NEW.ticket_status NOT IN ('sold', 'expired', 'cancelled') THEN
    RAISE EXCEPTION 'Only pending tickets can be completed or closed';
  END IF;

  IF NEW.ticket_status = 'sold'
     AND NEW.payment_method IS NULL THEN
    RAISE EXCEPTION 'A payment method is required to complete the ticket';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_ticket_update() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.release_tour_slot_for_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.ticket_status = 'pending' THEN
      UPDATE public."Tour"
      SET available_slot = available_slot + 1
      WHERE tour_id::text = OLD.tour_id;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.ticket_status = 'pending'
     AND NEW.ticket_status IN ('expired', 'cancelled') THEN
    UPDATE public."Tour"
    SET available_slot = available_slot + 1
    WHERE tour_id::text = OLD.tour_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.release_tour_slot_for_ticket() FROM PUBLIC, anon, authenticated;

UPDATE public.ticket
SET ticket_status = 'expired'
WHERE ticket_status = 'pending'
  AND created_at <= now() - interval '10 minutes';

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'expire-pending-tickets';

  PERFORM cron.schedule(
    'expire-pending-tickets',
    '* * * * *',
    $job$
      UPDATE public.ticket
      SET ticket_status = 'expired'
      WHERE ticket_status = 'pending'
        AND created_at <= now() - interval '10 minutes';
    $job$
  );
END;
$$;
