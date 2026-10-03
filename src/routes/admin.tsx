import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "@/components/dyad/brand-logo";
import { GlassCard } from "@/components/dyad/glass-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { decideApproval, getMyAccess, listApprovalRequests } from "@/lib/account-approval.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Account approvals — Dyad" },
      { name: "description", content: "Review access requests for Dyad." },
      { property: "og:title", content: "Account approvals — Dyad" },
      { property: "og:description", content: "Review access requests for Dyad." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type RequestRow = Awaited<ReturnType<typeof listApprovalRequests>>[number];

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const getAccess = useServerFn(getMyAccess);
  const listRequests = useServerFn(listApprovalRequests);
  const decide = useServerFn(decideApproval);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [pageState, setPageState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const access = await getAccess();
      if (!access.isAdmin) {
        setPageState("forbidden");
        return;
      }
      setRows(await listRequests());
      setPageState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load approval requests.");
      setPageState("error");
    }
  }, [getAccess, listRequests]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
    if (user) void load();
  }, [loading, user, navigate, load]);

  async function setDecision(userId: string, status: "approved" | "denied") {
    setBusyId(userId);
    setError(null);
    try {
      await decide({ data: { userId, status } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this account.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !user || pageState === "loading") return <div className="dyad-ambient min-h-dvh" />;

  return (
    <div className="dyad-ambient min-h-dvh px-4 py-5 md:px-8">
      <main className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <BrandLogo className="h-8 md:h-10" />
          <Link to="/app" className="text-xs uppercase tracking-[0.2em] text-foreground hover:text-agent">Dashboard</Link>
        </header>
        <div className="mt-12 flex items-end justify-between gap-5 border-b border-glass-line pb-5">
          <div>
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-agent"><ShieldCheck className="size-4" />Administrator</p>
            <h1 className="mt-3 font-display text-4xl font-extralight text-foreground md:text-5xl">Account approvals</h1>
          </div>
          <span className="text-sm text-foreground">{rows.filter((row) => row.status === "pending").length} pending</span>
        </div>

        {pageState === "forbidden" ? (
          <GlassCard tone="dyad" className="mt-8 p-6 text-foreground">This page is available to administrators only.</GlassCard>
        ) : (
          <div className="mt-7 grid gap-3">
            {error && <p className="rounded-md border border-destructive px-4 py-3 text-sm text-destructive">{error}</p>}
            {rows.length === 0 && <GlassCard tone="dyad" className="p-6 text-foreground">No account requests yet.</GlassCard>}
            {rows.map((row) => (
              <GlassCard key={row.user_id} tone={row.status === "approved" ? "agent" : row.status === "denied" ? "human" : "dyad"} className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className={cn("size-2 rounded-full", row.status === "approved" ? "bg-moss" : row.status === "denied" ? "bg-destructive" : "bg-agent ring-glow")} />
                    <p className="truncate text-base font-medium text-foreground">{row.email}</p>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{row.displayName ?? "No display name"} · Requested {new Date(row.created_at).toLocaleDateString()}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-foreground">{row.status}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={busyId === row.user_id || row.status === "denied"} onClick={() => void setDecision(row.user_id, "denied")}>
                    <X /> Deny
                  </Button>
                  <Button disabled={busyId === row.user_id || row.status === "approved"} onClick={() => void setDecision(row.user_id, "approved")}>
                    <Check /> Approve
                  </Button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}