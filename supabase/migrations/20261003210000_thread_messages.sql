-- One conversation between the human and their agent. Replaces the separate
-- insights, Ask Dyad and check-in cards. Rows are written only by the
-- dyad-thread and agent-checkin edge functions (service role).

CREATE TABLE IF NOT EXISTS public.thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  role text NOT NULL CHECK (role IN ('agent', 'human')),
  kind text NOT NULL CHECK (kind IN ('checkin', 'hold', 'message')),
  content text NOT NULL,
  event_id uuid REFERENCES public.agent_events(id) ON DELETE SET NULL,
  energy integer CHECK (energy BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS thread_messages_user_created_idx
  ON public.thread_messages (user_id, created_at DESC);

ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.thread_messages FROM anon;
GRANT SELECT ON public.thread_messages TO authenticated;
GRANT ALL ON public.thread_messages TO service_role;

DROP POLICY IF EXISTS thread_messages_select_own ON public.thread_messages;
CREATE POLICY thread_messages_select_own ON public.thread_messages FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
