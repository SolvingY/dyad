import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { authRedirectUrl, useAuth } from "@/hooks/use-auth";
import { GlassCard } from "@/components/dyad/glass-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth/")({
  head: () => ({
    meta: [
      { title: "Sign in — Dyad" },
      { name: "description", content: "Sign in to Dyad to see shared vitals for you and your AI agent." },
      { property: "og:title", content: "Sign in — Dyad" },
      { property: "og:description", content: "Sign in to Dyad to see shared vitals for you and your AI agent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { mode?: "signup" } =>
    search.mode === "signup" ? { mode: "signup" } : {},
  component: AuthPage,
});

type Mode = "signin" | "signup" | "magic" | "forgot";

const inputCls =
  "w-full rounded-lg border border-glass-line bg-background/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-glass-line-luminous";
const primaryBtn =
  "w-full rounded-lg bg-gradient-to-r from-human to-agent px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed";
const ghostBtn =
  "flex w-full items-center justify-center gap-2 rounded-lg border border-glass-line px-4 py-3 text-sm text-foreground transition-colors hover:border-glass-line-luminous disabled:cursor-not-allowed";

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>(Route.useSearch().mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app", replace: true });
  }, [user, loading, navigate]);

  async function oauth(provider: "google" | "github") {
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authRedirectUrl() },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: authRedirectUrl() },
        });
        if (error) throw error;
        if (!data.session) setNotice("Check your email to confirm your account.");
      } else if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: authRedirectUrl() },
        });
        if (error) throw error;
        setNotice("Check your email for a sign-in link.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("Check your email for a password reset link.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Mode; label: string }[] = [
    { id: "signin", label: "Sign in" },
    { id: "signup", label: "Create account" },
    { id: "magic", label: "Magic link" },
  ];

  return (
    <div className="dyad-ambient flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="block text-center font-display text-2xl font-light uppercase tracking-[0.45em] text-foreground"
        >
          Dyad
        </Link>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Shared vitals for a human and their AI agent.
        </p>

        <GlassCard tone="dyad" className="mt-10 px-7 py-8">
          <span aria-hidden="true" className="dyad-gradient-line absolute inset-x-7 top-0 h-px" />

          <div className="flex flex-col gap-3">
            <button type="button" className={ghostBtn} disabled={busy} onClick={() => oauth("google")}>
              Continue with Google
            </button>
            <button type="button" className={ghostBtn} disabled={busy} onClick={() => oauth("github")}>
              Continue with GitHub
            </button>
          </div>

          <div className="my-7 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            <span className="h-px flex-1 bg-glass-line" />
            or
            <span className="h-px flex-1 bg-glass-line" />
          </div>

          {mode !== "forgot" && (
            <div className="mb-5 flex gap-1 rounded-lg border border-glass-line p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setMode(t.id);
                    setError(null);
                    setNotice(null);
                  }}
                  className={cn(
                    "flex-1 rounded-md px-2 py-2 text-[11px] uppercase tracking-[0.15em] transition-colors",
                    mode === t.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
            {(mode === "signin" || mode === "signup") && (
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
            )}
            <button type="submit" className={cn(primaryBtn, "mt-2")} disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "magic"
                      ? "Send magic link"
                      : "Send reset link"}
            </button>
          </form>

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          {notice && <p className="mt-4 text-sm text-agent">{notice}</p>}

          <div className="mt-6 text-center text-xs text-muted-foreground">
            {mode === "signin" && (
              <button type="button" className="hover:text-foreground" onClick={() => setMode("forgot")}>
                Forgot password?
              </button>
            )}
            {mode === "forgot" && (
              <button type="button" className="hover:text-foreground" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
