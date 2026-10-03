import { createServerFn } from "@tanstack/react-start";

// One-off admin utility: send a password-recovery email through Supabase Auth.
// Uses the admin client so the redirect can be pinned to the published reset page.
export const sendPasswordResetEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => {
    if (!data?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new Error("A valid email address is required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: "https://dyad-human-agent-sync.lovable.app/reset-password",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
