"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AppShell, ErrorText, FieldLabel, PrimaryButton, inputClass } from "@/components/ui";

// Figma: LoginScreen + CreateAccountScreen
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const signup = mode === "signup";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (signup && password !== confirm) return setError("Those passwords don't match");
    setLoading(true);

    const { data, error } = signup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setError(error?.message ?? "Something went wrong");
      setLoading(false);
      return;
    }

    // Does this person already have a profile?
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();

    let pending: string | null = null;
    try {
      pending = localStorage.getItem("pendingInvite");
    } catch {}
    router.push(!profile ? "/onboarding" : pending ? "/friends" : "/home");
  }

  return (
    <AppShell theme="theme-auth" nav={false} decorations>
      <section className="flex min-h-[calc(100svh-12rem)] items-center justify-center py-6">
        <form onSubmit={handleSubmit} className="panel-3d w-full max-w-[560px] p-6 sm:p-8">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[.16em]">
                {signup ? "New to ConQuest?" : "Return to your route"}
              </p>
              <h1 className="map-title mt-2 font-display text-4xl leading-tight">
                {signup ? (
                  <>
                    Create your <span className="title-accent">account</span>
                  </>
                ) : (
                  <>
                    Welcome <span className="title-accent">back</span>
                  </>
                )}
              </h1>
              <p className="mt-3 text-base leading-7 text-black">
                {signup
                  ? "Make an account first, then we'll personalize your quests."
                  : "Log in to continue your current quest and see who's nearby."}
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-anchor.png"
              alt="ConQuest anchor logo"
              className="h-12 w-12 shrink-0 rounded-2xl border-2 border-black object-cover shadow-[4px_4px_0_#000]"
            />
          </div>

          <div className="mt-7 grid gap-4">
            <label>
              <FieldLabel>Email</FieldLabel>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </label>
            <label>
              <FieldLabel>Password</FieldLabel>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={signup ? "Create a password (6+ characters)" : "Your password"}
                className={inputClass}
              />
            </label>
            {signup && (
              <label>
                <FieldLabel>Confirm password</FieldLabel>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Type it again"
                  className={inputClass}
                />
              </label>
            )}
          </div>

          <div className="mt-5">
            <ErrorText>{error}</ErrorText>
          </div>

          <PrimaryButton type="submit" disabled={loading} className="mt-6 w-full">
            {loading ? "One sec…" : signup ? "Create account" : "Log in"}
          </PrimaryButton>
          {signup && (
            <p className="mt-4 text-center text-xs leading-5 text-black">
              By continuing, you agree to keep ConQuest safe, kind, and consent-based.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setMode(signup ? "login" : "signup");
              setError("");
            }}
            className="mt-4 w-full text-sm font-bold text-black underline decoration-quest-pink decoration-2 underline-offset-4"
          >
            {signup ? "Already have an account? Log in" : "New here? Create an account"}
          </button>
        </form>
      </section>
    </AppShell>
  );
}
