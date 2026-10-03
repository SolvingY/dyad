// Where to send the user after they sign in. The OAuth consent page sets this
// so sign-in (including Google/GitHub redirects) brings them back to approve.

const KEY = "dyad:return-to";

export function setReturnTo(path: string) {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    /* storage unavailable: fall back to the default */
  }
}

/** Returns and clears the saved path, or "/app". Only same-site paths are allowed. */
export function takeReturnTo(): string {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (path && path.startsWith("/") && !path.startsWith("//")) return path;
  } catch {
    /* storage unavailable */
  }
  return "/app";
}
