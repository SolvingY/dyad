import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import { Mic, Send, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

// The Dyad conversation, live from thread_messages. Sending goes through the
// dyad-thread edge function; the empty state can trigger agent-checkin once.

type Message = {
  id: string;
  role: string;
  kind: string;
  content: string;
  energy: number | null;
  event_id: string | null;
  created_at: string;
};

// Minimal typing for the browser Web Speech API.
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"] ?? null) as (new () => Recognition) | null;
}

export function DyadThread() {
  const { user, loading } = useAuth();
  const [hasAgent, setHasAgent] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [corrected, setCorrected] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkinState, setCheckinState] = useState<"idle" | "running" | "done">("idle");
  const [listening, setListening] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const baseTextRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setCanDictate(!!getRecognitionCtor()), []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("thread_messages")
      .select("id, role, kind, content, energy, event_id, created_at")
      .order("created_at", { ascending: false })
      .limit(80);
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
    const channel = supabase
      .channel(`thread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "thread_messages", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    // Fallback refresh in case live updates aren't enabled for the table.
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  async function post(content: string, energy: number | null) {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const { error } = await supabase.functions.invoke("dyad-thread", { body: { content, energy } });
    setBusy(false);
    if (error) setError("Couldn't send. Try again.");
    await load();
    return !error;
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    recognitionRef.current?.stop();
    if (await post(content, null)) setText("");
  }

  async function tapEnergy(n: number) {
    await post(`Energy ${n}/5`, n);
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

  async function triggerCheckin() {
    setCheckinState("running");
    setError(null);
    const { error } = await supabase.functions.invoke("agent-checkin", { body: {} });
    if (error) setError("Your agent couldn't check in right now.");
    setCheckinState("done");
    await load();
  }

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    baseTextRef.current = text ? `${text.trim()} ` : "";
    r.onresult = (e) => {
      let said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i]?.[0]?.transcript ?? "";
      setText(baseTextRef.current + said);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  }

  // Energy tap shows only on the newest check-in, until the human replies.
  const lastCheckinId = (() => {
    if (!messages) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.role === "human") return null;
      if (m.kind === "checkin") return m.id;
    }
    return null;
  })();

  if (loading) return <div className="flex-1" />;
  if (!user)
    return (
      <Centered>
        <Link to="/auth" className="underline underline-offset-4">
          Sign in
        </Link>{" "}
        to talk with your agent.
      </Centered>
    );
  if (hasAgent === false)
    return (
      <Centered>
        Create an agent first on the{" "}
        <Link to="/agent" className="underline underline-offset-4">
          agent page
        </Link>
        .
      </Centered>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-4">
        {messages && messages.length === 0 && (
          <div className="m-auto flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">Your agent will check in soon.</p>
            {checkinState !== "done" && (
              <button
                type="button"
                onClick={triggerCheckin}
                disabled={checkinState === "running"}
                className="glass-card rounded-full px-5 py-2 text-[11px] uppercase tracking-[0.2em] text-agent disabled:opacity-60"
              >
                {checkinState === "running" ? "Checking in…" : "Check in now"}
              </button>
            )}
          </div>
        )}
        {messages?.map((m) =>
          m.kind === "hold" ? (
            <p key={m.id} className="text-center text-[11px] text-muted-foreground/70">
              Agent held off · {m.content}
            </p>
          ) : m.role === "human" ? (
            <div
              key={m.id}
              className="max-w-[85%] self-end rounded-2xl rounded-br-sm border border-human/30 bg-human/10 px-4 py-2.5"
            >
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{m.content}</p>
            </div>
          ) : (
            <div
              key={m.id}
              className="max-w-[90%] self-start rounded-2xl rounded-bl-sm border border-agent/30 bg-agent/10 px-4 py-2.5"
            >
              {m.kind === "checkin" && (
                <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-agent">Check-in</p>
              )}
              <div className="ask-dyad-md text-sm leading-relaxed text-foreground/85">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
              {m.id === lastCheckinId && (
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="mr-1 text-[11px] text-muted-foreground">Energy</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={busy}
                      onClick={() => tapEnergy(n)}
                      aria-label={`Energy ${n} of 5`}
                      className="glass-card size-8 rounded-full text-xs text-foreground/80 hover:text-agent disabled:opacity-50"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {m.event_id && (
                <button
                  type="button"
                  onClick={() => toggleWrong(m.event_id!)}
                  className="mt-2 block text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {corrected.has(m.event_id) ? "Marked wrong · undo" : "This was wrong"}
                </button>
              )}
            </div>
          ),
        )}
        {busy && <p className="text-[11px] text-agent/80">Agent is thinking…</p>}
      </div>

      <form onSubmit={send} className="glass-card flex items-center gap-3 rounded-3xl p-2.5">
        {canDictate && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label={listening ? "Stop dictation" : "Start voice dictation"}
            aria-pressed={listening}
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-full border transition-colors",
              listening
                ? "border-human bg-human/20 text-human shadow-[0_0_18px_var(--human)]"
                : "border-glass-line-luminous text-foreground/70 hover:text-human",
            )}
          >
            {listening ? <Square className="size-5" /> : <Mic className="size-6" />}
          </button>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? "Listening…" : "Message your agent…"}
          maxLength={4000}
          aria-label="Message"
          className="min-w-0 flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label="Send"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-agent/20 text-agent transition-opacity disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-foreground/60">
      <p>{children}</p>
    </div>
  );
}
