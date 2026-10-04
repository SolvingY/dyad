// Dyad dashboard state adapter.
//
// Supabase rows (oura_daily, agent_daily) → raw display vitals → normalized
// visual state for the 3D brain. Raw values are kept as-is for display; the
// renderer only ever sees clamped 0–1 values. Missing values stay null in the
// raw layer and fall back to a neutral 0.5 in the visual layer (never zero).
import type { Database } from "@/integrations/supabase/types";
import {
  AGENT_READINESS_WEIGHTS,
  ALIGNMENT_TOLERANCE,
  HIGH_THRESHOLD,
  READY_THRESHOLD,
} from "./posture-config";

export type OuraRow = Database["public"]["Tables"]["oura_daily"]["Row"];
export type AgentRow = Database["public"]["Tables"]["agent_daily"]["Row"];

// ---------- Raw display vitals ----------

export type HumanVitals = {
  day: string;
  updatedAt: string;
  readiness: number | null;
  sleepScore: number | null;
  sleepEfficiency: number | null;
  restingHr: number | null;
  hrv: number | null;
  temperatureDeviation: number | null;
  activityScore: number | null;
  steps: number | null;
  activeCalories: number | null;
  totalCalories: number | null;
};

export type AgentVitals = {
  day: string;
  readiness: number | null;
  freshness: number | null;
  lastContextRefresh: string | null;
  cacheHitRate: number | null; // percent 0–100
  baselineLatencyMs: number | null;
  latencyVariabilityMs: number | null;
  errorRateDeviation: number | null; // fraction
  errorRate: number | null; // fraction
  activityScore: number | null;
  callCount: number | null;
  totalTokens: number | null;
  correctionRate: number | null; // fraction
  retryRate: number | null; // fraction
  contextFill: number | null; // fraction
  functionSuccessRate: number | null; // fraction
  functionFailureCount: number | null;
  functionLatencyMs: number | null;
};

const num = (v: number | string | null | undefined): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export function toHumanVitals(row: OuraRow | null | undefined): HumanVitals | null {
  if (!row) return null;
  return {
    day: row.day,
    updatedAt: row.updated_at,
    readiness: num(row.readiness_score),
    sleepScore: num(row.sleep_score),
    sleepEfficiency: num(row.sleep_efficiency),
    restingHr: num(row.resting_heart_rate),
    hrv: num(row.average_hrv),
    temperatureDeviation: num(row.temperature_deviation),
    activityScore: num(row.activity_score),
    steps: num(row.steps),
    activeCalories: num(row.active_calories),
    totalCalories: num(row.total_calories),
  };
}

export function toAgentVitals(row: AgentRow | null | undefined): AgentVitals | null {
  if (!row) return null;
  const raw = (row.raw ?? {}) as Record<string, unknown>;
  const last = typeof raw["last_context_refresh"] === "string" ? raw["last_context_refresh"] : null;
  return {
    day: row.day,
    readiness: num(row.readiness_score),
    freshness: num(row.freshness_score),
    lastContextRefresh: last,
    cacheHitRate: num(row.cache_hit_rate),
    baselineLatencyMs: num(row.baseline_latency_ms),
    latencyVariabilityMs: num(row.latency_variability_ms),
    errorRateDeviation: num(row.error_rate_deviation),
    errorRate: num(row.error_rate),
    activityScore: num(row.activity_score),
    callCount: num(row.call_count),
    totalTokens: num(row.total_tokens),
    correctionRate: num(row.correction_rate),
    retryRate: num(row.retry_rate),
    contextFill: num(row.avg_context_fill),
    functionSuccessRate: num(row.function_success_rate),
    functionFailureCount: num(row.function_failure_count),
    functionLatencyMs: num(row.function_latency_ms),
  };
}

// ---------- Normalization helpers ----------

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const NEUTRAL = 0.5;

/** 0–100 score → 0–1, neutral when missing. */
const score = (v: number | null) => (v == null ? NEUTRAL : clamp01(v / 100));
/** Fraction → 0–1, neutral when missing. */
const frac = (v: number | null, fallback = NEUTRAL) => (v == null ? fallback : clamp01(v));

