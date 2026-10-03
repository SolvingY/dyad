// Finishes the Oura OAuth flow. Called by the app's /oura/callback page with
// the signed-in user's session and the { code, state } Oura redirected with.
//
// The state must be valid AND belong to the caller. That stops someone from
// starting the flow on their own account and getting another person to
// approve it, which would store that person's Oura tokens on their account.
//
// Tokens are written with the service role and never returned or logged.

import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient, getCallerId } from "../_shared/auth.ts";
import { OURA_TOKEN_URL } from "../_shared/oura.ts";
import { verifyState } from "../_shared/oura-state.ts";

type OuraTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = adminClient();
  const userId = await getCallerId(req, admin);
  if (!userId) return json({ error: "not_signed_in" }, 401);

  let code: unknown, state: unknown;
  try {
    ({ code, state } = await req.json());
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (typeof code !== "string" || !code || typeof state !== "string" || !state) {
    return json({ error: "bad_request" }, 400);
  }

  const verified = await verifyState(state);
  if (!verified || verified.uid !== userId) return json({ error: "invalid_state" }, 400);

  const clientId = Deno.env.get("OURA_CLIENT_ID");
  const clientSecret = Deno.env.get("OURA_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.error("oura-callback: OURA_CLIENT_ID or OURA_CLIENT_SECRET is not set");
    return json({ error: "server_misconfigured" }, 500);
  }

  const tokenRes = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: verified.redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!tokenRes.ok) {
    // Status only: the body could echo request details.
    console.error(`oura-callback: token exchange failed with HTTP ${tokenRes.status}`);
    return json({ error: "token_exchange_failed" }, 502);
  }

  const tokens = (await tokenRes.json()) as OuraTokenResponse;
  if (!tokens.access_token || !tokens.refresh_token || typeof tokens.expires_in !== "number") {
    console.error(
      "oura-callback: token response missing access_token, refresh_token or expires_in",
    );
    return json({ error: "token_exchange_failed" }, 502);
  }

  const { error } = await admin.from("oura_tokens").upsert(
    {
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope ?? null,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error(`oura-callback: saving tokens failed: ${error.code} ${error.message}`);
    return json({ error: "save_failed" }, 500);
  }

  return json({ ok: true });
});
