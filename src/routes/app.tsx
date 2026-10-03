import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard } from "@/components/dyad/glass-card";
import { DyadThread } from "@/components/dyad/dyad-thread";
import { ReadinessRing } from "@/components/dyad/readiness-ring";
import { cn } from "@/lib/utils";
import { DyadBrain, type BrainRegion } from "@/components/dyad/dyad-brain";
import { RegionPanel } from "@/components/dyad/brain-panel";
import { BrandLogo } from "@/components/dyad/brand-logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccess } from "@/lib/account-approval.functions";
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

export type AgentOption = { id: string; name: string; source: string };

// Which agent the dashboard follows, remembered per browser.
const AGENT_KEY = "dyad.selectedAgent";
function readSelectedAgent() {
  try {
    return localStorage.getItem(AGENT_KEY);
  } catch {
    return null;
  }
}
function saveSelectedAgent(id: string) {
  try {
    localStorage.setItem(AGENT_KEY, id);
  } catch {
    // Private mode etc.: the choice just isn't remembered.
  }
}

// Alignment: 100 minus the gap between human and agent readiness, averaged
// over the last 7 days where both have a score.
function alignment(ouraRows: OuraRow[], agentRows: AgentRow[]) {
  const since = localDate(new Date(Date.now() - 6 * 86_400_000));
  const agentByDay = new Map(agentRows.map((r) => [r.day, r.readiness_score]));
  const gaps = ouraRows.flatMap((o) => {
    const a = agentByDay.get(o.day);
    return o.day >= since && o.readiness_score != null && a != null
      ? [100 - Math.abs(o.readiness_score - a)]
      : [];
  });
  if (!gaps.length) return null;
  return { value: Math.round(gaps.reduce((x, y) => x + y, 0) / gaps.length), days: gaps.length };
}

// Agent messages the human hasn't seen, and the daily greeting. The greeting
// function is a no-op after the first call of the day.
function useUnread(userId: string | undefined) {
  const [unread, setUnread] = useState(0);

  const count = useCallback(async () => {
    if (!userId) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("thread_seen_at")
      .eq("id", userId)
      .maybeSingle();
    const since = profile?.thread_seen_at ?? new Date(Date.now() - 86_400_000).toISOString();
    const { count: n } = await supabase
      .from("thread_messages")
      .select("id", { count: "exact", head: true })
      .eq("role", "agent")
      .neq("kind", "hold")
      .gt("created_at", since);
    setUnread(n ?? 0);
  }, [userId]);

  const markSeen = useCallback(async () => {
    if (!userId) return;
    setUnread(0);
    await supabase
      .from("profiles")
      .upsert({ id: userId, thread_seen_at: new Date().toISOString() }, { onConflict: "id" });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      await supabase.functions.invoke("dyad-greeting", { method: "POST" }).catch(() => null);
      await count();
    })();
  }, [userId, count]);

  return { unread, markSeen };
}

