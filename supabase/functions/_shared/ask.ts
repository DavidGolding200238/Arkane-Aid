// Everything the sage function does between "here is the request body" and "here is the reply",
// with Groq and the party lookup passed in, so tests can run the whole path with Groq mocked.
import type { ChatRequest } from "./groq.ts";
import { tidy } from "./groq.ts";
import { userMessage } from "./message.ts";
import { PERSONAS, resolveMode, type SageStyle, systemPrompt, temperatureFor } from "./personas.ts";
import { type ChatKind, chatKind } from "./smalltalk.ts";
import { splitReply } from "./reply.ts";
import { srd } from "./srd.ts";
import { hybridSearch, type SemanticSearch } from "./hybrid.ts";
import { historyMessages, isFollowUp, readHistory } from "./history.ts";
import { text } from "./http.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Questions that are about the table as a whole get the party's sheets as context.
const ABOUT_PARTY = /\b(party|we|our|us|everyone|everybody|anyone|anybody|who|group|team|together|all of)\b/i;
// "Check my sheet and tell me what's wrong": the question names no rule, so the search also
// looks for the character creation rules a sheet is checked against.
const SHEET_REVIEW = /\b(check|review|look over|look at|wrong|mistakes?|errors?|legal|valid|fix|problems?|issues?|correct)\b/i;
const SHEET_RULES = "create your character step ability scores adjust ability scores above 20";

export type AskDeps = {
  /** One Groq chat call (groq.ts chat with the key bound, or a mock). */
  chat: (request: ChatRequest) => Promise<string>;
  /** The party's sheets as text, read as the caller. */
  party: (partyId: string) => Promise<string>;
  /** Meaning search (gte-small + pgvector). Missing or failing means keyword search only. */
  semantic?: SemanticSearch;
};

export type AskReply = {
  mode: string;
  persona: string;
  /** The answer to show and read aloud, with no citations in it. */
  reply: string;
  /** Short source note for the card footer, e.g. "Alignment, p. 21". Never spoken. "" when none. */
  source: string;
  sources: { title: string; citation: string; page: number }[];
  corrections: { from: string; to: string }[];
  grounded: boolean;
  smallTalk: boolean;
  /** The kind of chat when the message was small talk (greeting, thanks, farewell, chat), else null. */
  chat: ChatKind | null;
  /** "hybrid" when meaning search took part, "keyword" when it was off or failed, "none" for small talk. */
  retrieval: "hybrid" | "keyword" | "none";
};

export type AskError = { error: string; code: "bad_request" | "empty_reply" };

export async function ask(body: Record<string, unknown>, deps: AskDeps): Promise<AskReply | AskError> {
  const resolved = resolveMode(body.mode ?? body.persona);
  if (!resolved) return { code: "bad_request", error: "Unknown mode. Use sage, scribe or bard." };
  const persona = PERSONAS[resolved.mode];
  const style: SageStyle = resolved.style ?? (body.style === "wizard" ? "wizard" : "plain");

  const question = text(body.question, 1500);
  if (!question) return { code: "bad_request", error: "Ask a question first." };
  const sheet = text(body.sheet, 2000);
  const partyId = typeof body.partyId === "string" && UUID.test(body.partyId) ? body.partyId : null;

  // Greetings, thanks, reactions ("damn", "wow") and casual chat are answered in character
  // without searching the SRD (a fuzzy search on "Hello" only finds noise), but they keep the
  // short memory so "Damn" after a ruling reacts to that ruling instead of greeting again.
  // Same check for every persona and style.
  const kind = chatKind(question);
  // Short memory: the last few exchanges of this Sage session, sent by the app. The Scribe
  // writes one-off notes, so it gets none.
  const history = persona.mode === "scribe" ? [] : readHistory(body.history);
  const review = !kind && !!sheet && SHEET_REVIEW.test(question);
  // "What about at level 5?" searches with the previous question's words too.
  const context = review
    ? SHEET_RULES
    : history.length && isFollowUp(question)
    ? history[history.length - 1].q
    : undefined;
  const found = kind
    ? null
    : await hybridSearch(srd, question, { limit: persona.srdLimit, semantic: deps.semantic, context });
  const party = found && partyId && ABOUT_PARTY.test(question) ? await deps.party(partyId) : "";
  const chat = kind ? { kind, hasHistory: history.length > 0 } : null;

  const raw = tidy(
    await deps.chat({
      model: persona.model,
      temperature: temperatureFor(persona.mode, style),
      maxTokens: persona.maxTokens,
      messages: [
        { role: "system", content: systemPrompt(persona.mode, style) },
        ...historyMessages(history),
        { role: "user", content: userMessage(question, found, found ? sheet : "", party, chat, review) },
      ],
    }),
  );
  // The spoken answer and its short source note ("Alignment, p. 21") travel separately, so
  // text to speech never reads citations aloud.
  const { text: reply, source } = splitReply(raw);
  if (!reply) return { code: "empty_reply", error: "The Sage had nothing to say. Try asking another way." };

  return {
    mode: persona.mode,
    persona: persona.name,
    reply,
    source: found ? source : "",
    sources: found?.hits.map((hit) => ({ title: hit.title, citation: hit.citation, page: hit.page })) ?? [],
    corrections: found?.corrections ?? [],
    grounded: found?.grounded ?? false,
    smallTalk: !found,
    chat: kind,
    retrieval: found?.retrieval ?? "none",
  };
}
