import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ArrowRight, Mail, Lock, Eye, EyeOff, ShieldAlert, Loader2 } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   Google SVG icon (brand-accurate)
───────────────────────────────────────────────────────────────────────────── */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Offline / not-configured fallback
───────────────────────────────────────────────────────────────────────────── */
function OfflineFallback({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="login-card w-full max-w-md p-8 rounded-2xl flex flex-col gap-6">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="h-14 w-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <ShieldAlert className="h-7 w-7 text-amber-400" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-white">Supabase Not Configured</h2>
        <p className="text-sm text-white/50 leading-relaxed">
          Add your Supabase credentials to enable cloud sync and sign-in.
        </p>
      </div>
      {/* Instructions */}
      <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 space-y-2">
        <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Setup — .env file</p>
        <pre className="text-xs text-blue-300 font-mono leading-relaxed">
          {`VITE_SUPABASE_URL=your_project_url\nVITE_SUPABASE_ANON_KEY=your_anon_key`}
        </pre>
        <p className="text-[11px] text-white/30">
          Create this file in the project root, then restart the dev server.
        </p>
      </div>
      <button
        onClick={onContinue}
        className="login-btn-outline group flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-medium transition-all"
      >
        Continue in Offline Mode
        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Login Page
───────────────────────────────────────────────────────────────────────────── */
export default function Login() {
  const { user, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Slight delay so the fade-in animation feels intentional
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  /* ── handlers ── */
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast.error((err as Error).message || "Google sign-in failed");
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (tab === "signup" && password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setAuthLoading(true);
    try {
      if (tab === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to verify.");
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  /* ── offline fallback ── */
  if (!isConfigured) {
    return (
      <div className="login-root">
        <LoginBackground />
        <div
          className={`login-content transition-all duration-500 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <OfflineFallback onContinue={() => navigate("/")} />
        </div>
        <LoginStyles />
      </div>
    );
  }

  return (
    <div className="login-root">
      {/* Animated background */}
      <LoginBackground />

      {/* Card */}
      <div
        className={`login-content transition-all duration-500 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <div className="login-card w-full max-w-[420px] rounded-2xl p-8 flex flex-col gap-6">

          {/* ── Brand ── */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 grid place-items-center shadow-[0_0_40px_rgba(99,102,241,0.4)]">
                <span className="text-white font-bold text-2xl select-none">E</span>
              </div>
              {/* Glow ring */}
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 opacity-20 blur-md -z-10" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Productivity Studio
              </h1>
              <p className="text-sm text-white/45 mt-0.5">
                Sign in to sync your matrix, habits & preferences
              </p>
            </div>
          </div>

          {/* ── Google (primary CTA) ── */}
          <button
            id="google-signin-btn"
            onClick={handleGoogleLogin}
            disabled={googleLoading || authLoading}
            className="login-btn-google group relative flex items-center justify-center gap-3 w-full py-3 px-5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:pointer-events-none"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/70" />
            ) : (
              <GoogleIcon className="h-5 w-5 shrink-0" />
            )}
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[11px] uppercase tracking-widest text-white/30">
              or use email
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* ── Tab switcher ── */}
          <div className="login-tabs grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.05]">
            {(["signin", "signup"] as const).map((t) => (
              <button
                key={t}
                id={`tab-${t}`}
                onClick={() => setTab(t)}
                className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                  tab === t
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {t === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* ── Email form ── */}
          <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-xs font-medium text-white/50 uppercase tracking-widest">
                Email
              </label>
              <div className="login-input-wrap relative">
                <Mail className="login-input-icon absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="login-input w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20 bg-transparent outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-xs font-medium text-white/50 uppercase tracking-widest">
                Password
              </label>
              <div className="login-input-wrap relative">
                <Lock className="login-input-icon absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={tab === "signin" ? "current-password" : "new-password"}
                  placeholder={tab === "signup" ? "Min. 6 characters" : "••••••••"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="login-input w-full pl-10 pr-12 py-3 rounded-xl text-sm text-white placeholder:text-white/20 bg-transparent outline-none"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="email-auth-btn"
              type="submit"
              disabled={authLoading || googleLoading}
              className="login-btn-primary group flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:pointer-events-none"
            >
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {authLoading
                ? tab === "signin"
                  ? "Signing in…"
                  : "Creating account…"
                : tab === "signin"
                ? "Sign In with Email"
                : "Create Account"}
              {!authLoading && (
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              )}
            </button>
          </form>

          {/* ── Footer note ── */}
          <p className="text-center text-[11px] text-white/25 leading-relaxed">
            Your data is encrypted and synced securely via Supabase.
            <br />
            All features work offline too.
          </p>
        </div>
      </div>

      <LoginStyles />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Animated background mesh
───────────────────────────────────────────────────────────────────────────── */
function LoginBackground() {
  return (
    <div className="login-bg" aria-hidden="true">
      {/* Deep dark base */}
      <div className="absolute inset-0 bg-[#080b14]" />
      {/* Radial glow orbs */}
      <div className="orb orb-blue" />
      <div className="orb orb-violet" />
      <div className="orb orb-teal" />
      {/* Noise texture overlay */}
      <div className="absolute inset-0 bg-noise opacity-[0.03]" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Scoped styles injected inline (no Tailwind escape needed for complex values)
───────────────────────────────────────────────────────────────────────────── */
function LoginStyles() {
  return (
    <style>{`
      .login-root {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .login-bg {
        position: absolute;
        inset: 0;
        overflow: hidden;
        z-index: 0;
      }

      .orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(100px);
        pointer-events: none;
      }

      .orb-blue {
        width: 55vw;
        height: 55vw;
        top: -20%;
        left: -15%;
        background: radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%);
        animation: orb-drift-1 14s ease-in-out infinite alternate;
      }

      .orb-violet {
        width: 50vw;
        height: 50vw;
        bottom: -20%;
        right: -10%;
        background: radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%);
        animation: orb-drift-2 18s ease-in-out infinite alternate;
      }

      .orb-teal {
        width: 35vw;
        height: 35vw;
        top: 40%;
        left: 50%;
        background: radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%);
        animation: orb-drift-3 22s ease-in-out infinite alternate;
      }

      @keyframes orb-drift-1 {
        from { transform: translate(0, 0) scale(1); }
        to   { transform: translate(4%, 6%) scale(1.08); }
      }
      @keyframes orb-drift-2 {
        from { transform: translate(0, 0) scale(1); }
        to   { transform: translate(-5%, -4%) scale(1.05); }
      }
      @keyframes orb-drift-3 {
        from { transform: translate(-50%, -50%) scale(1); }
        to   { transform: translate(-50%, -50%) scale(1.15); }
      }

      .login-content {
        position: relative;
        z-index: 10;
        width: 100%;
        max-width: 460px;
        padding: 1rem;
      }

      .login-card {
        background: rgba(255,255,255,0.035);
        border: 1px solid rgba(255,255,255,0.09);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        box-shadow:
          0 0 0 1px rgba(255,255,255,0.04) inset,
          0 32px 64px -16px rgba(0,0,0,0.7),
          0 4px 32px -4px rgba(99,102,241,0.12);
      }

      /* Google button — white with subtle shadow */
      .login-btn-google {
        background: #ffffff;
        color: #1a1a2e;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08);
      }
      .login-btn-google:hover:not(:disabled) {
        background: #f1f5ff;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.1);
        transform: translateY(-1px);
      }
      .login-btn-google:active:not(:disabled) {
        transform: translateY(0);
      }

      /* Primary email submit button */
      .login-btn-primary {
        background: linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%);
        color: #ffffff;
        box-shadow: 0 4px 16px rgba(99,102,241,0.35);
      }
      .login-btn-primary:hover:not(:disabled) {
        filter: brightness(1.1);
        box-shadow: 0 6px 20px rgba(99,102,241,0.45);
        transform: translateY(-1px);
      }
      .login-btn-primary:active:not(:disabled) {
        transform: translateY(0);
        filter: brightness(1);
      }

      /* Outline button (offline mode) */
      .login-btn-outline {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.12);
        color: rgba(255,255,255,0.7);
      }
      .login-btn-outline:hover {
        background: rgba(255,255,255,0.09);
        color: #ffffff;
        border-color: rgba(255,255,255,0.18);
      }

      /* Input wrapper */
      .login-input-wrap {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.09);
        border-radius: 0.75rem;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .login-input-wrap:focus-within {
        border-color: rgba(99,102,241,0.5);
        box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
      }

      .login-input {
        background: transparent;
        color: #fff;
        width: 100%;
      }
      .login-input:-webkit-autofill,
      .login-input:-webkit-autofill:hover,
      .login-input:-webkit-autofill:focus {
        -webkit-text-fill-color: #fff;
        -webkit-box-shadow: 0 0 0px 1000px transparent inset;
        transition: background-color 5000s ease-in-out 0s;
      }
    `}</style>
  );
}
