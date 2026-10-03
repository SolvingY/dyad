import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard } from "@/components/dyad/glass-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// The Dyad conversation: the agent's check-ins (and holds) and the human's
// messages in one thread. Sending goes through the dyad-thread edge function,
// which replies through agent-call. "This was wrong" marks a reply's
// agent_events row as corrected.

type Message = {
  id: string;
  role: string;
  kind: string;
  content: string;
  energy: number | null;
  event_id: string | null;
  created_at: string;
};

export function DyadThread() {
  const { user, loading } = useAuth();
  const [hasAgent, setHasAgent] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [corrected, setCorrected] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [energy, setEnergy] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("thread_messages")
      .select("id, role, kind, content, energy, event_id, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (data ?? []).reverse();
    setMessages(list);
    const eventIds = list.map((m) => m.event_id).filter((id): id is string => !!id);
    if (eventIds.length) {
      const { data: events } = await supabase
        .from("agent_events")
        .select("id")
        .in("id", eventIds)
        .eq("was_corrected", true);
      setCorrected(new Set((events ?? []).map((e) => e.id)));
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("agents")
      .select("id")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setHasAgent(!!data));
    void load();
  }, [user?.id, load]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.functions.invoke("dyad-thread", {
      body: { content, energy },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
    } else {
      setText("");
      setEnergy(null);
    }
    await load();
  }

  async function toggleWrong(eventId: string) {
    const isWrong = corrected.has(eventId);
    const { error } = await supabase.rpc("mark_event_corrected", {
      p_event_id: eventId,
      p_corrected: !isWrong,
    });
    if (error) return;
    setCorrected((prev) => {
      const next = new Set(prev);
      if (isWrong) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }

  return (
    <GlassCard tone="dyad" className="p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-foreground/50">Dyad</p>
      {loading ? null : !user ? (
        <p className="mt-4 text-sm text-foreground/60">
          <Link to="/auth" className="underline underline-offset-4">
            Sign in
          </Link>{" "}
          to talk with your agent.
        </p>
      ) : hasAgent === false ? (
        <p className="mt-4 text-sm text-foreground/60">
          Create an agent first on the{" "}
          <Link to="/agent" className="underline underline-offset-4">
            agent page
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mt-4 flex max-h-[28rem] flex-col gap-3 overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No messages yet. Say hello, or wait for your agent's next check-in.
              </p>
            )}
            {messages.map((m) =>
              m.kind === "hold" ? (
                <p key={m.id} className="text-xs text-muted-foreground/70">
                  Agent held off: {m.content}
                </p>
              ) : m.role === "human" ? (
                <div
                  key={m.id}
                  className="self-end max-w-[85%] rounded-2xl bg-foreground/5 px-3 py-2"
                >
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{m.content}</p>
                  {m.energy && (
                    <p className="mt-1 text-[11px] text-muted-foreground">Energy {m.energy}/5</p>
                  )}
                </div>
              ) : (
                <div key={m.id} className="max-w-[90%]">
                  {m.kind === "checkin" && (
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Check-in
                    </p>
                  )}
                  <div className="ask-dyad-md text-sm leading-relaxed text-foreground/80">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                  {m.event_id && (
                    <button
                      type="button"
                      onClick={() => toggleWrong(m.event_id!)}
                      className="mt-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      {corrected.has(m.event_id) ? "Marked wrong · undo" : "This was wrong"}
                    </button>
                  )}
                </div>
              ),
            )}
          </div>

          <form onSubmit={send} className="mt-4 flex flex-col gap-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message your agent…"
              maxLength={4000}
              rows={2}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Energy</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setEnergy(energy === n ? null : n)}
                  className={cn(
                    "glass-card size-7 rounded-full text-xs",
                    energy === n ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
              <Button type="submit" size="sm" className="ml-auto" disabled={busy || !text.trim()}>
                {busy ? "Thinking…" : "Send"}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </>
      )}
    </GlassCard>
  );
}
