import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard } from "@/components/dyad/glass-card";
import { SyncInsightsCard } from "@/components/dyad/sync-insights-card";
import { CheckinCard } from "@/components/dyad/checkin-card";
import { AskDyadCard } from "@/components/dyad/ask-dyad-card";
import wordmark from "@/assets/dyad-wordmark.png.asset.json";
import { ReadinessRing } from "@/components/dyad/readiness-ring";
import { cn } from "@/lib/utils";
import { DyadBrain, type BrainRegion } from "@/components/dyad/dyad-brain";
import { RegionPanel } from "@/components/dyad/brain-panel";
import {
  getDyadOperatingPosture,
  toAgentVisual,
  toAgentVitals,
  toCenterVisual,
  toHumanVisual,
  toHumanVitals,
  type AgentRow,
  type DyadVisualState,
  type OuraRow,
} from "@/lib/dyad/vitals";

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
      { property: "og:image", content: "https://dyadai.me/og-image.jpg" },
      { name: "twitter:image", content: "https://dyadai.me/og-image.jpg" },
    ],
  }),
  component: Dashboard,
});

// Loads the newest 14 oura_daily and agent_daily rows for the signed-in user
// (newest drives the display; the rest give each metric its own recent range),
// and runs the existing oura-sync once so the human side is fresh.
function useDyadData() {
  const { user } = useAuth();
  const [ouraRows, setOuraRows] = useState<OuraRow[]>([]);
  const [ouraConnected, setOuraConnected] = useState<boolean | null>(null);
  const [agentRows, setAgentRows] = useState<AgentRow[]>([]);

  useEffect(() => {
    if (!user) {
      setOuraRows([]);
      setAgentRows([]);
      return;
    }
    let cancelled = false;

    async function loadOura() {
      const { data } = await supabase
        .from("oura_daily")
        .select("*")
        .order("day", { ascending: false })
        .limit(14);
      if (!cancelled) setOuraRows(data ?? []);
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
        .select("*")
        .eq("agent_id", agent.id)
        .order("day", { ascending: false })
        .limit(14);
      if (!cancelled) setAgentRows(data ?? []);
    }

    void loadOura();
    void loadAgent();
    async function syncOura() {
      // Only call oura-sync with a live session token; otherwise the function
      // rejects with 401 not_signed_in.
      // getUser() validates the session with Supabase; a stale or foreign
      // token would otherwise be rejected by the function with 401.
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        // Saved session is no longer valid: clear it so the UI shows "Sign in".
        if (userErr?.status === 401 || userErr?.status === 403) {
          await supabase.auth.signOut({ scope: "local" });
        }
        return;
      }
      if (cancelled) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token || cancelled) return;
      try {
        const { data, error } = await supabase.functions.invoke("oura-sync", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (error) {
          console.warn("oura-sync failed", error.message);
          return;
        }
        setOuraConnected(typeof data?.connected === "boolean" ? data.connected : null);
        if (data?.connected) void loadOura();
      } catch (e) {
        console.warn("oura-sync failed", e);
      }
    }
    void syncOura();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { user, ouraRows, ouraConnected, agentRows };
}

async function connectOura() {
  const { data, error } = await supabase.functions.invoke("oura-auth-start");
  if (!error && data?.url) window.location.assign(data.url);
}

function Dashboard() {
  const { user, ouraRows, ouraConnected, agentRows } = useDyadData();
  const signedOut = user ? undefined : "Sign in to see your data";
  const [region, setRegion] = useState<BrainRegion>("center");

  const human = useMemo(() => toHumanVitals(ouraRows[0]), [ouraRows]);
  const agent = useMemo(() => toAgentVitals(agentRows[0]), [agentRows]);
  const posture = useMemo(
    () => getDyadOperatingPosture(human?.readiness ?? null, agent?.readiness ?? null),
    [human, agent],
  );
  const visual = useMemo<DyadVisualState>(
    () => ({
      human: toHumanVisual(human, ouraRows),
      agent: toAgentVisual(agent, agentRows),
      center: toCenterVisual(human?.readiness ?? null, agent?.readiness ?? null),
    }),
    [human, agent, ouraRows, agentRows],
  );
  const oura = ouraRows[0] ?? null;
  const agentDay = agentRows[0] ?? null;

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

        <section aria-label="Dyad brain" className="mt-10 grid gap-6 md:mt-14 lg:grid-cols-[1.5fr_1fr]">
          <GlassCard tone="dyad" className="overflow-hidden p-0">
            <DyadBrain
              visual={visual}
              selected={region}
              onSelect={setRegion}
              className="h-[360px] w-full sm:h-[440px]"
            />
            <div className="flex items-center justify-center gap-2 border-t border-glass-line/60 px-4 py-3">
              {(["human", "center", "agent"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegion(r)}
                  aria-pressed={region === r}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[10px] uppercase tracking-[0.25em] transition-colors",
                    region === r ? "glass-card text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r === "center" ? "Dyad" : r}
                </button>
              ))}
            </div>
          </GlassCard>
          <div className="min-w-0">
            {user ? (
              <RegionPanel region={region} human={human} agent={agent} posture={posture} />
            ) : (
              <GlassCard tone="dyad" className="px-5 py-6 text-sm text-muted-foreground">
                Sign in to light up the brain with your Oura and agent vitals.
              </GlassCard>
            )}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.15fr_1fr]">
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
            <ReadinessCard
              tone="dyad"
              label="Today's posture"
              caption={
                signedOut ??
                (posture ? posture.interruption.replace("_", " ").toLowerCase() : "Needs both readiness scores")
              }
            />
            <CheckinCard />
            <AskDyadCard />
            <SyncInsightsCard />
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

      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div>
        <h1>
          <img
            src={wordmark.url}
            alt="Dyad"
            className="h-8 w-auto mix-blend-screen md:h-10"
          />
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
