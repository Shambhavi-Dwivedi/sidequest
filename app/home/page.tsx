"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { challengeOfTheDay } from "@/lib/challenges";

type Profile = {
  name: string;
  interests: string[];
  avatar_url: string | null;
  streak_count: number | null;
  last_active: string | null;
};

function dayString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
}

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [streak, setStreak] = useState(0);
  const challenge = challengeOfTheDay();

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");

      const { data } = await supabase
        .from("profiles")
        .select("name, interests, avatar_url, streak_count, last_active")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!data) return router.replace("/onboarding");

      // Streak: +1 if they were here yesterday, reset to 1 if they missed a day
      const today = dayString(0);
      const yesterday = dayString(-1);
      let s = data.streak_count ?? 0;
      if (data.last_active !== today) {
        s = data.last_active === yesterday ? s + 1 : 1;
        await supabase
          .from("profiles")
          .update({ streak_count: s, last_active: today })
          .eq("id", auth.user.id);
      }

      setStreak(s);
      setProfile(data);
    }
    load();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <p className="text-neutral-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white px-6 py-10">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.name} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className="text-2xl font-bold">Hi, {profile.name}</h1>
          </div>

          <div className="flex items-center gap-1 rounded-full bg-orange-500/15 border border-orange-500/40 px-3 py-1">
            <span className="text-lg">🔥</span>
            <span className="font-bold text-orange-400">{streak}</span>
          </div>
        </div>

        {/* Challenge of the day */}
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5 space-y-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide">
            <span className="text-emerald-400 font-semibold">Challenge of the day</span>
            <span className="text-neutral-400">
              {challenge.type} · +{challenge.points} pts
            </span>
          </div>
          <h2 className="text-2xl font-bold">
            {challenge.emoji} {challenge.title}
          </h2>
          <p className="text-neutral-300">{challenge.description}</p>
          <button className="w-full rounded-xl bg-emerald-500 text-black font-semibold py-3">
            Accept challenge
          </button>
        </div>

        <Link
          href="/friends"
          className="block w-full rounded-xl border border-neutral-700 font-semibold py-3 text-center"
        >
          👥 My circle & invites
        </Link>

        <button onClick={logout} className="w-full text-sm text-neutral-500 underline">
          Log out
        </button>
      </div>
    </main>
  );
}