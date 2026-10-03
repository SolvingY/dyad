# Dyad: agent rules

See also AGENTS.md.

- The agent runs on the Claude API (Anthropic), not Gemini.
- The API key is the Supabase edge function secret `ANTHROPIC_API_KEY`. Never log it or return it to a client.
- Default model: `claude-haiku-4-5-20251001`.
- Logging: every Claude call must be logged to `agent_events` through the `agent-call` edge function (`supabase/functions/agent-call`). Don't call the Claude API from anywhere else.
- `agent_events` is model-agnostic; don't change the database schema for a model or provider switch.
