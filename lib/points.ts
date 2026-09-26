import { supabase } from "@/lib/supabase";

export const WEEKLY_CAP = 100;
export const DUO_BONUS = 10;

// YYYY-MM-DD in local time. offsetDays = -1 means yesterday.
export function dayString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-CA");
}

export const todayString = () => dayString(0);

// Monday of the current week
export function weekStart() {
  const d = new Date();
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d.toLocaleDateString("en-CA");
}

export async function weeklyPoints(userId: string) {
  const { data } = await supabase
    .from("check_ins")
    .select("points")
    .eq("user_id", userId)
    .gte("challenge_date", weekStart());
  return (data ?? []).reduce((sum, row) => sum + (row.points ?? 0), 0);
}
