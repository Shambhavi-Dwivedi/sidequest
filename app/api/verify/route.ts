import { askAI, parseJSON } from "@/lib/ai";
import { CHALLENGES } from "@/lib/challenges";

type AIVerdict = {
  verified: boolean;
  confidence?: number;
  has_faces?: boolean;
  feedback?: string;
};

export async function POST(req: Request) {
  const { imageUrl, challengeId } = await req.json();

  const challenge = CHALLENGES.find((c) => c.id === challengeId);
  if (!challenge || !challenge.aiCheck) {
    return Response.json({ error: "This challenge isn't photo-verified" }, { status: 400 });
  }

  // Only check photos stored in our own Supabase, not random links from the internet
  const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/`;
  if (typeof imageUrl !== "string" || !imageUrl.startsWith(storageUrl)) {
    return Response.json({ error: "Invalid photo" }, { status: 400 });
  }

  try {
    const { text, provider } = await askAI({
      instructions:
        "You check photo proof for SideQuest, a friendly app where friends do small real-life challenges. " +
        "Be encouraging and fairly lenient. Judge only what is visible in the photo.",
      prompt:
        `Challenge: "${challenge.title}". The photo should show: ${challenge.aiCheck}.\n` +
        'Return JSON exactly like: {"verified": true or false, "confidence": 0 to 1, ' +
        '"has_faces": true or false, "feedback": "one short, warm sentence to the user"}.\n' +
        "Set verified to true if the photo plausibly shows this. " +
        "If it is a screenshot, meme, blank, or unrelated, set verified to false and suggest what a better photo would show. " +
        "Set has_faces to true if any person's face is clearly identifiable.",
      imageUrl,
    });

    const v = parseJSON<AIVerdict>(text);
    return Response.json({
      verified: !!v.verified,
      hasFaces: !!v.has_faces,
      feedback: v.feedback ?? (v.verified ? "Nice work!" : "Hmm, I couldn't quite tell. Try another angle?"),
      provider,
    });
  } catch (err) {
    console.error("Photo check failed:", err);
    return Response.json(
      { error: "The AI check is busy right now. Ask a friend to confirm instead!" },
      { status: 502 }
    );
  }
}