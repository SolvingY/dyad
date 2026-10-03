import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Oura redirects here after the user approves (or denies) access. This page
// forwards the code to the oura-callback edge function with the user's
// session, then sends them home with ?oura=connected|denied|error.
export const Route = createFileRoute("/oura/callback")({
  head: () => ({
    meta: [{ title: "Connecting Oura — Dyad" }, { name: "robots", content: "noindex" }],
  }),
  ssr: false,
  component: OuraCallbackPage,
});

type OuraResult = "connected" | "denied" | "error";

async function finishOuraConnect(params: URLSearchParams): Promise<OuraResult> {
  if (params.get("error")) return "denied";
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return "error";

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return "error";

  const { error } = await supabase.functions.invoke("oura-callback", { body: { code, state } });
  return error ? "error" : "connected";
}

function OuraCallbackPage() {
  const navigate = useNavigate();
  // The code is single-use, so never send it twice (e.g. StrictMode double effects).
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    void finishOuraConnect(params)
      .catch(() => "error" as const)
      .then((oura) => navigate({ href: `/?oura=${oura}`, replace: true }));
  }, [navigate]);

  return (
    <div className="dyad-ambient flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Connecting your Oura ring…</p>
    </div>
  );
}
