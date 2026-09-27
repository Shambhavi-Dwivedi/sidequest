"use client";

// Shared ConQuest UI pieces, taken from the Figma Make design.
import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type IconName =
  | "anchor"
  | "arrow"
  | "bolt"
  | "camera"
  | "check"
  | "chevron"
  | "clock"
  | "code"
  | "compass"
  | "crosshair"
  | "home"
  | "info"
  | "lock"
  | "logout"
  | "map"
  | "people"
  | "pin"
  | "radio"
  | "search"
  | "settings"
  | "shield"
  | "spark"
  | "star"
  | "treasure"
  | "user"
  | "mail"
  | "copy"
  | "flame";

export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    anchor: (
      <>
        <circle cx="12" cy="5" r="2.5" />
        <path d="M12 7.5V21M7 12H3v2c0 4.2 3.9 7 9 7s9-2.8 9-7v-2h-4" />
        <path d="m8 17 4 4 4-4" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    bolt: <path d="m13 2-8 11h6l-1 9 9-12h-6V2Z" />,
    camera: (
      <>
        <path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v10H2V9a2 2 0 0 1 2-2Z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    code: (
      <>
        <path d="m8 8-4 4 4 4m8-8 4 4-4 4" />
        <path d="m14 5-4 14" />
      </>
    ),
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5 5.5-2.1Z" />
        <path d="M12 3v1m0 16v1M3 12h1m16 0h1" />
      </>
    ),
    crosshair: (
      <>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v.1" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    logout: (
      <>
        <path d="M10 4H5v16h5" />
        <path d="M13 8l4 4-4 4M8 12h9" />
      </>
    ),
    map: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5.5a3 3 0 0 1 0 5.5m1 3a5 5 0 0 1 4 5" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    radio: (
      <>
        <circle cx="12" cy="12" r="2" />
        <path d="M8.5 8.5a5 5 0 0 0 0 7m7-7a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13m13-13a9 9 0 0 1 0 13" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    shield: <path d="M12 2 4 5v6c0 5 3.4 9.2 8 11 4.6-1.8 8-6 8-11V5l-8-3Z" />,
    spark: (
      <>
        <path d="m12 2 1.3 5.2L18 9l-4.7 1.8L12 16l-1.3-5.2L6 9l4.7-1.8L12 2Z" />
        <path d="m19 16 .6 2.1 2.1.6-2.1.6L19 21.5l-.6-2.2-2.1-.6 2.1-.6L19 16Z" />
      </>
    ),
    star: <path d="m12 3 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8L12 3Z" />,
    treasure: (
      <>
        <path d="M3 10h18v10H3Z" />
        <path d="M5 10V8a7 7 0 0 1 14 0v2M3 14h18" />
        <path d="M10 14h4v4h-4Z" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
      </>
    ),
    flame: <path d="M12 22c4 0 7-2.7 7-6.8 0-3.2-2-5.6-3.6-7.4-.4 2-1.4 3.2-2.6 3.8.3-3.2-1-6.3-4.3-8.6.3 3-1.5 5.2-2.9 7C4.5 11.5 5 13 5 15.2 5 19.3 8 22 12 22Z" />,
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function OceanBackdrop() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 800"
    >
      <path
        d="M0 610Q150 550 300 610t300 0 300 0 300 0v190H0Z"
        fill="var(--color-quest-blue)"
        opacity=".12"
      />
      <path
        d="M0 690q120-58 240 0t240 0 240 0 240 0 240 0v110H0Z"
        fill="var(--color-quest-purple)"
        opacity=".1"
      />
      <path
        d="M-80 62Q180-12 390 72t400 4 470-54"
        fill="none"
        stroke="var(--color-quest-blue)"
        strokeDasharray="12 20"
        strokeLinecap="round"
        strokeWidth="4"
        opacity=".18"
      />
      <circle cx="1060" cy="48" r="44" fill="var(--color-quest-yellow)" opacity=".12" />
    </svg>
  );
}

