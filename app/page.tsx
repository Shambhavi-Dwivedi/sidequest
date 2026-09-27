"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Icon, OceanBackdrop } from "@/components/ui";

// Intro / splash screen (Figma: IntroScreen)
export default function IntroPage() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function start() {
    if (leaving) return;
    setLeaving(true);
    const { data } = await supabase.auth.getUser();
    let next = "/login";
    if (data.user) {
      const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
      next = profile ? "/home" : "/onboarding";
    }
    window.setTimeout(() => router.push(next), 450);
  }

  const floaty = "absolute grid place-items-center border-2 border-black shadow-[3px_3px_0_#000] transition-all duration-500 max-sm:hidden";

  return (
    <div className="mission-shell theme-intro min-h-screen overflow-hidden text-black">
      <OceanBackdrop />
      <section
        className={`relative z-10 flex min-h-screen items-center justify-center overflow-hidden px-4 transition-all duration-500 ${
          leaving ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <span aria-hidden="true" className={`${floaty} left-[8%] top-[18%] h-16 w-16 rounded-full bg-discovery ${leaving ? "-translate-x-8 -translate-y-8 opacity-0" : ""}`}>
          <Icon name="anchor" className="h-7 w-7" />
        </span>
        <span aria-hidden="true" className={`${floaty} right-[8%] top-[22%] h-14 w-14 rounded-full bg-progress delay-75 ${leaving ? "translate-x-8 -translate-y-8 opacity-0" : ""}`}>
          <Icon name="treasure" className="h-5 w-5" />
        </span>
        <span aria-hidden="true" className={`${floaty} bottom-[18%] left-[10%] h-14 w-14 rotate-12 rounded-xl bg-challenge delay-100 ${leaving ? "-translate-x-8 translate-y-8 opacity-0" : ""}`}>
          <Icon name="map" className="h-6 w-6" />
        </span>
        <span aria-hidden="true" className={`${floaty} bottom-[20%] right-[10%] h-16 w-16 rounded-full bg-community text-white delay-150 ${leaving ? "translate-x-8 translate-y-8 opacity-0" : ""}`}>
          <Icon name="compass" className="h-7 w-7" />
        </span>

        <button
          onClick={start}
          disabled={leaving}
          className="group relative z-10 flex w-full max-w-[620px] flex-col items-center rounded-[36px] px-5 py-10 text-center sm:px-10 sm:py-14"
          aria-label="Tap to get started with ConQuest"
        >
          <span className="relative grid h-40 w-40 place-items-center overflow-hidden rounded-[40px] border-2 border-black shadow-[7px_7px_0_#000] transition group-hover:-translate-y-1 sm:h-44 sm:w-44">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ConQuest logo" className="h-full w-full object-cover" />
          </span>

          <h1 className="map-title mt-8 font-display text-[clamp(3.8rem,18vw,6.5rem)] leading-none">
            Con<span className="title-accent">Quest</span>
          </h1>
          <p className="mt-4 font-display text-xl font-bold sm:text-2xl">Go further. Get closer.</p>

          <span className="quest-button mt-8 flex min-w-[240px] items-center justify-center gap-3 px-7 py-4 text-base font-bold">
            Tap to get started
            <Icon name="arrow" className="h-5 w-5 transition group-hover:translate-x-1" />
          </span>
        </button>
      </section>
    </div>
  );
}
