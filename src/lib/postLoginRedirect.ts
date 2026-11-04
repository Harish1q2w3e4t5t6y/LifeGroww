// Remembers where to send someone after they sign in, for pages that need a
// signed-in user but aren't the main app (the ChatGPT "Allow access?" page).
// Kept in sessionStorage so it survives the Google sign-in round trip, and
// expires so an abandoned attempt doesn't hijack a later, normal sign-in.

const KEY = "lifegrow.postLoginRedirect";
const MAX_AGE_MS = 15 * 60 * 1000;

function isSafePath(path: string): boolean {
  // Same-site paths only: "/x" but not "//evil.com" or "/\evil.com".
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

export function savePostLoginRedirect(path: string, now = Date.now()) {
  if (!isSafePath(path)) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, at: now }));
  } catch {
    /* storage unavailable: the user just lands on the home page */
  }
}

export function getPostLoginRedirect(now = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof path !== "string" || typeof at !== "number" || now - at > MAX_AGE_MS || !isSafePath(path)) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

export function clearPostLoginRedirect() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
