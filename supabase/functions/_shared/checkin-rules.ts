// When an agent must hold off checking in on the human, whichever agent it is
// (Dyad's built-in agent or one connected over MCP).

const MAX_ASKS_PER_DAY = 3;
const QUIET_AFTER_RESPONSE_MS = 2 * 60 * 60 * 1000;

type TodayCheckin = { decision: string; responded_at: string | null };

/** The reason to hold, given today's check-ins (America/Chicago day), or null if asking is allowed. */
export function holdReason(today: TodayCheckin[], now: Date): string | null {
  const answeredRecently = today.some(
    (c) =>
      c.responded_at &&
      now.getTime() - new Date(c.responded_at).getTime() < QUIET_AFTER_RESPONSE_MS,
  );
  if (answeredRecently) return "The human answered a check-in in the last 2 hours.";
  if (today.filter((c) => c.decision === "ask").length >= MAX_ASKS_PER_DAY) {
    return `Already asked ${MAX_ASKS_PER_DAY} times today.`;
  }
  return null;
}