/**
 * Position of a value within the user's own recent range (no population
 * thresholds). Neutral when the value is missing or the range is flat.
 */
function withinRecent(v: number | null, history: (number | null)[]): number {
  if (v == null) return NEUTRAL;
  const vals = history.filter((x): x is number => x != null);
  if (vals.length < 2) return NEUTRAL;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (max - min < 1e-9) return NEUTRAL;
  return clamp01((v - min) / (max - min));
}

// ---------- Visual state (renderer input) ----------

export type HumanVisual = {
  intensity: number; // readiness → luminosity / glow
  stability: number; // sleep score → steady light
  clarity: number; // sleep efficiency → sharp transmission
  pulseHz: number; // resting HR → very subtle pulse cadence (clamped)
  coherence: number; // HRV (within own range) → synchronized particles
  warmth: number; // |temperature deviation| → warm edge shift
  activity: number; // activity score → motion
  eventRate: number; // steps (within own range) → surface events
  throughput: number; // calories (within own range) → energy throughput
};

export type AgentVisual = {
  intensity: number; // readiness
  freshness: number; // freshness → awake/current
  efficiency: number; // cache hit rate → direct routing
  speed: number; // baseline latency (inverse, within own range) → transmission speed
  jitter: number; // latency variability (within own range)
  anomaly: number; // error-rate deviation → restrained amber
  activity: number; // activity score
  eventRate: number; // call count (within own range)
  volume: number; // tokens (within own range)
  correction: number; // correction rate → rerouting / coherence loss
  echo: number; // retry rate → echo signals
  load: number; // context fill → density, quieter halo
};

export type CenterVisual = {
  brightness: number; // both ready → brighter core
  balance: number; // -1 human stronger … +1 agent stronger
};

export type DyadVisualState = {
  human: HumanVisual | null;
  agent: AgentVisual | null;
  center: CenterVisual;
};

export function toHumanVisual(v: HumanVitals | null, history: OuraRow[]): HumanVisual | null {
  if (!v) return null;
  const rhr = v.restingHr;
  return {
    intensity: score(v.readiness),
    stability: score(v.sleepScore),
    clarity: score(v.sleepEfficiency),
    // Pulse runs at a fraction of the heart rate so it never reads as a heartbeat.
    pulseHz: rhr == null ? 0.15 : Math.min(0.3, Math.max(0.08, (rhr / 60) * 0.18)),
    coherence: withinRecent(v.hrv, history.map((r) => num(r.average_hrv))),
    warmth: v.temperatureDeviation == null ? 0 : clamp01(Math.abs(v.temperatureDeviation) / 1.5),
    activity: score(v.activityScore),
    eventRate: withinRecent(v.steps, history.map((r) => num(r.steps))),
    throughput: withinRecent(v.activeCalories, history.map((r) => num(r.active_calories))),
  };
}

export function toAgentVisual(v: AgentVitals | null, history: AgentRow[]): AgentVisual | null {
  if (!v) return null;
  const lat = withinRecent(v.baselineLatencyMs, history.map((r) => num(r.baseline_latency_ms)));
  return {
    intensity: score(v.readiness),
    freshness: score(v.freshness),
    efficiency: v.cacheHitRate == null ? NEUTRAL : clamp01(v.cacheHitRate / 100),
    speed: v.baselineLatencyMs == null ? NEUTRAL : 1 - lat,
    jitter: withinRecent(v.latencyVariabilityMs, history.map((r) => num(r.latency_variability_ms))),
    anomaly: v.errorRateDeviation == null ? 0 : clamp01(v.errorRateDeviation / 0.15),
    activity: score(v.activityScore),
    eventRate: withinRecent(v.callCount, history.map((r) => num(r.call_count))),
    volume: withinRecent(v.totalTokens, history.map((r) => num(r.total_tokens))),
    correction: frac(v.correctionRate, 0),
    echo: frac(v.retryRate, 0),
    load: frac(v.contextFill, 0),
  };
}

