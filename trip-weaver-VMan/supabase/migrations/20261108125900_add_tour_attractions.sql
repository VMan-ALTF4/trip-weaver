ALTER TABLE public."Tour"
  ADD COLUMN IF NOT EXISTS attractions jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public."Tour"
SET attractions = '[]'::jsonb
WHERE attractions IS NULL;

ALTER TABLE public."Tour"
  ALTER COLUMN attractions SET DEFAULT '[]'::jsonb,
  ALTER COLUMN attractions SET NOT NULL;
