"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  AppShell,
  ErrorText,
  FieldLabel,
  Icon,
  PrimaryButton,
  ScreenHeading,
  chipClass,
  inputClass,
} from "@/components/ui";

const GOALS = [
  { id: "connect", label: "Connect with friends", copy: "Turn group-chat plans into real plans" },
  { id: "meet_new", label: "Meet new people", copy: "Meet people without the pressure" },
  { id: "do_good", label: "Do good together", copy: "Make kindness part of your routine" },
];

const INTERESTS = [
  "coffee", "food", "cooking", "travel", "trips", "hiking", "nature",
  "music", "concerts", "art", "photography", "books", "writing",
  "movies", "theater", "games", "sports", "fitness", "dance",
  "fashion", "tech", "pets", "volunteering",
];

const COMFORT = [
  { level: 1, label: "Ease me in", desc: "A tiny nudge. Low-key stuff with friends" },
  { level: 2, label: "Stretch a little", desc: "A brave step. Small chats with new people" },
  { level: 3, label: "Bring it on", desc: "Plot twist. Bold, out-there challenges" },
];

const BIO_MAX = 160;

// Figma: ProfileScreen ("Pack your profile")
export default function OnboardingPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [bio, setBio] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [comfort, setComfort] = useState(1);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Must be logged in to see this page
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
      else setUserId(data.user.id);
    });
  }, [router]);

  function toggle(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  function addCustomInterest() {
    const value = customInterest.trim().toLowerCase();
    if (value && !interests.includes(value)) setInterests([...interests, value]);
    setCustomInterest("");
  }

  function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError("Image must be under 5MB");
    setError("");
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function save() {
    if (!userId) return;
    const ageNum = parseInt(age, 10);
    if (!name.trim()) return setError("Add your name");
    if (!ageNum || ageNum < 13 || ageNum > 120) return setError("Add a valid age (13+)");
    if (goals.length === 0) return setError("Pick at least one goal");
    if (interests.length < 2) return setError("Pick at least 2 interests");

    setError("");
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      name: name.trim(),
      age: ageNum,
      gender: gender.trim() || null,
      bio: bio.trim() || null,
      goals,
      interests,
      comfort_level: comfort,
    });

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    // Optional profile photo (can also be added later on the Friends page)
    if (photo) {
      const ext = photo.name.split(".").pop() || "png";
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, photo, { upsert: true });
      if (!upErr) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        await supabase.from("profiles").update({ avatar_url: `${data.publicUrl}?t=${Date.now()}` }).eq("id", userId);
      }
    }

    router.push("/friends");
  }

  const allInterests = [...INTERESTS, ...interests.filter((i) => !INTERESTS.includes(i))];
  const goalSummary = GOALS.filter((g) => goals.includes(g.id)).map((g) => g.label).join(" · ");

  return (
    <AppShell theme="theme-profile" nav={false}>
      <section className="mx-auto max-w-[1040px]">
        <ScreenHeading
          number="01"
          eyebrow="Chart stop 01"
          title="Pack your profile"
          copy="Tell us what you want to bring along so we can map missions that feel exciting, useful, and actually doable."
        />

        <div className="panel-3d mt-8 grid overflow-hidden lg:grid-cols-[.72fr_1.28fr]">
          {/* Left: photo + preview */}
          <div className="flex flex-col items-center justify-center border-b-2 border-black bg-discovery p-8 lg:border-b-0 lg:border-r-2 lg:p-10">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative grid h-36 w-36 place-items-center rounded-3xl border-2 border-dashed border-black"
              aria-label="Add a profile photo"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Your photo" className="h-24 w-24 rounded-full border-2 border-black object-cover" />
              ) : (
                <span className="grid h-24 w-24 place-items-center rounded-full border-2 border-black bg-success text-black">
                  <Icon name="user" className="h-10 w-10" />
                </span>
              )}
              <span className="quest-button absolute -bottom-3 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[.15em]">
                {preview ? "Change" : "Add photo"}
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
            <p className="mt-8 text-center font-display text-xl font-bold">{name.trim() || "Your name"}</p>
            <p className="mt-1 text-center font-mono text-xs uppercase tracking-[.18em] text-black">
              {age ? `${age}${gender.trim() ? ` · ${gender.trim()}` : ""}` : "Ready for ConQuest"}
            </p>
            {bio.trim() && <p className="mt-4 max-w-[260px] text-center text-sm leading-6">“{bio.trim()}”</p>}
          </div>

          {/* Right: the form */}
          <div className="p-6 sm:p-8">
            <div className="grid gap-5">
              <label>
                <FieldLabel>Display name</FieldLabel>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maya" className={inputClass} />
              </label>
              <div className="grid gap-5 sm:grid-cols-[.4fr_.6fr]">
                <label>
                  <FieldLabel>Age</FieldLabel>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="20"
                    className={inputClass}
                  />
                </label>
                <label>
                  <FieldLabel>Gender</FieldLabel>
                  <input
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    placeholder="However you describe it"
                    className={inputClass}
                  />
                </label>
              </div>
              <label>
                <FieldLabel>Bio · your circle sees this</FieldLabel>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                  placeholder="Coffee snob, always down for a spontaneous road trip…"
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
                <span className="mt-1 block text-right font-mono text-xs">
                  {bio.length}/{BIO_MAX}
                </span>
              </label>
            </div>

            <div className="mt-6 grid gap-3">
              {/* Interests (Figma: ChoiceDropdown) */}
              <details open className="group overflow-hidden rounded-[22px] border-2 border-black bg-white shadow-[3px_3px_0_#000]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="block text-xs font-bold uppercase tracking-[.15em] text-black">Choose your interests</span>
                    <span className="mt-1 block text-sm font-semibold text-black">
                      {interests.length ? interests.join(" · ") : "Pick at least two"}
                    </span>
                  </span>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-black bg-progress transition group-open:rotate-90">
                    <Icon name="chevron" className="h-4 w-4" />
                  </span>
                </summary>
                <div className="border-t-2 border-black bg-map-paper p-4">
                  <div className="flex flex-wrap gap-2">
                    {allInterests.map((i) => {
                      const active = interests.includes(i);
                      return (
                        <button type="button" key={i} onClick={() => toggle(interests, setInterests, i)} className={chipClass(active)}>
                          {active && <Icon name="check" className="h-3.5 w-3.5" />}
                          {i}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 rounded-[18px] border-2 border-black bg-white p-3">
                    <span className="block text-xs font-bold uppercase tracking-[.14em] text-black">Other</span>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        aria-label="Add another interest"
                        value={customInterest}
                        onChange={(e) => setCustomInterest(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomInterest();
                          }
                        }}
                        placeholder="Try astronomy, pottery…"
                        className="min-w-0 flex-1 rounded-xl border-2 border-black bg-white px-3 py-2.5 text-sm font-medium outline-none focus:shadow-[3px_3px_0_#2A9DBB]"
                      />
                      <button
                        type="button"
                        onClick={addCustomInterest}
                        disabled={!customInterest.trim()}
                        className="rounded-full border-2 border-black bg-progress px-4 py-2.5 text-xs font-bold shadow-[2px_2px_0_#000] transition disabled:cursor-not-allowed disabled:bg-white disabled:shadow-none"
                      >
                        Add option
                      </button>
                    </div>
                  </div>
                </div>
              </details>

              {/* Goals (Figma: GoalDropdown) */}
              <details open className="group overflow-hidden rounded-[22px] border-2 border-black bg-white shadow-[3px_3px_0_#000]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="block text-xs font-bold uppercase tracking-[.15em] text-black">What do you want from ConQuest?</span>
                    <span className="mt-1 block text-sm font-semibold text-black">{goalSummary || "Pick at least one"}</span>
                  </span>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-black bg-discovery transition group-open:rotate-90">
                    <Icon name="chevron" className="h-4 w-4" />
                  </span>
                </summary>
                <div className="grid gap-2 border-t-2 border-black bg-map-paper p-4 sm:grid-cols-3">
                  {GOALS.map((g) => {
                    const active = goals.includes(g.id);
                    return (
                      <button
                        type="button"
                        key={g.id}
                        onClick={() => toggle(goals, setGoals, g.id)}
                        className={`rounded-[20px] border-2 border-black p-3 text-left transition ${
                          active ? "bg-community text-white shadow-[3px_3px_0_#000]" : "bg-white text-black hover:bg-progress"
                        }`}
                      >
                        <span className="block text-xs font-bold">{g.label}</span>
                        <span className={`mt-1 block text-xs leading-4 ${active ? "text-white" : "text-black"}`}>{g.copy}</span>
                      </button>
                    );
                  })}
                </div>
              </details>
            </div>

            {/* Comfort level (Figma: mission difficulty) */}
            <div className="mt-6">
              <p className="font-sans text-lg font-extrabold">Choose your comfort level</p>
              <p className="mt-1 text-sm leading-6 text-black">Start comfortable, or choose a bigger social challenge.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {COMFORT.map((c) => (
                  <button
                    type="button"
                    key={c.level}
                    onClick={() => setComfort(c.level)}
                    className={`min-w-0 rounded-[22px] border-2 border-black px-4 py-3 text-left transition ${
                      comfort === c.level ? "translate-y-[-2px] bg-community text-white shadow-[3px_4px_0_#000]" : "bg-white text-black"
                    }`}
                  >
                    <span className="block text-sm font-extrabold">{c.label}</span>
                    <span className={`mt-1 block text-xs leading-5 ${comfort === c.level ? "text-white" : "text-black"}`}>{c.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <ErrorText>{error}</ErrorText>
            </div>

            <div className="mt-8 flex justify-end">
              <PrimaryButton onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save and continue"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
