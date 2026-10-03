// API keys for connected agents. Only the SHA-256 hash is stored.

export const KEY_PREFIX = "dyad_";

export function newAgentKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return KEY_PREFIX + btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashAgentKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
