import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard } from "@/components/dyad/glass-card";
import { BrandLogo } from "@/components/dyad/brand-logo";
import { Button } from "@/components/ui/button";
import { setReturnTo } from "@/lib/return-to";

// OAuth consent for apps connecting to Dyad's MCP server (e.g. Claude).
// Supabase Auth's OAuth 2.1 server sends the user here with ?authorization_id=...
export const Route = createFileRoute("/oauth/consent")({
  head: () => ({
    meta: [{ title: "Connect an app — Dyad" }, { name: "robots", content: "noindex" }],
  }),
  ssr: false,
  component: ConsentPage,
});

type Details = { clientName: string; clientUri: string; email: string };

function ConsentPage() {
  const { user, loading } = useAuth();
  const authorizationId = new URLSearchParams(window.location.search).get("authorization_id");
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !authorizationId) return;
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (error || !data) {
        setError(
          error?.message ?? "This request has expired. Start connecting again from the app.",
        );
      } else if ("redirect_url" in data) {
        // Already approved before: go straight back to the app.
        window.location.assign(data.redirect_url);
      } else {
        setDetails({
          clientName: data.client.name || "An app",
          clientUri: data.client.uri,
          email: data.user.email,
        });
      }
    });
  }, [user, authorizationId]);

  async function decide(approve: boolean) {
    if (!authorizationId) return;
    setBusy(true);
    const { error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId);
    // On success the browser is redirected back to the app.
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  let body;
  if (!authorizationId) {
    body = (
      <p className="text-sm text-muted-foreground">
        This link is missing its request. Start connecting again from the app.
      </p>
    );
  } else if (loading) {
    body = null;
  } else if (!user) {
    body = (
      <>
        <p className="text-sm text-muted-foreground">Sign in to Dyad to connect this app.</p>
        <Button
          asChild
          className="self-start"
          onClick={() => setReturnTo(window.location.pathname + window.location.search)}
        >
          <Link to="/auth">Sign in</Link>
        </Button>
      </>
    );
  } else if (error) {
    body = <p className="text-sm text-destructive">{error}</p>;
  } else if (!details) {
    body = <p className="text-sm text-muted-foreground">Loading…</p>;
  } else {
    body = (
      <>
        <p className="text-sm text-foreground/90">
          <strong>{details.clientName}</strong> wants to connect to your Dyad as one of your agents.
        </p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          <li>Read your Oura vitals and its own agent vitals</li>
          <li>Read your Dyad thread and post messages and check-ins</li>
          <li>Report its own calls so Dyad can track its vitals</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Signed in as {details.email}. Limited to 20 tool calls per hour. You can disconnect it any
          time on the agent page.
        </p>
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => decide(true)}>
            Approve
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            Deny
          </Button>
        </div>
      </>
    );
  }

  return (
    <div className="dyad-ambient flex min-h-screen items-center justify-center px-6">
      <GlassCard tone="agent" className="flex w-full max-w-md flex-col gap-4 p-6">
        <div className="flex justify-center pb-2">
          <BrandLogo className="h-11" />
        </div>
        <p className="text-xs uppercase tracking-[0.25em] text-foreground/50">Connect an app</p>
        {body}
      </GlassCard>
    </div>
  );
}
