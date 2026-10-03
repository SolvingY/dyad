CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_approvals
    WHERE user_id = _user_id AND status = 'approved'
  );
$$;
REVOKE ALL ON FUNCTION private.is_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_approved(uuid) TO authenticated, service_role;

DROP POLICY account_approvals_admin_select ON public.account_approvals;
DROP POLICY account_approvals_admin_update ON public.account_approvals;
CREATE POLICY account_approvals_admin_select
ON public.account_approvals FOR SELECT TO authenticated
USING (private.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY account_approvals_admin_update
ON public.account_approvals FOR UPDATE TO authenticated
USING (private.has_role((SELECT auth.uid()), 'admin'))
WITH CHECK (private.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY user_roles_admin_select ON public.user_roles;
CREATE POLICY user_roles_admin_select
ON public.user_roles FOR SELECT TO authenticated
USING (private.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY agents_select_own ON public.agents;
DROP POLICY agents_insert_own ON public.agents;
DROP POLICY agents_update_own ON public.agents;
CREATE POLICY agents_select_own ON public.agents FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND private.is_approved((SELECT auth.uid())));
CREATE POLICY agents_insert_own ON public.agents FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()) AND private.is_approved((SELECT auth.uid())));
CREATE POLICY agents_update_own ON public.agents FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()) AND private.is_approved((SELECT auth.uid())))
WITH CHECK (user_id = (SELECT auth.uid()) AND private.is_approved((SELECT auth.uid())));

DROP POLICY agent_daily_select_own ON public.agent_daily;
CREATE POLICY agent_daily_select_own ON public.agent_daily FOR SELECT TO authenticated
USING (private.is_approved((SELECT auth.uid())) AND EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_daily.agent_id AND a.user_id = (SELECT auth.uid())));

DROP POLICY agent_events_select_own ON public.agent_events;
DROP POLICY agent_events_update_own ON public.agent_events;
CREATE POLICY agent_events_select_own ON public.agent_events FOR SELECT TO authenticated
USING (private.is_approved((SELECT auth.uid())) AND EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_events.agent_id AND a.user_id = (SELECT auth.uid())));
CREATE POLICY agent_events_update_own ON public.agent_events FOR UPDATE TO authenticated
USING (private.is_approved((SELECT auth.uid())) AND EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_events.agent_id AND a.user_id = (SELECT auth.uid())))
WITH CHECK (private.is_approved((SELECT auth.uid())) AND EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_events.agent_id AND a.user_id = (SELECT auth.uid())));

DROP POLICY agent_keys_select_own ON public.agent_keys;
CREATE POLICY agent_keys_select_own ON public.agent_keys FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND private.is_approved((SELECT auth.uid())));

DROP POLICY checkins_select_own ON public.checkins;
CREATE POLICY checkins_select_own ON public.checkins FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND private.is_approved((SELECT auth.uid())));

DROP POLICY oura_daily_select_own ON public.oura_daily;
CREATE POLICY oura_daily_select_own ON public.oura_daily FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND private.is_approved((SELECT auth.uid())));

DROP POLICY thread_messages_select_own ON public.thread_messages;
CREATE POLICY thread_messages_select_own ON public.thread_messages FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND private.is_approved((SELECT auth.uid())));

DROP FUNCTION public.has_role(uuid, public.app_role);
DROP FUNCTION public.is_approved(uuid);