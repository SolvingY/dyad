import type { ReactNode } from "react";
import { GlassCard } from "@/components/dyad/glass-card";
import type { BrainRegion } from "@/components/dyad/dyad-brain";
import {
  agentLimitingFactor,
  type AgentVitals,
  type DyadOperatingPosture,
  type HumanVitals,
} from "@/lib/dyad/vitals";

const NO_DATA = "No data";
const fmt = (v: number | null, f: (n: number) => string) => (v == null ? NO_DATA : f(v));
const int = (n: number) => Math.round(n).toLocaleString();
const pct = (n: number) => `${Math.round(n * 100)}%`;
const signed = (n: number, digits = 1) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;

function Row({ label, value }: { label: string; value: ReactNode }) {
  const missing = value === NO_DATA;
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 border-b border-glass-line/60 py-2 last:border-0">
      <dt className="min-w-0 text-xs text-muted-foreground">{label}</dt>
      <dd className={missing ? "shrink-0 text-xs text-muted-foreground" : "shrink-0 font-display text-sm font-light text-foreground"}>
        {value}
      </dd>
    </div>
  );
}

function Title({ children, sub, dot }: { children: ReactNode; sub?: string | undefined; dot: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className={`size-1.5 rounded-full ${dot}`} />
        <h3 className="text-[11px] font-medium uppercase tracking-[0.35em] text-foreground">{children}</h3>
      </div>
      {sub && <span className="text-[10px] tracking-[0.15em] text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function HumanPanel({ v }: { v: HumanVitals | null }) {
  const sub = v ? `Oura · ${v.day}` : undefined;
  return (
    <GlassCard tone="human" className="h-full px-5 py-4 hover:transform-none">
      <Title dot="bg-human" sub={sub}>Human</Title>
      {!v ? (
        <p className="text-xs text-muted-foreground">No Oura data yet.</p>
      ) : (
        <dl className="grid gap-x-5 sm:grid-cols-2">
          <Row label="Readiness" value={fmt(v.readiness, int)} />
          <Row label="Sleep" value={fmt(v.sleepScore, int)} />
          <Row label="Sleep efficiency" value={fmt(v.sleepEfficiency, (n) => `${int(n)}%`)} />
          <Row label="Resting HR" value={fmt(v.restingHr, (n) => `${int(n)} bpm`)} />
          <Row label="HRV" value={fmt(v.hrv, (n) => `${int(n)} ms`)} />
          <Row label="Temperature deviation" value={fmt(v.temperatureDeviation, (n) => `${signed(n, 2)} °C`)} />
          <Row label="Activity" value={fmt(v.activityScore, int)} />
          <Row label="Steps" value={fmt(v.steps, int)} />
          <Row
            label="Calories"
            value={
              v.activeCalories == null && v.totalCalories == null
                ? NO_DATA
                : `${v.activeCalories == null ? "—" : int(v.activeCalories)} active · ${
                    v.totalCalories == null ? "—" : int(v.totalCalories)
                  } total`
            }
          />
        </dl>
      )}
      {v && (
        <p className="mt-3 text-[10px] text-muted-foreground">
          Synced {new Date(v.updatedAt).toLocaleString()}
        </p>
      )}
    </GlassCard>
  );
}

export function AgentPanel({ v }: { v: AgentVitals | null }) {
  return (
    <GlassCard tone="agent" className="h-full px-5 py-4 hover:transform-none">
      <Title dot="bg-agent" sub={v ? `Calls · ${v.day}` : undefined}>Agent</Title>
      {!v ? (
        <p className="text-xs text-muted-foreground">No agent calls logged yet.</p>
      ) : (
        <dl className="grid gap-x-5 sm:grid-cols-2">
          <Row label="Readiness" value={fmt(v.readiness, int)} />
          <Row label="Freshness" value={fmt(v.freshness, int)} />
          <Row label="Cache hit rate" value={fmt(v.cacheHitRate, (n) => `${Math.round(n)}%`)} />
          <Row label="Baseline latency" value={fmt(v.baselineLatencyMs, (n) => `${int(n)} ms`)} />
          <Row label="Latency variability" value={fmt(v.latencyVariabilityMs, (n) => `${int(n)} ms`)} />
          <Row label="Error-rate deviation" value={fmt(v.errorRateDeviation, (n) => `${signed(n * 100)} pts`)} />
          <Row label="Activity" value={fmt(v.activityScore, int)} />
          <Row label="Call count" value={fmt(v.callCount, int)} />
          <Row label="Tokens used" value={fmt(v.totalTokens, int)} />
          <Row label="Correction rate" value={fmt(v.correctionRate, pct)} />
          <Row label="Retry rate" value={fmt(v.retryRate, pct)} />
          <Row label="Context fill" value={fmt(v.contextFill, pct)} />
        </dl>
      )}
      {v && (
        <p className="mt-3 text-[10px] text-muted-foreground">
          {v.lastContextRefresh
            ? `Knowledge of you last refreshed ${new Date(v.lastContextRefresh).toLocaleString()}`
            : "No context refresh logged yet"}
        </p>
      )}
    </GlassCard>
  );
}

export function DyadPanel({
  human,
  agent,
  posture,
  agentVitals,
}: {
  human: number | null;
  agent: number | null;
  posture: DyadOperatingPosture | null;
  agentVitals: AgentVitals | null;
}) {
  const limit = posture?.state === "C_AGENT_LOWER" || posture?.state === "D_BOTH_LOWER" ? agentLimitingFactor(agentVitals) : null;
  const deltaLabel = !posture
    ? "Readiness delta"
    : posture.aligned
      ? "Aligned"
      : posture.delta > 0
        ? "Agent capacity higher"
        : "Human capacity higher";
  return (
    <GlassCard tone="dyad" className="h-full px-5 py-4 hover:transform-none">
      <span aria-hidden="true" className="dyad-gradient-line absolute inset-x-6 top-0 h-px" />
      <Title dot="bg-gradient-to-br from-human to-agent" sub={posture ? posture.interruption.replace("_", " ") : undefined}>
        Dyad
      </Title>
      <dl>
        <Row label="Human readiness" value={fmt(human, int)} />
        <Row label="Agent readiness" value={fmt(agent, int)} />
        <Row label={deltaLabel} value={posture ? signed(posture.delta, 0) : NO_DATA} />
      </dl>
      {!posture ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Today's posture appears once both readiness scores are available.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm font-light leading-relaxed text-foreground">{posture.headline}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-human">Human</p>
              <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                {posture.human.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-agent">Agent</p>
              <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                {posture.agent.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          </div>
          {limit && (
            <p className="text-[11px] text-muted-foreground">Agent readiness is being limited by {limit}.</p>
          )}
        </div>
      )}
    </GlassCard>
  );
}

export function RegionPanel(props: {
  region: BrainRegion;
  human: HumanVitals | null;
  agent: AgentVitals | null;
  posture: DyadOperatingPosture | null;
}) {
  if (props.region === "human") return <HumanPanel v={props.human} />;
  if (props.region === "agent") return <AgentPanel v={props.agent} />;
  return (
    <DyadPanel
      human={props.human?.readiness ?? null}
      agent={props.agent?.readiness ?? null}
      posture={props.posture}
      agentVitals={props.agent}
    />
  );
}
