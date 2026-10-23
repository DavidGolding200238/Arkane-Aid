// Groq chat completions (OpenAI-compatible). The key is a Supabase function secret only.
const URL = "https://api.groq.com/openai/v1/chat/completions";
const FALLBACK_MODEL = "openai/gpt-oss-20b";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatRequest = { model: string; temperature: number; maxTokens: number; messages: ChatMessage[] };

export class GroqError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** One Groq call, no fallback (the eval uses it to score the real model). */
export async function once(key: string, request: ChatRequest): Promise<string> {
  const response = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: request.model,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      reasoning_effort: "low",
      messages: request.messages,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new GroqError(data?.error?.message ?? `Groq answered ${response.status}.`, response.status);
  }
  // Only the final answer. The model's private reasoning is never shown to players.
  return String(data?.choices?.[0]?.message?.content ?? "").trim();
}

/** One call, with a single retry on the small model when the big one is busy or rate-limited. */
export async function chat(key: string, request: ChatRequest): Promise<string> {
  try {
    return await once(key, request);
  } catch (error) {
    const busy = error instanceof GroqError ? error.status === 429 || error.status >= 500 : true;
    if (!busy || request.model === FALLBACK_MODEL) throw error;
    return await once(key, { ...request, model: FALLBACK_MODEL });
  }
}

/** Plain text for a parchment card and the speech engine: no markdown left over. */
export function tidy(reply: string): string {
  return reply
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