// Today's oura_daily and agent_daily rows for the signed-in user, plus the
// existing oura-sync (run once on sign-in, and on Retry).
function useDyadData() {
  const { user } = useAuth();
  const [ouraRows, setOuraRows] = useState<OuraRow[]>([]);
  const [ouraError, setOuraError] = useState<string | null>(null);
  const [agentRows, setAgentRows] = useState<AgentRow[]>([]);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readSelectedAgent(),
  );
  const [ouraConnected, setOuraConnected] = useState<boolean | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");

  // Newest 14 days, ordered by day descending; rows[0] is the latest day.
  // Same query the restored Dyad card and brain use.
  const loadOura = useCallback(async () => {
    const { data, error } = await supabase
      .from("oura_daily")
      .select("*")
      .order("day", { ascending: false })
      .limit(14);
    if (error) {
      setOuraError(error.message);
      setOuraRows([]);
      return;
    }
    setOuraError(null);
    setLastSync(data?.[0]?.updated_at ?? null);
    setOuraRows(data ?? []);
  }, []);

  // The agents still connected (built-in, an active API key, or an OAuth grant
  // that hasn't been revoked) and the selected one's rows; the built-in agent
  // if none is picked or the picked one is gone.
  const loadAgent = useCallback(async () => {
    const [{ data: all, error: agentErr }, { data: keys }, { data: grants }] = await Promise.all([
      supabase.from("agents").select("id, name, source, oauth_client_id").order("created_at"),
      supabase.from("agent_keys").select("agent_id").is("revoked_at", null),
      supabase.auth.oauth.listGrants(),
    ]);
    if (agentErr) {
      setAgentError(agentErr.message);
      return;
    }
    const liveKeys = new Set((keys ?? []).map((k) => k.agent_id));
    const liveClients = grants ? new Set(grants.map((g) => g.client.id)) : null;
    const list = (all ?? [])
      .filter(
        (a) =>
          a.source === "builtin" ||
          liveKeys.has(a.id) ||
          (a.oauth_client_id !== null && (liveClients?.has(a.oauth_client_id) ?? true)),
      )
      .map(({ id, name, source }) => ({ id, name, source }));
    setAgents(list);
    const agent =
      list.find((a) => a.id === selectedAgentId) ??
      list.find((a) => a.source === "builtin") ??
      list[0];
    if (!agent) return;
    const { data, error } = await supabase
      .from("agent_daily")
      .select("*")
      .eq("agent_id", agent.id)
      .order("day", { ascending: false })
      .limit(14);
    if (error) {
      setAgentError(error.message);
      setAgentRows([]);
      return;
    }
    setAgentError(null);
    setAgentRows(data ?? []);
  }, [selectedAgentId]);

  const selectAgent = useCallback((id: string) => {
    saveSelectedAgent(id);
    setSelectedAgentId(id);
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
      setOuraRows([]);
      setAgentRows([]);
      return;
    }
    void loadOura();
    void sync();
  }, [user?.id, loadOura, sync]);

  // Separate so switching agents doesn't re-run the Oura sync.
  useEffect(() => {
    if (user) void loadAgent();
  }, [user?.id, loadAgent]);

  const selectedAgent =
    agents.find((a) => a.id === selectedAgentId) ??
    agents.find((a) => a.source === "builtin") ??
    agents[0] ??
    null;

  return {
    user,
    ouraRows,
    ouraError,
    agentRows,
    agentError,
    agents,
    selectedAgent,
    selectAgent,
    ouraConnected,
    lastSync,
    syncState,
    sync,
  };
}

async function connectOura() {
  const { data, error } = await supabase.functions.invoke("oura-auth-start");
  if (!error && data?.url) window.location.assign(data.url);
}

const pct = (v: number | null | undefined) => (v == null ? null : `${Math.round(v * 100)}%`);

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const getAccess = useServerFn(getMyAccess);
  const [access, setAccess] = useState<{ status: "pending" | "approved" | "denied"; isAdmin: boolean } | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);
  useEffect(() => {
    if (!user) return;
    getAccess()
      .then(setAccess)
      .catch((error) => setAccessError(error instanceof Error ? error.message : "Could not verify account access."));
  }, [user, getAccess]);
  if (loading || !user || (!access && !accessError)) return <div className="dyad-ambient h-dvh" />;
  if (accessError || access?.status !== "approved") {
    return <ApprovalState status={access?.status ?? "pending"} error={accessError} />;
  }
  return <DashboardInner isAdmin={access.isAdmin} />;
}

function ApprovalState({ status, error }: { status: "pending" | "approved" | "denied"; error: string | null }) {
  return (
    <div className="dyad-ambient flex min-h-dvh items-center justify-center px-6">
      <GlassCard tone="dyad" className="w-full max-w-lg p-8 text-center">
        <BrandLogo className="mx-auto h-10" />
        <h1 className="mt-8 font-display text-3xl font-extralight text-foreground">
          {error ? "Access check unavailable" : status === "denied" ? "Access denied" : "Approval pending"}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-foreground">
          {error ?? (status === "denied" ? "Your Dyad account is not approved. Contact the administrator if you believe this is a mistake." : "Your account is ready and waiting for administrator approval.")}
        </p>
      </GlassCard>
    </div>
  );
}

