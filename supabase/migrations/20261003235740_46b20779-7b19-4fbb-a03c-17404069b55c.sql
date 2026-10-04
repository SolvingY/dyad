CREATE TABLE public.oura_heartrate (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL,
  bpm integer NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ts)
);
GRANT SELECT ON public.oura_heartrate TO authenticated;
GRANT ALL ON public.oura_heartrate TO service_role;
GRANT USAGE ON SEQUENCE public.oura_heartrate_id_seq TO service_role;
ALTER TABLE public.oura_heartrate ENABLE ROW LEVEL SECURITY;
CREATE POLICY oura_heartrate_select_own ON public.oura_heartrate FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) AND private.is_approved((select auth.uid())));

CREATE TABLE public.oura_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  oura_id text NOT NULL UNIQUE,
  day date NOT NULL,
  activity text,
  start_at timestamptz,
  end_at timestamptz,
  calories numeric,
  intensity text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.oura_workouts TO authenticated;
GRANT ALL ON public.oura_workouts TO service_role;
ALTER TABLE public.oura_workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY oura_workouts_select_own ON public.oura_workouts FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) AND private.is_approved((select auth.uid())));

CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  threshold numeric,
  frequency_minutes integer NOT NULL DEFAULT 180,
  quiet_start smallint,
  quiet_end smallint,
  last_fired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY reminders_own ON public.reminders FOR ALL TO authenticated
  USING (user_id = (select auth.uid()) AND private.is_approved((select auth.uid())))
  WITH CHECK (user_id = (select auth.uid()) AND private.is_approved((select auth.uid())));
CREATE TRIGGER reminders_set_updated_at BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_kind text,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) AND private.is_approved((select auth.uid())));
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY notifications_delete_own ON public.notifications FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));
CREATE INDEX notifications_user_created ON public.notifications (user_id, created_at DESC);

GRANT DELETE ON public.thread_messages TO authenticated;
CREATE POLICY thread_messages_delete_own ON public.thread_messages FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()) AND private.is_approved((select auth.uid())));