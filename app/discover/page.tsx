"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Person = {
  id: string;
  name: string;
  age: number | null;
  bio: string | null;
  interests: string[] | null;
  avatar_url: string | null;
  lat: number | null;
  lng: number | null;
};

type Friendship = {
  id: string;
  requester: string;
  addressee: string;
  status: "pending" | "accepted";
};

// Round to 2 decimals (about 1 km) so we never store anyone's exact location
const roundCoord = (n: number) => Math.round(n * 100) / 100;

function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function Avatar({ url, name, size = 48 }: { url: string | null; name: string; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover" />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function DiscoverPage() {
  const router = useRouter();
  const [me, setMe] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [useDistance, setUseDistance] = useState(false);
  const [radius, setRadius] = useState(10);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fields = "id, name, age, bio, interests, avatar_url, lat, lng";

  async function loadFriendships(uid: string) {
    const { data } = await supabase
      .from("friendships")
      .select("id, requester, addressee, status")
      .or(`requester.eq.${uid},addressee.eq.${uid}`);
    setFriendships(data ?? []);
  }

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");
      const uid = auth.user.id;

      const { data: myProfile } = await supabase.from("profiles").select(fields).eq("id", uid).maybeSingle();
      if (!myProfile) return router.replace("/onboarding");
      setMe(myProfile);
      if (myProfile.lat != null) setUseDistance(true);

      // Discover is adults-only: 18+ users only see other 18+ users
      if ((myProfile.age ?? 0) >= 18) {
        const { data: others } = await supabase
          .from("profiles")
          .select(fields)
          .neq("id", uid)
          .gte("age", 18)
          .limit(100);
        setPeople(others ?? []);
        await loadFriendships(uid);
      }
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function shareLocation() {
    if (!me) return;
    if (!navigator.geolocation) return setError("Location isn't supported in this browser.");
    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = roundCoord(pos.coords.latitude);
        const lng = roundCoord(pos.coords.longitude);
        await supabase.from("profiles").update({ lat, lng }).eq("id", me.id);
        setMe({ ...me, lat, lng });
        setUseDistance(true);
        setLocating(false);
      },
      () => {
        setError("Location was blocked. You can still browse everyone below.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  async function removeLocation() {
    if (!me) return;
    await supabase.from("profiles").update({ lat: null, lng: null }).eq("id", me.id);
    setMe({ ...me, lat: null, lng: null });
    setUseDistance(false);
  }

  function statusWith(personId: string) {
    const f = friendships.find(
      (x) =>
        (x.requester === me?.id && x.addressee === personId) ||
        (x.addressee === me?.id && x.requester === personId)
    );
    if (!f) return { kind: "none" as const };
    if (f.status === "accepted") return { kind: "friends" as const, f };
    return f.requester === me?.id ? { kind: "sent" as const, f } : { kind: "incoming" as const, f };
  }

  async function sendRequest(personId: string) {
    if (!me) return;
    const { error } = await supabase.from("friendships").insert({ requester: me.id, addressee: personId });
    if (error && error.code !== "23505") setError(error.message);
    await loadFriendships(me.id);
  }

  async function accept(id: string) {
    if (!me) return;
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    await loadFriendships(me.id);
  }

  async function decline(id: string) {
    if (!me) return;
    await supabase.from("friendships").delete().eq("id", id);
    await loadFriendships(me.id);
  }

  const hasLocation = me?.lat != null && me?.lng != null;

  const list = useMemo(() => {
    if (!me) return [];
    const myInterests = me.interests ?? [];
    return people
      .map((p) => {
        const distance =
          hasLocation && p.lat != null && p.lng != null
            ? milesBetween(me.lat!, me.lng!, p.lat, p.lng)
            : null;
        const shared = (p.interests ?? []).filter((i) => myInterests.includes(i));
        return { ...p, distance, shared };
      })
      .filter((p) => !(useDistance && hasLocation) || (p.distance !== null && p.distance <= radius))
      .sort(
        (a, b) =>
          b.shared.length - a.shared.length || (a.distance ?? 99999) - (b.distance ?? 99999)
      );
  }, [people, me, hasLocation, useDistance, radius]);

  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee === me?.id);
  const nameOf = (id: string) => people.find((p) => p.id === id);

  function distanceLabel(d: number | null) {
    if (d === null) return null;
    return d < 1 ? "<1 mi away" : `~${Math.round(d)} mi away`;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <p className="text-neutral-400">Loading…</p>
      </main>
    );
  }

  // Under 18: no stranger discovery, point them to invite links instead
  if ((me?.age ?? 0) < 18) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white px-6 py-10">
        <div className="max-w-md mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Discover</h1>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-3">
            <p>Discover is for users 18 and older.</p>
            <p className="text-neutral-400 text-sm">
              You can still quest with friends you know. Share your circle's invite link with them.
            </p>
            <Link href="/friends" className="block text-center rounded-xl bg-emerald-500 text-black font-semibold py-3">
              Go to my circle
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white px-6 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Discover</h1>
          <Link href="/home" className="text-sm text-neutral-400 underline">
            Home
          </Link>
        </div>
        <p className="text-neutral-400 -mt-4">SideQuesters who share your interests.</p>

        {/* Incoming friend requests */}
        {incoming.length > 0 && (
          <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-3">
            <h2 className="font-semibold">Friend requests</h2>
            {incoming.map((f) => {
              const p = nameOf(f.requester);
              return (
                <div key={f.id} className="flex items-center gap-3">
                  <Avatar url={p?.avatar_url ?? null} name={p?.name ?? "?"} size={40} />
                  <p className="flex-1 font-medium">{p?.name ?? "Someone"}</p>
                  <button onClick={() => accept(f.id)} className="rounded-lg bg-emerald-500 text-black text-sm font-semibold px-3 py-2">
                    Accept
                  </button>
                  <button onClick={() => decline(f.id)} className="rounded-lg bg-neutral-800 text-sm px-3 py-2">
                    Decline
                  </button>
                </div>
              );
            })}
          </section>
        )}

        {/* Location filter (optional) */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
          {!hasLocation ? (
            <>
              <p className="font-semibold">📍 Find people near you</p>
              <p className="text-sm text-neutral-400">
                Optional. We only ever show approximate distance, never your exact location.
              </p>
              <button
                onClick={shareLocation}
                disabled={locating}
                className="w-full rounded-xl bg-emerald-500 text-black font-semibold py-3 disabled:opacity-50"
              >
                {locating ? "Finding you…" : "Allow location"}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="font-semibold">📍 Distance filter</p>
                <button
                  onClick={() => setUseDistance(!useDistance)}
                  className={`w-12 h-7 rounded-full p-1 transition ${useDistance ? "bg-emerald-500" : "bg-neutral-700"}`}
                  aria-label="Toggle distance filter"
                >
                  <span className={`block w-5 h-5 rounded-full bg-white transition ${useDistance ? "translate-x-5" : ""}`} />
                </button>
              </div>
              {useDistance && (
                <>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                  <p className="text-sm text-neutral-400">Within {radius} mile{radius === 1 ? "" : "s"}</p>
                </>
              )}
              <button onClick={removeLocation} className="text-xs text-neutral-500 underline">
                Stop sharing my location
              </button>
            </>
          )}
        </section>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* People list */}
        <section className="space-y-3">
          {list.length === 0 && (
            <p className="text-neutral-500 text-sm text-center py-8">
              {useDistance && hasLocation
                ? "No one in range yet. Try a bigger radius!"
                : "No other SideQuesters yet. Invite your friends!"}
            </p>
          )}

          {list.map((p) => {
            const status = statusWith(p.id);
            return (
              <div key={p.id} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar url={p.avatar_url} name={p.name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">
                      {p.name}
                      {p.age ? <span className="text-neutral-400 font-normal">, {p.age}</span> : null}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {[distanceLabel(p.distance), p.shared.length ? `${p.shared.length} shared interest${p.shared.length === 1 ? "" : "s"}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>

                {p.bio && <p className="text-sm text-neutral-300">{p.bio}</p>}

                <div className="flex flex-wrap gap-2">
                  {(p.interests ?? []).map((i) => (
                    <span
                      key={i}
                      className={`px-3 py-1 rounded-full text-xs border ${
                        p.shared.includes(i)
                          ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                          : "bg-neutral-950 border-neutral-800 text-neutral-400"
                      }`}
                    >
                      {i}
                    </span>
                  ))}
                </div>

                {status.kind === "none" && (
                  <button onClick={() => sendRequest(p.id)} className="w-full rounded-xl bg-emerald-500 text-black font-semibold py-2">
                    Add friend
                  </button>
                )}
                {status.kind === "sent" && (
                  <button disabled className="w-full rounded-xl bg-neutral-800 text-neutral-400 py-2">
                    Request sent
                  </button>
                )}
                {status.kind === "incoming" && (
                  <button onClick={() => accept(status.f.id)} className="w-full rounded-xl bg-emerald-500 text-black font-semibold py-2">
                    Accept request
                  </button>
                )}
                {status.kind === "friends" && (
                  <p className="text-center text-emerald-400 text-sm font-semibold py-2">Friends ✓</p>
                )}
              </div>
            );
          })}
        </section>

        <p className="text-xs text-neutral-600 text-center">
          Meeting someone new? Pick a public place and tell a friend where you're going.
        </p>
      </div>
    </main>
  );
}