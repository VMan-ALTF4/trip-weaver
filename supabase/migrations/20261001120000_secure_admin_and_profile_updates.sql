CREATE OR REPLACE FUNCTION public.has_admin_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT is_active AND role = 'admin'
      FROM public.profiles
      WHERE id = _user_id
    ),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_access_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  actor_role := public.current_profile_role();

  IF actor_role IS DISTINCT FROM 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Only admins can change profile roles or account status';
    END IF;

    IF actor_role IS DISTINCT FROM 'moderator' AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only admins and moderators can change profile status';
    END IF;

    IF actor_role = 'moderator' AND (
      NEW.name IS DISTINCT FROM OLD.name
      OR NEW.full_name IS DISTINCT FROM OLD.full_name
      OR NEW.email IS DISTINCT FROM OLD.email
    ) THEN
      RAISE EXCEPTION 'Moderators cannot change profile name or email';
    END IF;

    IF NEW.email IS DISTINCT FROM OLD.email
       AND NEW.email IS DISTINCT FROM (
         SELECT email FROM auth.users WHERE id = NEW.id
       ) THEN
      RAISE EXCEPTION 'Email can only be changed through Supabase Auth verification';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_auth_email_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET email = NEW.email, updated_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_auth_email_to_profile();

DO $$
DECLARE
  policy_name text;
BEGIN
  IF to_regclass('public."Tour"') IS NOT NULL THEN
    ALTER TABLE public."Tour" ENABLE ROW LEVEL SECURITY;
    FOR policy_name IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'Tour'
    LOOP
      EXECUTE format('DROP POLICY %I ON public."Tour"', policy_name);
    END LOOP;

    GRANT SELECT ON public."Tour" TO anon, authenticated;
    GRANT INSERT, UPDATE, DELETE ON public."Tour" TO authenticated;

    CREATE POLICY "Public can view available tours"
      ON public."Tour"
      FOR SELECT
      TO anon, authenticated
      USING (
        status_tour IS NULL
        OR lower(btrim(status_tour::text)) IN ('còn bán', 'đang hoạt động', 'active')
      );

    CREATE POLICY "Admins manage tours"
      ON public."Tour"
      FOR ALL
      TO authenticated
      USING (public.has_admin_access(auth.uid()))
      WITH CHECK (public.has_admin_access(auth.uid()));
  END IF;

  IF to_regclass('public."Vehicle"') IS NOT NULL THEN
    ALTER TABLE public."Vehicle" ENABLE ROW LEVEL SECURITY;
    FOR policy_name IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'Vehicle'
    LOOP
      EXECUTE format('DROP POLICY %I ON public."Vehicle"', policy_name);
    END LOOP;

    GRANT SELECT, INSERT, UPDATE, DELETE ON public."Vehicle" TO authenticated;

    CREATE POLICY "Admins manage vehicles"
      ON public."Vehicle"
      FOR ALL
      TO authenticated
      USING (public.has_admin_access(auth.uid()))
      WITH CHECK (public.has_admin_access(auth.uid()));
  END IF;
END;
$$;