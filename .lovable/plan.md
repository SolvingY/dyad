# Fix the Dyad panel and add Edge Function health

## What is happening now

- The Dyad guidance card is inside a desktop area fixed to roughly 40% of the screen height. Its guidance can be taller than that area, so the text extends into the conversation below.
- Agent readiness currently reflects Claude-call telemetry recorded by `agent-call`: freshness, corrections, errors, retries, context use, and latency.
- The other Supabase Edge Functions—Oura sync, thread, check-ins, MCP, keys, greeting, and auth callbacks—do not currently contribute to Agent health.

## Changes

### 1. Keep all Dyad guidance inside its card

- Replace the fixed-height top-center area with a constrained two-row layout that gives the brain/guidance enough minimum height and gives the conversation the remaining space.
- Make the Dyad guidance use the compact two-column presentation already used elsewhere, with responsive type and spacing rather than clipping or an inner scrollbar.
- Keep the brain, tabs, wording, one-screen desktop composition, and mobile order unchanged.
- Verify at the reported desktop size and at phone width that the card ends before the conversation begins.

### 2. Record Edge Function health without a management token

- Add a small, user-owned Edge Function event table for function name, success/failure, response time, timestamp, and a safe error category/message. Apply approved-user access rules; never store tokens or request bodies.
- Add one shared logging helper and use it across the existing Dyad Edge Functions so successful and failed executions are measured consistently.
- A function invocation that fails before its handler starts cannot self-report; platform-level crash logs would still require the Supabase management token that was previously put on hold.

### 3. Show function health and include it in Agent readiness

- Aggregate the current day’s function success rate, failure count, and response time into `agent_daily` through the existing SQL-owned readiness refresh path.
- Rebalance the existing readiness weights so function reliability contributes to the score while freshness, corrections, Claude errors, context use, and retries remain represented. The client will continue to display the stored readiness score rather than recomputing it.
- Add an “Edge Functions” group to the Agent card and Agent detail view showing status, success rate, failures, and response time. Show a clear empty/error message instead of dashes.
- Add the same daily function metrics to Agent Trends so changes can be reviewed over time.

## Technical notes

- Database changes will be applied through a Supabase migration with RLS.
- Existing Edge Functions remain in place; this adds lightweight observability around them rather than replacing them.
- No new secret is required for self-reported function health.
- Validate the readiness refresh with success and failure fixtures, then check the dashboard at desktop and phone sizes.
