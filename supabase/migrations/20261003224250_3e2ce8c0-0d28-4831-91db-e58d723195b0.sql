CREATE TYPE public.account_approval_status AS ENUM ('pending', 'approved', 'denied');
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.account_approvals (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.account_approval_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.account_approvals TO authenticated;
GRANT ALL ON public.account_approvals TO service_role;
ALTER TABLE public.account_approvals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
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
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
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
REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated, service_role;

CREATE POLICY account_approvals_select_own
ON public.account_approvals FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY account_approvals_admin_select
ON public.account_approvals FOR SELECT TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY account_approvals_admin_update
ON public.account_approvals FOR UPDATE TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'))
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY user_roles_select_own
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY user_roles_admin_select
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE TRIGGER account_approvals_set_updated_at
BEFORE UPDATE ON public.account_approvals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.account_approvals (user_id, status, reviewed_at)
SELECT id, 'approved', now() FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'user'::public.app_role FROM public.profiles p
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = 'adam@solvingy.com' AND u.email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.account_approvals aa
SET status = 'approved', reviewed_at = now()
FROM auth.users u
WHERE aa.user_id = u.id
  AND lower(u.email) = 'adam@solvingy.com'
  AND u.email_confirmed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.account_approvals (user_id, status)
  VALUES (NEW.id, 'pending')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS agents_select_own ON public.agents;
DROP POLICY IF EXISTS agents_insert_own ON public.agents;
DROP POLICY IF EXISTS agents_update_own ON public.agents;
CREATE POLICY agents_select_own ON public.agents FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND public.is_approved((SELECT auth.uid())));
CREATE POLICY agents_insert_own ON public.agents FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_approved((SELECT auth.uid())));
CREATE POLICY agents_update_own ON public.agents FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()) AND public.is_approved((SELECT auth.uid())))
WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_approved((SELECT auth.uid())));

DROP POLICY IF EXISTS agent_daily_select_own ON public.agent_daily;
CREATE POLICY agent_daily_select_own ON public.agent_daily FOR SELECT TO authenticated
USING (public.is_approved((SELECT auth.uid())) AND EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_daily.agent_id AND a.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS agent_events_select_own ON public.agent_events;
DROP POLICY IF EXISTS agent_events_update_own ON public.agent_events;
CREATE POLICY agent_events_select_own ON public.agent_events FOR SELECT TO authenticated
USING (public.is_approved((SELECT auth.uid())) AND EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_events.agent_id AND a.user_id = (SELECT auth.uid())));
CREATE POLICY agent_events_update_own ON public.agent_events FOR UPDATE TO authenticated
USING (public.is_approved((SELECT auth.uid())) AND EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_events.agent_id AND a.user_id = (SELECT auth.uid())))
WITH CHECK (public.is_approved((SELECT auth.uid())) AND EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_events.agent_id AND a.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS agent_keys_select_own ON public.agent_keys;
CREATE POLICY agent_keys_select_own ON public.agent_keys FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND public.is_approved((SELECT auth.uid())));

DROP POLICY IF EXISTS checkins_select_own ON public.checkins;
CREATE POLICY checkins_select_own ON public.checkins FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND public.is_approved((SELECT auth.uid())));

DROP POLICY IF EXISTS oura_daily_select_own ON public.oura_daily;
CREATE POLICY oura_daily_select_own ON public.oura_daily FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND public.is_approved((SELECT auth.uid())));

DROP POLICY IF EXISTS thread_messages_select_own ON public.thread_messages;
CREATE POLICY thread_messages_select_own ON public.thread_messages FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND public.is_approved((SELECT auth.uid())));