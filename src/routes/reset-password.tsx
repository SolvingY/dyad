import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/dyad/glass-card";
import { BrandLogo } from "@/components/dyad/brand-logo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Dyad" },
      { name: "description", content: "Choose a new password for your Dyad account." },
      { property: "og:title", content: "Reset password — Dyad" },
      { property: "og:description", content: "Choose a new password for your Dyad account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    navigate({ to: "/app", replace: true });
  }

  return (
    <main
      id="main-content"
      className="dyad-ambient flex min-h-screen items-center justify-center px-6"
    >
      <GlassCard tone="dyad" className="w-full max-w-md px-7 py-8">
        <div className="mb-7 flex justify-center">
          <BrandLogo className="h-12" />
        </div>
        <h1 className="text-[11px] uppercase tracking-[0.35em] text-foreground">Set a new password</h1>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          <label htmlFor="new-password" className="sr-only">
            New password (at least 6 characters)
          </label>
          <input
            id="new-password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "reset-error" : undefined}
            className="w-full rounded-lg border border-glass-line bg-background/40 px-4 py-3 text-sm text-foreground outline-none focus:border-glass-line-luminous focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-lg bg-gradient-to-r from-human to-agent px-4 py-3 text-sm font-medium text-background disabled:cursor-not-allowed"
          >
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
        <div role="alert">
          {error && (
            <p id="reset-error" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </GlassCard>
    </main>
  );
}
