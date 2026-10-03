// Starts the Oura OAuth flow for the signed-in user.
//
// The browser can't attach an Authorization header to a plain navigation, so
// the app calls this with supabase.functions.invoke("oura-auth-start") and then
// sends the user to the returned URL:
//
//   const { data } = await supabase.functions.invoke("oura-auth-start");
//   window.location.assign(data.url);
//
// Oura then redirects to <app origin>/oura/callback, which calls oura-callback.

import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient, getCallerId } from "../_shared/auth.ts";
import { OURA_AUTHORIZE_URL, OURA_SCOPES, ouraRedirectUriFromOrigin } from "../_shared/oura.ts";
import { signState } from "../_shared/oura-state.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const userId = await getCallerId(req, adminClient());
  if (!userId) return json({ error: "not_signed_in" }, 401);

  const redirectUri = ouraRedirectUriFromOrigin(req.headers.get("Origin"));
  if (!redirectUri) return json({ error: "bad_origin" }, 400);

  const clientId = Deno.env.get("OURA_CLIENT_ID");
  if (!clientId) {
    console.error("oura-auth-start: OURA_CLIENT_ID is not set");
    return json({ error: "server_misconfigured" }, 500);
  }

  const url = new URL(OURA_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", OURA_SCOPES.join(" "));
  url.searchParams.set("state", await signState(userId, redirectUri));

  return json({ url: url.toString() });
});
