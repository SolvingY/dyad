-- Outside agents (Claude Code, Cursor, a user's own code) connect to Dyad's
-- MCP server (the dyad-mcp edge function) with a per-agent API key.

-- 'builtin' is Dyad's own Claude agent; 'external' is a connected agent.
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'builtin'
  CHECK (source IN ('builtin', 'external'));

-- Only a SHA-256 hash of each key is stored; the key itself is shown once.
-- Written only by the agent-keys edge function (service role).
CREATE TABLE IF NOT EXISTS public.agent_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS agent_keys_user_idx ON public.agent_keys (user_id);

ALTER TABLE public.agent_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_keys FROM anon, authenticated;
-- Users can list their keys, but never read the hashes.
GRANT SELECT (id, user_id, agent_id, key_prefix, created_at, last_used_at, revoked_at)
  ON public.agent_keys TO authenticated;
GRANT ALL ON public.agent_keys TO service_role;

DROP POLICY IF EXISTS agent_keys_select_own ON public.agent_keys;
CREATE POLICY agent_keys_select_own ON public.agent_keys FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
