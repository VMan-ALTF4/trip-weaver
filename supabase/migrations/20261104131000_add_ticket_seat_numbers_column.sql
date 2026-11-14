ALTER TABLE public.ticket
  ADD COLUMN IF NOT EXISTS seat_numbers text[] NOT NULL DEFAULT '{}'::text[];

NOTIFY pgrst, 'reload schema';
