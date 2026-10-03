import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { takeReturnTo } from "@/lib/return-to";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Signing you in — Dyad" },
      { name: "description", content: "Completing sign-in to your Dyad dashboard." },
      { property: "og:title", content: "Signing you in — Dyad" },
      { property: "og:description", content: "Completing sign-in to your Dyad dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const finish = () => !cancelled && navigate({ href: takeReturnTo(), replace: true });

    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.slice(1));
      const providerError =
        url.searchParams.get("error_description") ?? hash.get("error_description");
      if (providerError) {
        setError(providerError);
        return;
      }

      // PKCE flow: exchange ?code= for a session.
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setError(error.message);
            return;
          }
        }
        finish();
        return;
      }

      // Implicit flow: the client reads #access_token automatically.
      const { data } = await supabase.auth.getSession();
      if (data.session) return finish();

      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        if (session) {
          sub.subscription.unsubscribe();
          finish();
        }
      });
      setTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        if (!data.session && !cancelled) setError("We couldn't complete sign-in. Please try again.");
      }, 6000);
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="dyad-ambient flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <p className="font-display text-xl font-light uppercase tracking-[0.45em] text-foreground">Dyad</p>
        {error ? (
          <>
            <p className="mt-6 text-sm text-destructive">{error}</p>
            <Link to="/auth" className="mt-4 inline-block text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
              Back to sign in
            </Link>
          </>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">Signing you in…</p>
        )}
      </div>
    </div>
  );
}
