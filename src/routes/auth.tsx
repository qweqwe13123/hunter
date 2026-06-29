import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Mail, Lock, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SolverHunt" },
      { name: "description", content: "Sign in or create an account to use SolverHunt's lead prospecting tools." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oauthRedirectUri = () => `${window.location.origin}/auth`;

  const getReadableOAuthError = (message: string) => {
    let decoded = message;
    try {
      decoded = decodeURIComponent(message);
    } catch {
      decoded = message;
    }
    if (decoded.toLowerCase().includes("provider 'google' is not supported")) {
      return "Google sign-in is not enabled yet. Enable Google in Cloud → Users → Auth → Google, then try again.";
    }
    return decoded || "Google sign-in failed";
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  useEffect(() => {
    if (!window.location.hash.includes("error")) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const message = params.get("error_description") || params.get("error") || "Google sign-in failed";
    setError(getReadableOAuthError(message));
    window.history.replaceState(null, "", "/auth");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0f1c] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(16,185,129,0.18) 0%, rgba(10,15,28,0) 70%), radial-gradient(40% 40% at 80% 30%, rgba(59,130,246,0.18) 0%, rgba(10,15,28,0) 70%)",
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mt-12">
          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {mode === "signin"
              ? "Sign in to keep using SolverHunt."
              : "Free plan includes 1 search of 5 leads. Upgrade anytime."}
          </p>

          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={async () => {
                setError(null);
                try {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: oauthRedirectUri() },
                  });
                  if (error) setError(getReadableOAuthError(error.message || "Google sign-in failed"));
                } catch (err) {
                  setError(err instanceof Error ? getReadableOAuthError(err.message) : "Google sign-in failed");
                }
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              <svg className="h-4 w-4" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 0 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.3-7.2 2.3-5.2 0-9.6-3.3-11.3-8l-6.5 5A20 20 0 0 0 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.4 35.9 44 30.4 44 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
              Continue with Google
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
            <div className="h-px flex-1 bg-white/10" /> or <div className="h-px flex-1 bg-white/10" />
          </div>




          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Email</span>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                <Mail className="h-4 w-4 text-slate-500" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Password</span>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                <Lock className="h-4 w-4 text-slate-500" />
                <input
                  type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </label>
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
            )}
            <button
              type="submit" disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.6)] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, rgb(16,185,129) 0%, rgb(20,184,166) 50%, rgb(59,130,246) 100%)" }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="font-semibold text-emerald-300 hover:text-emerald-200">
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
