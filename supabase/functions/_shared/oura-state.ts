// Signed OAuth `state` for the Oura flow. It carries the Supabase user id so
// oura-callback knows whose tokens it is storing, without a state table.
// Format: base64url(payload) + "." + base64url(HMAC-SHA256(payload)).

const STATE_TTL_SECONDS = 10 * 60;

type StatePayload = { uid: string; nonce: string; exp: number };

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

export async function signState(uid: string): Promise<string> {
  const payload: StatePayload = {
    uid,
    nonce: b64url(crypto.getRandomValues(new Uint8Array(16))),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  };
  const body = new TextEncoder().encode(JSON.stringify(payload));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), body));
  return `${b64url(body)}.${b64url(sig)}`;
}

/** Returns the user id if the state is authentic and unexpired, else null. */
export async function verifyState(state: string): Promise<string | null> {
  const [bodyPart, sigPart] = state.split(".");
  if (!bodyPart || !sigPart) return null;
  try {
    const body = b64urlDecode(bodyPart);
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), b64urlDecode(sigPart), body);
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(body)) as StatePayload;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.uid;
  } catch {
    return null;
  }
}