export function QuestDecorations() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 hidden overflow-hidden lg:block">
      <span className="quest-shape absolute -left-3 top-[22%] grid h-9 w-9 place-items-center rounded-full border-2 border-black bg-discovery shadow-[2px_2px_0_#000] sm:left-[2%] sm:h-11 sm:w-11">
        <Icon name="anchor" className="h-5 w-5" />
      </span>
      <span className="quest-shape absolute -right-3 top-[18%] grid h-10 w-10 place-items-center rounded-full border-2 border-black bg-progress shadow-[2px_2px_0_#000] sm:right-[2%] sm:h-12 sm:w-12">
        <Icon name="treasure" className="h-5 w-5" />
      </span>
      <span className="quest-shape absolute -left-3 bottom-[22%] grid h-10 w-10 place-items-center rounded-xl border-2 border-black bg-challenge shadow-[2px_2px_0_#000] sm:left-[2%]">
        <Icon name="map" className="h-5 w-5" />
      </span>
      <span className="quest-shape absolute -right-3 bottom-[28%] grid h-10 w-10 place-items-center rounded-full border-2 border-black bg-community text-white shadow-[2px_2px_0_#000] sm:right-[2%] sm:h-12 sm:w-12">
        <Icon name="compass" className="h-5 w-5" />
      </span>
      <span className="quest-shape absolute right-[4%] top-[48%] grid h-7 w-7 place-items-center rounded-lg border-2 border-black bg-quest-pink text-white shadow-[2px_2px_0_#000] max-sm:hidden">
        <Icon name="star" className="h-4 w-4" />
      </span>
      <span className="quest-shape absolute bottom-[10%] left-[4%] grid h-10 w-10 place-items-center rounded-full border-2 border-black bg-success shadow-[2px_2px_0_#000] max-sm:hidden">
        <Icon name="radio" className="h-4 w-4" />
      </span>
    </div>
  );
}
// ---------- Buttons ----------

const questButtonClass =
  "quest-button group inline-flex items-center justify-center gap-3 rounded-full px-6 py-4 font-display text-sm font-bold tracking-[.01em] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60";

