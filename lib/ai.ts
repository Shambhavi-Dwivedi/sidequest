// Server-side only: never import this file into a "use client" page.

type Provider = { name: string; baseUrl: string; apiKey?: string; model: string };

const providers: Provider[] = [
  {
    name: "meta",
    baseUrl: "https://api.meta.ai/v1",
    apiKey: process.env.META_API_KEY,
    model: process.env.META_MODEL || "muse-spark-1.1",
  },
  {
    name: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
    model: "qwen/qwen3.8-27b", // handles text and images
  },
].filter((p) => p.apiKey); // skip any provider without a key

type AskOptions = {
  instructions: string; // who the AI is and how to behave
  prompt: string;       // the specific request
  imageUrl?: string;    // optional photo to look at
};

// Pull the JSON object out of the reply, even if the model adds extra text or "thinking"
export function parseJSON<T>(text: string): T {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

export async function askAI({ instructions, prompt, imageUrl }: AskOptions) {
  if (providers.length === 0) throw new Error("No AI keys found in .env.local");

  const fullText = `${instructions}\n\n${prompt}\n\nRespond with a single JSON object only, no other text.`;
  const content = imageUrl
    ? [
        { type: "text", text: fullText },
        { type: "image_url", image_url: { url: imageUrl } },
      ]
    : fullText;

  let lastError: unknown;

  for (const p of providers) {
    try {
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${p.apiKey}`,
        },
        body: JSON.stringify({
          model: p.model,
          messages: [{ role: "user", content }],
        }),
        signal: AbortSignal.timeout(25000), // give up after 25s and try the backup
      });

      if (!res.ok) throw new Error(`${p.name} ${res.status}: ${await res.text()}`);

      const data = await res.json();
      return { text: data.choices[0].message.content as string, provider: p.name };
    } catch (err) {
      console.error(`AI provider "${p.name}" failed:`, err);
      lastError = err;
    }
  }

  throw lastError;
}
