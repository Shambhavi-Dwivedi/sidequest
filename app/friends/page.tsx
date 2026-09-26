"use client";

import { useEffect, useRef, useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";


type Member = { id: string; name: string; avatar_url: string | null };
type Circle = { id: string; name: string; invite_code: string };

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function Avatar({ url, name, size = 48 }: { url: string | null; name: string; size?: number }) {
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

    const { data: rows } = await supabase
      .from("circle_members")
      .select("user_id")
      .eq("circle_id", membership.circle_id);
    const ids = (rows ?? []).map((r) => r.user_id);

    const { data: people } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .in("id", ids);
    setMembers(people ?? []);
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", uid)
        .maybeSingle();
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

  const inviteLink = circle && typeof window !== "undefined"
    ? `${window.location.origin}/join/${circle.invite_code}`
    : "";

  const inviteMessage = circle
    ? `Join my SideQuest circle "${circle.name}"! We'll do small real-life challenges together. ${inviteLink}`
    : "";

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my SideQuest circle", text: inviteMessage });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const emailHref = `mailto:?subject=${encodeURIComponent("Join my SideQuest circle")}&body=${encodeURIComponent(inviteMessage)}`;

  const input =
    "w-full rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 outline-none focus:border-emerald-500";

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <p className="text-neutral-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white px-6 py-10">
      <div className="max-w-md mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Find your people</h1>
          <p className="text-neutral-400 mt-1">SideQuest is better with friends.</p>
        </div>

        {/* Profile picture */}
        <section className="flex items-center gap-4">
          <button onClick={() => fileRef.current?.click()} className="relative">
            <Avatar url={avatar} name={name} size={80} />
            <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-black text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center">
              +
            </span>
          </button>
          <div>
            <p className="font-semibold">{name}</p>
            <button onClick={() => fileRef.current?.click()} className="text-sm text-emerald-400">
              {uploading ? "Uploading…" : avatar ? "Change photo" : "Add a profile photo"}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
        </section>

        {/* Circle */}
        {circle ? (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{circle.name}</h2>
              <span className="text-xs text-neutral-400">{members.length} member{members.length === 1 ? "" : "s"}</span>
            </div>

            <div className="flex flex-wrap gap-3">
              {members.map((m) => (
                <div key={m.id} className="flex flex-col items-center gap-1 w-14">
                  <Avatar url={m.avatar_url} name={m.name} />
                  <span className="text-xs text-neutral-300 truncate w-full text-center">{m.name}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-3">
              <p className="text-xs text-neutral-500">Invite code</p>
              <p className="text-2xl font-mono font-bold tracking-widest">{circle.invite_code}</p>
            </div>

            <div className="flex gap-2">
              <button onClick={share} className="flex-1 rounded-xl bg-emerald-500 text-black font-semibold py-3">
                {copied ? "Link copied!" : "Share invite link"}
              </button>
              <a href={emailHref} className="flex-1 rounded-xl bg-neutral-800 font-semibold py-3 text-center">
                Email invite
              </a>
            </div>
          </section>
        ) : (
          <section className="space-y-6">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-3">
              <h2 className="font-semibold">Start a circle</h2>
              <input
                value={circleName}
                onChange={(e) => setCircleName(e.target.value)}
                placeholder="e.g. Roommates, Soccer crew"
                className={input}
              />
              <button onClick={createCircle} className="w-full rounded-xl bg-emerald-500 text-black font-semibold py-3">
                Create circle
              </button>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-3">
              <h2 className="font-semibold">Have an invite code?</h2>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="ABC123"
                className={`${input} uppercase tracking-widest`}
              />
              <button
                onClick={() => userId && joinByCode(joinCode, userId)}
                className="w-full rounded-xl bg-neutral-800 font-semibold py-3"
              >
                Join circle
              </button>
            </div>
          </section>
        )}

                <   
                    Link
          href="/discover"
          className="block rounded-2xl border border-neutral-800 bg-neutral-900 p-5 hover:border-emerald-500 transition"
        >
          <p className="font-semibold">🌍 Discover SideQuesters</p>
          <p className="text-sm text-neutral-400">Meet people who share your interests, near you or anywhere.</p>
        </Link>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={() => router.push("/home")}
          className="w-full rounded-xl border border-neutral-700 font-semibold py-3"
        >
          {circle ? "Continue →" : "Skip for now →"}
        </button>
      </div>
    </main>
  );
}
