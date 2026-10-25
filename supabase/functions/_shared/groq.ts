// Groq chat completions (OpenAI-compatible). The key is a Supabase function secret only.
const URL = "https://api.groq.com/openai/v1/chat/completions";
const FALLBACK_MODEL = "openai/gpt-oss-20b";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatRequest = {
  model: string;
  temperature: number;
  maxTokens: number;
  messages: ChatMessage[];
  /** false: when the big model is busy, fail instead of answering with the small one (rules answers). */
  fallback?: boolean;
};
/** The reply text and the model that wrote it. */
export type ChatAnswer = { text: string; model: string };

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

/** Rate-limited (429), a Groq server error (5xx), a timeout or a dropped connection. */
export function isBusy(error: unknown): boolean {
  return error instanceof GroqError ? error.status === 429 || error.status >= 500 : true;
}

/** One call, with a single retry on the small model when the big one is busy or rate-limited,
 *  unless the request says fallback: false. Returns the model that answered. */
export async function chatWithModel(key: string, request: ChatRequest): Promise<ChatAnswer> {
  try {
    return { text: await once(key, request), model: request.model };
  } catch (error) {
    if (!isBusy(error) || request.model === FALLBACK_MODEL || request.fallback === false) throw error;
    return { text: await once(key, { ...request, model: FALLBACK_MODEL }), model: FALLBACK_MODEL };
  }
}

/** chatWithModel, text only. */
export async function chat(key: string, request: ChatRequest): Promise<string> {
  return (await chatWithModel(key, request)).text;
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