export function toCenterVisual(h: number | null, a: number | null): CenterVisual {
  if (h == null || a == null) return { brightness: 0.35, balance: 0 };
  return {
    brightness: clamp01(Math.min(h, a) / 100),
    balance: Math.max(-1, Math.min(1, (a - h) / 40)),
  };
}

// ---------- Operating posture ----------

export type InterruptionPosture = "PROACTIVE" | "NORMAL" | "PROTECT_ATTENTION" | "HOLD_BACK";
export type DyadState = "A_ALIGNED" | "B_HUMAN_LOWER" | "C_AGENT_LOWER" | "D_BOTH_LOWER";

export type DyadOperatingPosture = {
  state: DyadState;
  interruption: InterruptionPosture;
  delta: number; // agent − human
  aligned: boolean;
  headline: string;
  human: string[];
  agent: string[];
};

/** Pure: compares human and agent readiness and returns today's posture. */
export function getDyadOperatingPosture(
  humanReadiness: number | null,
  agentReadiness: number | null,
): DyadOperatingPosture | null {
  if (humanReadiness == null || agentReadiness == null) return null;
  const delta = agentReadiness - humanReadiness;
  const aligned = Math.abs(delta) <= ALIGNMENT_TOLERANCE;
  const hReady = humanReadiness >= READY_THRESHOLD;
  const aReady = agentReadiness >= READY_THRESHOLD;

  if (!hReady && !aReady) {
    return {
      state: "D_BOTH_LOWER",
      interruption: "HOLD_BACK",
      delta,
      aligned,
      headline: "Both sides are running lower. Keep the system quiet and focus on essentials.",
      human: ["Reduce load.", "Refresh the agent when it suits you."],
      agent: ["Hold back.", "Minimize nonessential interruptions.", "Focus on necessary actions."],
    };
  }
  if (!aReady || (hReady && delta < -ALIGNMENT_TOLERANCE)) {
    return {
      state: "C_AGENT_LOWER",
      interruption: "HOLD_BACK",
      delta,
      aligned,
      headline: "You're ready. Your agent needs a refresh before taking more of the load.",
      human: ["Refresh the agent before leaning heavily on it."],
      agent: ["Hold back.", "Reduce proactive interruption.", "Flag uncertainty instead of guessing."],
    };
  }
  if (!hReady || delta > ALIGNMENT_TOLERANCE) {
    return {
      state: "B_HUMAN_LOWER",
      interruption: "PROTECT_ATTENTION",
      delta,
      aligned,
      headline: "Agent capacity is stronger today. Lean on Dyad and protect your attention.",
      human: ["Lean on the agent.", "Offload cognitive work where it fits."],
      agent: ["Protect attention.", "Handle background work.", "Interrupt only when meaningful."],
    };
  }
  const high = humanReadiness >= HIGH_THRESHOLD && agentReadiness >= HIGH_THRESHOLD;
  return {
    state: "A_ALIGNED",
    interruption: high ? "PROACTIVE" : "NORMAL",
    delta,
    aligned,
    headline: "Both sides are ready. Work collaboratively.",
    human: ["Use the system actively."],
    agent: high
      ? ["Be proactive.", "Surface useful work early."]
      : ["Work at a normal cadence.", "Surface useful items as they come up."],
  };
}

/**
 * The observed vital costing the most points in the existing readiness
 * formula (refresh_agent_daily). Explains — never recomputes — readiness.
 */
export function agentLimitingFactor(v: AgentVitals | null): string | null {
  if (!v) return null;
  const w = AGENT_READINESS_WEIGHTS;
  const losses: [string, number][] = [
    ["freshness", w.freshness * (100 - (v.freshness ?? 0))],
    ["correction rate", w.correction * 100 * (v.correctionRate ?? 0)],
    ["error rate", w.error * 100 * Math.min(1, v.errorRate ?? 0)],
    ["context fill", w.contextFill * 100 * Math.min(1, v.contextFill ?? 0)],
    ["retry rate", w.retry * 100 * Math.min(1, v.retryRate ?? 0)],
  ];
  losses.sort((a, b) => b[1] - a[1]);
  const top = losses[0];
  return top && top[1] > 1 ? top[0] : null;
}
