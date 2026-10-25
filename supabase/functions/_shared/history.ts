// Short conversation memory for the Sage: the last few exchanges of the current Sage session.
// The app keeps them in memory only and sends them with each question; nothing is stored here.
import type { ChatMessage } from "./groq.ts";

export type Turn = { q: string; a: string };

export const MAX_TURNS = 3;
/** About 600 tokens of history in total (roughly 4 characters a token). */
export const MAX_HISTORY_CHARS = 2400;
const MAX_Q = 300;
const MAX_A = 500;

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** The usable history from a request body: last 3 exchanges, clipped, oldest dropped first to fit. */
export function readHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  const turns: Turn[] = [];
  for (const item of raw.slice(-MAX_TURNS)) {
    if (!item || typeof item !== "object") continue;
    const { q, a } = item as Record<string, unknown>;
    if (typeof q !== "string" || typeof a !== "string" || !q.trim() || !a.trim()) continue;
    turns.push({ q: clip(q, MAX_Q), a: clip(a, MAX_A) });
  }
  const size = () => turns.reduce((sum, t) => sum + t.q.length + t.a.length, 0);
  while (turns.length && size() > MAX_HISTORY_CHARS) turns.shift();
  return turns;
}

const FOLLOW_LEAD = /^(and|but|also|so|then|what about|how about|what if|same|does it|do they|is it|can it|can they|at level|at higher|with)\b/;
const PRONOUN = /\b(it|its|that|this|they|them|those|these|he|she|him|her|one)\b/;

// Words that carry no rules topic of their own. A message made only of these ("what must I do",
// "where must I", "so how?") says nothing searchable: alone it is a cut-off question, after an
// answer it leans on that answer.
const FILLER = new Set(
  ("what where when why who how which whats wheres hows must should shall can could would will do does did " +
    "i im i'm me my we us our you your so then now next ok okay well um uh the a an to it is am are be " +
    "there here this that please again more just")
    .split(" "),
);

function words(question: string): string[] {
  return question.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

/** Four words or fewer and nothing but filler: "where must I", "what must I do", "now what". */
export function isVague(question: string): boolean {
  const list = words(question);
  return list.length > 0 && list.length <= 4 && list.every((w) => FILLER.has(w));
}

/** A short message that leans on the last one: "what about at level 5?", "does it stack?", "what must I do?". */
export function isFollowUp(question: string): boolean {
  const list = words(question);
  if (!list.length || list.length > 10) return false;
  const text = list.join(" ");
  return FOLLOW_LEAD.test(text) || PRONOUN.test(text) || isVague(question);
}

/** Earlier exchanges as chat turns, before the new question. */
export function historyMessages(turns: Turn[]): ChatMessage[] {
  return turns.flatMap((t): ChatMessage[] => [
    { role: "user", content: `Question: ${t.q}` },
    { role: "assistant", content: t.a },
  ]);
}
