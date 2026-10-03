// Hourly agent check-in, run by pg_cron (job 'agent-checkin-hourly').
//
// The cron job runs every hour in UTC; this function only acts between 9am and
// 6pm America/Chicago. For each user's first agent it:
//   1. runs oura-sync for the user,
//   2. reads today's oura_daily and agent_daily rows and today's check-ins,
//   3. holds without asking Claude if the human answered in the last 2 hours
//      or 3 asks already went out today,
//   4. otherwise asks Claude (through agent-call, so the call is logged) for
//      { decision, reason, message },
//   5. always inserts a checkins row, holds included.
//
// Only the cron job can call this: it must send the secret stored in Vault.

import { corsHeaders, json } from "../_shared/cors.ts";
import { ACT_AS_USER_HEADER, adminClient } from "../_shared/auth.ts";

const TZ = "America/Chicago";
const FIRST_HOUR = 9;
const LAST_HOUR = 18; // 6pm
const MAX_ASKS_PER_DAY = 3;
const QUIET_AFTER_RESPONSE_MS = 2 * 60 * 60 * 1000;

const PROMPT = `You are an AI agent checking in on the human you work with. Decide whether to ask them how they're doing right now ("ask") or leave them alone ("hold").
Ask only when it would help you plan your work around their energy, for example after a poor night's sleep, a big change in readiness, or a long gap since you last heard from them. Otherwise hold.
If you ask, write one short, friendly message of at most two sentences, with at most one question. Don't make medical claims or diagnoses.
Reply with JSON only, no other text: {"decision": "ask" | "hold", "reason": "<one sentence>", "message": "<message, or null if hold>"}`;

function chicagoParts(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

/** Calls another edge function as the given user. */
function callAsUser(fn: string, userId: string, body: unknown) {
  return fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      [ACT_AS_USER_HEADER]: userId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/** Keeps the message to at most one question by cutting after the first "?". */
function oneQuestion(message: string): string {
  const i = message.indexOf("?");
  return i === -1 ? message : message.slice(0, i + 1);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  const secret = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: ok } = await admin.rpc("check_checkin_cron_secret", { p_secret: secret });
  if (ok !== true) return json({ error: "forbidden" }, 403);

  const now = new Date();
  const local = chicagoParts(now);
  if (local.hour < FIRST_HOUR || local.hour > LAST_HOUR) {
    return json({ skipped: "outside 9am-6pm America/Chicago" });
  }
  const utcToday = now.toISOString().slice(0, 10);

  const { data: agents, error: agentsErr } = await admin
    .from("agents")
    .select("id, user_id")
    .order("created_at");
  if (agentsErr) {
    console.error(`agent-checkin: listing agents failed: ${agentsErr.message}`);
    return json({ error: "server_error" }, 500);
  }
  // One check-in per user, for their first agent.
  const firstAgentByUser = new Map<string, string>();
  for (const a of agents ?? [])
    if (!firstAgentByUser.has(a.user_id)) firstAgentByUser.set(a.user_id, a.id);

  const results: { user_id: string; decision: string }[] = [];
  for (const [userId, agentId] of firstAgentByUser) {
    try {
      const sync = await callAsUser("oura-sync", userId, {});
      if (!sync.ok) console.warn(`agent-checkin: oura-sync returned HTTP ${sync.status}`);

      const [{ data: oura }, { data: agentDay }, { data: recent }] = await Promise.all([
        admin
          .from("oura_daily")
          .select(
            "day, readiness_score, sleep_score, total_sleep_seconds, average_hrv, resting_heart_rate, activity_score, steps",
          )
          .eq("user_id", userId)
          .eq("day", local.date)
          .maybeSingle(),
        admin
          .from("agent_daily")
          .select(
            "day, readiness_score, freshness_score, call_count, error_rate, retry_rate, correction_rate, baseline_latency_ms",
          )
          .eq("agent_id", agentId)
          .eq("day", utcToday)
          .maybeSingle(),
        admin
          .from("checkins")
          .select(
            "created_at, decision, reason, message, response_energy, response_note, responded_at",
          )
          .eq("user_id", userId)
          .gte("created_at", new Date(now.getTime() - 36 * 3600_000).toISOString())
          .order("created_at"),
      ]);
      const today = (recent ?? []).filter(
        (c) => chicagoParts(new Date(c.created_at)).date === local.date,
      );

      const row = {
        user_id: userId,
        agent_id: agentId,
        human_readiness: oura?.readiness_score ?? null,
        agent_readiness: agentDay?.readiness_score ?? null,
      };

      let decision: "ask" | "hold" = "hold";
      let reason: string;
      let message: string | null = null;

      const answeredRecently = today.some(
        (c) =>
          c.responded_at &&
          now.getTime() - new Date(c.responded_at).getTime() < QUIET_AFTER_RESPONSE_MS,
      );
      const asksToday = today.filter((c) => c.decision === "ask").length;

      if (answeredRecently) {
        reason = "The human answered a check-in in the last 2 hours.";
      } else if (asksToday >= MAX_ASKS_PER_DAY) {
        reason = `Already asked ${MAX_ASKS_PER_DAY} times today.`;
      } else {
        const context = {
          local_time: `${local.date} ${String(local.hour).padStart(2, "0")}:00 ${TZ}`,
          human_today: oura ?? "no Oura data for today",
          agent_today: agentDay ?? "no agent activity today",
          earlier_checkins_today: today,
        };
        const res = await callAsUser("agent-call", userId, {
          agent_id: agentId,
          task_id: "checkin",
          messages: [{ role: "user", content: `${PROMPT}\n\nData:\n${JSON.stringify(context)}` }],
        });
        const body = await res.json().catch(() => null);
        const text: string = (body?.content ?? [])
          .filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text)
          .join("");
        let parsed: { decision?: unknown; reason?: unknown; message?: unknown } | null = null;
        try {
          parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        } catch {
          parsed = null;
        }
        if (!res.ok || !parsed) {
          reason = res.ok
            ? "Claude's reply wasn't valid JSON."
            : `agent-call failed (HTTP ${res.status}).`;
        } else {
          reason = typeof parsed.reason === "string" ? parsed.reason : "";
          if (
            parsed.decision === "ask" &&
            typeof parsed.message === "string" &&
            parsed.message.trim()
          ) {
            decision = "ask";
            message = oneQuestion(parsed.message.trim());
          }
        }
      }

      const { error } = await admin.from("checkins").insert({ ...row, decision, reason, message });
      if (error) console.error(`agent-checkin: insert failed: ${error.message}`);
      results.push({ user_id: userId, decision });
    } catch (err) {
      console.error(`agent-checkin: ${err instanceof Error ? err.message : err}`);
    }
  }

  return json({ checked_in: results.length, results });
});
