"use client";

import { AppShell, Icon, ScreenHeading, type IconName } from "@/components/ui";

const DETAILS: { color: string; icon: IconName; title: string; copy: string }[] = [
  {
    color: "#2A9DBB",
    icon: "compass",
    title: "Pick a direction",
    copy: "Tell us your interests, goals, comfort level, and who you want to explore with.",
  },
  {
    color: "#F2C14E",
    icon: "spark",
    title: "Get a ConQuest",
    copy: "Receive a small real-world challenge designed around the things you and a friend actually enjoy.",
  },
  {
    color: "#B9D8C2",
    icon: "people",
    title: "Share the story",
    copy: "Check in, keep a streak, and let your circle celebrate the brave little moments.",
  },
];

// Figma: AboutScreen
export default function AboutPage() {
  return (
    <AppShell theme="theme-about">
      <section className="mx-auto max-w-[1120px]">
        <ScreenHeading
          number="?"
          eyebrow="About the adventure"
          title="Less scrolling. More stories."
          copy="ConQuest turns social confidence into a colorful map of small, real-world adventures."
        />
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {DETAILS.map((item, index) => (
            <article key={item.title} className="panel-3d overflow-hidden p-7">
              <div
                className="grid h-14 w-14 place-items-center rounded-full border-2 border-black shadow-[3px_3px_0_#000]"
                style={{ backgroundColor: item.color }}
              >
                <Icon name={item.icon} className="h-6 w-6" />
              </div>
              <p className="mt-8 font-mono text-xs font-bold uppercase tracking-[.15em]">Stop 0{index + 1}</p>
              <h2 className="raised-type font-display mt-2 text-2xl font-bold">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-black">{item.copy}</p>
            </article>
          ))}
        </div>

        <div className="panel-3d mt-6 p-7">
          <p className="font-mono text-xs font-bold uppercase tracking-[.15em]">Safe by design</p>
          <ul className="mt-3 grid gap-2 text-sm leading-6 sm:grid-cols-2">
            <li>• Photos show places and things, never strangers.</li>
            <li>• Locations are approximate and always optional.</li>
            <li>• Meeting new people is 18+ only.</li>
            <li>• AI suggests a retake instead of calling anyone a cheater. Friends can always vouch.</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-5 rounded-[24px] border-2 border-black bg-quest-purple p-7 text-white shadow-[4px_4px_0_#000] sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-2xl font-bold text-white">The destination is connection.</p>
            <p className="mt-1 text-sm text-white/85">The points just make the trip more fun.</p>
          </div>
          <Icon name="compass" className="h-12 w-12 shrink-0" />
        </div>
      </section>
    </AppShell>
  );
}
