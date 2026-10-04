import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Note = { id: string; title: string; body: string | null; read_at: string | null; created_at: string };

export function NotificationBell({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, body, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setError(error?.message ?? null);
    setNotes(data ?? []);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();
    const t = setInterval(() => void load(), 5 * 60_000);
    return () => {
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const unread = notes.filter((n) => !n.read_at).length;

  const markAll = async () => {
    const ids = notes.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: now }).in("id", ids);
    setNotes((all) => all.map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n)));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="glass-card relative inline-flex size-11 items-center justify-center rounded-full text-foreground">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-agent text-[10px] font-medium text-background">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="glass-card w-80 border-glass-line bg-background/95 p-0 text-foreground">
        <div className="flex items-center justify-between border-b border-glass-line/60 px-4 py-3">
          <span className="text-[11px] uppercase tracking-[0.25em]">Notifications</span>
          {unread > 0 && (
            <button type="button" onClick={() => void markAll()} className="text-xs text-agent hover:underline">Mark all read</button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {error && <p className="px-4 py-3 text-xs">Error: {error}</p>}
          {!error && notes.length === 0 && (
            <p className="px-4 py-4 text-xs">
              No notifications yet. <Link to="/reminders" className="text-agent hover:underline">Set up reminders</Link>
            </p>
          )}
          {notes.map((n) => (
            <div key={n.id} className="border-b border-glass-line/40 px-4 py-3 last:border-0">
              <div className="flex items-center gap-2">
                {!n.read_at && <span className="size-1.5 shrink-0 rounded-full bg-agent" />}
                <span className="text-sm font-medium">{n.title}</span>
              </div>
              {n.body && <p className="mt-1 text-xs leading-relaxed">{n.body}</p>}
              <p className="mt-1 text-[10px] tracking-[0.1em]">
                {new Date(n.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