function DashboardInner({ isAdmin }: { isAdmin: boolean }) {
  const d = useDyadData();
  const { ouraRows, agentRows } = d;
  const oura = ouraRows[0] ?? null;
  const agentDay = agentRows.find((r) => r.day === localDate()) ?? null;
  const latestAgent = agentRows[0] ?? null;
  const [region, setRegion] = useState<BrainRegion>("center");
  const align = useMemo(() => alignment(ouraRows, agentRows), [ouraRows, agentRows]);
  const { unread, markSeen } = useUnread(d.user?.id);
  const agentTitle = d.selectedAgent?.source === "builtin" ? "Agent" : (d.selectedAgent?.name ?? "Agent");

  const human = useMemo(() => toHumanVitals(oura), [oura]);
  const agent = useMemo(() => toAgentVitals(latestAgent), [latestAgent]);
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
    {
      label: "Latency",
      value: agentDay?.baseline_latency_ms == null ? null : `${Math.round(agentDay.baseline_latency_ms)} ms`,
    },
    { label: "Retry rate", value: pct(agentDay?.retry_rate) },
    {
      label: "Tokens",
      value: agentDay?.total_tokens == null ? null : Number(agentDay.total_tokens).toLocaleString(),
    },
    {
      label: "Context fill",
      value: agentDay?.avg_context_fill == null ? null : pct(agentDay.avg_context_fill),
    },
  ];

  return (
    <div className="dyad-ambient relative min-h-dvh">
      <main className="relative mx-auto flex w-full max-w-7xl flex-col px-4 pb-10 pt-4 md:px-6">
        <Header
          isAdmin={isAdmin}
          picker={
            d.agents.length > 1 && (
              <label className="glass-card flex min-w-0 items-center gap-2 rounded-full py-1.5 pl-4 pr-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <span className="hidden sm:inline">Talking to</span>
                <span className="size-1.5 shrink-0 rounded-full bg-agent shadow-[0_0_8px_var(--agent)]" />
                <select
                  value={d.selectedAgent?.id ?? ""}
                  onChange={(e) => d.selectAgent(e.target.value)}
                  aria-label="Agent"
                  className="min-w-0 max-w-[11rem] truncate bg-transparent py-1 text-xs normal-case tracking-normal text-foreground outline-none"
                >
                  {d.agents.map((a) => (
                    <option key={a.id} value={a.id} className="bg-background text-foreground">
                      {a.source === "builtin" ? `${a.name} (built-in)` : a.name}
                    </option>
                  ))}
                </select>
              </label>
            )
          }
        />

        {unread > 0 && (
          <button
            type="button"
            onClick={() => {
              document.getElementById("dyad-thread")?.scrollIntoView({ behavior: "smooth" });
              void markSeen();
            }}
            className="glass-card mt-3 flex items-center gap-3 self-center rounded-full px-4 py-2 text-xs text-foreground hover:text-agent"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-agent text-[10px] font-medium text-background">
              {unread}
            </span>
            {unread === 1 ? "New message from your agent" : `${unread} new messages from your agent`}
          </button>
        )}

        <div className="mt-3 flex flex-col gap-5 lg:mt-6 lg:grid lg:h-[calc(100dvh-6rem)] lg:min-h-0 lg:grid-cols-[17rem_1fr_17rem]">
          <aside
            aria-label="You"
            className={cn(
              "order-2 flex min-h-0 flex-col rounded-2xl transition-all lg:order-none",
              region !== "agent" && "shadow-[0_0_28px_var(--human)]",
            )}
          >
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

          <section aria-label="Brain and conversation" className="order-1 flex min-h-0 flex-col gap-4 lg:order-none">
            <div className="grid shrink-0 gap-4 lg:h-[40%] lg:min-h-0 xl:grid-cols-[1.2fr_1fr]">
              <GlassCard tone="dyad" className="flex min-h-0 flex-col overflow-hidden p-0">
                <DyadBrain
                  visual={visual}
                  selected={region}
                  onSelect={setRegion}
                  className="h-[300px] w-full lg:h-auto lg:min-h-0 lg:flex-1"
                />
                <div className="flex items-center justify-center border-t border-glass-line/60 px-4 py-2">
                  <div className="relative flex">
                    <span
                      aria-hidden="true"
                      className="liquid-pill glass-card absolute inset-y-0 left-0 w-20 rounded-full"
                      style={{
                        transform: `translateX(${["human", "center", "agent"].indexOf(region) * 100}%)`,
                      }}
                    />
                    {(["human", "center", "agent"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRegion(r)}
                        aria-pressed={region === r}
                        className={cn(
                          "relative z-10 w-20 rounded-full py-1.5 text-[10px] uppercase tracking-[0.25em] text-foreground",
                          r === "human" && "text-human",
                          r === "agent" && "text-agent",
                        )}
                      >
                        {r === "center" ? "Dyad" : r}
                      </button>
                    ))}
                  </div>
                </div>
              </GlassCard>
              <div className="min-h-0 overflow-y-auto">
                {d.ouraError || d.agentError ? (
                  <GlassCard tone="dyad" className="px-5 py-5 text-xs text-foreground">
                    {d.ouraError && <p>Oura error: {d.ouraError}</p>}
                    {d.agentError && <p>Agent error: {d.agentError}</p>}
                  </GlassCard>
                ) : (
                  <RegionPanel region={region} human={human} agent={agent} posture={posture} />
                )}
              </div>
            </div>
            <div
              id="dyad-thread"
              onFocusCapture={() => unread > 0 && void markSeen()}
              className="flex h-[70dvh] min-h-0 flex-col lg:h-auto lg:flex-1"
            >
              <DyadThread agent={d.selectedAgent} />
            </div>
          </section>

          <aside
            aria-label="Agent"
            className={cn(
              "order-3 flex min-h-0 flex-col rounded-2xl transition-all lg:order-none",
              region !== "human" && "shadow-[0_0_28px_var(--agent)]",
            )}
          >
            <SideCard
              tone="agent"
              title={agentTitle}
              value={agentDay?.readiness_score}
              caption={
                d.agentError
                  ? `Agent error: ${d.agentError}`
                  : agentDay
                    ? "Readiness · today"
                    : "No agent activity today"
              }
              stats={agentStats}
            />
          </aside>
        </div>

        {/* Detail sections, restored from the earlier dashboard */}
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.15fr_1fr]">
          <section aria-label="Human detail" className="flex flex-col gap-5">
            <ColumnHeader title="Human" dotClassName="bg-human shadow-[0_0_12px_var(--human)]" />
            <ReadinessCard
              tone="human"
              label="Readiness"
              value={oura?.readiness_score}
              caption={d.ouraError ? `Oura error: ${d.ouraError}` : oura ? `Oura · ${oura.day}` : "No Oura data yet"}
            />
            <SlotCard tone="human" label="Sleep score" value={oura?.sleep_score} />
            <SlotCard
              tone="human"
              label="Avg HRV"
              value={oura?.average_hrv == null ? null : `${Math.round(oura.average_hrv)} ms`}
            />
          </section>
          <section aria-label="Cross-analysis" className="flex flex-col gap-5">
            <ColumnHeader title="Cross-analysis" dotClassName="bg-gradient-to-br from-human to-agent shadow-[0_0_12px_var(--glow-dyad)]" />
            <ReadinessCard
              tone="dyad"
              label="Alignment"
              value={align?.value}
              caption={
                align
                  ? `Readiness match · ${align.days} ${align.days === 1 ? "day" : "days"}${posture ? ` · ${posture.interruption.replace("_", " ").toLowerCase()}` : ""}`
                  : !oura
                    ? "No Oura readiness yet"
                    : agentRows.length
                      ? "No day yet with both readiness scores"
                      : `No vitals from ${d.selectedAgent?.name ?? "your agent"} yet`
              }
            />
          </section>
          <section aria-label="Agent detail" className="flex flex-col gap-5">
            <ColumnHeader title="Agent" dotClassName="bg-agent shadow-[0_0_12px_var(--agent)]" />
            <ReadinessCard
              tone="agent"
              label="Readiness"
              value={latestAgent?.readiness_score}
              caption={d.agentError ? `Agent error: ${d.agentError}` : latestAgent ? `Agent · ${latestAgent.day}` : "No agent calls yet"}
            />
            <SlotCard tone="agent" label="Calls" value={latestAgent?.call_count} />
            <SlotCard
              tone="agent"
              label="Error rate"
              value={latestAgent?.error_rate == null ? null : `${Math.round(latestAgent.error_rate * 100)}%`}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