export function PrimaryButton({
  children,
  onClick,
  className = "",
  disabled,
  type = "button",
  arrow = true,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  arrow?: boolean;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${questButtonClass} ${className}`}>
      {children}
      {arrow && <Icon name="arrow" className="h-[18px] w-[18px] transition group-hover:translate-x-1" />}
    </button>
  );
}

export function PrimaryLink({
  children,
  href,
  className = "",
  arrow = true,
}: {
  children: ReactNode;
  href: string;
  className?: string;
  arrow?: boolean;
}) {
  return (
    <Link href={href} className={`${questButtonClass} ${className}`}>
      {children}
      {arrow && <Icon name="arrow" className="h-[18px] w-[18px] transition group-hover:translate-x-1" />}
    </Link>
  );
}

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-black bg-white px-5 py-3 text-xs font-bold uppercase tracking-[.15em] text-black transition hover:bg-progress disabled:cursor-not-allowed disabled:opacity-50";

// ---------- Form pieces ----------

export const inputClass =
  "w-full rounded-xl border-2 border-black bg-white px-4 py-3.5 text-base font-medium text-black outline-none transition focus:shadow-[4px_4px_0_#2A9DBB]";

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-2 block text-xs font-bold uppercase tracking-[.14em] text-black">{children}</span>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-2xl border-2 border-black bg-white px-4 py-3 text-sm font-bold text-action">{children}</p>
  );
}

export function chipClass(active: boolean) {
  return `flex items-center gap-2 rounded-full border-2 border-black px-4 py-2.5 text-xs font-bold transition ${
    active ? "bg-community text-white shadow-[2px_2px_0_#000]" : "bg-white text-black hover:bg-progress"
  }`;
}

// ---------- Headings ----------

// Title with the last word in the accent colour, like "Your next ConQuest"
export function AccentTitle({ text }: { text: string }) {
  const words = text.trim().split(" ");
  const last = words.pop();
  return (
    <>
      {words.join(" ")} <span className="title-accent">{last}</span>
    </>
  );
}

export function ScreenHeading({
  number,
  eyebrow,
  title,
  copy,
}: {
  number: string;
  eyebrow: string;
  title: string;
  copy?: ReactNode;
}) {
  return (
    <div className="max-w-[720px]">
      <p className="flex flex-wrap items-center gap-3 font-mono text-xs font-bold uppercase tracking-[.18em] text-black">
        <span className="grid h-7 min-w-7 place-items-center rounded-full border-2 border-black bg-progress px-1 text-black">
          {number}
        </span>
        <Icon name="map" className="h-4 w-4" />
        {eyebrow}
        <span aria-hidden="true" className="ml-1 hidden items-center gap-1.5 sm:flex">
          <span className="h-2.5 w-2.5 rounded-full border border-black bg-discovery" />
          <span className="h-2.5 w-5 rounded-full border border-black bg-quest-pink" />
          <span className="h-2.5 w-2.5 rounded-full border border-black bg-success" />
        </span>
      </p>
      <h1 className="display-title font-display mt-4 text-[clamp(2.15rem,10vw,2.8rem)] sm:text-[clamp(2.4rem,4.6vw,3.8rem)]">
        <AccentTitle text={title} />
      </h1>
      {copy && <p className="mt-5 max-w-[640px] text-base font-medium leading-7 text-black">{copy}</p>}
    </div>
  );
}

// ---------- Avatar ----------

const AVATAR_COLORS = ["bg-community text-white", "bg-discovery", "bg-progress", "bg-success", "bg-challenge"];

export function Avatar({ url, name, size = 44 }: { url: string | null | undefined; name: string; size?: number }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full border-2 border-black object-cover"
      />
    );
  }
  const color = AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(12, size / 3) }}
      className={`grid shrink-0 place-items-center rounded-full border-2 border-black font-bold ${color}`}
    >
      {initials || "?"}
    </span>
  );
}

// ---------- Page shell: background, header, bottom navigation ----------

const NAV: [string, IconName, string][] = [
  ["Map", "pin", "/discover"],
  ["Friends", "people", "/friends"],
  ["Home", "home", "/home"],
  ["Quests", "bolt", "/missions"],
  ["About", "info", "/about"],
];

export function AppShell({
  children,
  theme = "theme-home",
  nav = true,
  decorations = false,
}: {
  children: ReactNode;
  theme?: string;
  nav?: boolean;
  decorations?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className={`mission-shell min-h-screen overflow-x-hidden text-black ${theme}`}>
      <OceanBackdrop />
      {decorations && <QuestDecorations />}

      <header className="app-header relative z-20 border-b-2 border-black bg-white">
        <div className="mx-auto flex min-h-18 max-w-[1200px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <Link href={nav ? "/home" : "/"} className="flex shrink-0 items-center gap-3 sm:gap-4">
            <span className="brand-mark relative grid h-10 w-10 overflow-hidden rounded-2xl text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-anchor.png" alt="" className="h-full w-full object-cover" />
            </span>
            <span className="relative z-10 inline-flex whitespace-nowrap py-1 pr-1 font-sans text-xl font-bold leading-normal tracking-[-.02em]">
              ConQuest
            </span>
          </Link>
          <div className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-black lg:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black" />
            Online
          </div>
          {nav && (
            <button
              onClick={logout}
              aria-label="Log out"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-black bg-white text-xs font-bold uppercase tracking-normal text-black shadow-[1px_1px_0_#000] transition hover:bg-quest-yellow sm:flex sm:h-auto sm:w-auto sm:px-3 sm:py-1.5 sm:tracking-[.1em]"
            >
              <Icon name="logout" className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          )}
        </div>
      </header>

      <main
        className={`relative z-10 mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-14 ${
          nav ? "pb-32 lg:pb-36" : ""
        }`}
      >
        <div className="page-enter">{children}</div>
      </main>

      {nav && (
        <nav aria-label="Main navigation" className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t-4 border-black bg-white">
          <div className="mx-auto grid max-w-[800px] grid-cols-5 px-2 sm:px-4">
            {NAV.map(([label, icon, href]) => {
              const active =
                pathname === href || pathname.startsWith(href + "/") || (href === "/home" && pathname === "/checkin");
              return (
                <Link
                  key={label}
                  href={href}
                  className={`relative flex min-h-20 flex-col items-center justify-center gap-1.5 px-1 text-xs font-extrabold transition ${
                    active ? "text-action" : "text-black hover:text-community"
                  }`}
                >
                  {active && <span className="absolute inset-x-4 top-0 h-1 bg-action" />}
                  <Icon name={icon} className="h-5 w-5" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

// Full-page loading state in the ConQuest style
export function LoadingScreen({ label = "Loading…", theme = "theme-home" }: { label?: string; theme?: string }) {
  return (
    <div className={`mission-shell grid min-h-screen place-items-center text-black ${theme}`}>
      <OceanBackdrop />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <span className="quest-spin grid h-16 w-16 place-items-center rounded-full border-2 border-black bg-community text-white">
          <Icon name="compass" className="h-8 w-8" />
        </span>
        <p className="font-mono text-xs font-bold uppercase tracking-[.18em]">{label}</p>
      </div>
    </div>
  );
}

export function QuestMap() {
  return (
    <svg
      aria-label="An illustrated ConQuest route connecting a starting point, a friend meetup, and a café"
      className="h-full w-full"
      role="img"
      viewBox="0 0 600 600"
    >
      <rect width="600" height="600" fill="white" />

      <path
        d="M0 176h168l44 44v102H0ZM404 0h196v154l-60 42H404ZM370 420h230v180H312v-86Z"
        fill="var(--color-quest-yellow)"
        stroke="var(--color-ink)"
        strokeWidth="4"
      />
      <path
        d="M0 392h132l50 54v154H0ZM230 0h112v126l-56 42-56-42Z"
        fill="var(--color-quest-blue)"
        stroke="var(--color-ink)"
        strokeWidth="4"
      />
      <path
        d="M402 222h198v128l-48 38H402l-40-52Z"
        fill="var(--color-quest-lime)"
        stroke="var(--color-ink)"
        strokeWidth="4"
      />

      <g fill="var(--color-ink)">
        <circle cx="40" cy="40" r="4" />
        <circle cx="64" cy="40" r="4" />
        <circle cx="88" cy="40" r="4" />
        <circle cx="512" cy="542" r="4" />
        <circle cx="536" cy="542" r="4" />
        <circle cx="560" cy="542" r="4" />
      </g>

      <g transform="translate(58 66)">
        <circle cx="54" cy="54" r="45" fill="white" stroke="var(--color-ink)" strokeWidth="4" />
        <circle cx="54" cy="54" r="27" fill="none" stroke="var(--color-ink)" strokeWidth="3" />
        <path d="m54 18 9 28 27 8-27 9-9 27-9-27-27-9 27-8Z" fill="var(--color-quest-pink)" stroke="var(--color-ink)" strokeLinejoin="round" strokeWidth="3" />
        <circle cx="54" cy="54" r="6" fill="var(--color-quest-yellow)" stroke="var(--color-ink)" strokeWidth="3" />
      </g>

      <g transform="translate(430 38)">
        <rect width="126" height="58" rx="18" fill="white" stroke="var(--color-ink)" strokeWidth="4" />
        <text x="18" y="24" className="font-mono" fontSize="12" fontWeight="700" letterSpacing="2">
          ROUTE 01
        </text>
        <text x="18" y="43" className="font-display" fontSize="16" fontWeight="800">
          Make a hello
        </text>
      </g>

      <path
        d="M78 506C104 440 158 472 180 405c23-70 105-34 128-98 22-61 81-52 104-105 19-43 31-66 78-73"
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeWidth="14"
      />
      <path
        d="M78 506C104 440 158 472 180 405c23-70 105-34 128-98 22-61 81-52 104-105 19-43 31-66 78-73"
        fill="none"
        stroke="var(--color-ink)"
        strokeDasharray="12 15"
        strokeLinecap="round"
        strokeWidth="5"
      />

      <g transform="translate(45 468)">
        <circle cx="34" cy="34" r="30" fill="var(--color-quest-lime)" stroke="var(--color-ink)" strokeWidth="4" />
        <circle cx="34" cy="34" r="9" fill="var(--color-ink)" />
        <path d="M34 4V-18" stroke="var(--color-ink)" strokeWidth="4" />
        <path d="M34-18h34l-9 11 9 11H34Z" fill="var(--color-quest-purple)" stroke="var(--color-ink)" strokeLinejoin="round" strokeWidth="4" />
        <text x="-1" y="82" className="font-mono" fontSize="12" fontWeight="700" letterSpacing="1.5">
          START HERE
        </text>
      </g>

      <g transform="translate(244 274)">
        <rect width="116" height="96" rx="28" fill="var(--color-quest-purple)" stroke="var(--color-ink)" strokeWidth="4" />
        <circle cx="42" cy="42" r="14" fill="var(--color-quest-yellow)" stroke="var(--color-ink)" strokeWidth="3" />
        <circle cx="76" cy="42" r="14" fill="var(--color-quest-blue)" stroke="var(--color-ink)" strokeWidth="3" />
        <path d="M20 79c4-18 15-27 32-27s29 9 34 27M49 79c4-18 15-27 32-27 10 0 19 4 25 12" fill="white" stroke="var(--color-ink)" strokeLinecap="round" strokeWidth="4" />
        <rect x="17" y="81" width="82" height="29" rx="12" fill="white" stroke="var(--color-ink)" strokeWidth="4" />
        <text x="31" y="100" className="font-display" fontSize="15" fontWeight="800">
          MEET UP
        </text>
      </g>

      <g transform="translate(448 112)">
        <path d="M15 28h72v53a24 24 0 0 1-24 24H39a24 24 0 0 1-24-24Z" fill="var(--color-quest-orange)" stroke="var(--color-ink)" strokeLinejoin="round" strokeWidth="4" />
        <path d="M87 42h10a18 18 0 0 1 0 36H87" fill="none" stroke="var(--color-ink)" strokeWidth="4" />
        <path d="M31 13c0 8-7 9-7 17M52 13c0 8-7 9-7 17M73 13c0 8-7 9-7 17" fill="none" stroke="var(--color-ink)" strokeLinecap="round" strokeWidth="4" />
        <path d="M5 105h96" stroke="var(--color-ink)" strokeLinecap="round" strokeWidth="4" />
        <text x="16" y="129" className="font-mono" fontSize="12" fontWeight="700" letterSpacing="1.5">
          DESTINATION
        </text>
      </g>

      <g transform="translate(168 120) rotate(-6)">
        <rect width="165" height="66" rx="18" fill="var(--color-quest-pink)" stroke="var(--color-ink)" strokeWidth="4" />
        <text x="18" y="27" fill="white" className="font-mono" fontSize="12" fontWeight="700" letterSpacing="1.5">
          TODAY&apos;S CLUE
        </text>
        <text x="18" y="49" fill="white" className="font-display" fontSize="17" fontWeight="800">
          Follow curiosity
        </text>
      </g>
    </svg>
  );
}