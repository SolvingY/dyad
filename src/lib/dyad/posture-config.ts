// Comparison constants for the Dyad operating posture.
// The existing data model defines readiness scores (0–100) but no readiness
// bands or tolerances, so they live here in one place. Tune them here only.

/** Readiness at or above this counts as "ready" for the posture comparison. */
export const READY_THRESHOLD = 70;

/** Both sides at or above this, and aligned, unlocks the proactive posture. */
export const HIGH_THRESHOLD = 80;

/** Differences within this many points are treated as aligned. */
export const ALIGNMENT_TOLERANCE = 8;

/** Agent freshness decays to its floor over this many hours (matches refresh_agent_daily). */
export const FRESHNESS_WINDOW_HOURS = 72;

/**
 * Weights of the existing agent readiness formula in public.refresh_agent_daily.
 * Used only to explain which observed vital is limiting readiness — never to
 * recompute readiness itself. Keep in sync with the SQL function.
 */
export const AGENT_READINESS_WEIGHTS = {
  freshness: 0.3,
  correction: 0.25,
  error: 0.2,
  contextFill: 0.15,
  retry: 0.1,
} as const;
