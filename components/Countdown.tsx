"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/time";

type Props = {
  to: Date | string;       // when the timer ends
  expiredText?: string;    // what to show after it ends
  className?: string;
};

// A live countdown that updates every second. Drop it anywhere: <Countdown to={someDate} />
export default function Countdown({ to, expiredText = "time's up", className }: Props) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = target - now;
  return (
    <span className={className} suppressHydrationWarning>
      {left > 0 ? formatCountdown(left) : expiredText}
    </span>
  );
}
