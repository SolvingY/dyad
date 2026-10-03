import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Service-role client. Bypasses RLS: only use server-side, never expose. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Server-to-server calls (e.g. agent-checkin acting for a user) send the
// service role key as the bearer token and name the user in this header.
export const ACT_AS_USER_HEADER = "x-dyad-user-id";

/**
 * Returns the caller's user id: the signed-in user, or, for a request that
 * carries the service role key, the user named in ACT_AS_USER_HEADER.
 * Null if neither applies.
 */
export async function getCallerId(req: Request, admin: SupabaseClient): Promise<string | null> {
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    console.warn("getCallerId: no Authorization header");
    return null;
  }
  if (jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return req.headers.get(ACT_AS_USER_HEADER);
  }
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) {
    console.warn("getCallerId: token rejected:", error?.message ?? "no user");
    return null;
  }
  return data.user.id;
}
