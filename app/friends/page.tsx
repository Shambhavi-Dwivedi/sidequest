"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { weekStart, WEEKLY_CAP } from "@/lib/points";
import {
  AppShell,
  Avatar,
  ErrorText,
  FieldLabel,
  Icon,
  LoadingScreen,
  PrimaryButton,
  PrimaryLink,
  ScreenHeading,
  inputClass,
  secondaryButtonClass,
} from "@/components/ui";

type Member = { id: string; name: string; avatar_url: string | null; points: number };
type Circle = { id: string; name: string; invite_code: string };

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// Figma: StreaksScreen (circle) + DebriefScreen (weekly standings)
export default function FriendsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [circleName, setCircleName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadCircle(uid: string) {
    const { data: membership } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", uid)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      setCircle(null);
      setMembers([]);
      return;
    }

    const { data: c } = await supabase
      .from("circles")
      .select("id, name, invite_code")
      .eq("id", membership.circle_id)
      .single();
    setCircle(c);

    const { data: rows } = await supabase.from("circle_members").select("user_id").eq("circle_id", membership.circle_id);
    const ids = (rows ?? []).map((r) => r.user_id);

    const { data: people } = await supabase.from("profiles").select("id, name, avatar_url").in("id", ids);

    // Weekly standings: points earned since Monday
    const { data: scores } = await supabase
      .from("check_ins")
      .select("user_id, points")
      .in("user_id", ids)
      .gte("challenge_date", weekStart());
    const totals = new Map<string, number>();
    (scores ?? []).forEach((s) => totals.set(s.user_id, (totals.get(s.user_id) ?? 0) + (s.points ?? 0)));

    setMembers(
      (people ?? [])
        .map((p) => ({ ...p, points: totals.get(p.id) ?? 0 }))
        .sort((a, b) => b.points - a.points)
    );
  }

  async function joinByCode(code: string, uid: string) {
    setError("");
    const { data: c } = await supabase
      .from("circles")
      .select("id")
      .eq("invite_code", code.trim().toUpperCase())
      .maybeSingle();

    if (!c) return setError("No circle found with that code");

    const { error } = await supabase.from("circle_members").insert({ circle_id: c.id, user_id: uid });
    if (error && error.code !== "23505") return setError(error.message); // 23505 = already a member
    await loadCircle(uid);
  }

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");
      const uid = auth.user.id;
      setUserId(uid);

      const { data: profile } = await supabase.from("profiles").select("name, avatar_url").eq("id", uid).maybeSingle();
      if (!profile) return router.replace("/onboarding");
      setName(profile.name);
      setAvatar(profile.avatar_url);

      // If they arrived through an invite link, join that circle automatically
      let pending: string | null = null;
      try {
        pending = localStorage.getItem("pendingInvite");
        localStorage.removeItem("pendingInvite");
      } catch {}
      if (pending) await joinByCode(pending, uid);

      await loadCircle(uid);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function uploadAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (file.size > 5 * 1024 * 1024) return setError("Image must be under 5MB");

    setUploading(true);
    setError("");
    const ext = file.name.split(".").pop() || "png";
    const path = `${userId}/avatar.${ext}`;

    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      setError(error.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`; // forces the new photo to show
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
    setAvatar(url);
    setUploading(false);
    if (circle) await loadCircle(userId);
  }

  async function createCircle() {
    if (!userId) return;
    if (!circleName.trim()) return setError("Give your circle a name");
    setError("");

    const { data: c, error } = await supabase
      .from("circles")
      .insert({ name: circleName.trim(), invite_code: makeCode(), created_by: userId })
      .select("id")
      .single();
    if (error) return setError(error.message);

    await supabase.from("circle_members").insert({ circle_id: c.id, user_id: userId });
    await loadCircle(userId);
  }

  const inviteLink = circle && typeof window !== "undefined" ? `${window.location.origin}/join/${circle.invite_code}` : "";
  const inviteMessage = circle
    ? `Join my ConQuest circle "${circle.name}"! We'll do small real-life quests together. ${inviteLink}`
    : "";

  async function share() {
    // 1. Phone share sheet (works on phones and Safari)
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my ConQuest circle", text: inviteMessage });
        return;
      } catch {
        // share sheet closed or blocked, so fall back to copying
      }
    }
    // 2. Copy to clipboard
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically. Tap the link box and copy it.");
    }
  }

  const emailHref = `mailto:?subject=${encodeURIComponent("Join my ConQuest circle")}&body=${encodeURIComponent(inviteMessage)}`;
  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent("Join my ConQuest circle")}&body=${encodeURIComponent(inviteMessage)}`;

  if (loading) return <LoadingScreen theme="theme-friends" />;

  return (
    <AppShell theme="theme-friends">
      <section className="mx-auto max-w-[1000px]">
        <ScreenHeading
          number="02"
          eyebrow="Your crew"
          title="Streaks and friend circles"
          copy="Make a circle for your crew, invite your IRL friends, and see who's leading this week."
        />

        {/* Profile photo */}
        <div className="panel-3d mt-8 flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative self-start" aria-label="Change photo">
            <Avatar url={avatar} name={name} size={80} />
            <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-black bg-progress">
              <Icon name="camera" className="h-4 w-4" />
            </span>
          </button>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold">{name}</h2>
            <p className="mt-1 text-sm text-black">{avatar ? "Looking good." : "Add a photo so friends recognize you."}</p>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="self-start rounded-full border-2 border-black bg-progress px-5 py-3 text-xs font-bold shadow-[3px_3px_0_#000] sm:self-auto"
          >
            {uploading ? "Uploading…" : avatar ? "Change photo" : "Add a photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
        </div>

        {circle ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
            {/* Circle + invites */}
            <div className="rounded-[36px] border-2 border-black bg-community p-6 text-white shadow-[4px_4px_0_#000] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-[.16em] text-white">Your circle</p>
                  <p className="raised-type-light font-display mt-2 text-3xl text-white">{circle.name}</p>
                </div>
                <span className="rounded-full border-2 border-black bg-progress px-3 py-2 text-xs font-bold text-black">
                  {members.length} member{members.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-4">
                {members.map((m) => (
                  <div key={m.id} className="flex w-16 flex-col items-center gap-1.5">
                    <Avatar url={m.avatar_url} name={m.name} size={52} />
                    <span className="w-full truncate text-center text-xs font-bold text-white">{m.name}</span>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-sm leading-6 text-white">Invite friends with this code:</p>
              <div className="mt-2 flex items-center justify-between rounded-2xl border-2 border-black bg-progress px-4 py-3 text-black shadow-[3px_3px_0_#000]">
                <span className="font-mono text-2xl font-bold tracking-[.2em]">{circle.invite_code}</span>
                <Icon name="people" className="h-5 w-5" />
              </div>

              <input
                readOnly
                value={inviteLink}
                onFocus={(e) => e.target.select()}
                aria-label="Invite link"
                className="mt-4 w-full rounded-xl border-2 border-black bg-white px-4 py-3 font-mono text-xs text-black"
              />

              <div className="mt-4 grid gap-3">
                <PrimaryButton onClick={share} arrow={false} className="w-full">
                  <Icon name={copied ? "check" : "copy"} className="h-4 w-4" />
                  {copied ? "Link copied!" : "Share invite link"}
                </PrimaryButton>
                <div className="grid grid-cols-2 gap-3">
                  <a href={gmailHref} target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
                    <Icon name="mail" className="h-4 w-4" />
                    Gmail
                  </a>
                  <a href={emailHref} className={secondaryButtonClass}>
                    <Icon name="mail" className="h-4 w-4" />
                    Mail app
                  </a>
                </div>
              </div>
            </div>

            {/* Weekly standings */}
            <aside className="panel-3d p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[.18em] text-black">Weekly standings</p>
                  <h3 className="font-display mt-1 text-2xl font-bold">{circle.name}</h3>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-black bg-community text-white">
                  <Icon name="shield" className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-6 space-y-1">
                {members.map((m, i) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-4 rounded-2xl border-2 px-4 py-3 ${
                      m.id === userId ? "border-black bg-progress shadow-[3px_3px_0_#000]" : "border-transparent bg-white"
                    }`}
                  >
                    <span className="font-mono text-xs text-black">{String(i + 1).padStart(2, "0")}</span>
                    <Avatar url={m.avatar_url} name={m.name} size={32} />
                    <span className="flex-1 truncate text-sm font-bold">
                      {m.name}
                      {i === 0 && m.points > 0 && " 👑"}
                    </span>
                    <span className="font-mono text-xs text-black">{m.points} pts</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border-2 border-black bg-success p-4">
                <p className="text-xs font-bold uppercase tracking-[.14em] text-black">Circle reward</p>
                <p className="mt-2 text-xs leading-5 text-black">
                  Whoever leads on Sunday night picks next week&apos;s group hangout. Everyone can earn up to {WEEKLY_CAP} points a week.
                </p>
              </div>
            </aside>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="panel-3d rounded-[36px] p-6">
              <p className="font-mono text-xs font-bold uppercase tracking-[.16em]">Make a friend circle</p>
              <p className="raised-type font-display mt-2 text-2xl">Quest together</p>
              <p className="mt-2 text-sm leading-6 text-black">Name your circle, then share the invite code with your friends.</p>
              <label className="mt-5 block">
                <FieldLabel>Circle name</FieldLabel>
                <input
                  value={circleName}
                  onChange={(e) => setCircleName(e.target.value)}
                  placeholder="e.g. Weekend Wanderers"
                  className={inputClass}
                />
              </label>
              <button type="button" onClick={createCircle} className="quest-button mt-4 w-full px-5 py-3 text-sm font-bold">
                Create circle
              </button>
            </div>

            <div className="panel-3d rounded-[36px] p-6">
              <div className="flex items-center gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-black bg-discovery">
                  <Icon name="code" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.12em]">Have a circle code?</p>
                  <p className="mt-1 text-xs text-black">Ask a friend to share their six-character code.</p>
                </div>
              </div>
              <input
                aria-label="Circle code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="HXJR5C"
                className="mt-5 w-full rounded-xl border-2 border-black bg-white px-4 py-3 font-mono text-sm uppercase tracking-[.18em] text-black outline-none focus:shadow-[4px_4px_0_#2A9DBB]"
              />
              <button type="button" onClick={() => userId && joinByCode(joinCode, userId)} className={`${secondaryButtonClass} mt-4 w-full`}>
                Join circle
              </button>
            </div>
          </div>
        )}

        <div className="mt-6">
          <ErrorText>{error}</ErrorText>
        </div>

        <Link
          href="/discover"
          className="mt-6 flex items-center gap-4 rounded-[28px] border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000] transition"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-black bg-discovery">
            <Icon name="pin" className="h-6 w-6" />
          </span>
          <span className="flex-1">
            <span className="block font-display text-lg font-bold">Discover ConQuesters</span>
            <span className="block text-sm text-black">Meet people who share your interests, near you or anywhere.</span>
          </span>
          <Icon name="chevron" className="h-5 w-5" />
        </Link>

        <div className="mt-7 flex justify-end">
          <PrimaryLink href="/home">{circle ? "Show my quest" : "Skip for now"}</PrimaryLink>
        </div>
      </section>
    </AppShell>
  );
}
