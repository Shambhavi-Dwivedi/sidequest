"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Countdown from "@/components/Countdown";
import { MISSION_HOURS, isExpired } from "@/lib/time";


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

function Avatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover" />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

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
        const { data: rows } = await supabase
          .from("circle_members")
          .select("user_id")
          .eq("circle_id", membership.circle_id);
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
        const { data: people } = await supabase
          .from("profiles")
          .select("id, name, avatar_url")
          .in("id", [...ids]);
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
    await supabase
      .from("missions")
      .delete()
      .eq("created_by", userId)
      .eq("partner_id", m.partner_id)
      .eq("status", "suggested");
    setSuggestions([]);
    await loadActive(userId);
  }

  const nameOf = (id: string) => friends.find((f) => f.id === id)?.name ?? "your friend";
  const partnerOf = (m: Mission) => (m.created_by === userId ? m.partner_id : m.created_by);
  const dots = (d: number | null) => "●".repeat(d ?? 1) + "○".repeat(3 - (d ?? 1));

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <p className="text-neutral-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white px-6 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Plan a quest</h1>
          <Link href="/home" className="text-sm text-neutral-400 underline">
            Home
          </Link>
        </div>
        <p className="text-neutral-400 -mt-4">
          SideQuest reads both your interests and reflections, then plans something for the two of you.
        </p>

        {/* Pick a friend */}
        {friends.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-3">
            <p>You need a friend to plan a quest with.</p>
            <Link href="/friends" className="block text-center rounded-xl bg-emerald-500 text-black font-semibold py-3">
              Invite friends
            </Link>
          </div>
        ) : (
          <section className="space-y-3">
            <h2 className="font-semibold">Who are you questing with?</h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {friends.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPartnerId(f.id)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border px-3 py-3 min-w-20 ${
                    partnerId === f.id ? "border-emerald-500 bg-emerald-500/10" : "border-neutral-800 bg-neutral-900"
                  }`}
                >
                  <Avatar url={f.avatar_url} name={f.name} />
                  <span className="text-xs">{f.name}</span>
                </button>
              ))}
            </div>

            <button
              onClick={generate}
              disabled={generating || !partnerId}
              className="w-full rounded-xl bg-emerald-500 text-black font-semibold py-3 disabled:opacity-50"
            >
              {generating ? "Reading both your vibes… ✨" : "✨ Plan our next quest"}
            </button>
          </section>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* AI suggestions */}
        {suggestions.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold">
              Picked for you and {nameOf(partnerId)}
              {usedFallback && <span className="block text-xs text-neutral-500 font-normal">(AI was busy, so these are SideQuest favorites)</span>}
            </h2>
            {suggestions.map((m) => (
              <div key={m.id} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>
                    {dots(m.difficulty)} · +{m.points} pts
                  </span>
                  <span>{m.proof === "photo" ? "🤖 photo proof" : "🤝 friend confirms"}</span>
                </div>
                <h3 className="text-xl font-bold">
                  {m.emoji} {m.title}
                </h3>
                <p className="text-neutral-300 text-sm">{m.description}</p>
                {m.reason && (
                  <p className="text-sm rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 p-3">
                    💡 {m.reason}
                  </p>
                )}
                <button onClick={() => accept(m)} className="w-full rounded-xl bg-emerald-500 text-black font-semibold py-2">
                  We&apos;re in
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Accepted missions */}
        {active.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold">Your active quests</h2>
            {active.map((m) => (
              <div key={m.id} className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-2">
                                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">With {nameOf(partnerOf(m))} · +{m.points} pts</span>
                  {m.due_at && (
                    <span className={isExpired(m.due_at) ? "text-red-400" : "text-amber-300"}>
                      ⏱ <Countdown to={m.due_at} expiredText="time's up" />
                    </span>
                  )}
                </div>
                <h3 className="font-bold">
                  {m.emoji} {m.title}
                </h3>
                <p className="text-sm text-neutral-300">{m.description}</p>
                <Link
                  href={`/checkin?m=${m.id}`}
                  className="block text-center rounded-xl bg-emerald-500 text-black font-semibold py-2"
                >
                  Check in →
                </Link>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}