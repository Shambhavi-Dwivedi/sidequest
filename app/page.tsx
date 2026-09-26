"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Start() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      router.replace(data.user ? "/home" : "/login");
    });
  }, [router]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
      <p className="text-neutral-400">Loading SideQuest…</p>
    </main>
  );
}
