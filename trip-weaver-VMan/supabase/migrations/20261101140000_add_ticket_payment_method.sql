ALTER TABLE public.ticket
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public.ticket
  DROP CONSTRAINT IF EXISTS ticket_payment_method_check;

ALTER TABLE public.ticket
  ADD CONSTRAINT ticket_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method IN ('vnpay', 'momo', 'card', 'bank_transfer')
  );
