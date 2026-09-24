CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'user');
CREATE TYPE public.app_permission AS ENUM ('admin_dashboard');

ALTER TABLE public.profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission public.app_permission NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);
GRANT SELECT, INSERT, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_admin_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_active FROM public.profiles WHERE id = _user_id), false)
    AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
      OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND permission = 'admin_dashboard')
    )
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_admin_access(auth.uid()));
CREATE POLICY "Admins add roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_admin_access(auth.uid()));
CREATE POLICY "Admins remove roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_admin_access(auth.uid()));

CREATE POLICY "Users view own permissions" ON public.user_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all permissions" ON public.user_permissions FOR SELECT TO authenticated USING (public.has_admin_access(auth.uid()));
CREATE POLICY "Admins add permissions" ON public.user_permissions FOR INSERT TO authenticated WITH CHECK (public.has_admin_access(auth.uid()));
CREATE POLICY "Admins remove permissions" ON public.user_permissions FOR DELETE TO authenticated USING (public.has_admin_access(auth.uid()));

CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_admin_access(auth.uid()));
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_admin_access(auth.uid())) WITH CHECK (public.has_admin_access(auth.uid()));

-- Prevent regular users from changing their own is_active flag
CREATE OR REPLACE FUNCTION public.protect_profile_active()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active
     AND auth.uid() IS NOT NULL
     AND NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to change account status';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_protect_active BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_active();