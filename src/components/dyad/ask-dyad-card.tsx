import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard } from "@/components/dyad/glass-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Ask Dyad: questions about the user's synced Oura data. Every question goes
// through the agent-call edge function (Claude, logged to agent_events) with
// the last 14 days of oura_daily rows as context. "This was wrong" marks that
// call's event as corrected via mark_event_corrected.

const OURA_COLUMNS =
  "day, readiness_score, sleep_score, sleep_efficiency, total_sleep_seconds, main_sleep_seconds, nap_seconds, nap_count, average_hrv, resting_heart_rate, average_heart_rate, respiratory_rate, temperature_deviation, activity_score, steps, active_calories, total_calories";

const INSTRUCTIONS = `You are Dyad, answering questions about the user's own Oura ring data.
Use only the data provided below. Explain patterns you see (trends, changes, relationships between
metrics across days) and suggest practical, everyday next steps (sleep timing, recovery, activity,
routines, what to keep tracking). Reference specific days and values when helpful.
Do not make medical claims or diagnoses, do not name conditions, and do not use words like
"healthy", "unhealthy" or "sick". Prefer "higher/lower than your recent range". If a question needs
medical judgment, say a clinician is the right person to ask. If the data can't answer the question,
say so plainly. Answer in concise markdown.`;

type Answer = {
  id: string;
  question: string;
  text: string | null;
  error: string | null;
  eventId: string | null;
  corrected: boolean;
  marking: boolean;
};

export function AskDyadCard() {
  const { user, loading } = useAuth();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentChecked, setAgentChecked] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
  }, [user?.id]);

  const update = (id: string, patch: Partial<Answer>) =>
    setAnswers((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  async function ask(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!agentId || !q || busy) return;
    const id = crypto.randomUUID();
    setAnswers((list) => [
      { id, question: q, text: null, error: null, eventId: null, corrected: false, marking: false },
      ...list,
    ]);
    setQuestion("");
    setBusy(true);
    try {
      const { data: rows, error: rowsErr } = await supabase
        .from("oura_daily")
        .select(OURA_COLUMNS)
        .order("day", { ascending: false })
        .limit(14);
      if (rowsErr) throw new Error("Couldn't read your Oura data.");
      if (!rows?.length) throw new Error("No synced Oura data yet. Connect Oura on the dashboard first.");

      const content = `${INSTRUCTIONS}\n\nLast ${rows.length} days of Oura data (newest first, JSON):\n${JSON.stringify(rows)}\n\nQuestion:\n${q}`;
      const { data, error: fnErr } = await supabase.functions.invoke("agent-call", {
        body: { agent_id: agentId, task_id: "ask-dyad", messages: [{ role: "user", content }] },
      });
      if (fnErr || !data?.content) {
        let msg = fnErr?.message ?? "Something went wrong.";
        try {
          const ctx = (fnErr as { context?: Response })?.context;
          const j = ctx ? await ctx.json() : null;
          if (j?.detail || j?.error) msg = j.detail ?? j.error;
        } catch {
          /* keep default */
        }
        throw new Error(msg);
      }
      const text = (data.content as { type: string; text?: string }[])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      update(id, { text, eventId: data.event_id ?? null });
    } catch (err) {
      update(id, { error: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function markWrong(a: Answer) {
    if (!a.eventId || a.marking) return;
    update(a.id, { marking: true });
    const { error } = await supabase.rpc("mark_event_corrected", {
      p_event_id: a.eventId,
      p_corrected: !a.corrected,
    });
    update(a.id, { marking: false, ...(error ? {} : { corrected: !a.corrected }) });
  }

  return (
    <GlassCard tone="dyad" className="p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-foreground/50">Ask Dyad</p>
      {loading ? null : !user ? (
        <p className="mt-4 text-sm text-foreground/60">
          <Link to="/auth" className="underline underline-offset-4">Sign in</Link> to ask about your Oura data.
        </p>
      ) : agentChecked && !agentId ? (
        <p className="mt-4 text-sm text-foreground/60">
          Create an agent first on the <Link to="/agent" className="underline underline-offset-4">agent page</Link>.
        </p>
      ) : (
        <>
          <form onSubmit={ask} className="mt-4 flex flex-col gap-3">
            <Textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="e.g. How has my sleep changed over the last two weeks?"
              maxLength={1000}
              rows={2}
            />
            <Button type="submit" disabled={busy || !agentId || !question.trim()}>
              {busy ? "Thinking…" : "Ask"}
            </Button>
            <p className="text-[11px] text-muted-foreground/60">
              Uses your last 14 days of Oura data. Not medical advice.
            </p>
          </form>

          {answers.length > 0 && (
            <div className="mt-5 flex flex-col gap-5">
              {answers.map((a) => (
                <div key={a.id} className="border-t border-glass-line/60 pt-4">
                  <p className="text-sm text-foreground/90">{a.question}</p>
                  {a.error ? (
                    <p className="mt-2 text-sm text-destructive">{a.error}</p>
                  ) : a.text == null ? (
                    <p className="mt-2 animate-pulse text-sm text-muted-foreground">Reading your data…</p>
                  ) : (
                    <>
                      <div className="ask-dyad-md mt-2 text-sm leading-relaxed text-foreground/75">
                        <ReactMarkdown>{a.text}</ReactMarkdown>
                      </div>
                      {a.eventId && (
                        <button
                          type="button"
                          onClick={() => markWrong(a)}
                          disabled={a.marking}
                          aria-pressed={a.corrected}
                          className="mt-3 rounded-full border border-glass-line px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                        >
                          {a.corrected ? "Marked as wrong · undo" : "This was wrong"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}
