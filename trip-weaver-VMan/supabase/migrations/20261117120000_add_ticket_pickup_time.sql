ALTER TABLE public.ticket
  ADD COLUMN IF NOT EXISTS pickup_time text;

UPDATE public.eticket AS eticket
SET pickup_time = ticket.pickup_time
FROM public.ticket AS ticket
WHERE eticket.ticket_id = ticket.id
  AND eticket.pickup_time IS NULL;

CREATE OR REPLACE FUNCTION public.sync_eticket_pickup_time()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  ticket_pickup_time text;
BEGIN
  SELECT ticket.pickup_time
  INTO ticket_pickup_time
  FROM public.ticket AS ticket
  WHERE ticket.id = NEW.ticket_id;

  NEW.pickup_time := ticket_pickup_time;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_eticket_pickup_time_before_insert ON public.eticket;
CREATE TRIGGER sync_eticket_pickup_time_before_insert
  BEFORE INSERT ON public.eticket
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_eticket_pickup_time();

CREATE OR REPLACE FUNCTION public.prevent_ticket_pickup_time_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.pickup_time IS DISTINCT FROM OLD.pickup_time THEN
    RAISE EXCEPTION 'Ticket booking details cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_ticket_pickup_time_change ON public.ticket;
CREATE TRIGGER prevent_ticket_pickup_time_change
  BEFORE UPDATE ON public.ticket
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ticket_pickup_time_change();

NOTIFY pgrst, 'reload schema';
