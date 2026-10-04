import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard } from "@/components/dyad/glass-card";
import { ApprovedGate, PageHeader } from "@/components/dyad/approved-gate";

export const Route = createFileRoute("/reminders")({
  head: () => ({
    meta: [
      { title: "Reminders — Dyad" },
      { name: "description", content: "Choose when your agent notifies you inside Dyad, and how often." },
      { property: "og:title", content: "Reminders — Dyad" },
      { property: "og:description", content: "Choose when your agent notifies you inside Dyad, and how often." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ApprovedGate>
      <Reminders />
    </ApprovedGate>
  ),
});

const KINDS = [
  { kind: "hr_high", tone: "human", title: "Working too hard", help: "Last hour's heart rate is this many bpm above your resting rate (workouts excluded).", unit: "bpm above resting", def: 15 },
  { kind: "readiness_low", tone: "human", title: "Low readiness", help: "Your Oura readiness is below this score.", unit: "readiness", def: 65 },
  { kind: "agent_latency", tone: "agent", title: "Agent slowing down", help: "Your agent's typical response time is above this.", unit: "ms", def: 3000 },
  { kind: "agent_errors", tone: "agent", title: "Agent errors", help: "Your agent's error rate is above this percent.", unit: "%", def: 10 },
] as const;

const FREQS = [
  { v: 60, label: "At most hourly" },
  { v: 180, label: "Every 3 hours" },
  { v: 1440, label: "Once a day" },
];

type Rem = {
  kind: string;
  enabled: boolean;
  threshold: number | null;
  frequency_minutes: number;
  quiet_start: number | null;
  quiet_end: number | null;
};

const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });

function Reminders() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, Rem>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("kind, enabled, threshold, frequency_minutes, quiet_start, quiet_end");
      if (error) return setError(error.message);
      setRows(Object.fromEntries((data ?? []).map((r) => [r.kind, r as Rem])));
    })();
  }, []);

  const current = (kind: string, def: number): Rem =>
    rows[kind] ?? { kind, enabled: false, threshold: def, frequency_minutes: 180, quiet_start: 22, quiet_end: 7 };

  const save = async (r: Rem) => {
    if (!user) return;
    setRows((all) => ({ ...all, [r.kind]: r }));
    const { error } = await supabase
      .from("reminders")
      .upsert({ ...r, user_id: user.id }, { onConflict: "user_id,kind" });
    setError(error?.message ?? null);
    if (!error) {
      setSaved(r.kind);
      setTimeout(() => setSaved((s) => (s === r.kind ? null : s)), 1500);
    }
  };

  const select = "rounded-lg border border-glass-line bg-background px-2 py-1.5 text-sm text-foreground";

  return (
    <div className="dyad-ambient relative min-h-dvh">
      <main className="relative mx-auto w-full max-w-3xl px-4 pb-16 pt-6 md:px-6">
        <PageHeader />
        <h1 className="mt-10 text-center font-display text-4xl font-extralight tracking-tight text-foreground md:text-5xl">
          Reminders
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-foreground">
          Choose when your agent notifies you. Notifications appear under the bell on your dashboard. Rules are checked every hour.
        </p>
        {error && <GlassCard tone="dyad" className="mt-6 px-5 py-4 text-sm text-foreground">Error: {error}</GlassCard>}

        <div className="mt-10 flex flex-col gap-4">
          {KINDS.map((k) => {
            const r = current(k.kind, k.def);
            return (
              <GlassCard key={k.kind} tone={k.tone} className="px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className={k.tone === "human" ? "text-sm font-medium text-human" : "text-sm font-medium text-agent"}>{k.title}</h2>
                    <p className="mt-1 text-xs text-foreground">{k.help}</p>
                  </div>
                  <label className="flex shrink-0 items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => void save({ ...r, enabled: e.target.checked })}
                      className="size-4 accent-current"
                    />
                    {r.enabled ? "On" : "Off"}
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-foreground">
                  <label className="flex items-center gap-2">
                    Limit
                    <input
                      type="number"
                      defaultValue={r.threshold ?? k.def}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n) && n !== r.threshold) void save({ ...r, threshold: n });
                      }}
                      className={`${select} w-24`}
                    />
                    {k.unit}
                  </label>
                  <select value={r.frequency_minutes} onChange={(e) => void save({ ...r, frequency_minutes: Number(e.target.value) })} className={select} aria-label="How often">
                    {FREQS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
                  </select>
                  <label className="flex items-center gap-2">
                    Quiet
                    <select value={r.quiet_start ?? ""} onChange={(e) => void save({ ...r, quiet_start: e.target.value === "" ? null : Number(e.target.value) })} className={select} aria-label="Quiet from">
                      <option value="">None</option>
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                    </select>
                    to
                    <select value={r.quiet_end ?? ""} onChange={(e) => void save({ ...r, quiet_end: e.target.value === "" ? null : Number(e.target.value) })} className={select} aria-label="Quiet until">
                      <option value="">None</option>
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                    </select>
                  </label>
                  {saved === k.kind && <span className="text-agent">Saved</span>}
                </div>
              </GlassCard>
            );
          })}
        </div>
      </main>
    </div>
  );
}
