-- Fix: handle_new_user failed on signup with 'relation "profiles" does not exist'
-- (SQLSTATE 42P01) because the function had a mutable search_path, so GoTrue's
-- connection could not resolve the public schema. Pin search_path and fully
-- qualify table names. Also harden auth_user_org_id (used by all RLS policies).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'organization_admin')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_org_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;
