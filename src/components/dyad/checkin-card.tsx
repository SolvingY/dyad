import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard } from "@/components/dyad/glass-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Checkin = { id: string; message: string | null; created_at: string };

// Shows the agent's latest unanswered check-in question and sends the human's
// answer to the checkin-respond edge function.
export function CheckinCard() {
  const { user } = useAuth();
  const [checkin, setCheckin] = useState<Checkin | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("checkins")
      .select("id, message, created_at")
      .eq("decision", "ask")
      .is("responded_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setCheckin(data));
  }, [user]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!checkin || energy === null) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.functions.invoke("checkin-respond", {
      body: { checkin_id: checkin.id, energy, note: note.trim() || null },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setCheckin(null);
  }

  if (!checkin) return null;

  return (
    <GlassCard tone="dyad" className="p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-foreground/50">Agent check-in</p>
      <p className="mt-4 text-sm text-foreground/85">{checkin.message}</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Energy</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setEnergy(n)}
              className={cn(
                "glass-card size-8 rounded-full text-sm",
                energy === n ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note"
          maxLength={1000}
          rows={2}
        />
        <Button type="submit" disabled={busy || energy === null}>
          {busy ? "Sending…" : "Answer"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </GlassCard>
  );
}
