-- Hourly agent-checkin schedule. Same as the cron part of
-- 20261003200000_checkins.sql, split out so it can be applied on its own;
-- every statement is safe to re-run.
--
-- pg_cron runs in UTC and has no time zones, so the job runs every hour and
-- agent-checkin itself only acts 9am–6pm America/Chicago.

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
