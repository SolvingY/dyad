# Contain the Dyad card and include Edge Function health

## Confirmed current behavior

- The Dyad guidance card sits in a desktop region fixed to about 40% of the screen height. The guidance can be taller than that region, so its last lines extend into the conversation below.
- Agent readiness currently measures Claude activity logged in `agent_events`: freshness, corrections, Claude errors, retries, context use, and Claude response time.
- Supabase Edge Function execution health is not included. Oura sync, thread, check-ins, MCP, keys, greeting, and auth callback failures currently remain in Supabase logs.
- Recent MCP logs also show its telemetry insert failing because it omits the required `status` value. This means some agent activity is currently missing from the displayed metrics.

## Changes

### 1. Make the Dyad widget contain all of its text

- Stop forcing the brain and Dyad card into a percentage height that is shorter than their content.
- Give the center-top area a content-safe minimum height on desktop while keeping the conversation in the remaining space.
- Keep the existing brain, tabs, wording, card styling, desktop columns, and mobile order.
- Use compact responsive spacing in the guidance card, without clipping or an inner scrollbar.

### 2. Record Edge Function health using the existing telemetry system

- Extend `agent_events` with a nullable function-name field and use a distinct `edge_invocation` event type. No separate health table is needed.
- Add one shared lightweight logger to the existing Edge Functions. For each agent-associated request, record function name, success/failure, response time, timestamp, and a safe error summary—never tokens, credentials, or request content.
- Fix MCP telemetry inserts to always include `status`, restoring the activity that is currently being dropped.
- Function crashes that happen before the handler starts cannot self-report; those remain visible only in Supabase’s platform logs unless a management token is added later.

### 3. Display function health and include it in Agent readiness

- Extend the existing database-owned daily refresh so Edge Function success rate and latency contribute to the stored Agent readiness score. Rebalance the existing weights rather than calculating readiness in the browser.
- Keep Claude-call errors and latency distinct from Edge Function errors and latency so each remains understandable.
- Add an **Edge Functions** group to the Agent card and Agent detail area with overall status, success rate, failure count, and response time. Missing or failed reads show a clear message, never dashes.
- Add the same daily Edge Function metrics to Agent Trends.

## Verification

- Validate the daily readiness calculation with successful and failed function events.
- Test MCP logging to confirm the current missing-status error is gone.
- Check the dashboard at the reported desktop size and phone width, confirming the Dyad text remains inside its card and function metrics render without overflow.
