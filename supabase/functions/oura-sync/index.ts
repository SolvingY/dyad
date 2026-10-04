// Syncs the signed-in user's last 14 days of Oura data into oura_daily.
//
// Refreshes the access token first if it has expired. Pulls daily_readiness,
// daily_sleep, daily_activity and sleep (sessions) from the Oura v2 API and
// upserts one row per day on (user_id, day). The raw_* columns hold the
// unmodified Oura documents for that day.
//
// Returns { connected: false } if the user hasn't connected Oura (or must
// reconnect), else { connected: true, days }. Tokens are never logged or returned.

import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient, getCallerId } from "../_shared/auth.ts";
import { OURA_TOKEN_URL } from "../_shared/oura.ts";
import { withEdgeHealth } from "../_shared/edge-health.ts";

const OURA_API = "https://api.ouraring.com/v2/usercollection";
const SYNC_DAYS = 14;

type Doc = { day: string; [key: string]: unknown };
type SleepDoc = Doc & {
  type?: string | null;
  total_sleep_duration?: number | null;
  efficiency?: number | null;
  average_hrv?: number | null;
  lowest_heart_rate?: number | null;
  average_heart_rate?: number | null;
  average_breath?: number | null;
};

class OuraUnauthorized extends Error {}

async function fetchAll(
  endpoint: string,
  token: string,
  start: string,
  end: string,
): Promise<Doc[]> {
  const docs: Doc[] = [];
  let nextToken: string | null = null;
  do {
    const url = new URL(`${OURA_API}/${endpoint}`);
    url.searchParams.set("start_date", start);
    url.searchParams.set("end_date", end);
    if (nextToken) url.searchParams.set("next_token", nextToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) throw new OuraUnauthorized();
    if (!res.ok) throw new Error(`Oura ${endpoint} returned HTTP ${res.status}`);
    const page = await res.json();
    docs.push(...page.data);
    nextToken = page.next_token ?? null;
  } while (nextToken);
  return docs;
}

const toInt = (n: number | null | undefined) => (n == null ? null : Math.round(n));

Deno.serve(withEdgeHealth("oura-sync", async (req, health) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = adminClient();
  const userId = await getCallerId(req, admin);
  if (!userId) return json({ error: "not_signed_in" }, 401);
  health.userId = userId;

  const { data: tokens } = await admin
    .from("oura_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!tokens) return json({ connected: false });

  let accessToken: string = tokens.access_token;
  if (new Date(tokens.expires_at).getTime() < Date.now() + 60_000) {
    const res = await fetch(OURA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        client_id: Deno.env.get("OURA_CLIENT_ID") ?? "",
        client_secret: Deno.env.get("OURA_CLIENT_SECRET") ?? "",
      }),
    });
    if (!res.ok) {
      console.error(`oura-sync: token refresh failed with HTTP ${res.status}`);
      return json({ connected: false, reason: "reconnect_required" });
    }
    const t = await res.json();
    accessToken = t.access_token;
    // Oura may rotate the refresh token, so always store what it returns.
    const { error } = await admin
      .from("oura_tokens")
      .update({
        access_token: t.access_token,
        refresh_token: t.refresh_token ?? tokens.refresh_token,
        expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
        ...(t.scope ? { scope: t.scope } : {}),
      })
      .eq("user_id", userId);
    if (error) console.error(`oura-sync: saving refreshed token failed: ${error.message}`);
  }

  // end_date is tomorrow so today is always included.
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const start = day(-SYNC_DAYS);
  const end = day(1);

  let readiness: Doc[], sleepDaily: Doc[], activity: Doc[], sessions: Doc[];
  try {
    [readiness, sleepDaily, activity, sessions] = await Promise.all([
      fetchAll("daily_readiness", accessToken, start, end),
      fetchAll("daily_sleep", accessToken, start, end),
      fetchAll("daily_activity", accessToken, start, end),
      fetchAll("sleep", accessToken, start, end),
    ]);
  } catch (err) {
    if (err instanceof OuraUnauthorized)
      return json({ connected: false, reason: "reconnect_required" });
    console.error(`oura-sync: ${err instanceof Error ? err.message : err}`);
    return json({ error: "oura_fetch_failed" }, 502);
  }

  const byDay = <T extends Doc>(docs: T[]) => new Map(docs.map((d) => [d.day, d]));
  const readinessByDay = byDay(readiness);
  const sleepByDay = byDay(sleepDaily);
  const activityByDay = byDay(activity);
  const sessionsByDay = new Map<string, SleepDoc[]>();
  for (const s of sessions as SleepDoc[]) {
    sessionsByDay.set(s.day, [...(sessionsByDay.get(s.day) ?? []), s]);
  }

  const days = new Set([
    ...readinessByDay.keys(),
    ...sleepByDay.keys(),
    ...activityByDay.keys(),
    ...sessionsByDay.keys(),
  ]);

  const rows = [...days].map((d) => {
    const r = readinessByDay.get(d) as
      (Doc & { score?: number | null; temperature_deviation?: number | null }) | undefined;
    const sd = sleepByDay.get(d) as (Doc & { score?: number | null }) | undefined;
    const a = activityByDay.get(d) as
      | (Doc & {
          score?: number | null;
          steps?: number;
          active_calories?: number;
          total_calories?: number;
        })
      | undefined;
    const daySessions = sessionsByDay.get(d) ?? [];
    const counted = daySessions.filter((s) => s.type !== "deleted");
    const mainSessions = counted.filter((s) => s.type === "long_sleep");
    const naps = counted.filter((s) => s.type !== "long_sleep");
    const seconds = (list: SleepDoc[]) =>
      list.reduce((sum, s) => sum + (s.total_sleep_duration ?? 0), 0);
    // Vitals come from the longest main sleep of the day.
    const main = [...mainSessions].sort(
      (x, y) => (y.total_sleep_duration ?? 0) - (x.total_sleep_duration ?? 0),
    )[0];

    return {
      user_id: userId,
      day: d,
      readiness_score: toInt(r?.score),
      temperature_deviation: r?.temperature_deviation ?? null,
      sleep_score: toInt(sd?.score),
      total_sleep_seconds: counted.length ? toInt(seconds(counted)) : null,
      main_sleep_seconds: mainSessions.length ? toInt(seconds(mainSessions)) : null,
      nap_seconds: counted.length ? toInt(seconds(naps)) : null,
      nap_count: counted.length ? naps.length : null,
      sleep_session_count: counted.length ? counted.length : null,
      sleep_efficiency: toInt(main?.efficiency),
      average_hrv: main?.average_hrv ?? null,
      resting_heart_rate: main?.lowest_heart_rate ?? null,
      average_heart_rate: main?.average_heart_rate ?? null,
      respiratory_rate: main?.average_breath ?? null,
      activity_score: toInt(a?.score),
      steps: toInt(a?.steps),
      active_calories: toInt(a?.active_calories),
      total_calories: toInt(a?.total_calories),
      raw_readiness: r ?? null,
      raw_sleep_daily: sd ?? null,
      raw_activity: a ?? null,
      raw_sleep_sessions: daySessions.length ? daySessions : null,
    };
  });

  if (rows.length) {
    const { error } = await admin.from("oura_daily").upsert(rows, { onConflict: "user_id,day" });
    if (error) {
      console.error(`oura-sync: upsert failed: ${error.message}`);
      return json({ error: "save_failed" }, 500);
    }
  }

  // Heart rate (last 24h) and workouts (last 7 days). These need the
  // `heartrate` / `workout` permissions; older connections lack them, so a
  // failure here is reported but doesn't fail the daily sync.
  const extras = await syncHeartRateAndWorkouts(admin, userId, accessToken);

  return json({ connected: true, days: rows.length, ...extras });
}));

