import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard } from "@/components/dyad/glass-card";
import { DyadThread } from "@/components/dyad/dyad-thread";
import { ReadinessRing } from "@/components/dyad/readiness-ring";
import { cn } from "@/lib/utils";
import type { AgentRow, OuraRow } from "@/lib/dyad/vitals";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Your dashboard — Dyad" },
      {
        name: "description",
        content: "A calm conversation between you and your AI agent, grounded in both of your vitals.",
      },
      { property: "og:title", content: "Your dashboard — Dyad" },
      {
        property: "og:description",
        content: "A calm conversation between you and your AI agent, grounded in both of your vitals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type SyncState = "idle" | "syncing" | "ok" | "failed";

// Today's oura_daily and agent_daily rows for the signed-in user, plus the
// existing oura-sync (run once on sign-in, and on Retry).
function useDyadData() {
  const { user } = useAuth();
  const [oura, setOura] = useState<OuraRow | null>(null);
  const [ouraError, setOuraError] = useState<string | null>(null);
  const [agentDay, setAgentDay] = useState<AgentRow | null>(null);
  const [ouraConnected, setOuraConnected] = useState<boolean | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");

  const loadOura = useCallback(async () => {
    const { data, error } = await supabase
      .from("oura_daily")
      .select("*")
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      setOuraError(error.message);
      setOura(null);
      return;
    }
    setOuraError(null);
    setLastSync(data?.updated_at ?? null);
    setOura(data ?? null);
  }, []);

  const loadAgent = useCallback(async () => {
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
      .eq("day", localDate())
      .maybeSingle();
    setAgentDay(data ?? null);
  }, []);

  const sync = useCallback(async () => {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      if (userErr?.status === 401 || userErr?.status === 403) {
        await supabase.auth.signOut({ scope: "local" });
      }
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    setSyncState("syncing");
    try {
      const { data, error } = await supabase.functions.invoke("oura-sync", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) {
        setSyncState("failed");
        return;
      }
      setOuraConnected(typeof data?.connected === "boolean" ? data.connected : null);
      setSyncState("ok");
      if (data?.connected) await loadOura();
    } catch {
      setSyncState("failed");
    }
  }, [loadOura]);

  useEffect(() => {
    if (!user) {
      setOura(null);
      setAgentDay(null);
      return;
    }
    void loadOura();
    void loadAgent();
    void sync();
  }, [user?.id, loadOura, loadAgent, sync]);

  return { user, oura, ouraError, agentDay, ouraConnected, lastSync, syncState, sync };
}

async function connectOura() {
  const { data, error } = await supabase.functions.invoke("oura-auth-start");
  if (!error && data?.url) window.location.assign(data.url);
}

const pct = (v: number | null | undefined) => (v == null ? null : `${Math.round(v * 100)}%`);

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);
  if (loading || !user) return <div className="dyad-ambient h-dvh" />;
  return <DashboardInner />;
}

