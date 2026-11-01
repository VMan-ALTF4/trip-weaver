CREATE TABLE IF NOT EXISTS public.ticket (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_status text NOT NULL DEFAULT 'pending'
    CHECK (ticket_status IN ('pending', 'sold', 'cancelled')),
  pickup_location text,
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  passengers integer NOT NULL DEFAULT 1 CHECK (passengers > 0),
  seat_numbers text[] NOT NULL DEFAULT '{}',
  travel_date date,
  payment_method text CHECK (
    payment_method IS NULL OR payment_method IN ('vnpay', 'momo', 'card', 'bank_transfer')
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_user_created_at_idx
  ON public.ticket (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ticket_pending_created_at_idx
  ON public.ticket (created_at)
  WHERE ticket_status = 'pending';

ALTER TABLE public.ticket ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ticket FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket TO authenticated;

DROP POLICY IF EXISTS "Users read own tickets" ON public.ticket;
CREATE POLICY "Users read own tickets"
  ON public.ticket FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users create own pending tickets" ON public.ticket;
CREATE POLICY "Users create own pending tickets"
  ON public.ticket FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND ticket_status = 'pending');

DROP POLICY IF EXISTS "Users update own tickets" ON public.ticket;
CREATE POLICY "Users update own tickets"
  ON public.ticket FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own pending tickets" ON public.ticket;
CREATE POLICY "Users delete own pending tickets"
  ON public.ticket FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND ticket_status = 'pending');

CREATE OR REPLACE FUNCTION public.reserve_tour_slot_for_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reserved_tour_id text;
BEGIN
  NEW.created_at := now();

  IF NEW.ticket_status = 'pending' THEN
    UPDATE public."Tour"
    SET available_slot = available_slot - 1
    WHERE tour_id::text = NEW.tour_id
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

DROP TRIGGER IF EXISTS reserve_tour_slot_before_ticket_insert ON public.ticket;
CREATE TRIGGER reserve_tour_slot_before_ticket_insert
  BEFORE INSERT ON public.ticket
  FOR EACH ROW
  EXECUTE FUNCTION public.reserve_tour_slot_for_ticket();
REVOKE ALL ON FUNCTION public.reserve_tour_slot_for_ticket() FROM PUBLIC, anon, authenticated;

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
     OR NEW.ticket_status NOT IN ('sold', 'cancelled') THEN
    RAISE EXCEPTION 'Only pending tickets can be completed or cancelled';
  END IF;

  IF NEW.ticket_status = 'sold'
     AND NEW.payment_method IS NULL THEN
    RAISE EXCEPTION 'A payment method is required to complete the ticket';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_ticket_update_before_update ON public.ticket;
CREATE TRIGGER validate_ticket_update_before_update
  BEFORE UPDATE ON public.ticket
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ticket_update();
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

  IF OLD.ticket_status = 'pending' AND NEW.ticket_status = 'cancelled' THEN
    UPDATE public."Tour"
    SET available_slot = available_slot + 1
    WHERE tour_id::text = OLD.tour_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS release_tour_slot_after_ticket_change ON public.ticket;
CREATE TRIGGER release_tour_slot_after_ticket_change
  AFTER DELETE OR UPDATE ON public.ticket
  FOR EACH ROW
  EXECUTE FUNCTION public.release_tour_slot_for_ticket();
REVOKE ALL ON FUNCTION public.release_tour_slot_for_ticket() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'expire-pending-tickets';

  PERFORM cron.schedule(
    'expire-pending-tickets',
    '* * * * *',
    $job$
      DELETE FROM public.ticket
      WHERE ticket_status = 'pending'
        AND created_at <= now() - interval '10 minutes';
    $job$
  );
END;
$$;
