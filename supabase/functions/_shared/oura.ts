export const OURA_AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
export const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";

// `daily` covers daily_readiness, daily_sleep, daily_activity and sleep.
export const OURA_SCOPES = ["daily"];

// Oura sends the user back to this page in the app, which forwards the code
// to oura-callback together with the user's session.
export const OURA_CALLBACK_PATH = "/oura/callback";

/**
 * Builds the redirect URI from the calling app's Origin header, so the same
 * code works on the published site and on preview domains. Oura only accepts
 * redirect URIs registered on the Oura app, so an unexpected origin fails there.
 */
export function ouraRedirectUriFromOrigin(origin: string | null): string | null {
  if (!origin) return null;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) return null;
  return `${url.origin}${OURA_CALLBACK_PATH}`;
}
