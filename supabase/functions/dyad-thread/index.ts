// The Dyad conversation: the human writes to their agent and gets a reply.
//
// POST { content, energy? (1-5), agent_id? } with the signed-in user's session.
// Each agent has its own conversation; agent_id picks it (default: the built-in
// agent). A connected agent (e.g. Claude over MCP) can't be called from here,
// so its messages are only saved: it reads them with get_thread next time it
// runs and replies with post_message. It:
//   1. saves the human's message to thread_messages,
//   2. marks that agent's open check-in as answered, so the hold rules see it,
// and for the built-in agent also:
//   3. logs an agent_events 'context_refresh' (the agent heard from the human),
//   4. calls Claude through agent-call with the last 20 messages (holds
//      left out), today's oura_daily row and today's agent_daily row,
//   5. saves the reply with its agent_events id.

import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient, getCallerId } from "../_shared/auth.ts";
import { chicagoParts } from "../_shared/chicago.ts";
import { THREAD_SYSTEM } from "../_shared/thread-prompt.ts";

const HISTORY = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = adminClient();
  const userId = await getCallerId(req, admin);
  if (!userId) return json({ error: "not_signed_in" }, 401);

  const body = await req.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const energy = body?.energy ?? null;
  if (!content || content.length > 4000) {
    return json({ error: "bad_request", detail: "content must be 1-4000 characters" }, 400);
  }
  if (energy !== null && (!Number.isInteger(energy) || energy < 1 || energy > 5)) {
    return json({ error: "bad_request", detail: "energy must be an integer 1-5" }, 400);
  }

  const agentId = typeof body?.agent_id === "string" ? body.agent_id : null;
  const agents = admin.from("agents").select("id, source").eq("user_id", userId);
  const { data: agent } = await (
    agentId ? agents.eq("id", agentId) : agents.eq("source", "builtin").order("created_at").limit(1)
  ).maybeSingle();
  if (!agent) return json({ error: "agent_not_found" }, 404);

  const { error: saveErr } = await admin.from("thread_messages").insert({
    user_id: userId,
    agent_id: agent.id,
    role: "human",
    kind: "message",
    content,
    energy,
  });
  if (saveErr) {
    console.error(`dyad-thread: saving message failed: ${saveErr.message}`);
    return json({ error: "save_failed" }, 500);
  }

  const { data: openCheckin } = await admin
    .from("checkins")
    .select("id")
    .eq("user_id", userId)
    .eq("agent_id", agent.id)
    .eq("decision", "ask")
    .is("responded_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (openCheckin) {
    await admin
      .from("checkins")
      .update({
        responded_at: new Date().toISOString(),
        response_energy: energy,
        response_note: content,
      })
      .eq("id", openCheckin.id);
  }

  if (agent.source !== "builtin") return json({ ok: true, queued: true });

  const { error: eventErr } = await admin
    .from("agent_events")
    .insert({ agent_id: agent.id, event_type: "context_refresh", task_id: "thread" });
  if (eventErr) console.error(`dyad-thread: logging context_refresh failed: ${eventErr.message}`);

  const now = new Date();
  const [{ data: history }, { data: oura }, { data: agentDay }] = await Promise.all([
    admin
      .from("thread_messages")
      .select("role, content, energy")
      .eq("user_id", userId)
      .eq("agent_id", agent.id)
      .neq("kind", "hold")
      .order("created_at", { ascending: false })
      .limit(HISTORY),
    admin
      .from("oura_daily")
      .select(
        "day, readiness_score, sleep_score, sleep_efficiency, total_sleep_seconds, average_hrv, resting_heart_rate, respiratory_rate, temperature_deviation, activity_score, steps",
      )
      .eq("user_id", userId)
      .eq("day", chicagoParts(now).date)
      .maybeSingle(),
    admin
      .from("agent_daily")
      .select(
        "day, readiness_score, freshness_score, error_rate, error_rate_deviation, retry_rate, correction_rate, cache_hit_rate, baseline_latency_ms, latency_variability_ms, calls_per_hour, call_count, avg_context_fill",
      )
      .eq("agent_id", agent.id)
      .eq("day", now.toISOString().slice(0, 10))
      .maybeSingle(),
  ]);

  // Oldest first, starting with a human turn as the Messages API requires.
  const turns = (history ?? []).reverse().map((m) => ({
    role: m.role === "agent" ? "assistant" : "user",
    content: m.energy ? `[energy ${m.energy}/5] ${m.content}` : m.content,
  }));
  while (turns.length && turns[0].role === "assistant") turns.shift();

  const system =
    `${THREAD_SYSTEM}\n\nThe human's Oura data today: ${oura ? JSON.stringify(oura) : "none yet"}` +
    `\nYour own vitals today (agent_daily): ${agentDay ? JSON.stringify(agentDay) : "none yet"}`;

  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-call`, {
    method: "POST",
    headers: {
      Authorization: req.headers.get("Authorization")!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ agent_id: agent.id, task_id: "thread", system, messages: turns }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.content) {
    return json({ error: "agent_call_failed", detail: result?.detail ?? result?.error }, 502);
  }

  const reply = (result.content as { type: string; text?: string }[])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  const { error: replyErr } = await admin.from("thread_messages").insert({
    user_id: userId,
    agent_id: agent.id,
    role: "agent",
    kind: "message",
    content: reply || "(no reply)",
    event_id: result.event_id ?? null,
  });
  if (replyErr) console.error(`dyad-thread: saving reply failed: ${replyErr.message}`);

  return json({ ok: true });
});
