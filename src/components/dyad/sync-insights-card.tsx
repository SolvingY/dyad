import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard } from "@/components/dyad/glass-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Sync insights: Claude gets the agent's latest agent_daily row, the human's
// latest Oura data (added by agent-call) and an optional note from the human,
// and returns synchronization advice. Goes through the agent-call edge function
// so the call is logged to agent_events like every other Claude call.

const PROMPT = `You are Dyad's synchronization coach. A human and their AI agent work as a pair.
Using the data below, produce 3–5 concise, actionable insights to better synchronize them
(e.g. scheduling agent work around the human's energy, handoffs, review timing, load balancing).
Every insight must cite exactly one human metric from the Oura data in the system prompt and one
agent metric from the agent_daily data, each by name and value, e.g. "sleep_score 79" and "error_rate 0".
Format: a short numbered list. Each item: a bold one-line action, then one sentence of why that cites
both metrics. Do not make medical claims or diagnoses. If the human's Oura data or the agent's data is
missing, say so and say what to track next instead of inventing numbers.`;

export function SyncInsightsCard() {
  const { user, loading } = useAuth();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentChecked, setAgentChecked] = useState(false);
  const [human, setHuman] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("agents")
      .select("id")
      .order("created_at")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setAgentId(data?.id ?? null);
        setAgentChecked(true);
      });
  }, [user]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!agentId || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const { data: agentDay } = await supabase
      .from("agent_daily")
      .select(
        "day, readiness_score, freshness_score, error_rate, error_rate_deviation, retry_rate, correction_rate, cache_hit_rate, baseline_latency_ms, latency_variability_ms, calls_per_hour, call_count, avg_context_fill",
      )
      .eq("agent_id", agentId)
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle();
    const content = `${PROMPT}\n\nAgent data (agent_daily):\n${agentDay ? JSON.stringify(agentDay) : "(none yet)"}\n\nHuman's note:\n${human.trim() || "(none)"}`;
    const { data, error: fnErr } = await supabase.functions.invoke("agent-call", {
      body: {
        agent_id: agentId,
        task_id: "sync-insights",
        include_human_context: true,
        messages: [{ role: "user", content }],
      },
    });
    setBusy(false);
    if (fnErr || !data?.content) {
      let msg = fnErr?.message ?? "Something went wrong.";
      try {
        const ctx = (fnErr as { context?: Response })?.context;
        const j = ctx ? await ctx.json() : null;
        if (j?.detail || j?.error) msg = j.detail ?? j.error;
      } catch {
        /* keep default */
      }
      setError(msg);
      return;
    }
    const text = (data.content as { type: string; text?: string }[])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    setResult(text);
  }

  return (
    <GlassCard tone="dyad" className="p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-foreground/50">Sync insights</p>
      {loading ? null : !user ? (
        <p className="mt-4 text-sm text-foreground/60">
          <Link to="/auth" className="underline underline-offset-4">Sign in</Link> to get insights.
        </p>
      ) : agentChecked && !agentId ? (
        <p className="mt-4 text-sm text-foreground/60">
          Create an agent first on the <Link to="/agent" className="underline underline-offset-4">agent page</Link>.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <Textarea
            value={human}
            onChange={(e) => setHuman(e.target.value)}
            placeholder="Optional: anything else about how you've slept, felt, worked lately…"
            maxLength={2000}
            rows={3}
          />
          <Button type="submit" disabled={busy || !agentId}>
            {busy ? "Analyzing…" : "Generate insights"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{result}</div>
          )}
        </form>
      )}
    </GlassCard>
  );
}
