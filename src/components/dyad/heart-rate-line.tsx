import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Pt = { ts: string; bpm: number; source: string | null };

/** Today's heart rate summary on the You card. Refreshes whenever a sync finishes. */
export function HeartRateLine({
  refreshKey,
  restingHr,
  onReconnect,
}: {
  refreshKey: unknown;
  restingHr: number | null | undefined;
  onReconnect: () => void;
}) {
  const [pts, setPts] = useState<Pt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data, error } = await supabase
        .from("oura_heartrate")
        .select("ts, bpm, source")
        .gte("ts", since)
        .order("ts");
      setError(error?.message ?? null);
      setPts(data ?? []);
    })();
  }, [refreshKey]);

  if (error) return <p>Heart rate error: {error}</p>;
  if (!pts) return null;
  if (pts.length === 0)
    return (
      <p>
        No heart rate yet.{" "}
        <button type="button" onClick={onReconnect} className="text-human hover:underline">
          Reconnect Oura
        </button>{" "}
        to share heart rate and workouts.
      </p>
    );

  const awake = pts.filter((p) => p.source !== "sleep");
  const hourAgo = Date.now() - 3600_000;
  const lastHour = awake.filter((p) => new Date(p.ts).getTime() >= hourAgo);
  const avg = (l: Pt[]) => (l.length ? Math.round(l.reduce((s, p) => s + p.bpm, 0) / l.length) : null);
  const latest = pts.at(-1)!;
  const hourAvg = avg(lastHour);
  const high = restingHr != null && hourAvg != null && lastHour.length >= 3 && hourAvg - restingHr > 15;

  return (
    <p>
      <span className="text-human">Heart rate</span> {latest.bpm} bpm at{" "}
      {new Date(latest.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      {avg(awake) != null && ` · awake avg ${avg(awake)}`}
      {high && <span className="ml-1 font-medium text-ember"> · Running high</span>}
    </p>
  );
}
