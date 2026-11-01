-- Keep profile-management permissions aligned with the role stored on profiles.
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Managers view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.current_profile_role() IN ('admin', 'moderator'));

DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Managers update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.current_profile_role() IN ('admin', 'moderator')
    OR auth.uid() = id
  )
  WITH CHECK (
    public.current_profile_role() IN ('admin', 'moderator')
    OR auth.uid() = id
  );

CREATE OR REPLACE FUNCTION public.protect_profile_access_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
BEGIN
  actor_role := public.current_profile_role();

  IF auth.uid() IS NOT NULL AND actor_role IS DISTINCT FROM 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Only admins can change profile roles';
    END IF;

    IF actor_role IS DISTINCT FROM 'moderator' AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only admins and moderators can change profile status';
    END IF;

    IF actor_role = 'moderator' AND (
      NEW.name IS DISTINCT FROM OLD.name
      OR NEW.full_name IS DISTINCT FROM OLD.full_name
      OR NEW.email IS DISTINCT FROM OLD.email
    ) THEN
      RAISE EXCEPTION 'Moderators can only change profile status and phone';
    END IF;

    IF actor_role IS DISTINCT FROM 'moderator' AND (
      NEW.name IS DISTINCT FROM OLD.name
      OR NEW.full_name IS DISTINCT FROM OLD.full_name
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.id IS DISTINCT FROM auth.uid()
    ) THEN
      RAISE EXCEPTION 'Users can only change their own phone';
    END IF;

    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Only admins can change account status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;