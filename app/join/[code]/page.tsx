"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    // Remember the code so we can join after they sign up / log in
    try {
      localStorage.setItem("pendingInvite", String(code).toUpperCase());
    } catch {}

    supabase.auth.getUser().then(({ data }) => {
      router.replace(data.user ? "/friends" : "/login");
    });
  }, [code, router]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-6 text-center">
      <p className="text-neutral-400">Joining your friend's circle…</p>
    </main>
  );
}