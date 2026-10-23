// Everything the sage function does between "here is the request body" and "here is the reply",
// with Groq and the party lookup passed in, so tests can run the whole path with Groq mocked.
import type { ChatRequest } from "./groq.ts";
import { tidy } from "./groq.ts";
import { userMessage } from "./message.ts";
import { PERSONAS, resolveMode, type SageStyle, systemPrompt, temperatureFor } from "./personas.ts";
import { isSmallTalk } from "./smalltalk.ts";
import { srd } from "./srd.ts";
import { hybridSearch, type SemanticSearch } from "./hybrid.ts";
import { historyMessages, isFollowUp, readHistory } from "./history.ts";
import { text } from "./http.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Questions that are about the table as a whole get the party's sheets as context.
const ABOUT_PARTY = /\b(party|we|our|us|everyone|everybody|anyone|anybody|who|group|team|together|all of)\b/i;

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
  reply: string;
  sources: { title: string; citation: string; page: number }[];
  corrections: { from: string; to: string }[];
  grounded: boolean;
  smallTalk: boolean;
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

  // A message that is only a greeting or "thanks" is answered in character without searching
  // the SRD (a fuzzy search on "Hello" only finds noise). Anything with a question in it is searched.
  // Same check for every persona and style.
  const smallTalk = isSmallTalk(question);
  // Short memory: the last few exchanges of this Sage session, sent by the app. The Scribe
  // writes one-off notes, so it gets none; small talk does not need any either.
  const history = persona.mode === "scribe" || smallTalk ? [] : readHistory(body.history);
  // "What about at level 5?" searches with the previous question's words too.
  const context = history.length && isFollowUp(question) ? history[history.length - 1].q : undefined;
  const found = smallTalk
    ? null
    : await hybridSearch(srd, question, { limit: persona.srdLimit, semantic: deps.semantic, context });
  const party = found && partyId && ABOUT_PARTY.test(question) ? await deps.party(partyId) : "";

  const reply = tidy(
    await deps.chat({
      model: persona.model,
      temperature: temperatureFor(persona.mode, style),
      maxTokens: persona.maxTokens,
      messages: [
        { role: "system", content: systemPrompt(persona.mode, style) },
        ...historyMessages(history),
        { role: "user", content: userMessage(question, found, found ? sheet : "", party) },
      ],
    }),
  );
  if (!reply) return { code: "empty_reply", error: "The Sage had nothing to say. Try asking another way." };

  return {
    mode: persona.mode,
    persona: persona.name,
    reply,
    sources: found?.hits.map((hit) => ({ title: hit.title, citation: hit.citation, page: hit.page })) ?? [],
    corrections: found?.corrections ?? [],
    grounded: found?.grounded ?? false,
    smallTalk: !found,
    retrieval: found?.retrieval ?? "none",
  };
}
