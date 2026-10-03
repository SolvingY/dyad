export const OURA_AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
export const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";

// `daily` covers daily_readiness, daily_sleep, daily_activity and sleep.
export const OURA_SCOPES = ["daily"];

/** Must match the redirect URI registered with Oura exactly. */
export function ouraRedirectUri(): string {
  const base = Deno.env.get("SUPABASE_URL");
  if (!base) throw new Error("SUPABASE_URL is not set");
  return `${base.replace(/\/$/, "")}/functions/v1/oura-callback`;
}
