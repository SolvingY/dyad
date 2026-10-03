import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Service-role client. Bypasses RLS: only use server-side, never expose. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Returns the signed-in caller's user id, or null if the request has no valid session. */
export async function getCallerId(req: Request, admin: SupabaseClient): Promise<string | null> {
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    console.warn("getCallerId: no Authorization header");
    return null;
  }
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) {
    console.warn("getCallerId: token rejected:", error?.message ?? "no user");
    return null;
  }
  return data.user.id;
}
