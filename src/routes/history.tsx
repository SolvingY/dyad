import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard } from "@/components/dyad/glass-card";
import { BrandLogo } from "@/components/dyad/brand-logo";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccess } from "@/lib/account-approval.functions";
import type { AgentRow, OuraRow } from "@/lib/dyad/vitals";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Trends — Dyad" },
      {
        name: "description",
        content: "How you and your agent have been trending, side by side over the last 30 days.",
      },
      { property: "og:title", content: "Trends — Dyad" },
      {
        property: "og:description",
        content: "How you and your agent have been trending, side by side over the last 30 days.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HistoryPage,
});

const DAY_MS = 86_400_000;

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function HistoryPage() {
  const { user, loading } = useAuth();
  const getAccess = useServerFn(getMyAccess);
  const [access, setAccess] = useState<{ status: "pending" | "approved" | "denied"; isAdmin: boolean } | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getAccess()
      .then(setAccess)
      .catch((error) => setAccessError(error instanceof Error ? error.message : "Could not verify account access."));
  }, [user, getAccess]);

  if (loading || !user || (!access && !accessError)) return <div className="dyad-ambient h-dvh" />;
  if (accessError || access?.status !== "approved") {
    return (
      <div className="dyad-ambient flex min-h-dvh items-center justify-center px-6">
        <GlassCard tone="dyad" className="w-full max-w-lg p-8 text-center">
          <BrandLogo className="mx-auto h-10" />
          <h1 className="mt-8 font-display text-3xl font-extralight text-foreground">
            {accessError ? "Access check unavailable" : access?.status === "denied" ? "Access denied" : "Approval pending"}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-foreground">
            {accessError ??
              (access?.status === "denied"
                ? "Your Dyad account is not approved. Contact the administrator if you believe this is a mistake."
                : "Your account is ready and waiting for administrator approval.")}
          </p>
        </GlassCard>
      </div>
    );
  }
  return <Trends />;
}

type Trend = {
  label: string;
  // Chronological, oldest first.
  points: { day: string; v: number | null }[];
  format: (v: number) => string;
};

