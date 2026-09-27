// How long two friends have to finish a mission after accepting it (change this if you like)
export const MISSION_HOURS = 48;

// Midnight tonight, local time (when the next daily challenge appears)
export function nextMidnight() {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d;
}

// 2d 4h  /  5h 12m  /  12m 05s
export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
}

export const isExpired = (due: string | null) => !!due && new Date(due).getTime() <= Date.now();
