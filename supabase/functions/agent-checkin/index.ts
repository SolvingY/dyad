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
//   5. always inserts a checkins row (the decision log), holds included, and
//      posts the question or the hold into the Dyad thread (thread_messages).
//
// Only the cron job can call this: it must send the secret stored in Vault.

import { corsHeaders, json } from "../_shared/cors.ts";
import { ACT_AS_USER_HEADER, adminClient, getCallerId } from "../_shared/auth.ts";
import { TZ, chicagoParts } from "../_shared/chicago.ts";
import { holdReason } from "../_shared/checkin-rules.ts";

const FIRST_HOUR = 9;
const LAST_HOUR = 18; // 6pm

const PROMPT = `You are an AI agent checking in on the human you work with. Decide whether to ask them how they're doing right now ("ask") or leave them alone ("hold").
Ask only when it would help you plan your work around their energy, for example after a poor night's sleep, a big change in readiness, or a long gap since you last heard from them. Otherwise hold.
If you ask, write one short, friendly message of at most two sentences, with at most one question. Don't make medical claims or diagnoses.
Reply with JSON only, no other text: {"decision": "ask" | "hold", "reason": "<one sentence>", "message": "<message, or null if hold>"}`;

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
  // A signed-in user may also trigger one check-in for themselves (the
  // dashboard's empty-state button). Hold rules still apply; the hours window
  // does not, since the human asked.
  const selfUserId = ok === true ? null : await getCallerId(req, admin);
  if (ok !== true && !selfUserId) return json({ error: "forbidden" }, 403);

  const now = new Date();
  const local = chicagoParts(now);
  // Reminders run every hour (their own quiet hours apply), on the cron path only.
  const synced = new Set<string>();
  let reminderCount = 0;
  if (!selfUserId) {
    try {
      reminderCount = await evaluateReminders(admin, now, local.hour, synced);
    } catch (err) {
      console.error(`agent-checkin: reminders failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (!selfUserId && (local.hour < FIRST_HOUR || local.hour > LAST_HOUR)) {
    return json({ skipped: "outside 9am-6pm America/Chicago", notifications: reminderCount });
  }
  const utcToday = now.toISOString().slice(0, 10);
  // dry_run (signed-in callers only, e.g. dyad-mcp's should_check_in tool):
  // return the decision without saving it or posting to the thread.
  const dryRun = selfUserId !== null && (await req.json().catch(() => null))?.dry_run === true;

  // Only Dyad's built-in agent checks in on a schedule; connected agents
  // (source 'external') decide for themselves.
  let agentsQuery = admin
    .from("agents")
    .select("id, user_id")
    .eq("source", "builtin")
    .order("created_at");
  if (selfUserId) agentsQuery = agentsQuery.eq("user_id", selfUserId);
  const { data: agents, error: agentsErr } = await agentsQuery;
  if (agentsErr) {
    console.error(`agent-checkin: listing agents failed: ${agentsErr.message}`);
    return json({ error: "server_error" }, 500);
  }
  // One check-in per user, for their first agent.
  const firstAgentByUser = new Map<string, string>();
  for (const a of agents ?? [])
    if (!firstAgentByUser.has(a.user_id)) firstAgentByUser.set(a.user_id, a.id);

  const results: {
    user_id: string;
    decision: string;
    reason?: string;
    message?: string | null;
  }[] = [];
  for (const [userId, agentId] of firstAgentByUser) {
    try {
      if (!synced.has(userId)) {
        const sync = await callAsUser("oura-sync", userId, {});
        if (!sync.ok) console.warn(`agent-checkin: oura-sync returned HTTP ${sync.status}`);
      }

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
      let eventId: string | null = null;

      const mustHold = holdReason(today, now);
      if (mustHold) {
        reason = mustHold;
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
        eventId = body?.event_id ?? null;
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

      if (dryRun) {
        results.push({ user_id: userId, decision, reason, message });
        continue;
      }

      const { error } = await admin.from("checkins").insert({ ...row, decision, reason, message });
      if (error) console.error(`agent-checkin: insert failed: ${error.message}`);
      const { error: threadErr } = await admin.from("thread_messages").insert({
        user_id: userId,
        agent_id: agentId,
        role: "agent",
        kind: decision === "ask" ? "checkin" : "hold",
        content: decision === "ask" ? message : reason || "Holding.",
        event_id: eventId,
      });
      if (threadErr) console.error(`agent-checkin: thread insert failed: ${threadErr.message}`);
      results.push({ user_id: userId, decision });
    } catch (err) {
      console.error(`agent-checkin: ${err instanceof Error ? err.message : err}`);
    }
  }

  return json({ checked_in: results.length, results, notifications: reminderCount });
});

// ---------- Reminders ----------
// Kinds: hr_high (bpm above resting), readiness_low (score), agent_latency (ms),
// agent_errors (percent). Each fires at most once per frequency_minutes and
// never during the user's quiet hours (local hours, America/Chicago).
const REMINDER_DEFAULTS: Record<string, number> = {
  hr_high: 15,
  readiness_low: 65,
  agent_latency: 3000,
  agent_errors: 10,
};

function inQuiet(hour: number, start: number | null, end: number | null) {
  if (start == null || end == null || start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

// deno-lint-ignore no-explicit-any
async function evaluateReminders(admin: any, now: Date, hour: number, synced: Set<string>) {
  const { data: reminders, error } = await admin
    .from("reminders")
    .select("id, user_id, kind, threshold, frequency_minutes, quiet_start, quiet_end, last_fired_at")
    .eq("enabled", true);
  if (error) throw new Error(error.message);
  const due = (reminders ?? []).filter(
    (r: { quiet_start: number | null; quiet_end: number | null; last_fired_at: string | null; frequency_minutes: number }) =>
      !inQuiet(hour, r.quiet_start, r.quiet_end) &&
      (!r.last_fired_at ||
        now.getTime() - new Date(r.last_fired_at).getTime() >= r.frequency_minutes * 60_000 - 60_000),
  );
  let fired = 0;
  const byUser = new Map<string, typeof due>();
  for (const r of due) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);

  for (const [userId, list] of byUser) {
    const needsOura = list.some((r: { kind: string }) => r.kind === "hr_high" || r.kind === "readiness_low");
    if (needsOura && !synced.has(userId)) {
      await callAsUser("oura-sync", userId, {}).catch(() => null);
      synced.add(userId);
    }
    const hourAgo = new Date(now.getTime() - 3600_000).toISOString();
    const [{ data: oura }, { data: hr }, { data: workouts }, { data: agent }] = await Promise.all([
      admin.from("oura_daily").select("day, readiness_score, resting_heart_rate")
        .eq("user_id", userId).order("day", { ascending: false }).limit(1).maybeSingle(),
      admin.from("oura_heartrate").select("bpm, source").eq("user_id", userId).gte("ts", hourAgo),
      admin.from("oura_workouts").select("id").eq("user_id", userId).gte("end_at", hourAgo),
      admin.from("agents").select("id").eq("user_id", userId).order("created_at").limit(1).maybeSingle(),
    ]);
    const { data: agentDay } = agent
      ? await admin.from("agent_daily").select("baseline_latency_ms, error_rate, call_count")
          .eq("agent_id", agent.id).order("day", { ascending: false }).limit(1).maybeSingle()
      : { data: null };

    for (const r of list) {
      const t = Number(r.threshold ?? REMINDER_DEFAULTS[r.kind]);
      let note: { title: string; body: string } | null = null;
      if (r.kind === "hr_high") {
        const day = (hr ?? []).filter((p: { source: string | null }) => p.source !== "sleep");
        const resting = oura?.resting_heart_rate;
        if (day.length >= 3 && resting && !(workouts ?? []).length) {
          const avg = day.reduce((s: number, p: { bpm: number }) => s + p.bpm, 0) / day.length;
          if (avg - resting >= t)
            note = {
              title: "You might be pushing hard",
              body: `Your heart rate averaged ${Math.round(avg)} bpm over the last hour, ${Math.round(avg - resting)} above your resting ${Math.round(resting)}. Consider a short break.`,
            };
        }
      } else if (r.kind === "readiness_low") {
        if (oura?.readiness_score != null && oura.readiness_score < t)
          note = {
            title: "Low readiness today",
            body: `Your readiness is ${oura.readiness_score} (below ${t}). Go easier where you can.`,
          };
      } else if (r.kind === "agent_latency") {
        const ms = agentDay?.baseline_latency_ms;
        if (ms != null && Number(ms) > t)
          note = {
            title: "Your agent is slowing down",
            body: `Typical response time is ${Math.round(Number(ms))} ms, above your limit of ${t} ms.`,
          };
      } else if (r.kind === "agent_errors") {
        const rate = agentDay?.error_rate;
        if (rate != null && Number(rate) * 100 > t)
          note = {
            title: "Your agent is hitting errors",
            body: `Error rate is ${(Number(rate) * 100).toFixed(1)}%, above your limit of ${t}%.`,
          };
      }
      if (!note) continue;
      const { error: insErr } = await admin
        .from("notifications")
        .insert({ user_id: userId, reminder_kind: r.kind, ...note });
      if (insErr) {
        console.error(`agent-checkin: notification insert failed: ${insErr.message}`);
        continue;
      }
      await admin.from("reminders").update({ last_fired_at: now.toISOString() }).eq("id", r.id);
      fired++;
    }
  }
  return fired;
}
