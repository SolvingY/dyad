// Signed OAuth `state` for the Oura flow. It carries the Supabase user id and
// the redirect URI used, so oura-callback can check the state belongs to the
// signed-in caller and repeat the same redirect URI, without a state table.
// Format: base64url(payload) + "." + base64url(HMAC-SHA256(payload)).

const STATE_TTL_SECONDS = 10 * 60;

type StatePayload = { uid: string; ru: string; nonce: string; exp: number };
export type VerifiedState = { uid: string; redirectUri: string };

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("OURA_CLIENT_SECRET");
  if (!secret) throw new Error("OURA_CLIENT_SECRET is not set");
  // Domain-separated so the signature is only valid as an Oura state value.
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`dyad-oura-state:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signState(uid: string, redirectUri: string): Promise<string> {
  const payload: StatePayload = {
    uid,
    ru: redirectUri,
    nonce: b64url(crypto.getRandomValues(new Uint8Array(16))),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  };
  const body = new TextEncoder().encode(JSON.stringify(payload));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), body));
  return `${b64url(body)}.${b64url(sig)}`;
}

/** Returns the state's contents if it is authentic and unexpired, else null. */
export async function verifyState(state: string): Promise<VerifiedState | null> {
  const [bodyPart, sigPart] = state.split(".");
  if (!bodyPart || !sigPart) return null;
  try {
    const body = b64urlDecode(bodyPart);
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), b64urlDecode(sigPart), body);
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(body)) as StatePayload;
    if (typeof payload.uid !== "string" || typeof payload.ru !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { uid: payload.uid, redirectUri: payload.ru };
  } catch {
    return null;
  }
}
