"use client";

import { useEffect, useRef, useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CHALLENGES, challengeOfTheDay, Challenge } from "@/lib/challenges";
import { todayString, weeklyPoints, WEEKLY_CAP, DUO_BONUS } from "@/lib/points";

type Friend = { id: string; name: string };
type Verdict = { verified: boolean; feedback: string; hasFaces: boolean };
type Step = "form" | "checking" | "retry" | "done";

export default function CheckInPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [challenge, setChallenge] = useState<Challenge>(challengeOfTheDay());
  const [userId, setUserId] = useState<string | null>(null);
  const [circleId, setCircleId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reflection, setReflection] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [earned, setEarned] = useState(0);
  const [capped, setCapped] = useState(false);
  const [verifiedNow, setVerifiedNow] = useState(false);
  const [alreadyToday, setAlreadyToday] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      // Testing / demo: /checkin?c=cafe-swap picks a specific challenge
      const override = new URLSearchParams(window.location.search).get("c");
      const found = CHALLENGES.find((c) => c.id === override);
      if (found) setChallenge(found);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");
      const uid = auth.user.id;
      setUserId(uid);

      // Circle friends (for confirming / duo bonus)
      const { data: membership } = await supabase
        .from("circle_members")
        .select("circle_id")
        .eq("user_id", uid)
        .limit(1)
        .maybeSingle();

      if (membership) {
        setCircleId(membership.circle_id);
        const { data: rows } = await supabase
          .from("circle_members")
          .select("user_id")
          .eq("circle_id", membership.circle_id)
          .neq("user_id", uid);
        const ids = (rows ?? []).map((r) => r.user_id);
        if (ids.length) {
          const { data: people } = await supabase.from("profiles").select("id, name").in("id", ids);
          setFriends(people ?? []);
        }
      }

      const { data: existing } = await supabase
        .from("check_ins")
        .select("id")
        .eq("user_id", uid)
        .eq("challenge_date", todayString())
        .maybeSingle();
      setAlreadyToday(!!existing);
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

  // mode "ai": the AI checks the photo. mode "friend": a circle friend confirms instead.
  async function submit(mode: "ai" | "friend") {
    if (!userId) return;
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
          body: JSON.stringify({ imageUrl: photoUrl, challengeId: challenge.id }),
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
          photo_url: photoUrl,
          reflection: reflection.trim(),
          ai_verified: verified,
          ai_feedback: v?.feedback ?? null,
          partner_id: partnerId || null,
          partner_confirmed: false,
          status: verified ? "verified" : "pending",
          points,
        },
        { onConflict: "user_id,challenge_date" }
      );
      if (error) throw new Error(error.message);

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
  const input =
    "w-full rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 outline-none focus:border-emerald-500";

  const friendPicker = (label: string) =>
    friends.length > 0 ? (
      <section>
        <h2 className="font-semibold mb-2">{label}</h2>
        <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={input}>
          <option value="">{challenge.proof === "partner" ? "Choose a friend…" : "No one, I did it solo"}</option>
          {friends.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </section>
    ) : (
      <p className="text-sm text-neutral-500">
        Join a circle so friends can confirm your quests.{" "}
        <Link href="/friends" className="text-emerald-400 underline">
          Find friends
        </Link>
      </p>
    );

  // ---------- Screens ----------

  if (step === "checking") {
    return (
      <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-5xl animate-bounce">🤖</p>
        <p className="text-neutral-300">{photo ? "Checking your photo…" : "Saving your check-in…"}</p>
      </main>
    );
  }

  if (step === "done") {
    return (
      <main className="min-h-screen bg-neutral-950 text-white px-6 py-10">
        <div className="max-w-md mx-auto space-y-6 text-center">
          {verifiedNow ? (
            <>
              <p className="text-6xl">🎉</p>
              <h1 className="text-4xl font-bold text-emerald-400">+{earned} pts</h1>
              {verdict?.feedback && <p className="text-neutral-300">“{verdict.feedback}”</p>}
              {capped && <p className="text-amber-400 text-sm">🏆 You've hit this week's 100-point max!</p>}
              {partnerName && (
                <p className="text-sm text-neutral-400">
                  When {partnerName} confirms you did it together, you'll get +{DUO_BONUS} duo bonus.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-6xl">⏳</p>
              <h1 className="text-2xl font-bold">Sent to {partnerName} to confirm</h1>
              <p className="text-neutral-400">
                You'll get +{challenge.points + DUO_BONUS} pts when they confirm.
              </p>
            </>
          )}
          <Link href="/home" className="block rounded-xl bg-emerald-500 text-black font-semibold py-3">
            Back home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white px-6 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <Link href="/home" className="text-sm text-neutral-400 underline">
          ← Home
        </Link>

        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5 space-y-2">
          <p className="text-xs uppercase tracking-wide text-emerald-400 font-semibold">
            {challenge.type} · +{challenge.points} pts
          </p>
          <h1 className="text-2xl font-bold">
            {challenge.emoji} {challenge.title}
          </h1>
          <p className="text-neutral-300">{challenge.description}</p>
          <p className="text-xs text-neutral-500">
            {challenge.proof === "photo" ? "🤖 Proof: AI checks your photo" : "🤝 Proof: a friend confirms"}
          </p>
        </div>

        {alreadyToday && (
          <p className="text-sm text-amber-400">You already checked in today. Submitting again replaces it.</p>
        )}

        {/* AI said no, or the AI was unavailable */}
        {step === "retry" && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
            <p className="font-semibold">🤔 Not quite yet</p>
            <p className="text-neutral-300 text-sm">{verdict?.feedback ?? error}</p>
            <button onClick={retake} className="w-full rounded-xl bg-neutral-800 font-semibold py-3">
              Retake photo
            </button>
            {friends.length > 0 && (
              <>
                {friendPicker("Or have a friend vouch for you")}
                <button
                  onClick={() => submit("friend")}
                  className="w-full rounded-xl border border-neutral-700 font-semibold py-3"
                >
                  Ask a friend to confirm instead
                </button>
              </>
            )}
          </div>
        )}

        {step === "form" && (
          <>
            {/* Photo */}
            <section>
              <h2 className="font-semibold mb-2">
                {challenge.proof === "photo" ? "Photo proof" : "Photo (optional)"}
              </h2>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-neutral-700 bg-neutral-900 overflow-hidden flex items-center justify-center"
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Your photo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-neutral-400">📷 Tap to take a photo</span>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={pickPhoto}
                className="hidden"
              />
              <p className="text-xs text-neutral-500 mt-2">Places and things, please. No strangers' faces.</p>
            </section>

            {/* Reflection */}
            <section>
              <h2 className="font-semibold mb-2">How did it go?</h2>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value.slice(0, 200))}
                placeholder="One sentence. The barista recommended a lavender latte and it was amazing."
                rows={2}
                className={`${input} resize-none`}
              />
            </section>

            {friendPicker(
              challenge.proof === "partner"
                ? "Who can confirm you did it?"
                : `Did it with a friend? (+${DUO_BONUS} duo bonus when they confirm)`
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={() => submit(challenge.proof === "photo" ? "ai" : "friend")}
              className="w-full rounded-xl bg-emerald-500 text-black font-semibold py-3"
            >
              {challenge.proof === "photo" ? "Check my photo 🤖" : "Send to friend to confirm 🤝"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}