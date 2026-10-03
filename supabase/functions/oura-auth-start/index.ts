// Starts the Oura OAuth flow for the signed-in user.
//
// The browser can't attach an Authorization header to a plain navigation, so
// the app calls this with supabase.functions.invoke("oura-auth-start") and then
// sends the user to the returned URL:
//
//   const { data } = await supabase.functions.invoke("oura-auth-start");
//   window.location.assign(data.url);

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { OURA_AUTHORIZE_URL, OURA_SCOPES, ouraRedirectUri } from "../_shared/oura.ts";
import { signState } from "../_shared/oura-state.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "not_signed_in" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) return json({ error: "not_signed_in" }, 401);

  const clientId = Deno.env.get("OURA_CLIENT_ID");
  if (!clientId) {
    console.error("oura-auth-start: OURA_CLIENT_ID is not set");
    return json({ error: "server_misconfigured" }, 500);
  }

  const url = new URL(OURA_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", ouraRedirectUri());
  url.searchParams.set("scope", OURA_SCOPES.join(" "));
  url.searchParams.set("state", await signState(data.user.id));

  return json({ url: url.toString() });
});
