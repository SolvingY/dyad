-- Agent check-ins: the agent decides each hour whether to ask the human how
-- they're doing ('ask') or leave them alone ('hold'). Rows are written only by
-- the agent-checkin and checkin-respond edge functions (service role).

CREATE TABLE IF NOT EXISTS public.checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  decision text NOT NULL CHECK (decision IN ('ask', 'hold')),
  reason text,
  message text,
  human_readiness integer,
  agent_readiness integer,
  response_energy integer CHECK (response_energy BETWEEN 1 AND 5),
  response_note text,
  responded_at timestamptz
);

CREATE INDEX IF NOT EXISTS checkins_user_created_idx ON public.checkins (user_id, created_at DESC);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;

DROP POLICY IF EXISTS checkins_select_own ON public.checkins;
CREATE POLICY checkins_select_own ON public.checkins FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Hourly schedule. pg_cron runs in UTC and has no time zones, so the job runs
-- every hour and agent-checkin itself only acts 9am–6pm America/Chicago.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Shared secret the cron job sends to agent-checkin; generated here, never in git.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'agent_checkin_cron_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'agent_checkin_cron_secret');
  END IF;
END $$;

-- Lets agent-checkin (service role) check the secret without reading it.
CREATE OR REPLACE FUNCTION public.check_checkin_cron_secret(p_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'agent_checkin_cron_secret' AND decrypted_secret = p_secret
  );
$$;
REVOKE EXECUTE ON FUNCTION public.check_checkin_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_checkin_cron_secret(text) TO service_role;

SELECT cron.schedule(
  'agent-checkin-hourly',
  '0 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://lkrowosefofrksfheeqh.supabase.co/functions/v1/agent-checkin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'agent_checkin_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
