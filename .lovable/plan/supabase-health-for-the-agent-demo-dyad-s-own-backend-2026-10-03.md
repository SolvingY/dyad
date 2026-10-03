# Supabase health for the agent (demo: Dyad's own backend)

## What you'll see
A small "Backend health" row on the **Agent** card, last 24 hours:
- Database errors
- Sign-in failures
- Function failures
- Status: "Connected" / "Not connected" (shows the error message if the check fails, never dashes)

The agent can read the same numbers, plus the latest few error messages, through its MCP connection, so it can mention them in the chat.

Readiness score is not changed.

## One thing needed from you
Supabase only shares these logs through its management API, which needs a **Supabase personal access token** (Supabase dashboard > Account > Access Tokens). I'll ask for it in a secure box; it is stored as a server secret and never shown in the browser.

## Changes (minimal)
1. Add secret `SUPABASE_MANAGEMENT_TOKEN`.
2. One server function that asks Supabase's log API for 24h counts of: Postgres ERROR/FATAL/PANIC lines, Auth responses with status 400+, and Edge Function calls with status 500+. Signed-in, approved users only.
3. Agent card: add the three stats + status line in the existing stat style.
4. `dyad-mcp` edge function: add one read-only tool `get_backend_health` returning the same counts and the 5 most recent error messages. (This is an edge function change; needed so the agent itself can see it.)

No database tables, policies, or schema changes.

## Later (not built now)
Letting each user connect their own Supabase project would reuse the same check with their own project ref and token.

## Technical details
- Endpoint: `GET https://api.supabase.com/v1/projects/lkrowosefofrksfheeqh/analytics/endpoints/logs.all?sql=...&iso_timestamp_start=...&iso_timestamp_end=...` with `Authorization: Bearer $SUPABASE_MANAGEMENT_TOKEN`.
- Sources: `postgres_logs` (error_severity), `auth_logs` (status), `function_edge_logs` (response status_code).
- Server fn uses `requireSupabaseAuth`, checks approval, reads token inside the handler; cached ~60s client side via React Query.
- MCP tool reuses existing agent-key auth in `dyad-mcp`; token read from edge secret of the same name (needs setting in Supabase edge secrets too).
