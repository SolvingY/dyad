// Wraps every Claude call the agent makes, and logs it to agent_events.
//
// POST { agent_id, task_id?, messages, include_human_context? } with the
// signed-in user's session. The caller must own the agent.
//
// One 'llm_call' event is written per call, success or failure. With
// include_human_context, the user's latest oura_daily row (today or yesterday,
// UTC) is put in the system prompt and a 'context_refresh' event is written.
//
// ANTHROPIC_API_KEY is never logged or returned.

import Anthropic from "npm:@anthropic-ai/sdk@0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient, getCallerId } from "../_shared/auth.ts";

const MODEL = "claude-haiku-4-5-20251001";
const CONTEXT_LIMIT = 200_000; // Claude Haiku 4.5 context window
const MAX_TOKENS = 4096;
const MAX_RETRIES = 2;

function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIConnectionError) return true;
  if (!(err instanceof Anthropic.APIError)) return false;
  const s = err.status ?? 0;
  return s === 408 || s === 409 || s === 429 || s >= 500;
}

function errorText(err: unknown): string {
  if (err instanceof Anthropic.APIError) return `${err.status ?? "error"}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = adminClient();
  const userId = await getCallerId(req, admin);
  if (!userId) return json({ error: "not_signed_in" }, 401);

  const body = await req.json().catch(() => null);
  const { agent_id, task_id = null, messages, include_human_context } = body ?? {};
  if (typeof agent_id !== "string" || !Array.isArray(messages) || messages.length === 0) {
    return json({ error: "bad_request", detail: "agent_id and messages are required" }, 400);
  }
  if (task_id !== null && typeof task_id !== "string") {
    return json({ error: "bad_request", detail: "task_id must be a string" }, 400);
  }

  // A malformed uuid makes this query error; treat that as "not found" too.
  const { data: agent } = await admin
    .from("agents")
    .select("id")
    .eq("id", agent_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent) return json({ error: "agent_not_found" }, 404);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("agent-call: ANTHROPIC_API_KEY is not set");
    return json({ error: "server_misconfigured" }, 500);
  }

  let system: string | undefined;
  if (include_human_context === true) {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const { data: day } = await admin
      .from("oura_daily")
      .select(
        "day, readiness_score, temperature_deviation, sleep_score, total_sleep_seconds, sleep_efficiency, average_hrv, resting_heart_rate, average_heart_rate, respiratory_rate, activity_score, steps, active_calories, total_calories, main_sleep_seconds, nap_seconds, nap_count, sleep_session_count",
      )
      .eq("user_id", userId)
      .gte("day", yesterday)
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (day) {
      system = `Latest data about the human you work with, from their Oura ring:\n${JSON.stringify(day)}`;
      const { error } = await admin
        .from("agent_events")
        .insert({ agent_id, event_type: "context_refresh", task_id });
      if (error) console.error(`agent-call: logging context_refresh failed: ${error.message}`);
    }
  }

  // SDK retries are off so retries can be counted here.
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  let response: Anthropic.Message | null = null;
  let failure: unknown = null;
  let retries = 0;
  let latencyMs = 0;
  for (let attempt = 0; ; attempt++) {
    const started = performance.now();
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages,
      });
      latencyMs = Math.round(performance.now() - started);
      break;
    } catch (err) {
      latencyMs = Math.round(performance.now() - started);
      if (attempt < MAX_RETRIES && isRetryable(err)) {
        retries++;
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        continue;
      }
      failure = err;
      break;
    }
  }

  const usage = response?.usage;
  const tokensIn = usage
    ? usage.input_tokens +
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0)
    : null;

  const { data: event, error: logErr } = await admin
    .from("agent_events")
    .insert({
      agent_id,
      event_type: "llm_call",
      task_id,
      model: MODEL,
      tokens_in: tokensIn,
      tokens_out: usage?.output_tokens ?? null,
      cached_tokens: usage ? (usage.cache_read_input_tokens ?? 0) : null,
      latency_ms: latencyMs,
      status: response ? "ok" : "error",
      retry_count: retries,
      context_tokens: tokensIn,
      context_limit: CONTEXT_LIMIT,
      error: response ? null : errorText(failure),
    })
    .select("id")
    .single();
  if (logErr) console.error(`agent-call: logging llm_call failed: ${logErr.message}`);

  if (!response) {
    return json(
      { error: "claude_call_failed", detail: errorText(failure), event_id: event?.id ?? null },
      502,
    );
  }
  return json({
    event_id: event?.id ?? null,
    content: response.content,
    stop_reason: response.stop_reason,
    usage: response.usage,
  });
});
