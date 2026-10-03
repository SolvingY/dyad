CREATE POLICY profiles_admin_select
ON public.profiles FOR SELECT TO authenticated
USING (private.has_role((SELECT auth.uid()), 'admin'));