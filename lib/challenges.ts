export type Challenge = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  type: "solo" | "duo" | "circle";
  points: number;
};

export const CHALLENGES: Challenge[] = [
  {
    id: "cafe-swap",
    emoji: "☕",
    title: "Café Swap",
    description:
      "Visit a café with a friend. Each of you ask the barista for a recommendation, then order it for the other person.",
    type: "duo",
    points: 20,
  },
  {
    id: "compliment-chain",
    emoji: "💬",
    title: "Compliment Chain",
    description:
      "Give 3 genuine compliments today: one to a friend, one to a classmate or coworker, and one to a stranger.",
    type: "solo",
    points: 20,
  },
  {
    id: "ask-a-local",
    emoji: "🗺️",
    title: "Ask a Local",
    description:
      "Ask someone you don't know (a librarian, shop owner, barista) for a recommendation, and write down what they said.",
    type: "solo",
    points: 25,
  },
  {
    id: "duo-snap",
    emoji: "📸",
    title: "Daily Duo Snap",
    description:
      "You and a circle friend both post a photo of what you're doing right now. Places and things only, no strangers.",
    type: "duo",
    points: 15,
  },
  {
    id: "scavenger-snap",
    emoji: "🔎",
    title: "Scavenger Snap",
    description:
      "Find and photograph: a dog, a mural, something older than you, a handwritten sign, and something purple.",
    type: "circle",
    points: 30,
  },
  {
    id: "skill-swap",
    emoji: "🎓",
    title: "Skill Swap",
    description:
      "Teach a friend something in 15 minutes: a card trick, a phrase in another language, a recipe step. Then swap.",
    type: "duo",
    points: 25,
  },
  {
    id: "good-deed-duo",
    emoji: "🌱",
    title: "Good Deed Duo",
    description:
      "Do something kind together: pick up litter for 15 minutes, leave an encouraging note, or help a neighbor.",
    type: "duo",
    points: 30,
  },
];

// Same "random" challenge for everyone on a given day, so friends get the same one
export function challengeOfTheDay(date = new Date()): Challenge {
  const key = date.toLocaleDateString("en-CA"); // e.g. 2026-09-26
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CHALLENGES[hash % CHALLENGES.length];
}