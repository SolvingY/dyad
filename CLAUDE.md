# Dyad: agent rules

See also AGENTS.md.

- The agent's voice (thread replies and the daily greeting) runs on the owner's own model when the edge function secrets `CUSTOM_MODEL_BASE_URL`, `CUSTOM_MODEL_API_KEY` and `CUSTOM_MODEL_ID` are set (any OpenAI-compatible API; optional `CUSTOM_MODEL_CONTEXT_LIMIT`, default 128,000). Claude is the backup: if that model fails, times out or returns nothing, Claude answers.
- Everything else, including check-in decisions (they need Claude's exact JSON), runs on the Claude API (Anthropic), not Gemini.
- The Claude API key is the Supabase edge function secret `ANTHROPIC_API_KEY`. Never log or return it, or `CUSTOM_MODEL_API_KEY`, to a client.
- Claude model: `claude-haiku-4-5-20251001`.
- Logging: every model call, Claude or custom, must be logged to `agent_events` through the `agent-call` edge function (`supabase/functions/agent-call`). Don't call either model from anywhere else.
- `agent_events` is model-agnostic; don't change the database schema for a model or provider switch.
