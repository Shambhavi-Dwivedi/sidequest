"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CHALLENGES, challengeOfTheDay } from "@/lib/challenges";
import { dayString, todayString, weekStart, weeklyPoints, WEEKLY_CAP, DUO_BONUS } from "@/lib/points";
import Countdown from "@/components/Countdown";
import { nextMidnight } from "@/lib/time";


type Profile = { name: string; avatar_url: string | null };
type TodayCheckIn = { status: "pending" | "verified"; points: number; partner_id: string | null; partner_confirmed: boolean };
type ToConfirm = {
  id: string;
  user_id: string;
  challenge_id: string;
  title: string | null;
  emoji: string | null;
  max_points: number | null;
  reflection: string | null;
  photo_url: string | null;
  status: "pending" | "verified";
  points: number;
  name?: string;
};

// Consecutive days with a completed quest (today counts if done, otherwise starts from yesterday)
function computeStreak(dates: string[]) {
  const done = new Set(dates);
  let offset = done.has(dayString(0)) ? 0 : -1;
  let streak = 0;
  while (done.has(dayString(offset))) {
    streak++;
    offset--;
  }
  return streak;
}

export default function HomePage() {
  const router = useRouter();
  const challenge = challengeOfTheDay();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [streak, setStreak] = useState(0);
  const [weekPts, setWeekPts] = useState(0);
  const [today, setToday] = useState<TodayCheckIn | null>(null);
  const [toConfirm, setToConfirm] = useState<ToConfirm[]>([]);
  const [activeMissions, setActiveMissions] = useState(0);

  async function load(uid: string) {
    const { data: done } = await supabase
      .from("check_ins")
      .select("challenge_date")
      .eq("user_id", uid)
      .eq("status", "verified")
      .order("challenge_date", { ascending: false })
      .limit(100);
    setStreak(computeStreak((done ?? []).map((d) => d.challenge_date)));

    setWeekPts(await weeklyPoints(uid));

    const { data: t } = await supabase
      .from("check_ins")
      .select("status, points, partner_id, partner_confirmed")
      .eq("user_id", uid)
      .eq("challenge_date", todayString())
      .eq("challenge_id", challenge.id)
      .maybeSingle();
    setToday(t);

    const { count } = await supabase
      .from("missions")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`created_by.eq.${uid},partner_id.eq.${uid}`);
    setActiveMissions(count ?? 0);

    // Friends who say they did a quest with you
    const { data: asks } = await supabase
      .from("check_ins")
      .select("id, user_id, challenge_id, title, emoji, max_points, reflection, photo_url, status, points")
      .eq("partner_id", uid)
      .eq("partner_confirmed", false)
      .gte("challenge_date", weekStart());
    const list = asks ?? [];
    if (list.length) {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", list.map((a) => a.user_id));
      setToConfirm(list.map((a) => ({ ...a, name: people?.find((p) => p.id === a.user_id)?.name })));
    } else {
      setToConfirm([]);
    }
  }

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");

      const { data } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!data) return router.replace("/onboarding");

      setUserId(auth.user.id);
      setProfile(data);
      await load(auth.user.id);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function confirm(c: ToConfirm) {
    const base = c.max_points ?? CHALLENGES.find((x) => x.id === c.challenge_id)?.points ?? 10;
    // Already AI-verified? Add the duo bonus. Otherwise award the full points plus the bonus.
    const target = c.status === "verified" ? (c.points ?? 0) + DUO_BONUS : base + DUO_BONUS;
    const theirWeek = await weeklyPoints(c.user_id);
    const room = WEEKLY_CAP - (theirWeek - (c.points ?? 0));
    const finalPoints = Math.max(0, Math.min(target, room));

    await supabase
      .from("check_ins")
      .update({ partner_confirmed: true, status: "verified", points: finalPoints })
      .eq("id", c.id);

    // If it was an AI mission, mark it completed
    if (c.challenge_id.startsWith("mission-")) {
      await supabase.from("missions").update({ status: "completed" }).eq("id", c.challenge_id.replace("mission-", ""));
    }

    if (userId) await load(userId);
  }

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

  const pct = Math.min(100, Math.round((weekPts / WEEKLY_CAP) * 100));

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

        {/* Weekly points */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">This week</span>
            <span className="font-semibold">
              {weekPts} / {WEEKLY_CAP} pts {weekPts >= WEEKLY_CAP && "🏆"}
            </span>
          </div>
          <div className="h-3 rounded-full bg-neutral-800 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Friends waiting for you to confirm */}
        {toConfirm.map((c) => {
          const ch = CHALLENGES.find((x) => x.id === c.challenge_id);
          return (
            <div key={c.id} className="rounded-2xl border border-sky-500/40 bg-sky-500/5 p-4 space-y-3">
              <p className="text-sm">
                <span className="font-semibold">{c.name ?? "A friend"}</span> says you did{" "}
                <span className="font-semibold">
                  {c.emoji ?? ch?.emoji} {c.title ?? ch?.title}
                </span>{" "}
                together
              </p>
              {c.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photo_url} alt="Check-in" className="w-full rounded-xl max-h-60 object-cover" />
              )}
              {c.reflection && <p className="text-sm text-neutral-300">“{c.reflection}”</p>}
              <button onClick={() => confirm(c)} className="w-full rounded-xl bg-sky-500 text-black font-semibold py-2">
                Yes, we did it ✓
              </button>
            </div>
          );
        })}

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

          {!today && (
            <Link href="/checkin" className="block w-full rounded-xl bg-emerald-500 text-black font-semibold py-3 text-center">
              Accept challenge
            </Link>
          )}
          {today?.status === "verified" && (
            <p className="text-center text-emerald-400 font-semibold py-2">
              Completed ✓ +{today.points} pts
              {today.partner_id && !today.partner_confirmed && (
                <span className="block text-xs text-neutral-400 font-normal">Duo bonus waiting on your friend</span>
              )}
            </p>
          )}
          {today?.status === "pending" && (
            <p className="text-center text-amber-400 font-semibold py-2">⏳ Waiting for your friend to confirm</p>
          )}
                    <p className="text-center text-xs text-neutral-500">
            ⏱ New challenge in <Countdown to={nextMidnight()} expiredText="any second now" />
          </p>
        </div>

        {/* AI missions */}
        <Link
          href="/missions"
          className="block rounded-2xl border border-purple-500/40 bg-purple-500/10 p-5 hover:border-purple-400 transition"
        >
          <p className="font-semibold">✨ Plan a quest with a friend</p>
          <p className="text-sm text-neutral-400">
            {activeMissions > 0
              ? `${activeMissions} active quest${activeMissions === 1 ? "" : "s"}. Tap to check in.`
              : "AI plans something for the two of you, based on both your vibes."}
          </p>
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/friends" className="rounded-xl border border-neutral-700 font-semibold py-3 text-center">
            👥 My circle
          </Link>
          <Link href="/discover" className="rounded-xl border border-neutral-700 font-semibold py-3 text-center">
            🌍 Discover
          </Link>
        </div>

        <button onClick={logout} className="w-full text-sm text-neutral-500 underline">
          Log out
        </button>
      </div>
    </main>
  );
}
