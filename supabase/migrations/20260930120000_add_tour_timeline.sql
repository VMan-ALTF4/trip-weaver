alter table if exists public."Tour"
  add column if not exists timeline jsonb;