// Wraps every Claude call the agent makes, and logs it to agent_events.
//
// POST { agent_id, task_id?, messages, system?, include_human_context? } with
// the signed-in user's session. The caller must own the agent.
//
// One 'llm_call' event is written per call, success or failure. With
// include_human_context, the user's latest oura_daily row (today or yesterday,
// UTC) is put in the system prompt and a 'context_refresh' event is written.
//
// ANTHROPIC_API_KEY is never logged or returned.

import Anthropic from "npm:@anthropic-ai/sdk@0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient, getCallerId } from "../_shared/auth.ts";
import { withEdgeHealth } from "../_shared/edge-health.ts";

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

Deno.serve(withEdgeHealth("agent-call", async (req, health) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = adminClient();
  const userId = await getCallerId(req, admin);
  if (!userId) return json({ error: "not_signed_in" }, 401);
  health.userId = userId;

  const body = await req.json().catch(() => null);
  const { agent_id, task_id = null, messages, include_human_context } = body ?? {};
  let system: string | undefined = body?.system;
  if (typeof agent_id !== "string" || !Array.isArray(messages) || messages.length === 0) {
    return json({ error: "bad_request", detail: "agent_id and messages are required" }, 400);
  }
  if (task_id !== null && typeof task_id !== "string") {
    return json({ error: "bad_request", detail: "task_id must be a string" }, 400);
  }
  if (system !== undefined && typeof system !== "string") {
    return json({ error: "bad_request", detail: "system must be a string" }, 400);
  }

  // A malformed uuid makes this query error; treat that as "not found" too.
  const { data: agent } = await admin
    .from("agents")
    .select("id")
    .eq("id", agent_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent) return json({ error: "agent_not_found" }, 404);
  health.agentIds = [agent.id];


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
      const ouraContext = `Latest data about the human you work with, from their Oura ring:\n${JSON.stringify(day)}`;
      system = system ? `${system}\n\n${ouraContext}` : ouraContext;
      const { error } = await admin
        .from("agent_events")
        .insert({ agent_id, event_type: "context_refresh", task_id });
      if (error) console.error(`agent-call: logging context_refresh failed: ${error.message}`);
    }
  }

  type Attempt = {
    ok: boolean;
    model: string;
    content: unknown;
    stopReason: string | null;
    usage: Record<string, number> | null;
    tokensIn: number | null;
    tokensOut: number | null;
    cached: number | null;
    contextLimit: number;
    latencyMs: number;
    retries: number;
    error: string | null;
  };

  const failed = (model: string, contextLimit: number, latencyMs: number, retries: number, error: string): Attempt => ({
    ok: false, model, content: null, stopReason: null, usage: null,
    tokensIn: null, tokensOut: null, cached: null, contextLimit, latencyMs, retries, error,
  });

  async function logAttempt(a: Attempt): Promise<string | null> {
    const { data: event, error: logErr } = await admin
      .from("agent_events")
      .insert({
        agent_id,
        event_type: "llm_call",
        task_id,
        model: a.model,
        tokens_in: a.tokensIn,
        tokens_out: a.tokensOut,
        cached_tokens: a.cached,
        latency_ms: a.latencyMs,
        status: a.ok ? "ok" : "error",
        retry_count: a.retries,
        context_tokens: a.tokensIn,
        context_limit: a.contextLimit,
        error: a.ok ? null : a.error,
      })
      .select("id")
      .single();
    if (logErr) console.error(`agent-call: logging llm_call failed: ${logErr.message}`);
    return event?.id ?? null;
  }

  // The user's own OpenAI-compatible model, tried first when configured.
  async function callCustom(): Promise<Attempt | null> {
    const base = Deno.env.get("CUSTOM_MODEL_BASE_URL");
    const key = Deno.env.get("CUSTOM_MODEL_API_KEY");
    const model = Deno.env.get("CUSTOM_MODEL_ID");
    if (!base || !key || !model) return null;
    const contextLimit = Number(Deno.env.get("CUSTOM_MODEL_CONTEXT_LIMIT")) || 128_000;
    const chat = [
      ...(system ? [{ role: "system", content: system }] : []),
      ...messages.map((m: { role: string; content: unknown }) => ({
        role: m.role,
        content: typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
          ? m.content.map((b: { text?: string }) => b.text ?? "").join("")
          : String(m.content),
      })),
    ];
    const url = `${base.replace(/\/+$/, "")}/chat/completions`;
    let retries = 0;
    let latencyMs = 0;
    let error = "";
    for (let attempt = 0; ; attempt++) {
      const started = performance.now();
      let retryable = false;
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: chat, max_tokens: MAX_TOKENS }),
          signal: AbortSignal.timeout(30_000),
        });
        latencyMs = Math.round(performance.now() - started);
        if (r.ok) {
          const d = await r.json();
          const text: string = d?.choices?.[0]?.message?.content ?? "";
          if (text.trim()) {
            const pin: number | null = d?.usage?.prompt_tokens ?? null;
            const pout: number | null = d?.usage?.completion_tokens ?? null;
            return {
              ok: true, model,
              content: [{ type: "text", text }],
              stopReason: d?.choices?.[0]?.finish_reason ?? null,
              usage: { input_tokens: pin ?? 0, output_tokens: pout ?? 0 },
              tokensIn: pin, tokensOut: pout, cached: null,
              contextLimit, latencyMs, retries, error: null,
            };
          }
          error = "empty reply";
        } else {
          error = `${r.status}: ${(await r.text()).slice(0, 200)}`;
          retryable = r.status === 408 || r.status === 429 || r.status >= 500;
        }
      } catch (err) {
        latencyMs = Math.round(performance.now() - started);
        error = err instanceof Error ? err.message : String(err);
        retryable = true;
      }
      if (retryable && attempt < MAX_RETRIES) {
        retries++;
        await new Promise((res) => setTimeout(res, 500 * 2 ** attempt));
        continue;
      }
      return failed(model, contextLimit, latencyMs, retries, error);
    }
  }

  async function callClaude(): Promise<Attempt> {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return failed(MODEL, CONTEXT_LIMIT, 0, 0, "ANTHROPIC_API_KEY is not set");
    // SDK retries are off so retries can be counted here.
    const client = new Anthropic({ apiKey, maxRetries: 0 });
    let response: Anthropic.Message | null = null;
    let failure: unknown = null;
    let retries = 0;
    let latencyMs = 0;
    for (let attempt = 0; ; attempt++) {
      const started = performance.now();
      try {
        response = await client.messages.create({ model: MODEL, max_tokens: MAX_TOKENS, system, messages });
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
    if (!response) return failed(MODEL, CONTEXT_LIMIT, latencyMs, retries, errorText(failure));
    const usage = response.usage;
    const tokensIn = usage.input_tokens + (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0);
    return {
      ok: true, model: MODEL,
      content: response.content,
      stopReason: response.stop_reason,
      usage: usage as unknown as Record<string, number>,
      tokensIn, tokensOut: usage.output_tokens,
      cached: usage.cache_read_input_tokens ?? 0,
      contextLimit: CONTEXT_LIMIT, latencyMs, retries, error: null,
    };
  }

  let fallback = false;
  let result = await callCustom();
  let eventId: string | null = null;
  if (result) eventId = await logAttempt(result);
  if (!result || !result.ok) {
    if (result) {
      fallback = true;
      console.error(`agent-call: custom model failed, using Claude: ${result.error}`);
    }
    result = await callClaude();
    eventId = await logAttempt(result);
  }

  if (!result.ok) {
    return json({ error: "model_call_failed", detail: result.error, event_id: eventId }, 502);
  }
  return json({
    event_id: eventId,
    content: result.content,
    stop_reason: result.stopReason,
    usage: result.usage,
    model: result.model,
    fallback,
  });
}));