function Trends() {
  const [ouraRows, setOuraRows] = useState<OuraRow[]>([]);
  const [ouraError, setOuraError] = useState<string | null>(null);
  const [agentRows, setAgentRows] = useState<AgentRow[]>([]);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [{ data, error }, { data: agents }] = await Promise.all([
        supabase.from("oura_daily").select("*").order("day", { ascending: false }).limit(30),
        supabase.from("agents").select("id, name, source").order("created_at"),
      ]);
      if (error) {
        setOuraError(error.message);
        setOuraRows([]);
      } else {
        setOuraError(null);
        setOuraRows(data ?? []);
      }
      const agent = agents?.find((a) => a.source === "builtin") ?? agents?.[0];
      if (!agent) return;
      setAgentName(agent.name);
      const { data: daily, error: dailyErr } = await supabase
        .from("agent_daily")
        .select("*")
        .eq("agent_id", agent.id)
        .order("day", { ascending: false })
        .limit(30);
      if (dailyErr) {
        setAgentError(dailyErr.message);
        setAgentRows([]);
      } else {
        setAgentError(null);
        setAgentRows(daily ?? []);
      }
    })();
  }, []);

  const int = (v: number) => v.toLocaleString();
  const ms = (v: number) => `${Math.round(v)} ms`;
  const bpm = (v: number) => `${Math.round(v)} bpm`;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  // Rows arrive day-descending; flip to chronological for the charts.
  const chron = <T extends { day: string }>(rows: T[]) => [...rows].reverse();

  const humanTrends: Trend[] = [
    { label: "Readiness", points: chron(ouraRows).map((r) => ({ day: r.day, v: r.readiness_score })), format: int },
    { label: "Sleep", points: chron(ouraRows).map((r) => ({ day: r.day, v: r.sleep_score })), format: int },
    { label: "HRV", points: chron(ouraRows).map((r) => ({ day: r.day, v: r.average_hrv })), format: ms },
    {
      label: "Resting heart rate",
      points: chron(ouraRows).map((r) => ({ day: r.day, v: r.resting_heart_rate })),
      format: bpm,
    },
    { label: "Steps", points: chron(ouraRows).map((r) => ({ day: r.day, v: r.steps })), format: int },
  ];
  const agentTrends: Trend[] = [
    { label: "Readiness", points: chron(agentRows).map((r) => ({ day: r.day, v: r.readiness_score })), format: int },
    { label: "Freshness", points: chron(agentRows).map((r) => ({ day: r.day, v: r.freshness_score })), format: int },
    { label: "Calls", points: chron(agentRows).map((r) => ({ day: r.day, v: r.call_count })), format: int },
    { label: "Error rate", points: chron(agentRows).map((r) => ({ day: r.day, v: r.error_rate })), format: pct },
    { label: "Correction rate", points: chron(agentRows).map((r) => ({ day: r.day, v: r.correction_rate })), format: pct },
  ];

  const range = (rows: { day: string }[]) => {
    const days = rows.map((r) => r.day).sort();
    if (!days.length) return null;
    const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
    const [first, last] = [days[0], days[days.length - 1]];
    return first && last ? (first === last ? fmt(first) : `${fmt(first)} – ${fmt(last)}`) : null;
  };

  return (
    <div className="dyad-ambient relative min-h-dvh">
      <main className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-6 md:px-6">
        <header className="flex items-center justify-between gap-4">
          <a href="/app" className="shrink-0" aria-label="Back to dashboard">
            <BrandLogo className="h-7 md:h-9" />
          </a>
          <a
            href="/app"
            className="glass-card rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-foreground"
          >
            Dashboard
          </a>
        </header>

        <h1 className="mt-10 text-center font-display text-4xl font-extralight tracking-tight text-foreground md:text-5xl">
          Trends
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-foreground">
          You and your agent, side by side over the last 30 days.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section aria-label="You" className="flex flex-col gap-5">
            <div className="flex items-center gap-3 px-1">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-human shadow-[0_0_12px_var(--human)]" />
              <h2 className="text-[11px] font-medium uppercase tracking-[0.35em] text-human">You</h2>
              <span className="ml-auto text-[10px] tracking-[0.2em] text-foreground">
                {ouraError ? "" : (range(ouraRows) ?? "")}
              </span>
            </div>
            {ouraError ? (
              <GlassCard tone="human" className="px-5 py-5 text-xs text-foreground">Oura error: {ouraError}</GlassCard>
            ) : ouraRows.length === 0 ? (
              <GlassCard tone="human" className="px-5 py-5 text-xs text-foreground">
                No Oura data yet. Sync from the dashboard once your ring is connected.
              </GlassCard>
            ) : (
              humanTrends.map((t) => <TrendCard key={t.label} tone="human" trend={t} />)
            )}
          </section>

          <section aria-label="Agent" className="flex flex-col gap-5">
            <div className="flex items-center gap-3 px-1">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-agent shadow-[0_0_12px_var(--agent)]" />
              <h2 className="text-[11px] font-medium uppercase tracking-[0.35em] text-agent">
                {agentName ?? "Agent"}
              </h2>
              <span className="ml-auto text-[10px] tracking-[0.2em] text-foreground">
                {agentError ? "" : (range(agentRows) ?? "")}
              </span>
            </div>
            {agentError ? (
              <GlassCard tone="agent" className="px-5 py-5 text-xs text-foreground">Agent error: {agentError}</GlassCard>
            ) : agentRows.length === 0 ? (
              <GlassCard tone="agent" className="px-5 py-5 text-xs text-foreground">
                No agent activity recorded yet. It appears as your agent works.
              </GlassCard>
            ) : (
              agentTrends.map((t) => <TrendCard key={t.label} tone="agent" trend={t} />)
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function TrendCard({ tone, trend }: { tone: "human" | "agent"; trend: Trend }) {
  const latest = [...trend.points].reverse().find((p) => p.v != null);
  const latestDay = latest
    ? new Date(`${latest.day}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })
    : null;
  return (
    <GlassCard tone={tone} className="px-5 pb-4 pt-5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[10px] uppercase tracking-[0.25em] text-foreground">{trend.label}</span>
        <span className="font-display text-2xl font-extralight tracking-tight text-foreground">
          {latest?.v != null ? trend.format(latest.v) : "—"}
          {latestDay && <span className="ml-2 text-[10px] tracking-[0.15em] text-foreground">{latestDay}</span>}
        </span>
      </div>
      <Sparkline tone={tone} points={trend.points.map((p) => p.v)} />
    </GlassCard>
  );
}

function Sparkline({ tone, points }: { tone: "human" | "agent"; points: (number | null)[] }) {
  const w = 240;
  const h = 48;
  const vals = points.filter((v): v is number => v != null);
  if (vals.length < 2) {
    return (
      <div className="flex h-12 items-center text-xs text-foreground">
        {vals.length === 1 ? "One day recorded" : "No data yet"}
      </div>
    );
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * w : w / 2);
  const y = (v: number) => h - 4 - ((v - min) / span) * (h - 8);

  // One path per run of consecutive known values, so gaps stay open.
  const paths: string[] = [];
  let cur: string[] = [];
  points.forEach((v, i) => {
    if (v != null) {
      cur.push(`${cur.length === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    } else if (cur.length) {
      paths.push(cur.join(" "));
      cur = [];
    }
  });
  if (cur.length) paths.push(cur.join(" "));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-3 h-12 w-full" aria-hidden="true">
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={tone === "human" ? "var(--human)" : "var(--agent)"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
