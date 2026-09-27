import { createClient } from "@/lib/supabase-server";
import { askAI, parseJSON } from "@/lib/ai";
import { CHALLENGES } from "@/lib/challenges";

type Person = {
  id: string;
  name: string;
  age: number | null;
  bio: string | null;
  goals: string[] | null;
  interests: string[] | null;
  comfort_level: number | null;
};

type AIMission = {
  emoji?: string;
  title?: string;
  description?: string;
  reason?: string;
  difficulty?: number;
  points?: number;
  proof?: string;
  ai_check?: string;
};

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : fallback;
};

function describe(p: Person) {
  return [
    `${p.name}${p.age ? ` (age ${p.age})` : ""}`,
    `interests: ${(p.interests ?? []).join(", ") || "not listed"}`,
    `comfort level: ${p.comfort_level ?? 1}/3 (1 = low-key with friends, 3 = bold)`,
    `goals: ${(p.goals ?? []).join(", ") || "not listed"}`,
    p.bio ? `bio: "${p.bio}"` : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function POST(req: Request) {
  const { partnerId } = await req.json();
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Please log in again" }, { status: 401 });
  const me = auth.user.id;
  if (!partnerId || partnerId === me) return Response.json({ error: "Pick a friend" }, { status: 400 });

  // Both people's profiles
  const { data: people } = await supabase
    .from("profiles")
    .select("id, name, age, bio, goals, interests, comfort_level")
    .in("id", [me, partnerId]);
  const meP = people?.find((p) => p.id === me) as Person | undefined;
  const them = people?.find((p) => p.id === partnerId) as Person | undefined;
  if (!meP || !them) return Response.json({ error: "Couldn't find both profiles" }, { status: 404 });

  // Both people's recent reflections
  const { data: recent } = await supabase
    .from("check_ins")
    .select("user_id, title, challenge_id, reflection")
    .in("user_id", [me, partnerId])
    .not("reflection", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  const reflections =
    (recent ?? [])
      .map((r) => `- ${r.user_id === me ? meP.name : them.name} after "${r.title ?? r.challenge_id}": "${r.reflection}"`)
      .join("\n") || "(no reflections yet)";

  // Missions they've already had, to avoid repeats
  const { data: past } = await supabase
    .from("missions")
    .select("title")
    .or(`created_by.eq.${me},partner_id.eq.${me}`)
    .order("created_at", { ascending: false })
    .limit(10);
  const pastTitles = (past ?? []).map((m) => m.title).join(", ") || "none";

  let rows: Record<string, unknown>[] = [];
  let source = "ai";

  try {
    const { text } = await askAI({
      instructions:
        "You are ConQuest's mission planner. ConQuest helps friends turn 'we should hang out' into real, in-person plans. " +
        "You design small missions for two specific friends to do together.",
      prompt: `Friend 1: ${describe(meP)}
Friend 2: ${describe(them)}

Their recent reflections (most recent first):
${reflections}

Missions they've already had (don't repeat these): ${pastTitles}

Create exactly 3 missions for ${meP.name} and ${them.name} to do TOGETHER, in person, this week.
Rules:
- Blend both people's interests. If there are reflections, at least one mission should build on something they wrote.
- Match the LOWER of their two comfort levels. One mission may stretch one step higher.
- Safe, legal, free or cheap, and doable in 1 to 2 hours in a normal town or city.
- Never ask anyone to photograph strangers or their faces.
- "reason" must mention both names and say specifically why this fits them (their interests or what they wrote).
- "proof": "photo" if a photo of a place or object could show it was done, otherwise "partner".
- "ai_check": for photo missions, what the photo should show (places or objects only). Use "" for partner missions.
- "difficulty": 1, 2, or 3. "points": 15 to 40, higher for harder missions.

Return JSON exactly like:
{"missions": [{"emoji": "☕", "title": "", "description": "", "reason": "", "difficulty": 1, "points": 20, "proof": "photo", "ai_check": ""}]}`,
    });

    const parsed = parseJSON<{ missions?: AIMission[] }>(text);
    rows = (parsed.missions ?? [])
      .filter((m) => m.title && m.description)
      .slice(0, 3)
      .map((m) => {
        const proof = m.proof === "partner" ? "partner" : "photo";
        return {
          created_by: me,
          partner_id: partnerId,
          emoji: m.emoji || "✨",
          title: m.title,
          description: m.description,
          reason: m.reason ?? null,
          difficulty: clamp(m.difficulty, 1, 3, 1),
          points: clamp(m.points, 15, 40, 20),
          proof,
          ai_check: proof === "photo" ? m.ai_check || m.title : null,
          status: "suggested",
        };
      });
    if (rows.length === 0) throw new Error("AI returned no missions");
  } catch (err) {
    // Backup plan: pick from the built-in challenge list so the app never breaks
    console.error("Mission planner fell back to built-in challenges:", err);
    source = "fallback";
    rows = [...CHALLENGES]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((c) => ({
        created_by: me,
        partner_id: partnerId,
        emoji: c.emoji,
        title: c.title,
        description: c.description,
        reason: `A ConQuest favorite for ${meP.name} and ${them.name}.`,
        difficulty: 1,
        points: c.points,
        proof: c.proof,
        ai_check: c.aiCheck ?? null,
        status: "suggested",
      }));
  }

  // Replace any old unpicked suggestions for this pair
  await supabase.from("missions").delete().eq("created_by", me).eq("partner_id", partnerId).eq("status", "suggested");

  const { data: saved, error } = await supabase.from("missions").insert(rows).select();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ missions: saved, source });
}