async function getJson(url: URL, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return { status: res.status, data: null as Doc[] | null };
  const page = await res.json();
  return { status: res.status, data: (page.data ?? []) as Doc[] };
}

// deno-lint-ignore no-explicit-any
async function syncHeartRateAndWorkouts(admin: any, userId: string, token: string) {
  const out: { heartrate_points?: number; workouts?: number; needs_reconnect_for?: string[] } = {};
  const missing: string[] = [];

  const hrUrl = new URL(`${OURA_API}/heartrate`);
  hrUrl.searchParams.set("start_datetime", new Date(Date.now() - 24 * 3600_000).toISOString());
  hrUrl.searchParams.set("end_datetime", new Date().toISOString());
  const hr = await getJson(hrUrl, token).catch(() => ({ status: 0, data: null }));
  if (hr.data) {
    const points = (hr.data as unknown as { bpm: number; source?: string; timestamp: string }[])
      .filter((p) => typeof p.bpm === "number" && p.timestamp)
      .map((p) => ({
        user_id: userId,
        ts: p.timestamp,
        bpm: Math.round(p.bpm),
        source: p.source ?? null,
      }));
    if (points.length) {
      const { error } = await admin
        .from("oura_heartrate")
        .upsert(points, { onConflict: "user_id,ts" });
      if (error) console.error(`oura-sync: heartrate upsert failed: ${error.message}`);
    }
    await admin
      .from("oura_heartrate")
      .delete()
      .eq("user_id", userId)
      .lt("ts", new Date(Date.now() - 14 * 86_400_000).toISOString());
    out.heartrate_points = points.length;
  } else if (hr.status === 401 || hr.status === 403) missing.push("heartrate");
  else console.warn(`oura-sync: heartrate returned HTTP ${hr.status}`);

  const day = (o: number) => new Date(Date.now() + o * 86_400_000).toISOString().slice(0, 10);
  const wUrl = new URL(`${OURA_API}/workout`);
  wUrl.searchParams.set("start_date", day(-7));
  wUrl.searchParams.set("end_date", day(1));
  const w = await getJson(wUrl, token).catch(() => ({ status: 0, data: null }));
  if (w.data) {
    type W = Doc & {
      id: string;
      activity?: string;
      start_datetime?: string;
      end_datetime?: string;
      calories?: number;
      intensity?: string;
    };
    const rows = (w.data as W[]).map((d) => ({
      user_id: userId,
      oura_id: d.id,
      day: d.day,
      activity: d.activity ?? null,
      start_at: d.start_datetime ?? null,
      end_at: d.end_datetime ?? null,
      calories: d.calories ?? null,
      intensity: d.intensity ?? null,
      raw: d,
    }));
    if (rows.length) {
      const { error } = await admin.from("oura_workouts").upsert(rows, { onConflict: "oura_id" });
      if (error) console.error(`oura-sync: workout upsert failed: ${error.message}`);
    }
    out.workouts = rows.length;
  } else if (w.status === 401 || w.status === 403) missing.push("workout");
  else console.warn(`oura-sync: workout returned HTTP ${w.status}`);

  if (missing.length) out.needs_reconnect_for = missing;
  return out;
}
