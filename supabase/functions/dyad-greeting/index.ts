// The built-in agent's first message of the day.
//
// POST with the signed-in user's session; the dashboard calls it on load. The
// first call each day (America/Chicago) claims profiles.last_greeted_on, asks
// Claude through agent-call for a short greeting about today, and posts it to
// the Dyad thread. Later calls that day return { greeted: false }.

import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient, getCallerId } from "../_shared/auth.ts";
import { chicagoParts } from "../_shared/chicago.ts";
import { THREAD_SYSTEM } from "../_shared/thread-prompt.ts";

const PROMPT = `The human just opened Dyad for the first time today. Write a short greeting
(2-3 sentences) about today: cite one of their Oura metrics and one of your own vitals, if you have
them. Ask at most one question. Don't mention that this is a greeting.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = adminClient();
  const userId = await getCallerId(req, admin);
  if (!userId) return json({ error: "not_signed_in" }, 401);

  const { data: agent } = await admin
    .from("agents")
    .select("id")
    .eq("user_id", userId)
    .eq("source", "builtin")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!agent) return json({ greeted: false, reason: "no_agent" });

  // Claim today. The update only matches if nobody greeted today yet, so two
  // tabs loading at once produce one greeting.
  const now = new Date();
  const today = chicagoParts(now).date;
  await admin.from("profiles").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
  const { data: claimed } = await admin
    .from("profiles")
    .update({ last_greeted_on: today })
    .eq("id", userId)
    .or(`last_greeted_on.is.null,last_greeted_on.lt.${today}`)
    .select("id");
  if (!claimed?.length) return json({ greeted: false });

  const [{ data: oura }, { data: agentDay }] = await Promise.all([
    admin
      .from("oura_daily")
      .select(
        "day, readiness_score, sleep_score, sleep_efficiency, total_sleep_seconds, average_hrv, resting_heart_rate, respiratory_rate, temperature_deviation, activity_score, steps",
      )
      .eq("user_id", userId)
      .eq("day", today)
      .maybeSingle(),
    admin
      .from("agent_daily")
      .select(
        "day, readiness_score, freshness_score, error_rate, error_rate_deviation, retry_rate, correction_rate, cache_hit_rate, baseline_latency_ms, latency_variability_ms, calls_per_hour, call_count, avg_context_fill",
      )
      .eq("agent_id", agent.id)
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const system =
    `${THREAD_SYSTEM}\n\nThe human's Oura data today: ${oura ? JSON.stringify(oura) : "none yet"}` +
    `\nYour own latest vitals (agent_daily): ${agentDay ? JSON.stringify(agentDay) : "none yet"}`;

  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-call`, {
    method: "POST",
    headers: {
      Authorization: req.headers.get("Authorization")!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: agent.id,
      task_id: "greeting",
      system,
      messages: [{ role: "user", content: PROMPT }],
    }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.content) {
    // Give the claim back so the next load can try again.
    await admin.from("profiles").update({ last_greeted_on: null }).eq("id", userId);
    return json({ error: "agent_call_failed", detail: result?.detail ?? result?.error }, 502);
  }

  const text = (result.content as { type: string; text?: string }[])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) return json({ greeted: false });

  const { error: saveErr } = await admin.from("thread_messages").insert({
    user_id: userId,
    agent_id: agent.id,
    role: "agent",
    kind: "message",
    content: text,
    event_id: result.event_id ?? null,
  });
  if (saveErr) {
    console.error(`dyad-greeting: saving message failed: ${saveErr.message}`);
    return json({ error: "save_failed" }, 500);
  }
  return json({ greeted: true });
});
