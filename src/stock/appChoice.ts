// Decides which app a visit opens: Lifegrow, Home Stock, or (on phones) the
// "which app?" choice screen. Part of the Home Stock experiment; see REMOVE.md.

export type AppPick = "lifegrow" | "stock" | "ask";
type Choice = "lifegrow" | "stock";

const REMEMBER_KEY = "app-choice.v1"; // localStorage: this phone always opens this app
const SESSION_KEY = "app-choice.session.v1"; // sessionStorage: chosen for this visit only

export interface VisitInfo {
  pathname: string;
  search: string;
  hash: string;
  isPhone: boolean;
  remembered: string | null;
  chosenThisVisit: string | null;
}

const isChoice = (v: string | null): v is Choice => v === "lifegrow" || v === "stock";

export function pickApp(v: VisitInfo): AppPick {
  if (v.pathname === "/stock" || v.pathname.startsWith("/stock/")) return "stock";
  // Only the front door asks. Other Lifegrow pages (e.g. /oauth/consent for
  // ChatGPT) and sign-in round trips (?code=, #access_token, password reset)
  // must go straight to Lifegrow.
  const frontDoor = v.pathname === "/" || v.pathname === "/login";
  if (!frontDoor || v.search || v.hash) return "lifegrow";
  if (isChoice(v.chosenThisVisit)) return v.chosenThisVisit;
  if (isChoice(v.remembered)) return v.remembered;
  return v.isPhone ? "ask" : "lifegrow";
}

function safeGet(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function looksLikePhone(): boolean {
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPod|Mobile/i.test(ua)) return true;
  // iPadOS reports itself as a Mac; touch tells it apart.
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

export function pickAppForThisVisit(): AppPick {
  return pickApp({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    isPhone: looksLikePhone(),
    remembered: safeGet(() => localStorage, REMEMBER_KEY),
    chosenThisVisit: safeGet(() => sessionStorage, SESSION_KEY),
  });
}

export function chooseApp(choice: Choice, remember: boolean) {
  try {
    sessionStorage.setItem(SESSION_KEY, choice);
    if (remember) localStorage.setItem(REMEMBER_KEY, choice);
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* storage blocked: it just asks again next time */
  }
  window.location.assign(choice === "stock" ? "/stock" : "/");
}

/** "Switch app": forget the choice and show the choice screen again. */
export function switchApp() {
  try {
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  window.location.assign("/");
}
