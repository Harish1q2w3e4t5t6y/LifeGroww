// "Allow ChatGPT to use your Lifegrow account?" page.
//
// Supabase Auth's OAuth 2.1 server sends people here (Dashboard → Authentication
// → OAuth Server → Authorization path = /oauth/consent) with ?authorization_id=…
// when an app such as ChatGPT asks to connect. We make sure they're signed in,
// show who is asking, and pass their Allow / Deny back to Supabase, which then
// returns them to ChatGPT.

import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, ListChecks, CalendarCheck } from "lucide-react";
import type { OAuthAuthorizationDetails } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { clearPostLoginRedirect, savePostLoginRedirect } from "@/lib/postLoginRedirect";

type State =
  | { kind: "loading" }
  | { kind: "ready"; details: OAuthAuthorizationDetails }
  | { kind: "redirecting" }
  | { kind: "error"; message: string };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full grid place-items-center bg-[#0d0f1a] px-4 py-10 text-white">
      <div className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.5)] backdrop-blur">
        {children}
      </div>
    </div>
  );
}

export default function OAuthConsent() {
  const { user, loading, isConfigured } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const authorizationId = new URLSearchParams(location.search).get("authorization_id");
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null);

  useEffect(() => {
    if (loading || !user || !authorizationId) return;
    // We made it here signed in, so the remembered "come back here" is used up.
    clearPostLoginRedirect();
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (cancelled) return;
      if (error || !data) {
        setState({ kind: "error", message: error?.message || "This connection request is no longer valid." });
      } else if ("redirect_url" in data && !("authorization_id" in data)) {
        // Already approved before: go straight back to the app that asked.
        setState({ kind: "redirecting" });
        window.location.assign(data.redirect_url);
      } else {
        setState({ kind: "ready", details: data as OAuthAuthorizationDetails });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, authorizationId]);

  if (!isConfigured) {
    return (
      <Shell>
        <p className="text-sm text-white/70">Sign-in isn't set up on this site, so other apps can't connect to it.</p>
      </Shell>
    );
  }

  if (!authorizationId) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Nothing to approve</h1>
        <p className="mt-2 text-sm text-white/60">This page is opened by apps like ChatGPT when they ask to connect to your account.</p>
        <button onClick={() => navigate("/")} className="mt-6 w-full rounded-xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/15">
          Go to my matrix
        </button>
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-white/50" />
        </div>
      </Shell>
    );
  }

  if (!user) {
    savePostLoginRedirect(`${location.pathname}${location.search}`);
    return <Navigate to="/login" replace />;
  }

  const decide = async (allow: boolean) => {
    setBusy(allow ? "allow" : "deny");
    const { data, error } = allow
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (error || !data?.redirect_url) {
      setBusy(null);
      setState({ kind: "error", message: error?.message || "Could not send your answer. Please try connecting again." });
      return;
    }
    setState({ kind: "redirecting" });
    window.location.assign(data.redirect_url);
  };

  if (state.kind === "error") {
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Couldn't connect</h1>
        <p className="mt-2 text-sm text-white/60">{state.message}</p>
        <p className="mt-2 text-sm text-white/60">Start the connection again from the app you were using.</p>
        <button onClick={() => navigate("/")} className="mt-6 w-full rounded-xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/15">
          Go to my matrix
        </button>
      </Shell>
    );
  }

  if (state.kind !== "ready") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-6 text-sm text-white/50">
          <Loader2 className="h-6 w-6 animate-spin" />
          {state.kind === "redirecting" ? "Returning you to the app…" : "Loading…"}
        </div>
      </Shell>
    );
  }

  const { client } = state.details;
  const clientName = client?.name || "An app";

  return (
    <Shell>
      <div className="flex flex-col items-center gap-3 text-center">
        {client?.logo_uri ? (
          <img src={client.logo_uri} alt="" className="h-14 w-14 rounded-2xl bg-white/10 object-contain" />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600">
            <ShieldCheck className="h-7 w-7" />
          </div>
        )}
        <h1 className="text-xl font-bold tracking-tight">Allow {clientName} to use your account?</h1>
        <p className="text-sm text-white/50">
          Signed in as <span className="text-white/80">{state.details.user?.email || user.email}</span>
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
        <p className="mb-3 text-white/60">{clientName} will be able to:</p>
        <ul className="space-y-2.5">
          <li className="flex gap-2.5">
            <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
            <span>See, add, change, complete and delete tasks in both workspaces</span>
          </li>
          <li className="flex gap-2.5">
            <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
            <span>See your habits and tick them off</span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-white/40">It can't see your password or change your settings.</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={() => decide(false)}
          disabled={busy !== null}
          className="rounded-xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/15 disabled:opacity-60"
        >
          {busy === "deny" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Deny"}
        </button>
        <button
          onClick={() => decide(true)}
          disabled={busy !== null}
          className="rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
        >
          {busy === "allow" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Allow"}
        </button>
      </div>
    </Shell>
  );
}
