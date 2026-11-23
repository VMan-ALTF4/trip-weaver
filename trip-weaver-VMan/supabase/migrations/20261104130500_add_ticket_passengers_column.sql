ALTER TABLE public.ticket
  ADD COLUMN IF NOT EXISTS passengers integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ticket'::regclass
      AND conname = 'ticket_passengers_positive_check'
  ) THEN
    ALTER TABLE public.ticket
      ADD CONSTRAINT ticket_passengers_positive_check
      CHECK (passengers > 0);
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
