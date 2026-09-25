-- Persist the signup name in the profiles.name column.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_name text;
BEGIN
  profile_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    NEW.email
  );

  INSERT INTO public.profiles (id, name, email, role, status)
  VALUES (NEW.id, profile_name, NEW.email, 'guest', 'active')
  ON CONFLICT (id) DO UPDATE
  SET name = COALESCE(public.profiles.name, EXCLUDED.name),
      email = COALESCE(public.profiles.email, EXCLUDED.email),
      updated_at = now();

  RETURN NEW;
END;
$$;