function Header({ isAdmin, picker }: { isAdmin: boolean; picker?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <h1 className="flex shrink-0">
        <BrandLogo className="h-7 md:h-9" />
      </h1>
      {picker}
      <AccountMenu isAdmin={isAdmin} />
    </header>
  );
}

function AccountMenu({ isAdmin }: { isAdmin: boolean }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const item =
    "block rounded-xl px-4 py-3 text-sm uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-glass-line/40";

  if (loading) return <div className="glass-card rounded-full px-4 py-2 text-[11px] text-foreground">…</div>;
  if (!user)
    return (
      <Link to="/auth" className="glass-card rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-foreground">
        Sign in
      </Link>
    );
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" aria-label="Open menu" className="glass-card inline-flex size-11 items-center justify-center rounded-full text-foreground">
          <Menu className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="glass-card flex w-80 flex-col gap-6 border-l border-glass-line bg-background/95 text-foreground">
        <SheetHeader>
          <SheetTitle className="text-left text-foreground">Menu</SheetTitle>
          <p className="truncate text-left text-xs text-foreground">{user.email}</p>
        </SheetHeader>
        <nav className="flex flex-col gap-1" onClick={() => setOpen(false)}>
          <Link to="/history" className={item}>Trends</Link>
          <Link to="/agent" className={cn(item, "text-agent")}>Connect Your Agent</Link>
          <a href="/dyad-walkthrough.html" target="_blank" rel="noopener noreferrer" className={item}>Walkthrough</a>
          {isAdmin && <Link to="/admin" className={item}>Approvals</Link>}
          <a href="/terms" className={item}>Terms</a>
          <a href="/privacy" className={item}>Privacy</a>
        </nav>
        <button
          type="button"
          className={cn(item, "mt-auto text-left")}
          onClick={async () => {
            setOpen(false);
            await supabase.auth.signOut();
            navigate({ to: "/", replace: true });
          }}
        >
          Sign out
        </button>
      </SheetContent>
    </Sheet>
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

function ColumnHeader({ title, dotClassName }: { title: string; dotClassName: string }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", dotClassName)} />
      <h2 className="text-[11px] font-medium uppercase tracking-[0.35em] text-foreground">{title}</h2>
    </div>
  );
}

