import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard } from "@/components/dyad/glass-card";
import { ReadinessRing } from "@/components/dyad/readiness-ring";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dyad — Shared vitals for human & agent" },
      {
        name: "description",
        content:
          "A calm, futuristic dashboard pairing human vitals with AI agent telemetry.",
      },
      { property: "og:title", content: "Dyad — Shared vitals for human & agent" },
      {
        property: "og:description",
        content: "A calm, futuristic dashboard pairing human vitals with AI agent telemetry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type OuraDay = {
  day: string;
  readiness_score: number | null;
  sleep_score: number | null;
  average_hrv: number | null;
};
type AgentDay = {
  day: string;
  readiness_score: number | null;
  call_count: number | null;
  error_rate: number | null;
};

// Loads the latest oura_daily and agent_daily rows for the signed-in user, and
// runs oura-sync once so the human side is fresh.
function useDyadData() {
  const { user } = useAuth();
  const [oura, setOura] = useState<OuraDay | null>(null);
  const [ouraConnected, setOuraConnected] = useState<boolean | null>(null);
  const [agentDay, setAgentDay] = useState<AgentDay | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadOura() {
      const { data } = await supabase
        .from("oura_daily")
        .select("day, readiness_score, sleep_score, average_hrv")
        .order("day", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setOura(data);
    }

    async function loadAgent() {
      const { data: agent } = await supabase
        .from("agents")
        .select("id")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (!agent) return;
      const { data } = await supabase
        .from("agent_daily")
        .select("day, readiness_score, call_count, error_rate")
        .eq("agent_id", agent.id)
        .order("day", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setAgentDay(data);
    }

    void loadOura();
    void loadAgent();
    void supabase.functions.invoke("oura-sync").then(({ data }) => {
      if (cancelled) return;
      setOuraConnected(typeof data?.connected === "boolean" ? data.connected : null);
      if (data?.connected) void loadOura();
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { user, oura, ouraConnected, agentDay };
}

async function connectOura() {
  const { data, error } = await supabase.functions.invoke("oura-auth-start");
  if (!error && data?.url) window.location.assign(data.url);
}

function Dashboard() {
  const { user, oura, ouraConnected, agentDay } = useDyadData();
  const signedOut = user ? undefined : "Sign in to see your data";

  return (
    <div className="dyad-ambient relative min-h-screen overflow-hidden">
      {/* Faint grid texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--glass-line) 1px, transparent 1px), linear-gradient(to bottom, var(--glass-line) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(70rem 45rem at 50% 0%, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(70rem 45rem at 50% 0%, black 30%, transparent 75%)",
        }}
      />

      <main className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-10 md:pt-14">
        <Header />

        <div className="mt-12 grid gap-6 md:mt-16 lg:grid-cols-[1fr_1.15fr_1fr]">
          <section aria-label="Human" className="flex flex-col gap-5">
            <ColumnHeader title="Human" dotClassName="bg-human" glowClassName="shadow-[0_0_12px_var(--human)]" />
            <ReadinessCard
              tone="human"
              label="Readiness"
              value={oura?.readiness_score}
              caption={signedOut ?? (oura ? `Oura · ${oura.day}` : "No Oura data yet")}
              action={
                ouraConnected === false && (
                  <button
                    type="button"
                    onClick={connectOura}
                    className="glass-card mt-4 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                  >
                    Connect Oura
                  </button>
                )
              }
            />
            <SlotCard index="01" tone="human" label="Sleep score" value={oura?.sleep_score} />
            <SlotCard
              index="02"
              tone="human"
              label="Avg HRV"
              value={oura?.average_hrv == null ? null : `${Math.round(oura.average_hrv)} ms`}
            />
          </section>

          <section aria-label="Cross-analysis" className="relative flex flex-col gap-5">
            <ColumnHeader
              title="Cross-analysis"
              dotClassName="bg-gradient-to-br from-human to-agent"
              glowClassName="shadow-[0_0_12px_var(--glow-dyad)]"
            />
            <ReadinessCard tone="dyad" label="Alignment" />
            <SlotCard index="01" tone="dyad" />
          </section>

          <section aria-label="Agent" className="flex flex-col gap-5">
            <ColumnHeader title="Agent" dotClassName="bg-agent" glowClassName="shadow-[0_0_12px_var(--agent)]" />
            <ReadinessCard
              tone="agent"
              label="Readiness"
              value={agentDay?.readiness_score}
              caption={signedOut ?? (agentDay ? `Agent · ${agentDay.day}` : "No agent calls yet")}
            />
            <SlotCard index="01" tone="agent" label="Calls" value={agentDay?.call_count} />
            <SlotCard
              index="02"
              tone="agent"
              label="Error rate"
              value={
                agentDay?.error_rate == null ? null : `${Math.round(agentDay.error_rate * 100)}%`
              }
            />
          </section>
        </div>

        <footer className="mt-14 flex items-center justify-center gap-4 text-[11px] uppercase tracking-[0.25em] text-muted-foreground/60">
          <a href="/terms" className="transition-colors hover:text-foreground/80">
            Terms
          </a>
          <span aria-hidden="true" className="size-1 rounded-full bg-glass-line-luminous" />
          <a href="/privacy" className="transition-colors hover:text-foreground/80">
            Privacy
          </a>
        </footer>

        <p className="mt-6 text-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground/60">
          Shell build · schema pending
        </p>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="font-display text-2xl font-light uppercase tracking-[0.45em] text-foreground/90">
          Dyad
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Shared vitals for a human and their AI agent.
        </p>
      </div>
      <AccountChip />
    </header>
  );
}

function AccountChip() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const chip =
    "glass-card inline-flex items-center gap-2.5 self-start rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground";

  if (loading) return <div className={chip}>…</div>;
  if (!user)
    return (
      <Link to="/auth" className={cn(chip, "hover:text-foreground")}>
        <span className="size-1.5 rounded-full bg-glass-line-luminous" />
        Sign in
      </Link>
    );
  return (
    <div className={chip}>
      <span className="size-1.5 rounded-full bg-agent shadow-[0_0_8px_var(--agent)]" />
      <span className="max-w-[12rem] truncate normal-case tracking-normal">{user.email}</span>
      <Link to="/agent" className="ml-1 hover:text-foreground">
        Agent
      </Link>
      <button
        type="button"
        className="ml-1 hover:text-foreground"
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/", replace: true });
        }}
      >
        Sign out
      </button>
    </div>
  );
}

function ColumnHeader({
  title,
  dotClassName,
  glowClassName,
}: {
  title: string;
  dotClassName?: string;
  glowClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-1">
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", dotClassName, glowClassName)}
      />
      <h2 className="text-[11px] font-medium uppercase tracking-[0.35em] text-foreground/60">
        {title}
      </h2>
    </div>
  );
}

function ReadinessCard({
  tone,
  label,
  value,
  caption = "Awaiting schema",
  action,
}: {
  tone: "human" | "agent" | "dyad";
  label: string;
  value?: number | null | undefined;
  caption?: string;
  action?: ReactNode;
}) {
  return (
    <GlassCard tone={tone} className="flex flex-col items-center px-6 pb-8 pt-6">
      <div className="flex w-full items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground/50">
          RING
        </span>
      </div>
      <ReadinessRing tone={tone} value={value} className="mt-7" />
      <p className="mt-6 font-display text-5xl font-extralight tracking-tight text-foreground/85">
        {value ?? "—"}
      </p>
      <p className="mt-2 text-xs text-muted-foreground/80">{caption}</p>
      {action}
    </GlassCard>
  );
}

function SlotCard({
  index,
  tone,
  label,
  value,
}: {
  index: string;
  tone: "human" | "agent" | "dyad";
  label?: string;
  value?: number | string | null | undefined;
}) {
  return (
    <GlassCard tone={tone} className="flex flex-1 flex-col px-6 pb-6 pt-6">
      {tone === "dyad" && (
        <span
          aria-hidden="true"
          className="dyad-gradient-line absolute inset-x-6 top-0 h-px"
        />
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Slot {index}
        </span>
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground/50">
          00 / 00
        </span>
      </div>
      <p className="mt-8 font-display text-4xl font-extralight tracking-tight text-foreground/80">
        {value ?? "—"}
      </p>
      <p className="mt-3 text-xs text-muted-foreground/80">{label ?? "Awaiting schema"}</p>
    </GlassCard>
  );
}
