-- Apps that connect to dyad-mcp with OAuth (Supabase Auth's OAuth 2.1 server)
-- get one external agent per user and OAuth client.
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS oauth_client_id text;
CREATE UNIQUE INDEX IF NOT EXISTS agents_user_oauth_client_idx
  ON public.agents (user_id, oauth_client_id) WHERE oauth_client_id IS NOT NULL;

-- Rate limit per agent instead of per key, so it covers OAuth apps too.
DROP FUNCTION IF EXISTS public.consume_agent_key_call(uuid, integer, integer);
DROP TABLE IF EXISTS public.agent_key_calls;

CREATE TABLE IF NOT EXISTS public.agent_calls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_calls_agent_created_idx ON public.agent_calls (agent_id, created_at);
ALTER TABLE public.agent_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_calls FROM anon, authenticated;
GRANT ALL ON public.agent_calls TO service_role;

-- Records one call and returns 0, or returns the seconds to wait if the agent
-- already made p_limit calls in the last p_window_seconds.
CREATE OR REPLACE FUNCTION public.consume_agent_call(
  p_agent_id uuid, p_limit integer, p_window_seconds integer
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_count integer;
  v_oldest timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_agent_id::text, 0));
  DELETE FROM public.agent_calls
    WHERE agent_id = p_agent_id AND created_at < now() - make_interval(secs => p_window_seconds);
  SELECT count(*), min(created_at) INTO v_count, v_oldest
    FROM public.agent_calls WHERE agent_id = p_agent_id;
  IF v_count >= p_limit THEN
    RETURN greatest(1, ceil(extract(epoch FROM
      (v_oldest + make_interval(secs => p_window_seconds) - now())))::integer);
  END IF;
  INSERT INTO public.agent_calls (agent_id) VALUES (p_agent_id);
  RETURN 0;
END $$;
REVOKE EXECUTE ON FUNCTION public.consume_agent_call(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_agent_call(uuid, integer, integer) TO service_role;