function DashboardInner() {
  const d = useDyadData();
  const { oura, agentDay } = d;

  const youStats = [
    { label: "Sleep", value: oura?.sleep_score },
    { label: "HRV", value: oura?.average_hrv == null ? null : `${Math.round(oura.average_hrv)} ms` },
    {
      label: "Resting HR",
      value: oura?.resting_heart_rate == null ? null : `${Math.round(oura.resting_heart_rate)} bpm`,
    },
    { label: "Steps", value: oura?.steps?.toLocaleString() },
  ];
  const agentStats = [
    { label: "Freshness", value: agentDay?.freshness_score },
    { label: "Correction rate", value: pct(agentDay?.correction_rate) },
    { label: "Error rate", value: pct(agentDay?.error_rate) },
    { label: "Calls", value: agentDay?.call_count },
  ];

  return (
    <div className="dyad-ambient relative h-dvh overflow-hidden">
      <main className="relative mx-auto flex h-full w-full max-w-7xl flex-col px-4 pb-4 pt-4 md:px-6">
        <Header />

        {/* Phone: compact ring strip */}
        <div className="mt-3 grid grid-cols-2 gap-3 lg:hidden">
          <MiniRing tone="human" label="You" value={oura?.readiness_score} />
          <MiniRing tone="agent" label="Agent" value={agentDay?.readiness_score} />
        </div>

        <div className="mt-3 grid min-h-0 flex-1 gap-5 lg:mt-6 lg:grid-cols-[17rem_1fr_17rem]">
          <aside aria-label="You" className="hidden min-h-0 flex-col lg:flex">
            <SideCard
              tone="human"
              title="You"
              value={oura?.readiness_score}
              caption={
                d.user
                  ? d.ouraError
                    ? `Oura error: ${d.ouraError}`
                    : oura
                      ? `Readiness · ${new Date(`${oura.day}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}`
                      : "No Oura data yet"
                  : "Sign in"
              }
              stats={youStats}
              footer={
                d.user && (
                  <div className="flex flex-col gap-2 border-t border-glass-line/60 pt-4 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          d.ouraConnected ? "bg-moss" : d.ouraConnected === false ? "bg-ember" : "bg-glass-line-luminous",
                        )}
                      />
                      {d.ouraConnected
                        ? "Oura connected"
                        : d.ouraConnected === false
                          ? "Oura not connected"
                          : "Checking Oura…"}
                    </div>
                    <p>
                      Last sync{" "}
                      {d.lastSync
                        ? new Date(d.lastSync).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
                        : "—"}
                      {d.syncState === "failed" && " · sync failed"}
                    </p>
                    {d.ouraConnected === false ? (
                      <button type="button" onClick={connectOura} className="self-start text-human hover:underline">
                        Connect Oura
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void d.sync()}
                        disabled={d.syncState === "syncing"}
                        className="self-start text-human hover:underline disabled:cursor-not-allowed"
                      >
                        {d.syncState === "syncing" ? "Syncing…" : "Retry sync"}
                      </button>
                    )}
                  </div>
                )
              }
            />
          </aside>

          <section aria-label="Conversation" className="flex min-h-0 flex-col">
            <DyadThread />
          </section>

          <aside aria-label="Agent" className="hidden min-h-0 flex-col lg:flex">
            <SideCard
              tone="agent"
              title="Agent"
              value={agentDay?.readiness_score}
              caption={d.user ? (agentDay ? "Readiness · today" : "No agent activity today") : "Sign in"}
              stats={agentStats}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between gap-4">
      <h1>
        <img
          src="/logo-wordmark.png"
          alt="Dyad"
          width={900}
          height={194}
          className="dyad-logo-glow h-7 w-auto md:h-9"
        />
      </h1>
      <div className="flex items-center gap-4">
        <nav className="hidden gap-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:flex">
          <a href="/terms" className="hover:text-foreground">Terms</a>
          <a href="/privacy" className="hover:text-foreground">Privacy</a>
        </nav>
        <AccountChip />
      </div>
    </header>
  );
}

function AccountChip() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const chip =
    "glass-card inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground";

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
      <span className="hidden max-w-[12rem] truncate normal-case tracking-normal sm:inline">{user.email}</span>
      <Link to="/agent" className="hover:text-foreground">
        Agent
      </Link>
      <button
        type="button"
        className="hover:text-foreground"
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

function SideCard({
  tone,
  title,
  value,
  caption,
  stats,
  footer,
}: {
  tone: "human" | "agent";
  title: string;
  value: number | null | undefined;
  caption: string;
  stats: { label: string; value: number | string | null | undefined }[];
  footer?: React.ReactNode;
}) {
  return (
    <GlassCard tone={tone} className="flex h-full flex-col px-5 pb-5 pt-5">
      <div className="flex items-center gap-2.5">
        <span className={cn("size-1.5 rounded-full", tone === "human" ? "bg-human" : "bg-agent")} />
        <h2
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.35em]",
            tone === "human" ? "text-human" : "text-agent",
          )}
        >
          {title}
        </h2>
      </div>
      <div className="mt-5 flex flex-col items-center">
        <ReadinessRing tone={tone} value={value} />
        <p className="mt-4 font-display text-5xl font-extralight tracking-tight text-foreground">
          {value ?? "—"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 font-display text-xl font-extralight text-foreground">{s.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto pt-6">{footer}</div>
    </GlassCard>
  );
}

function MiniRing({
  tone,
  label,
  value,
}: {
  tone: "human" | "agent";
  label: string;
  value: number | null | undefined;
}) {
  return (
    <GlassCard tone={tone} className="flex items-center gap-3 px-3 py-2">
      <ReadinessRing tone={tone} value={value} size={44} />
      <div>
        <p
          className={cn(
            "text-[10px] uppercase tracking-[0.25em]",
            tone === "human" ? "text-human" : "text-agent",
          )}
        >
          {label}
        </p>
        <p className="font-display text-2xl font-extralight text-foreground">{value ?? "—"}</p>
      </div>
    </GlassCard>
  );
}
