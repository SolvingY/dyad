import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyAccess } from "@/lib/account-approval.functions";
import { GlassCard } from "@/components/dyad/glass-card";
import { BrandLogo } from "@/components/dyad/brand-logo";

/** Renders children only for signed-in, approved accounts; otherwise redirects or explains. */
export function ApprovedGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const getAccess = useServerFn(getMyAccess);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);
  useEffect(() => {
    if (!user) return;
    getAccess()
      .then((a) => setStatus(a.status))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not verify account access."));
  }, [user, getAccess]);

  if (loading || !user || (!status && !error)) return <div className="dyad-ambient h-dvh" />;
  if (error || status !== "approved") {
    return (
      <div className="dyad-ambient flex min-h-dvh items-center justify-center px-6">
        <GlassCard tone="dyad" className="w-full max-w-lg p-8 text-center">
          <BrandLogo className="mx-auto h-10" />
          <h1 className="mt-8 font-display text-3xl font-extralight text-foreground">
            {error ? "Access check unavailable" : status === "denied" ? "Access denied" : "Approval pending"}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-foreground">
            {error ??
              (status === "denied"
                ? "Your Dyad account is not approved. Contact the administrator if you believe this is a mistake."
                : "Your account is ready and waiting for administrator approval.")}
          </p>
        </GlassCard>
      </div>
    );
  }
  return <>{children}</>;
}

export function PageHeader() {
  return (
    <header className="flex items-center justify-between gap-4">
      <a href="/app" className="shrink-0" aria-label="Back to dashboard">
        <BrandLogo className="h-7 md:h-9" />
      </a>
      <a href="/app" className="glass-card rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-foreground">
        Dashboard
      </a>
    </header>
  );
}
