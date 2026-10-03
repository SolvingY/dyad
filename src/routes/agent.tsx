import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard } from "@/components/dyad/glass-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ConnectedAgents } from "@/components/dyad/connected-agents";

// Test page for the agent: create an agent, send one message through the
// agent-call edge function, and see the reply and the agent_events row it logged.
export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [{ title: "Agent — Dyad" }, { name: "robots", content: "noindex" }],
  }),
  ssr: false,
  component: AgentPage,
});

type Agent = { id: string; name: string };

function AgentPage() {
  const { user, loading } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [message, setMessage] = useState("Say hello in five words.");
  const [withOura, setWithOura] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [event, setEvent] = useState<unknown>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("agents")
      .select("id, name")
      .eq("source", "builtin")
      .order("created_at")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setAgent(data));
  }, [user]);

  async function createAgent() {
    if (!user) return;
    setError(null);
    const { data, error } = await supabase
      .from("agents")
      .insert({ user_id: user.id, name: "My agent" })
      .select("id, name")
      .single();
    if (error) setError(error.message);
    else setAgent(data);
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!agent) return;
    setBusy(true);
    setError(null);
    setReply(null);
    setEvent(null);
    const { data, error } = await supabase.functions.invoke("agent-call", {
      body: {
        agent_id: agent.id,
        task_id: "test",
        messages: [{ role: "user", content: message }],
        include_human_context: withOura,
      },
    });
    if (error) {
      setError(error.message);
    } else {
      setReply(
        (data.content as { type: string; text?: string }[])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join(""),
      );
      if (data.event_id) {
        const { data: row } = await supabase
          .from("agent_events")
          .select("*")
          .eq("id", data.event_id)
          .single();
        setEvent(row);
      }
    }
    setBusy(false);
  }

  if (loading) return null;

  return (
    <div className="dyad-ambient relative min-h-screen">
      <main className="relative mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 pb-24 pt-10">
        <Link to="/app" className="text-sm text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
        <h1 className="font-display text-2xl font-light uppercase tracking-[0.3em]">Agent</h1>

        {!user ? (
          <p className="text-sm text-muted-foreground">
            <Link to="/auth" className="underline">
              Sign in
            </Link>{" "}
            to use the agent.
          </p>
        ) : !agent ? (
          <GlassCard tone="agent" className="flex flex-col gap-3 p-6">
            <p className="text-sm text-muted-foreground">You don't have an agent yet.</p>
            <Button onClick={createAgent} className="self-start">
              Create agent
            </Button>
          </GlassCard>
        ) : (
          <GlassCard tone="agent" className="p-6">
            <form onSubmit={send} className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                {agent.name} · {agent.id}
              </p>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={withOura} onCheckedChange={(v) => setWithOura(v === true)} />
                Include my latest Oura data
              </label>
              <Button type="submit" disabled={busy || !message.trim()} className="self-start">
                {busy ? "Sending…" : "Send"}
              </Button>
            </form>
          </GlassCard>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {reply !== null && (
          <GlassCard tone="agent" className="p-6">
            <p className="whitespace-pre-wrap text-sm">{reply}</p>
          </GlassCard>
        )}
        {event !== null && (
          <GlassCard className="p-6">
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Logged to agent_events
            </p>
            <pre className="overflow-x-auto text-xs">{JSON.stringify(event, null, 2)}</pre>
          </GlassCard>
        )}
        {user && <ConnectedAgents />}
      </main>
    </div>
  );
}
