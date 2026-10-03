import { createFileRoute } from "@tanstack/react-router";

// Sends a Supabase password-recovery email. This is the same capability as the
// public "forgot password" form — it never returns account data, it only
// triggers an email to the address itself. The redirect is pinned to the
// published reset page so the link works outside the editor preview.
export const Route = createFileRoute("/api/public/password-reset")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let email: string | undefined;
        try {
          const body = await request.json();
          email = typeof body?.email === "string" ? body.email.trim() : undefined;
        } catch {
          return Response.json({ error: "Invalid request body" }, { status: 400 });
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return Response.json({ error: "A valid email address is required" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: "https://dyad-human-agent-sync.lovable.app/reset-password",
        });
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
