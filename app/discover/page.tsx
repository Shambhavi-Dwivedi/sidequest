"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  AppShell,
  Avatar,
  ErrorText,
  Icon,
  LoadingScreen,
  PrimaryLink,
  ScreenHeading,
  secondaryButtonClass,
} from "@/components/ui";

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

type Filter = "Everyone" | "Friends" | "New people";

// Round to 2 decimals (about 1 km) so we never store anyone's exact location
const roundCoord = (n: number) => Math.round(n * 100) / 100;

function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// A stable angle per person, so their pin doesn't jump around the map
function angleFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ((h % 360) * Math.PI) / 180;
}

const PIN_COLORS = ["var(--color-quest-purple)", "var(--color-quest-blue)", "var(--color-quest-orange)", "var(--color-quest-lime)"];

// Figma: LiveMapScreen ("See who's nearby")
export default function DiscoverPage() {
  const router = useRouter();
  const [me, setMe] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [useDistance, setUseDistance] = useState(false);
  const [radius, setRadius] = useState(10);
  const [filter, setFilter] = useState<Filter>("Everyone");
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
        const { data: others } = await supabase.from("profiles").select(fields).neq("id", uid).gte("age", 18).limit(100);
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
      (x) => (x.requester === me?.id && x.addressee === personId) || (x.addressee === me?.id && x.requester === personId)
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
          hasLocation && p.lat != null && p.lng != null ? milesBetween(me.lat!, me.lng!, p.lat, p.lng) : null;
        const shared = (p.interests ?? []).filter((i) => myInterests.includes(i));
        return { ...p, distance, shared };
      })
      .filter((p) => !(useDistance && hasLocation) || (p.distance !== null && p.distance <= radius))
      .sort((a, b) => b.shared.length - a.shared.length || (a.distance ?? 99999) - (b.distance ?? 99999));
  }, [people, me, hasLocation, useDistance, radius]);

  const isFriend = (id: string) => statusWith(id).kind === "friends";
  const visible = list.filter((p) =>
    filter === "Everyone" ? true : filter === "Friends" ? isFriend(p.id) : !isFriend(p.id)
  );

  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee === me?.id);
  const personById = (id: string) => people.find((p) => p.id === id);

  function distanceLabel(d: number | null) {
    if (d === null) return null;
    return d < 1 ? "<1 mi away" : `~${Math.round(d)} mi away`;
  }

  if (loading) return <LoadingScreen theme="theme-map" />;

  // Under 18: no stranger discovery, point them to invite links instead
  if ((me?.age ?? 0) < 18) {
    return (
      <AppShell theme="theme-map">
        <section className="mx-auto max-w-[720px]">
          <ScreenHeading number="MAP" eyebrow="Live quest map" title="See who's nearby" />
          <div className="panel-3d mt-8 p-6">
            <div className="flex items-center gap-3">
              <Icon name="shield" className="h-6 w-6" />
              <p className="font-display text-xl font-bold">Discover is for users 18 and older.</p>
            </div>
            <p className="mt-3 text-sm leading-6">
              You can still quest with friends you know. Share your circle&apos;s invite link with them.
            </p>
            <PrimaryLink href="/friends" className="mt-5">
              Go to my circle
            </PrimaryLink>
          </div>
        </section>
      </AppShell>
    );
  }

  // Map pins: up to 8 people, placed around "YOU" by approximate distance
  const maxRange = useDistance && hasLocation ? radius : Math.max(5, ...visible.map((p) => p.distance ?? 0));
  const pins = visible.slice(0, 8).map((p, i) => {
    const t = p.distance === null ? 0.8 : Math.min(1, Math.max(0.18, p.distance / maxRange));
    const a = angleFor(p.id);
    return {
      p,
      x: 400 + Math.cos(a) * t * 300,
      y: 310 + Math.sin(a) * t * 230,
      color: PIN_COLORS[i % PIN_COLORS.length],
      light: i % PIN_COLORS.length === 0,
    };
  });

  return (
    <AppShell theme="theme-map">
      <section className="mx-auto max-w-[1180px]">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <ScreenHeading
            number="MAP"
            eyebrow="Live quest map"
            title="See who's nearby"
            copy="Find friends and ConQuesters who share your interests. Location is optional and always approximate."
          />
          {hasLocation ? (
            <button
              type="button"
              onClick={() => setUseDistance(!useDistance)}
              className={`flex items-center gap-2 self-start rounded-full border-2 border-black px-4 py-3 text-xs font-bold shadow-[3px_3px_0_#000] sm:self-auto ${
                useDistance ? "bg-success text-black" : "bg-white text-black"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${useDistance ? "animate-pulse bg-quest-pink" : "bg-black"}`} />
              {useDistance ? "Distance filter on" : "Distance filter off"}
            </button>
          ) : (
            <button
              type="button"
              onClick={shareLocation}
              disabled={locating}
              className="quest-button flex items-center gap-2 self-start px-5 py-3 text-xs font-bold sm:self-auto"
            >
              <Icon name="pin" className="h-4 w-4" />
              {locating ? "Finding you…" : "Allow location"}
            </button>
          )}
        </div>

        <div className="mt-6">
          <ErrorText>{error}</ErrorText>
        </div>

        {/* Incoming friend requests */}
        {incoming.length > 0 && (
          <div className="panel-3d mt-6 p-5">
            <p className="font-mono text-xs font-bold uppercase tracking-[.15em]">Friend requests</p>
            <div className="mt-3 grid gap-3">
              {incoming.map((f) => {
                const p = personById(f.requester);
                return (
                  <div key={f.id} className="flex items-center gap-3 rounded-[20px] border-2 border-black bg-white p-3">
                    <Avatar url={p?.avatar_url} name={p?.name ?? "?"} size={40} />
                    <p className="flex-1 text-sm font-bold">{p?.name ?? "Someone"}</p>
                    <button type="button" onClick={() => accept(f.id)} className="quest-button px-4 py-2 text-xs font-bold">
                      Accept
                    </button>
                    <button type="button" onClick={() => decline(f.id)} className={secondaryButtonClass}>
                      Decline
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="panel-3d mt-6 overflow-hidden">
          <div className="flex flex-col gap-4 border-b-2 border-black px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Icon name="shield" className="h-5 w-5" />
              <p className="text-sm font-bold">Approximate locations only</p>
            </div>
            <div className="quest-scroll flex gap-2 overflow-x-auto pb-1">
              {(["Everyone", "Friends", "New people"] as Filter[]).map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => setFilter(option)}
                  className={`shrink-0 rounded-full border-2 border-black px-4 py-2 text-xs font-bold transition ${
                    filter === option ? "bg-community text-white" : "bg-white text-black hover:bg-progress"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-[1.35fr_.65fr]">
            {/* Map */}
            <div className="relative min-h-[360px] overflow-hidden border-b-2 border-black bg-white sm:min-h-[480px] lg:min-h-[560px] lg:border-b-0 lg:border-r-2">
              <svg aria-label="Map of ConQuesters near you" className="absolute inset-0 h-full w-full" role="img" viewBox="0 0 800 620" preserveAspectRatio="xMidYMid slice">
                <rect width="800" height="620" fill="white" />
                <rect x="28" y="28" width="210" height="132" rx="28" fill="var(--color-quest-yellow)" fillOpacity=".3" />
                <rect x="550" y="38" width="210" height="150" rx="34" fill="var(--color-quest-lime)" fillOpacity=".35" />
                <rect x="48" y="418" width="230" height="166" rx="38" fill="var(--color-quest-blue)" fillOpacity=".22" />
                <rect x="510" y="430" width="250" height="150" rx="34" fill="var(--color-quest-purple)" fillOpacity=".12" />
                <path d="M-30 240C150 170 255 340 430 268S660 150 830 238" fill="none" stroke="var(--color-ink)" strokeWidth="42" />
                <path d="M-30 240C150 170 255 340 430 268S660 150 830 238" fill="none" stroke="white" strokeWidth="34" />
                <path d="M320-30c-8 160 88 238 40 370S300 510 362 660" fill="none" stroke="var(--color-ink)" strokeWidth="38" />
                <path d="M320-30c-8 160 88 238 40 370S300 510 362 660" fill="none" stroke="white" strokeWidth="30" />
                <path d="M610-20c-72 140-18 250-80 365s-30 184-80 295" fill="none" stroke="var(--color-quest-blue)" strokeWidth="64" />
                <path d="M610-20c-72 140-18 250-80 365s-30 184-80 295" fill="none" stroke="white" strokeDasharray="10 14" strokeWidth="3" />

                {pins.map(({ p, x, y, color, light }) => (
                  <g key={p.id} transform={`translate(${x} ${y})`}>
                    <circle r="25" fill={color} stroke="var(--color-ink)" strokeWidth="4" />
                    <text x="0" y="6" textAnchor="middle" fill={light ? "white" : "var(--color-ink)"} className="font-sans" fontSize="15" fontWeight="800">
                      {p.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </text>
                  </g>
                ))}

                <g transform="translate(400 310)">
                  <circle r="36" fill="var(--color-quest-pink)" fillOpacity=".2" className={hasLocation ? "animate-pulse" : ""} />
                  <circle r="19" fill="var(--color-quest-pink)" stroke="var(--color-ink)" strokeWidth="4" />
                  <circle r="6" fill="white" />
                  <rect x="-35" y="28" width="70" height="28" rx="14" fill="white" stroke="var(--color-ink)" strokeWidth="3" />
                  <text x="0" y="47" textAnchor="middle" className="font-mono" fontSize="12" fontWeight="700">
                    YOU
                  </text>
                </g>
              </svg>
              <div className="absolute left-4 top-4 rounded-full border-2 border-black bg-white px-3 py-2 text-xs font-bold shadow-[2px_2px_0_#000]">
                {hasLocation ? (useDistance ? `Within ${radius} mi · Live` : "Everywhere · Live") : "Location off"}
              </div>
            </div>

            {/* Side panel */}
            <aside className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs font-bold uppercase tracking-[.15em]">Nearby now</p>
                <span className="rounded-full bg-progress px-3 py-1.5 text-xs font-bold">{visible.length}</span>
              </div>

              {hasLocation && useDistance && (
                <div className="mt-4 rounded-[20px] border-2 border-black bg-white p-4">
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span>Distance</span>
                    <span className="font-mono text-xs">
                      {radius} mile{radius === 1 ? "" : "s"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="mt-2 w-full"
                    aria-label="Search radius in miles"
                  />
                </div>
              )}

              <div className="mt-4 grid gap-3">
                {visible.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-[20px] border-2 border-black bg-white p-3">
                    <Avatar url={p.avatar_url} name={p.name} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{p.name}</span>
                      <span className="mt-0.5 block text-xs text-black">
                        {[distanceLabel(p.distance), p.shared.length ? `${p.shared.length} shared` : null].filter(Boolean).join(" · ") ||
                          "ConQuester"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[20px] border-2 border-black bg-success p-4">
                <p className="text-sm font-bold">You control your visibility</p>
                <p className="mt-1 text-xs leading-5 text-black">
                  Exact locations are never shown. Locations are rounded to about half a mile before they&apos;re saved.
                </p>
                {hasLocation && (
                  <button type="button" onClick={removeLocation} className="mt-2 text-xs font-bold underline underline-offset-4">
                    Stop sharing my location
                  </button>
                )}
              </div>
            </aside>
          </div>
        </div>

        {/* People cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {visible.length === 0 && (
            <p className="panel-3d p-6 text-center text-sm font-bold md:col-span-2">
              {useDistance && hasLocation ? "No one in range yet. Try a bigger radius!" : "No one here yet. Invite your friends!"}
            </p>
          )}

          {visible.map((p) => {
            const status = statusWith(p.id);
            return (
              <article key={p.id} className="flex flex-col gap-3 border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000]">
                <div className="flex items-center gap-3">
                  <Avatar url={p.avatar_url} name={p.name} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-bold">
                      {p.name}
                      {p.age ? <span className="font-sans text-sm font-semibold">, {p.age}</span> : null}
                    </p>
                    <p className="font-mono text-xs uppercase tracking-[.1em]">
                      {[distanceLabel(p.distance), p.shared.length ? `${p.shared.length} shared interest${p.shared.length === 1 ? "" : "s"}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>

                {p.bio && <p className="text-sm leading-6">“{p.bio}”</p>}

                <div className="flex flex-wrap gap-2">
                  {(p.interests ?? []).map((i) => (
                    <span
                      key={i}
                      className={`rounded-full border-2 border-black px-3 py-1 text-xs font-bold ${
                        p.shared.includes(i) ? "bg-success" : "bg-white"
                      }`}
                    >
                      {i}
                    </span>
                  ))}
                </div>

                <div className="mt-auto pt-1">
                  {status.kind === "none" && (
                    <button type="button" onClick={() => sendRequest(p.id)} className="quest-button w-full px-5 py-3 text-sm font-bold">
                      Add friend
                    </button>
                  )}
                  {status.kind === "sent" && (
                    <button type="button" disabled className={`${secondaryButtonClass} w-full`}>
                      Request sent
                    </button>
                  )}
                  {status.kind === "incoming" && (
                    <button type="button" onClick={() => accept(status.f.id)} className="quest-button w-full px-5 py-3 text-sm font-bold">
                      Accept request
                    </button>
                  )}
                  {status.kind === "friends" && (
                    <span className="flex items-center justify-center gap-2 rounded-full border-2 border-black bg-success px-5 py-3 text-sm font-bold">
                      <Icon name="check" className="h-4 w-4" />
                      Friends
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs font-bold">
          Meeting someone new? Pick a public place and tell a friend where you&apos;re going.
        </p>
      </section>
    </AppShell>
  );
}
