"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CHALLENGES, challengeOfTheDay, type Challenge } from "@/lib/challenges";
import { todayString, weeklyPoints, WEEKLY_CAP, DUO_BONUS } from "@/lib/points";
import { nextMidnight } from "@/lib/time";
import Countdown from "@/components/Countdown";
import {
  AccentTitle,
  AppShell,
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

type Friend = { id: string; name: string };
type Verdict = { verified: boolean; feedback: string; hasFaces: boolean };
type Step = "loading" | "form" | "checking" | "retry" | "done";

// Figma: DebriefScreen ("Share the adventure")
export default function CheckInPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [challenge, setChallenge] = useState<Challenge>(challengeOfTheDay());
  const [missionId, setMissionId] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [circleId, setCircleId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reflection, setReflection] = useState("");
  const [step, setStep] = useState<Step>("loading");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [earned, setEarned] = useState(0);
  const [capped, setCapped] = useState(false);
  const [verifiedNow, setVerifiedNow] = useState(false);
  const [alreadyToday, setAlreadyToday] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");
      const uid = auth.user.id;
      setUserId(uid);

      // Which quest? ?m=<mission id> for AI missions, ?c=<challenge id> for testing, otherwise today's challenge
      const params = new URLSearchParams(window.location.search);
      let current: Challenge = challengeOfTheDay();
      let missionPartner: string | null = null;

      const mId = params.get("m");
      const cId = params.get("c");
      if (mId) {
        const { data: m } = await supabase
          .from("missions")
          .select("id, created_by, partner_id, emoji, title, description, points, proof, ai_check, due_at")
          .eq("id", mId)
          .maybeSingle();
        if (m) {
          current = {
            id: `mission-${m.id}`,
            emoji: m.emoji ?? "✨",
            title: m.title,
            description: m.description,
            type: "duo",
            points: m.points ?? 20,
            proof: m.proof === "partner" ? "partner" : "photo",
            aiCheck: m.ai_check ?? undefined,
          };
          setMissionId(m.id);
          setDueAt(m.due_at ?? null);
          missionPartner = m.created_by === uid ? m.partner_id : m.created_by;
          setPartnerId(missionPartner ?? "");
        }
      } else if (cId) {
        const found = CHALLENGES.find((c) => c.id === cId);
        if (found) current = found;
      }
      setChallenge(current);

      // Friends = circle members + accepted friend requests (+ your mission partner)
      const ids = new Set<string>();
      const { data: membership } = await supabase
        .from("circle_members")
        .select("circle_id")
        .eq("user_id", uid)
        .limit(1)
        .maybeSingle();
      if (membership) {
        setCircleId(membership.circle_id);
        const { data: rows } = await supabase.from("circle_members").select("user_id").eq("circle_id", membership.circle_id);
        (rows ?? []).forEach((r) => ids.add(r.user_id));
      }
      const { data: fs } = await supabase
        .from("friendships")
        .select("requester, addressee")
        .eq("status", "accepted")
        .or(`requester.eq.${uid},addressee.eq.${uid}`);
      (fs ?? []).forEach((f) => ids.add(f.requester === uid ? f.addressee : f.requester));
      if (missionPartner) ids.add(missionPartner);
      ids.delete(uid);

      if (ids.size) {
        const { data: people } = await supabase.from("profiles").select("id, name").in("id", [...ids]);
        setFriends(people ?? []);
      }

      const { data: existing } = await supabase
        .from("check_ins")
        .select("id")
        .eq("user_id", uid)
        .eq("challenge_date", todayString())
        .eq("challenge_id", current.id)
        .maybeSingle();
      setAlreadyToday(!!existing);

      setStep("form");
    }
    init();
  }, [router]);

  function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setError("Photo must be under 10MB");
    setError("");
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function uploadPhoto(uid: string) {
    if (!photo) return null;
    const ext = photo.name.split(".").pop() || "jpg";
    const path = `${uid}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("checkins").upload(path, photo);
    if (error) throw new Error(error.message);
    return supabase.storage.from("checkins").getPublicUrl(path).data.publicUrl;
  }

  // mode "ai": the AI checks the photo. mode "friend": a friend confirms instead.
  async function submit(mode: "ai" | "friend") {
    if (!userId) return;
    if (dueAt && new Date(dueAt).getTime() <= Date.now()) {
      return setError("Time's up on this quest! Plan a new one with your friend.");
    }
    if (mode === "ai" && !photo) return setError("Add a photo so the AI can check it");
    if (mode === "friend" && !partnerId) return setError("Pick the friend who can confirm");
    if (!reflection.trim()) return setError("Add one sentence about how it went");

    setError("");
    setStep("checking");

    try {
      const photoUrl = await uploadPhoto(userId);
      let v: Verdict | null = null;

      if (mode === "ai" && photoUrl) {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(missionId ? { imageUrl: photoUrl, missionId } : { imageUrl: photoUrl, challengeId: challenge.id }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "The AI check failed. Ask a friend to confirm instead.");
          setStep("retry");
          return;
        }
        v = data as Verdict;
        setVerdict(v);
        if (!v.verified) {
          setStep("retry");
          return;
        }
      }

      const verified = mode === "ai" && !!v?.verified;
      let points = 0;
      if (verified) {
        const weekly = await weeklyPoints(userId);
        points = Math.max(0, Math.min(challenge.points, WEEKLY_CAP - weekly));
        setCapped(points < challenge.points);
      }

      const { error } = await supabase.from("check_ins").upsert(
        {
          user_id: userId,
          circle_id: circleId,
          challenge_id: challenge.id,
          challenge_date: todayString(),
          title: challenge.title,
          emoji: challenge.emoji,
          max_points: challenge.points,
          photo_url: photoUrl,
          reflection: reflection.trim(),
          ai_verified: verified,
          ai_feedback: v?.feedback ?? null,
          partner_id: partnerId || null,
          partner_confirmed: false,
          status: verified ? "verified" : "pending",
          points,
        },
        { onConflict: "user_id,challenge_date,challenge_id" }
      );
      if (error) throw new Error(error.message);

      if (missionId && verified) {
        await supabase.from("missions").update({ status: "completed" }).eq("id", missionId);
      }

      setEarned(points);
      setVerifiedNow(verified);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("form");
    }
  }

  function retake() {
    setPhoto(null);
    setPreview(null);
    setVerdict(null);
    setError("");
    setStep("form");
  }

  const partnerName = friends.find((f) => f.id === partnerId)?.name;

  const friendPicker = (label: string) =>
    friends.length > 0 ? (
      <label className="block">
        <FieldLabel>{label}</FieldLabel>
        <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={inputClass}>
          <option value="">{challenge.proof === "partner" ? "Choose a friend…" : "No one, I did it solo"}</option>
          {friends.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
    ) : (
      <p className="text-sm">
        Add friends so they can confirm your quests.{" "}
        <Link href="/friends" className="font-bold underline decoration-quest-pink decoration-2 underline-offset-4">
          Find friends
        </Link>
      </p>
    );

  // ---------- Screens ----------

  if (step === "loading") return <LoadingScreen />;
  if (step === "checking") return <LoadingScreen label={photo ? "Checking your photo…" : "Saving your check-in…"} />;

  if (step === "done") {
    return (
      <AppShell theme="theme-streak">
        <section className="mx-auto max-w-[640px]">
          <div className="panel-3d p-7 text-center sm:p-10">
            {verifiedNow ? (
              <>
                <span className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-black bg-success shadow-[4px_4px_0_#000]">
                  <Icon name="check" className="h-10 w-10" />
                </span>
                <p className="mt-6 font-mono text-xs font-bold uppercase tracking-[.18em]">Mission accomplished</p>
                <h1 className="map-title mt-2 font-display text-6xl">
                  +<span className="title-accent">{earned}</span> pts
                </h1>
                {verdict?.feedback && <p className="mx-auto mt-4 max-w-[440px] text-base leading-7">“{verdict.feedback}”</p>}
                {capped && (
                  <p className="mx-auto mt-4 inline-block rounded-full border-2 border-black bg-progress px-4 py-2 text-sm font-bold">
                    🏆 You&apos;ve hit this week&apos;s {WEEKLY_CAP}-point max!
                  </p>
                )}
                {partnerName && (
                  <p className="mt-4 text-sm">
                    When {partnerName} confirms you did it together, you&apos;ll get +{DUO_BONUS} duo bonus.
                  </p>
                )}
              </>
            ) : (
              <>
                <span className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-black bg-progress shadow-[4px_4px_0_#000]">
                  <Icon name="clock" className="h-10 w-10" />
                </span>
                <h1 className="map-title mt-6 font-display text-4xl">
                  Sent to <span className="title-accent">{partnerName}</span>
                </h1>
                <p className="mt-3 text-base">You&apos;ll get +{challenge.points + DUO_BONUS} pts when they confirm.</p>
              </>
            )}

            <div className="mt-8 grid gap-3">
              {partnerName && (
                <PrimaryLink href="/missions" className="w-full">
                  Plan your next quest with {partnerName}
                </PrimaryLink>
              )}
              <Link href="/home" className={`${secondaryButtonClass} w-full`}>
                Back home
              </Link>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell theme="theme-streak">
      <section className="mx-auto max-w-[1180px]">
        <Link href={missionId ? "/missions" : "/home"} className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em]">
          <Icon name="chevron" className="h-4 w-4 rotate-180" />
          Back
        </Link>
        <ScreenHeading
          number="04"
          eyebrow={missionId ? "AI mission · Quest log" : "Quest log"}
          title="Share the adventure"
          copy="Post your proof, say how it went, and keep your streak moving. ConQuest uses what you both write to plan your next quest."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          {/* Form */}
          <div className="panel-3d">
            <div className="flex items-center justify-between border-b-2 border-black px-6 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.15em]">Check in</p>
                <p className="mt-1 text-xs text-black">Visible only to your circle</p>
              </div>
              <span className="flex items-center gap-2 rounded-full border-2 border-black bg-white px-3 py-2 text-xs font-bold">
                <Icon name={challenge.proof === "photo" ? "camera" : "people"} className="h-4 w-4" />
                {challenge.proof === "photo" ? "AI checks photo" : "Friend confirms"}
              </span>
            </div>

            <div className="grid gap-5 p-4 sm:p-6">
              {alreadyToday && (
                <p className="rounded-2xl border-2 border-black bg-progress px-4 py-3 text-sm font-bold">
                  You already checked in for this today. Submitting again replaces it.
                </p>
              )}

              {/* AI said no, or the AI was unavailable */}
              {step === "retry" && (
                <div className="rounded-[24px] border-2 border-black bg-progress p-5">
                  <p className="font-display text-xl">Not quite yet</p>
                  <p className="mt-2 text-sm leading-6">{verdict?.feedback ?? error}</p>
                  <button type="button" onClick={retake} className={`${secondaryButtonClass} mt-4 w-full`}>
                    <Icon name="camera" className="h-4 w-4" />
                    Retake photo
                  </button>
                  {friends.length > 0 && (
                    <div className="mt-4 grid gap-3">
                      {friendPicker("Or have a friend vouch for you")}
                      <PrimaryButton onClick={() => submit("friend")} className="w-full">
                        Ask a friend to confirm instead
                      </PrimaryButton>
                    </div>
                  )}
                </div>
              )}

              {step === "form" && (
                <>
                  <div>
                    <FieldLabel>{challenge.proof === "photo" ? "Photo proof" : "Photo (optional)"}</FieldLabel>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-[28px] border-2 border-dashed border-black bg-white"
                    >
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="Your photo" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <span className="flex flex-col items-center gap-3">
                          <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-black bg-discovery">
                            <Icon name="camera" className="h-7 w-7" />
                          </span>
                          <span className="text-sm font-bold">Tap to take a photo</span>
                        </span>
                      )}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pickPhoto} className="hidden" />
                    <p className="mt-2 text-xs font-semibold">Places and things, please. No strangers&apos; faces.</p>
                  </div>

                  <label className="block">
                    <FieldLabel>How did it go?</FieldLabel>
                    <textarea
                      value={reflection}
                      onChange={(e) => setReflection(e.target.value.slice(0, 200))}
                      placeholder="One sentence. The barista recommended a lavender latte and it was amazing."
                      rows={3}
                      className={`${inputClass} resize-none`}
                    />
                  </label>

                  {friendPicker(
                    challenge.proof === "partner"
                      ? "Who can confirm you did it?"
                      : `Did it with a friend? (+${DUO_BONUS} duo bonus when they confirm)`
                  )}

                  <ErrorText>{error}</ErrorText>

                  <PrimaryButton onClick={() => submit(challenge.proof === "photo" ? "ai" : "friend")} className="w-full">
                    {challenge.proof === "photo" ? "Check my photo" : "Send to friend to confirm"}
                  </PrimaryButton>
                </>
              )}
            </div>
          </div>

          {/* Quest summary */}
          <aside className="panel-3d p-6">
            <p className="font-mono text-xs uppercase tracking-[.18em]">
              {missionId ? "AI mission" : `${challenge.type} quest`} · +{challenge.points} pts
            </p>
            <h2 className="display-title font-display mt-3 text-4xl">
              {challenge.emoji} <AccentTitle text={challenge.title} />
            </h2>
            <p className="mt-4 text-sm leading-6">{challenge.description}</p>

            <div className="mt-6 flex items-center gap-3 rounded-2xl border-2 border-black bg-progress px-4 py-3 shadow-[3px_3px_0_#000]">
              <Icon name="clock" className="h-5 w-5" />
              <span className="text-sm font-bold">
                {missionId ? (
                  dueAt ? (
                    <>
                      Time left: <Countdown to={dueAt} expiredText="expired" />
                    </>
                  ) : (
                    "No deadline"
                  )
                ) : (
                  <>
                    Ends in <Countdown to={nextMidnight()} expiredText="any second now" />
                  </>
                )}
              </span>
            </div>

            <div className="mt-5 rounded-2xl border-2 border-black bg-success p-4">
              <p className="text-xs font-bold uppercase tracking-[.14em]">How points work</p>
              <p className="mt-2 text-xs leading-5">
                Earn the quest&apos;s points when it&apos;s verified, plus +{DUO_BONUS} when a friend confirms you did it together. Max {WEEKLY_CAP} points a week.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </AppShell>
  );
}
