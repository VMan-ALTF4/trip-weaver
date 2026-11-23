DO $$
DECLARE
  ticket_user_type regtype;
BEGIN
  SELECT attribute.atttypid::regtype
  INTO ticket_user_type
  FROM pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.ticket'::regclass
    AND attribute.attname = 'user_id'
    AND NOT attribute.attisdropped;

  IF ticket_user_type IS DISTINCT FROM 'uuid'::regtype THEN
    RAISE EXCEPTION
      'Expected public.ticket.user_id to be uuid, found %',
      COALESCE(ticket_user_type::text, 'missing column');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ticket AS ticket
    LEFT JOIN auth.users AS auth_user ON auth_user.id = ticket.user_id
    WHERE auth_user.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot repair ticket_user_id_fkey: ticket rows reference users missing from auth.users. No rows were changed.';
  END IF;

  ALTER TABLE public.ticket
    DROP CONSTRAINT IF EXISTS ticket_user_id_fkey;

  ALTER TABLE public.ticket
    ADD CONSTRAINT ticket_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON DELETE CASCADE;
END;
$$;

NOTIFY pgrst, 'reload schema';
