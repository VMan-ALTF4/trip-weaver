ALTER TABLE public.profiles
  ADD COLUMN name text,
  ADD COLUMN role text NOT NULL DEFAULT 'guest',
  ADD COLUMN status text NOT NULL DEFAULT 'active',
  ADD COLUMN sdt text;

UPDATE public.profiles
SET name = COALESCE(name, full_name, email),
    role = COALESCE(role, 'guest'),
    status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
WHERE name IS NULL OR role IS NULL OR status IS NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'moderator', 'guest'));

CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profiles_updated_at();

CREATE OR REPLACE FUNCTION public.protect_profile_access_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_admin_access(auth.uid()) THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Not allowed to change profile access fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_active ON public.profiles;
CREATE TRIGGER profiles_protect_access_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_access_fields();

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
    NEW.email
  );

  INSERT INTO public.profiles (id, name, full_name, email, role, status)
  VALUES (NEW.id, profile_name, profile_name, NEW.email, 'guest', 'active')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;