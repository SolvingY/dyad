# Use your own trained model as Dyad's voice

## What changes for you
- Every Dyad reply (thread chat, check-ins, greetings) comes from your own hosted model first, so it speaks with your knowledge and style.
- If your model fails or times out, Dyad falls back to Claude so the conversation keeps working. Those replies get a small "Backup" label in the thread.
- Agent health keeps working: calls to your model are counted, timed and logged the same way Claude calls are. Readiness, latency, error rate and Trends need no changes.

## What you'll need to provide (secure boxes, never stored in code)
1. **Model endpoint URL**: the base address of your OpenAI-compatible API (for example `https://api.together.xyz/v1`).
2. **API key** for that endpoint.
3. **Model name/ID** as your provider lists it (for example `ft:gpt-4o-mini:you:dyad:abc123`).

## How it works
```text
thread / check-in / greeting
        |
     agent-call ──> your model (OpenAI-compatible /chat/completions)
        |                 | fails or times out
        |                 v
        └────────────> Claude Haiku (backup)
        |
   one llm_call log row per attempt (model name recorded)
```

## Technical details
- Only `supabase/functions/agent-call/index.ts` changes the model call; the other functions already route through it.
- New edge secrets: `CUSTOM_MODEL_BASE_URL`, `CUSTOM_MODEL_API_KEY`, `CUSTOM_MODEL_ID`. If unset, agent-call uses Claude exactly as today.
- Convert the Claude-style request (`system` + `messages`) into OpenAI `chat/completions` format (system becomes the first message). Up to 2 retries on 408/429/5xx, 30s timeout per attempt.
- Convert the reply back to the existing response shape (`content: [{type:"text", text}]`, `stop_reason`, `usage` mapped from `prompt_tokens`/`completion_tokens`) so dyad-thread, dyad-greeting and agent-checkin need no changes.
- Logging: an `llm_call` row in `agent_events` for the custom attempt (`model` = your model ID, status/latency/tokens/error), plus a second row if Claude fallback runs. Uses the existing model-agnostic schema, so the database doesn't change. Keys are never logged or returned.
- Response adds `fallback: true` when Claude answered. dyad-thread stores that in the existing message metadata if a metadata column exists; otherwise, the label is skipped. The column gets checked before building, and no new column gets added.
- Context limit for context-fill: optional `CUSTOM_MODEL_CONTEXT_LIMIT` secret, default 128,000.
- Update the project rules note: the default model is the user's custom model with Claude Haiku as the backup.
- Verify: deploy, call agent-call with a test message, check the reply, the log row and the fallback path (by temporarily using an invalid model ID).
