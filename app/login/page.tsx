"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setError(error?.message ?? "Something went wrong");
      setLoading(false);
      return;
    }

    // Does this person already have a profile?
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle();

        let pending: string | null = null;
    try {
      pending = localStorage.getItem("pendingInvite");
    } catch {}
    router.push(!profile ? "/onboarding" : pending ? "/friends" : "/home");
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-bold mb-2">SideQuest</h1>
        <p className="text-neutral-400 mb-8">
          Turn "we should hang out" into something you actually do.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 outline-none focus:border-emerald-500"
          />
          <input
            type="password"
            placeholder="Password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 outline-none focus:border-emerald-500"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 text-black font-semibold py-3 disabled:opacity-50"
          >
            {loading ? "One sec…" : mode === "signup" ? "Create account" : "Log in"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          className="mt-6 text-sm text-neutral-400 underline w-full text-center"
        >
          {mode === "signup"
            ? "Already have an account? Log in"
            : "New here? Create an account"}
        </button>
      </div>
    </main>
  );
}