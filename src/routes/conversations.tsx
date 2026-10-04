import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Pause, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/dyad/glass-card";
import { ApprovedGate, PageHeader } from "@/components/dyad/approved-gate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conversations")({
  head: () => ({
    meta: [
      { title: "Conversations — Dyad" },
      { name: "description", content: "Read and delete past conversations with your agent." },
      { property: "og:title", content: "Conversations — Dyad" },
      { property: "og:description", content: "Read and delete past conversations with your agent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ApprovedGate>
      <Conversations />
    </ApprovedGate>
  ),
});

type Msg = { id: string; created_at: string; role: string; kind: string; content: string };

const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function Conversations() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("thread_messages")
        .select("id, created_at, role, kind, content")
        .order("created_at", { ascending: false })
        .limit(1000);
      setError(error?.message ?? null);
      setMsgs(data ?? []);
      setLoaded(true);
    })();
  }, []);

  const days = useMemo(() => {
    const m = new Map<string, Msg[]>();
    for (const x of msgs) m.set(localDay(x.created_at), [...(m.get(localDay(x.created_at)) ?? []), x]);
    return [...m.entries()].map(([day, list]) => ({ day, list: list.reverse() }));
  }, [msgs]);

  const remove = async (day: string, list: Msg[]) => {
    setBusy(true);
    const ids = list.map((m) => m.id);
    const { error } = await supabase.from("thread_messages").delete().in("id", ids);
    setBusy(false);
    setConfirm(null);
    if (error) return setError(error.message);
    setMsgs((all) => all.filter((m) => !ids.includes(m.id)));
    if (open === day) setOpen(null);
  };

  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="dyad-ambient relative min-h-dvh">
      <main className="relative mx-auto w-full max-w-3xl px-4 pb-16 pt-6 md:px-6">
        <PageHeader />
        <h1 className="mt-10 text-center font-display text-4xl font-extralight tracking-tight text-foreground md:text-5xl">
          Conversations
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-foreground">
          Your past chats with your agent, by day.
        </p>

        <div className="mt-10 flex flex-col gap-4">
          {error && <GlassCard tone="dyad" className="px-5 py-4 text-sm text-foreground">Error: {error}</GlassCard>}
          {loaded && !error && days.length === 0 && (
            <GlassCard tone="dyad" className="px-5 py-4 text-sm text-foreground">No conversations yet.</GlassCard>
          )}
          {days.map(({ day, list }) => (
            <GlassCard key={day} tone="dyad" className="px-5 py-4">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setOpen(open === day ? null : day)} className="min-w-0 flex-1 text-left">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-foreground">
                    {fmt(day)} · {list.length} {list.length === 1 ? "message" : "messages"}
                  </div>
                  {open !== day && <p className="mt-1 truncate text-sm text-foreground">{list[0]?.content}</p>}
                </button>
                {confirm === day ? (
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <button type="button" disabled={busy} onClick={() => void remove(day, list)} className="rounded-full bg-destructive px-3 py-1.5 text-destructive-foreground">
                      {busy ? "Deleting…" : "Delete forever"}
                    </button>
                    <button type="button" onClick={() => setConfirm(null)} className="px-2 py-1.5 text-foreground">Cancel</button>
                  </div>
                ) : (
                  <button type="button" aria-label={`Delete conversation from ${fmt(day)}`} onClick={() => setConfirm(day)} className="shrink-0 p-2 text-foreground hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              {open === day && (
                <div className="mt-4 flex flex-col gap-3 border-t border-glass-line/60 pt-4">
                  {list.map((m) =>
                    m.kind === "hold" ? (
                      <p key={m.id} className="flex items-center gap-2 text-xs text-foreground">
                        <Pause className="size-3 text-agent" /> {m.content}
                      </p>
                    ) : (
                      <div
                        key={m.id}
                        className={cn(
                          "max-w-[85%] rounded-2xl border px-4 py-2.5 text-sm text-foreground",
                          m.role === "agent" ? "self-start border-agent/40" : "self-end border-human/40",
                        )}
                      >
                        <div className={cn("mb-1 text-[10px] uppercase tracking-[0.2em]", m.role === "agent" ? "text-agent" : "text-human")}>
                          {m.role === "agent" ? "Agent" : "You"} ·{" "}
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </div>
                        <div className="prose prose-invert prose-sm max-w-none text-foreground">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      </main>
    </div>
  );
}
