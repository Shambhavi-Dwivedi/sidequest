"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const GOALS = [
  { id: "connect", label: "Connect with friends" },
  { id: "meet_new", label: "Meet new people" },
  { id: "do_good", label: "Do good together" },
];

const INTERESTS = [
  "coffee", "food", "cooking", "travel", "trips", "hiking", "nature",
  "music", "concerts", "art", "photography", "books", "writing",
  "movies", "theater", "games", "sports", "fitness", "dance",
  "fashion", "tech", "pets", "volunteering",
];

const COMFORT = [
  { level: 1, label: "Ease me in", desc: "Low-key stuff with friends" },
  { level: 2, label: "Stretch a little", desc: "Small chats with new people" },
  { level: 3, label: "Bring it on", desc: "Bold, out-there challenges" },
];

const BIO_MAX = 160;

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [bio, setBio] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [comfort, setComfort] = useState(1);
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

  async function save() {
    if (!userId) return;
    const ageNum = parseInt(age, 10);
    if (!name.trim()) return setError("Add your name");
    if (!ageNum || ageNum < 13 || ageNum > 120) return setError("Add a valid age (13+)");
    if (goals.length === 0) return setError("Pick at least one goal");
    if (interests.length < 2) return setError("Pick at least 2 interests");

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
    router.push("/friends");
  }

  const input =
    "w-full rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 outline-none focus:border-emerald-500";

  const chip = (active: boolean) =>
    `px-4 py-2 rounded-full border text-sm transition ${
      active
        ? "bg-emerald-500 text-black border-emerald-500"
        : "bg-neutral-900 border-neutral-800 text-neutral-300"
    }`;

  // Show any custom interests the user typed alongside the preset ones
  const allInterests = [...INTERESTS, ...interests.filter((i) => !INTERESTS.includes(i))];

  return (
    <main className="min-h-screen bg-neutral-950 text-white px-6 py-10">
      <div className="max-w-md mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Set up your profile</h1>
          <p className="text-neutral-400 mt-1">This is how SideQuest picks your missions.</p>
        </div>

        <section className="space-y-3">
          <div>
            <h2 className="font-semibold mb-2">Your name</h2>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maya" className={input} />
          </div>

          <div className="flex gap-3">
            <div className="w-1/3">
              <h2 className="font-semibold mb-2">Age</h2>
              <input
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="20"
                className={input}
              />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold mb-2">Gender</h2>
              <input
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                placeholder="However you describe it"
                className={input}
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-1">Bio</h2>
          <p className="text-sm text-neutral-500 mb-2">Your circle will see this.</p>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            placeholder="Coffee snob, always down for a spontaneous road trip…"
            rows={3}
            className={`${input} resize-none`}
          />
          <p className="text-xs text-neutral-500 text-right mt-1">
            {bio.length}/{BIO_MAX}
          </p>
        </section>

        <section>
          <h2 className="font-semibold mb-2">What do you want from SideQuest?</h2>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button key={g.id} onClick={() => toggle(goals, setGoals, g.id)} className={chip(goals.includes(g.id))}>
                {g.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-2">Your interests</h2>
          <div className="flex flex-wrap gap-2">
            {allInterests.map((i) => (
              <button key={i} onClick={() => toggle(interests, setInterests, i)} className={chip(interests.includes(i))}>
                {i}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              value={customInterest}
              onChange={(e) => setCustomInterest(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomInterest()}
              placeholder="Add your own…"
              className={input}
            />
            <button onClick={addCustomInterest} className="px-4 rounded-xl bg-neutral-800 text-sm font-semibold">
              Add
            </button>
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-2">Comfort level</h2>
          <div className="space-y-2">
            {COMFORT.map((c) => (
              <button
                key={c.level}
                onClick={() => setComfort(c.level)}
                className={`w-full text-left rounded-xl border px-4 py-3 ${
                  comfort === c.level ? "border-emerald-500 bg-emerald-500/10" : "border-neutral-800 bg-neutral-900"
                }`}
              >
                <p className="font-semibold">{c.label}</p>
                <p className="text-sm text-neutral-400">{c.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-emerald-500 text-black font-semibold py-3 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Start questing →"}
        </button>
      </div>
    </main>
  );
}
