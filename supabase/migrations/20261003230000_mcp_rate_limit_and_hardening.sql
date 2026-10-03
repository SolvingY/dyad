-- 1. Rate limit for connected agents: 20 MCP tool calls per hour per key.
CREATE TABLE IF NOT EXISTS public.agent_key_calls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key_id uuid NOT NULL REFERENCES public.agent_keys(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_key_calls_key_created_idx
  ON public.agent_key_calls (key_id, created_at);
ALTER TABLE public.agent_key_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_key_calls FROM anon, authenticated;
GRANT ALL ON public.agent_key_calls TO service_role;

-- Records one call and returns 0, or returns the seconds to wait if the key
-- already made p_limit calls in the last p_window_seconds.
CREATE OR REPLACE FUNCTION public.consume_agent_key_call(
  p_key_id uuid, p_limit integer, p_window_seconds integer
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_count integer;
  v_oldest timestamptz;
BEGIN
  -- Serialize calls per key so concurrent requests can't slip past the limit.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key_id::text, 0));
  DELETE FROM public.agent_key_calls
    WHERE key_id = p_key_id AND created_at < now() - make_interval(secs => p_window_seconds);
  SELECT count(*), min(created_at) INTO v_count, v_oldest
    FROM public.agent_key_calls WHERE key_id = p_key_id;
  IF v_count >= p_limit THEN
    RETURN greatest(1, ceil(extract(epoch FROM
      (v_oldest + make_interval(secs => p_window_seconds) - now())))::integer);
  END IF;
  INSERT INTO public.agent_key_calls (key_id) VALUES (p_key_id);
  RETURN 0;
END $$;
REVOKE EXECUTE ON FUNCTION public.consume_agent_key_call(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_agent_key_call(uuid, integer, integer) TO service_role;

-- 2. Users may only mark their agent's calls as corrected, not edit telemetry.
REVOKE UPDATE ON public.agent_events FROM authenticated;
GRANT UPDATE (was_corrected) ON public.agent_events TO authenticated;

-- 3. Users may rename their agents but not change owner or source.
REVOKE UPDATE ON public.agents FROM authenticated;
GRANT UPDATE (name, model) ON public.agents TO authenticated;

-- 4. Signed-out visitors never read or write app tables directly.
REVOKE ALL ON public.agents, public.agent_events, public.agent_daily, public.oura_daily,
  public.oura_tokens, public.checkins, public.thread_messages, public.profiles FROM anon;

-- 5. Move pg_net out of the public schema (its functions stay in the net
--    schema, so the hourly cron job is unaffected).
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;