function ReadinessCard({
  tone,
  label,
  value,
  caption,
}: {
  tone: "human" | "agent" | "dyad";
  label: string;
  value?: number | null | undefined;
  caption: string;
}) {
  return (
    <GlassCard tone={tone} className="flex flex-col items-center px-6 pb-8 pt-6">
      <div className="flex w-full items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.25em] text-foreground">{label}</span>
        <span className="text-[10px] tracking-[0.2em] text-foreground">RING</span>
      </div>
      <ReadinessRing tone={tone} value={value} className="mt-7" />
      <p className="mt-6 font-display text-5xl font-extralight tracking-tight text-foreground">{value ?? "—"}</p>
      <p className="mt-2 text-xs text-foreground">{caption}</p>
    </GlassCard>
  );
}

function SlotCard({
  tone,
  label,
  value,
}: {
  tone: "human" | "agent";
  label: string;
  value?: number | string | null | undefined;
}) {
  return (
    <GlassCard tone={tone} className="flex flex-1 flex-col px-6 pb-6 pt-6">
      <span className="text-[10px] uppercase tracking-[0.25em] text-foreground">{label}</span>
      <p className="mt-8 font-display text-4xl font-extralight tracking-tight text-foreground">{value ?? "—"}</p>
    </GlassCard>
  );
}
