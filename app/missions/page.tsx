"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MISSION_HOURS, isExpired } from "@/lib/time";
import Countdown from "@/components/Countdown";
import {
  AccentTitle,
  AppShell,
  Avatar,
  ErrorText,
  Icon,
  LoadingScreen,
  PrimaryButton,
  PrimaryLink,
  ScreenHeading,
} from "@/components/ui";

type Friend = { id: string; name: string; avatar_url: string | null };
type Mission = {
  id: string;
  created_by: string;
  partner_id: string;
  emoji: string | null;
  title: string;
  description: string;
  reason: string | null;
  difficulty: number | null;
  points: number | null;
  proof: "photo" | "partner";
  status: string;
  due_at: string | null;
};

const LEVELS = ["", "Easy", "Medium", "Hard"];

// Figma: ModeScreen ("Choose your route") + MissionScreen's "Why this quest"
export default function MissionsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [suggestions, setSuggestions] = useState<Mission[]>([]);
  const [active, setActive] = useState<Mission[]>([]);
  const [usedFallback, setUsedFallback] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadActive(uid: string) {
    const { data } = await supabase
      .from("missions")
      .select("*")
      .eq("status", "accepted")
      .or(`created_by.eq.${uid},partner_id.eq.${uid}`)
      .order("created_at", { ascending: false });
    setActive(data ?? []);
  }

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");
      const uid = auth.user.id;
      setUserId(uid);

      // Friends = your circle members + accepted friend requests
      const ids = new Set<string>();
      const { data: membership } = await supabase
        .from("circle_members")
        .select("circle_id")
        .eq("user_id", uid)
        .limit(1)
        .maybeSingle();
      if (membership) {
        const { data: rows } = await supabase.from("circle_members").select("user_id").eq("circle_id", membership.circle_id);
        (rows ?? []).forEach((r) => ids.add(r.user_id));
      }
      const { data: fs } = await supabase
        .from("friendships")
        .select("requester, addressee")
        .eq("status", "accepted")
        .or(`requester.eq.${uid},addressee.eq.${uid}`);
      (fs ?? []).forEach((f) => ids.add(f.requester === uid ? f.addressee : f.requester));
      ids.delete(uid);

      if (ids.size) {
        const { data: people } = await supabase.from("profiles").select("id, name, avatar_url").in("id", [...ids]);
        setFriends(people ?? []);
      }

      await loadActive(uid);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function generate() {
    if (!partnerId) return setError("Pick a friend first");
    setError("");
    setGenerating(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't plan missions");
      setSuggestions(data.missions ?? []);
      setUsedFallback(data.source === "fallback");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  async function accept(m: Mission) {
    if (!userId) return;
    const now = Date.now();
    await supabase
      .from("missions")
      .update({
        status: "accepted",
        accepted_at: new Date(now).toISOString(),
        due_at: new Date(now + MISSION_HOURS * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", m.id);
    // Clear the suggestions they didn't pick
    await supabase.from("missions").delete().eq("created_by", userId).eq("partner_id", m.partner_id).eq("status", "suggested");
    setSuggestions([]);
    await loadActive(userId);
  }

  const nameOf = (id: string) => friends.find((f) => f.id === id)?.name ?? "your friend";
  const partnerOf = (m: Mission) => (m.created_by === userId ? m.partner_id : m.created_by);

  if (loading) return <LoadingScreen theme="theme-route" />;

  return (
    <AppShell theme="theme-route">
      <section className="mx-auto max-w-[1120px]">
        <ScreenHeading
          number="AI"
          eyebrow="Plan together"
          title="Choose your route"
          copy="Pick a friend. ConQuest reads both your interests, comfort levels, and what you each wrote after your last quest, then plans something for the two of you."
        />

        {/* Pick a friend */}
        {friends.length === 0 ? (
          <div className="panel-3d mt-8 p-6">
            <p className="font-display text-xl">You need a friend to plan a quest with.</p>
            <p className="mt-2 text-sm">Invite someone to your circle, or add a friend from the map.</p>
            <PrimaryLink href="/friends" className="mt-5">
              Invite friends
            </PrimaryLink>
          </div>
        ) : (
          <div className="panel-3d mt-8 p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
              <div>
                <p className="font-sans text-lg font-extrabold">Who are you questing with?</p>
                <p className="mt-1 text-sm leading-6 text-black">Friends from your circle and the map show up here.</p>
              </div>
              <div className="quest-scroll flex gap-3 overflow-x-auto pb-2">
                {friends.map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => setPartnerId(f.id)}
                    className={`flex min-w-24 flex-col items-center gap-2 rounded-[22px] border-2 border-black px-4 py-3 transition ${
                      partnerId === f.id ? "translate-y-[-2px] bg-community text-white shadow-[3px_4px_0_#000]" : "bg-white text-black"
                    }`}
                  >
                    <Avatar url={f.avatar_url} name={f.name} />
                    <span className="text-xs font-extrabold">{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <PrimaryButton onClick={generate} disabled={generating || !partnerId}>
                {generating ? "Reading both your vibes…" : "Plan our next quest"}
              </PrimaryButton>
            </div>
          </div>
        )}

        <div className="mt-6">
          <ErrorText>{error}</ErrorText>
        </div>

        {/* AI suggestions */}
        {suggestions.length > 0 && (
          <div className="mt-8">
            <p className="font-mono text-xs font-bold uppercase tracking-[.16em]">
              Picked for you and {nameOf(partnerId)}
              {usedFallback && " · AI was busy, so these are ConQuest favorites"}
            </p>
            <div className="mt-4 grid gap-6 md:grid-cols-3">
              {suggestions.map((m) => (
                <div key={m.id} className="flex flex-col rounded-[28px] border-2 border-black bg-white p-6 text-left shadow-[4px_4px_0_#000]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-black bg-quest-purple text-2xl">
                      {m.emoji ?? "✨"}
                    </span>
                    <span className="rounded-full border-2 border-black bg-progress px-3 py-1.5 font-mono text-xs font-bold uppercase">
                      +{m.points} pts
                    </span>
                  </div>
                  <p className="raised-type mt-5 font-display text-2xl">
                    <AccentTitle text={m.title} />
                  </p>
                  <p className="mt-3 text-sm leading-6 text-black">{m.description}</p>
                  {m.reason && (
                    <div className="mt-4 rounded-2xl border-2 border-black bg-map-paper p-3">
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em]">
                        <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-black bg-progress">
                          <Icon name="spark" className="h-3 w-3" />
                        </span>
                        Why this quest
                      </p>
                      <p className="mt-2 text-sm leading-6">{m.reason}</p>
                    </div>
                  )}
                  <p className="mt-auto pt-5 font-mono text-xs uppercase tracking-[.12em]">
                    {LEVELS[m.difficulty ?? 1] || "Easy"} · {m.proof === "photo" ? "AI photo check" : "Friend confirms"}
                  </p>
                  <button type="button" onClick={() => accept(m)} className="quest-button mt-4 w-full px-5 py-3 text-sm font-bold">
                    We&apos;re in
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accepted missions */}
        {active.length > 0 && (
          <div className="panel-3d mt-8 p-6 sm:p-8">
            <p className="font-mono text-xs font-bold uppercase tracking-[.16em]">Active quests</p>
            <p className="raised-type font-display mt-1 text-2xl">Keep each other moving</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {active.map((m) => {
                const expired = isExpired(m.due_at);
                return (
                  <div key={m.id} className="flex flex-col gap-3 rounded-[30px] border-2 border-black bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold">With {nameOf(partnerOf(m))} · +{m.points} pts</span>
                      {m.due_at && (
                        <span
                          className={`flex items-center gap-1.5 rounded-full border-2 border-black px-3 py-1 text-xs font-bold ${
                            expired ? "bg-action text-white" : "bg-progress"
                          }`}
                        >
                          <Icon name="clock" className="h-3.5 w-3.5" />
                          <Countdown to={m.due_at} expiredText="time's up" />
                        </span>
                      )}
                    </div>
                    <p className="font-display text-xl">
                      {m.emoji} {m.title}
                    </p>
                    <p className="text-sm leading-6">{m.description}</p>
                    {expired ? (
                      <p className="mt-auto text-sm font-bold">Time&apos;s up on this one. Plan a new quest above.</p>
                    ) : (
                      <PrimaryLink href={`/checkin?m=${m.id}`} className="mt-auto w-full">
                        Check in
                      </PrimaryLink>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
