"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CHALLENGES, challengeOfTheDay } from "@/lib/challenges";
import { dayString, todayString, weekStart, weeklyPoints, WEEKLY_CAP, DUO_BONUS } from "@/lib/points";
import { nextMidnight } from "@/lib/time";
import Countdown from "@/components/Countdown";
import {
  AccentTitle,
  AppShell,
  Avatar,
  Icon,
  LoadingScreen,
  PrimaryButton,
  PrimaryLink,
  ScreenHeading,
  type IconName,
} from "@/components/ui";

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

function MissionStat({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 text-xs font-semibold text-black shadow-[2px_2px_0_#000]">
      <Icon name={icon} className="h-4 w-4 text-challenge" />
      {children}
    </span>
  );
}

// Figma: MissionScreen ("Your next ConQuest")
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

      const { data } = await supabase.from("profiles").select("name, avatar_url").eq("id", auth.user.id).maybeSingle();
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

    await supabase.from("check_ins").update({ partner_confirmed: true, status: "verified", points: finalPoints }).eq("id", c.id);

    // If it was an AI mission, mark it completed
    if (c.challenge_id.startsWith("mission-")) {
      await supabase.from("missions").update({ status: "completed" }).eq("id", c.challenge_id.replace("mission-", ""));
    }

    if (userId) await load(userId);
  }

  if (!profile) return <LoadingScreen />;

  const pct = Math.min(100, Math.round((weekPts / WEEKLY_CAP) * 100));
  const steps: [string, string, string][] =
    challenge.proof === "photo"
      ? [
          ["01", "Pick a spot", "Somewhere relaxed and easy to leave."],
          ["02", "Do the quest", challenge.type === "solo" ? "Go at your own pace." : "Bring a friend along."],
          ["03", "Snap proof", "Places and things only. AI checks it."],
        ]
      : [
          ["01", "Pick a moment", "Fit it into your normal day."],
          ["02", "Do the quest", "Keep it genuine and kind."],
          ["03", "Get vouched", "A friend confirms you did it."],
        ];

  return (
    <AppShell theme="theme-home">
      <section className="mx-auto max-w-[1140px]">
        {/* Greeting, streak, weekly points */}
        <div className="panel-3d mb-8 flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-4">
            <Avatar url={profile.avatar_url} name={profile.name} size={56} />
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[.16em]">Welcome back</p>
              <p className="font-display text-2xl">Hi, {profile.name}</p>
            </div>
          </div>
          <span className="flex items-center gap-2 self-start rounded-full border-2 border-black bg-progress px-4 py-2 text-sm font-extrabold shadow-[3px_3px_0_#000] sm:self-auto">
            <Icon name="flame" className="h-5 w-5 text-action" />
            {streak} day streak
          </span>
          <div className="min-w-[200px] sm:w-56">
            <div className="flex justify-between font-mono text-xs font-bold uppercase tracking-[.1em]">
              <span>This week</span>
              <span>
                {weekPts}/{WEEKLY_CAP} {weekPts >= WEEKLY_CAP && "🏆"}
              </span>
            </div>
            <div className="mt-2 h-3 rounded-full border-2 border-black bg-white">
              <div className="h-full rounded-full bg-discovery transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Friends waiting for you to confirm */}
        {toConfirm.map((c) => {
          const ch = CHALLENGES.find((x) => x.id === c.challenge_id);
          return (
            <article key={c.id} className="mb-6 grid overflow-hidden border-2 border-black bg-white shadow-[4px_4px_0_#000] sm:grid-cols-[.8fr_1.2fr]">
              {c.photo_url ? (
                <div className="relative min-h-[200px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.photo_url} alt="Friend's check-in" className="absolute inset-0 h-full w-full object-cover" />
                </div>
              ) : (
                <div className="grid min-h-[140px] place-items-center bg-discovery">
                  <Icon name="people" className="h-12 w-12" />
                </div>
              )}
              <div className="flex flex-col p-5">
                <p className="font-mono text-xs font-bold uppercase tracking-[.16em]">Vouch for your friend</p>
                <p className="mt-2 text-sm leading-6">
                  <span className="font-bold">{c.name ?? "A friend"}</span> says you did{" "}
                  <span className="font-bold">
                    {c.emoji ?? ch?.emoji} {c.title ?? ch?.title}
                  </span>{" "}
                  together.
                </p>
                {c.reflection && <p className="mt-3 text-sm leading-6">“{c.reflection}”</p>}
                <PrimaryButton onClick={() => confirm(c)} className="mt-auto w-full" arrow={false}>
                  <Icon name="check" className="h-4 w-4" />
                  Yes, we did it
                </PrimaryButton>
              </div>
            </article>
          );
        })}

        <div className="mb-7 flex items-end justify-between">
          <ScreenHeading
            number="03"
            eyebrow={`Today's route · ${challenge.type}`}
            title="Your next ConQuest"
            copy="One new challenge a day, the same for your whole circle."
          />
          <div className="hidden items-center gap-3 rounded-full border-2 border-black bg-success px-4 py-3 text-black shadow-[3px_3px_0_#000] md:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-quest-pink" />
            <span className="text-xs font-bold uppercase tracking-[.16em]">
              New in <Countdown to={nextMidnight()} expiredText="any second" />
            </span>
          </div>
        </div>

           <div className="panel-3d grid overflow-hidden lg:grid-cols-[1.2fr_.8fr]">
          {/* Today's challenge */}
          <div className="relative overflow-hidden border-b-2 border-black p-6 sm:p-9 lg:border-b-0 lg:border-r-2">
            <div className="mb-8 flex flex-wrap items-center gap-3">
              <span className="whitespace-nowrap rounded-full border-2 border-black bg-progress px-3 py-2 font-mono text-xs font-bold uppercase tracking-[.12em] text-black">
                {challenge.type} quest
              </span>
              <span className="whitespace-nowrap rounded-full border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase tracking-[.12em] text-black shadow-[2px_2px_0_#000]">
                {challenge.emoji} Quest # {challenge.id.toUpperCase()}
              </span>
            </div>
            <p className="font-mono text-xs uppercase tracking-[.2em] text-black">Today&apos;s challenge</p>
            <h2 className="display-title font-display mt-3 max-w-[670px] text-[clamp(2.2rem,11vw,3rem)] sm:text-[clamp(2.6rem,6vw,4.5rem)]">
              <AccentTitle text={challenge.title} />
            </h2>
            <p className="mt-6 max-w-[600px] text-base leading-7 text-black">{challenge.description}</p>

            <div className="mt-8">
              <p className="font-mono text-xs font-bold uppercase tracking-[.16em] text-black">How to complete this quest</p>
              <div className="quest-scroll mt-3 flex snap-x gap-3 overflow-x-auto pb-3 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
                {steps.map(([step, title, copy], index) => (
                  <div
                    key={step}
                    className={`w-[70vw] max-w-[260px] shrink-0 snap-start rounded-[28px] border-2 border-black p-4 sm:w-auto sm:max-w-none ${
                      index === 0 ? "bg-discovery" : index === 1 ? "bg-progress" : "bg-success"
                    }`}
                  >
                    <span className="font-mono text-xs font-bold">{step}</span>
                    <p className="mt-2 text-sm font-bold">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-black">{copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <MissionStat icon="clock">
                Ends in <Countdown to={nextMidnight()} expiredText="any second" />
              </MissionStat>
              <MissionStat icon="bolt">+{challenge.points} points</MissionStat>
              <MissionStat icon={challenge.proof === "photo" ? "camera" : "people"}>
                {challenge.proof === "photo" ? "AI photo check" : "Friend confirms"}
              </MissionStat>
            </div>

            <div className="mt-10">
              {!today && <PrimaryLink href="/checkin">Accept challenge</PrimaryLink>}
              {today?.status === "verified" && (
                <div className="inline-flex flex-col rounded-[22px] border-2 border-black bg-success px-5 py-3">
                  <span className="flex items-center gap-2 font-display text-lg">
                    <Icon name="check" className="h-5 w-5" />
                    Completed · +{today.points} pts
                  </span>
                  {today.partner_id && !today.partner_confirmed && (
                    <span className="text-xs font-bold">Duo bonus waiting on your friend</span>
                  )}
                </div>
              )}
              {today?.status === "pending" && (
                <div className="inline-flex items-center gap-2 rounded-[22px] border-2 border-black bg-progress px-5 py-3 font-bold">
                  <Icon name="clock" className="h-5 w-5" />
                  Waiting for your friend to confirm
                </div>
              )}
            </div>
          </div>

          {/* Side: plan with a friend */}
          <aside className="bg-quest-blue p-6 sm:p-8">
            <p className="font-mono text-xs uppercase tracking-[.18em] text-black">Quest partner</p>
            <div className="mt-5 flex items-center gap-4 border-b-2 border-black pb-6">
              <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-black bg-community font-display text-lg text-white shadow-[3px_3px_0_#000]">
                AI
              </span>
              <div>
                <p className="font-display text-xl font-bold">ConQuest guide</p>
                <p className="mt-1 text-xs text-black">Plans quests for you and a friend</p>
              </div>
              <span className="ml-auto h-2.5 w-2.5 animate-pulse rounded-full bg-black" />
            </div>

            <Link
              href="/missions"
              className="mt-6 block rounded-2xl border-2 border-black bg-white p-4 shadow-[4px_4px_0_#000] transition"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-black">
                  <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-black bg-progress">
                    <Icon name="spark" className="h-3.5 w-3.5" />
                  </span>
                  Plan a quest together
                </p>
                <Icon name="chevron" className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm leading-6 text-black">
                {activeMissions > 0
                  ? `${activeMissions} active quest${activeMissions === 1 ? "" : "s"} waiting. Tap to check in.`
                  : "AI reads both your interests and reflections, then plans something for the two of you."}
              </p>
            </Link>

            <div className="mt-5 rounded-2xl border-2 border-black bg-white p-4 shadow-[4px_4px_0_#000]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[.15em] text-black">Why this quest</p>
                <span className="rounded-full border-2 border-black bg-success px-2 py-1 font-mono text-xs font-bold uppercase tracking-[.1em]">
                  Daily
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-black">
                Everyone in your circle gets the same challenge today, so it&apos;s easy to do it together. Do it with a friend for +{DUO_BONUS} bonus points.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </AppShell>
  );
}
