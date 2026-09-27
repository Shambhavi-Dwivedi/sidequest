"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LoadingScreen } from "@/components/ui";

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

  return <LoadingScreen label="Joining your friend's circle…" theme="theme-friends" />;
}
