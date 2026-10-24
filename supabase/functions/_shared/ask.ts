// Everything the sage function does between "here is the request body" and "here is the reply",
// with Groq and the party lookup passed in, so tests can run the whole path with Groq mocked.
import type { ChatRequest } from "./groq.ts";
import { tidy } from "./groq.ts";
import { reviewMessage, userMessage } from "./message.ts";
import { PERSONAS, resolveMode, type SageStyle, systemPrompt, temperatureFor, voiceReminder } from "./personas.ts";
import { type ChatKind, chatKind } from "./smalltalk.ts";
import { dropClosers, hasLabels, pickSource, splitReply } from "./reply.ts";
import { checkSheet, findingsSource, labelledSheet, parseBrief, readSheet, type Severity } from "./sheet_check.ts";
import { srd } from "./srd.ts";
import { hybridSearch, type SemanticSearch } from "./hybrid.ts";
import { historyMessages, isFollowUp, readHistory } from "./history.ts";
import { text } from "./http.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Questions that are about the table as a whole get the party's sheets as context.
const ABOUT_PARTY = /\b(party|we|our|us|everyone|everybody|anyone|anybody|who|group|team|together|all of)\b/i;
// "Check my sheet", "What do you think of my character sheet": a sheet review. The sheet checker
// finds the problems; the model only explains them. The question has to name the sheet and ask
// for a verdict, so "does my character add proficiency to the check" stays a rules question.
const SHEETY = /\b(sheet|playersheet|charsheet|build|stats|ability scores)\b/i;
const CHARY = /\b(?!chapter|chatter)cha[a-z]{0,4}ters?\b|\bcaracters?\b|\bpc\b/i;
const STRONG = /\b(check (?:my|the|over|out|this)|review|look (?:over|at)|wrong|mistakes?|errors?|fix (?:my|the|this)|problems?|issues?|think (?:of|about)|what do you think|thoughts?|opinion|rate|rating|feedback|critique)\b/i;
const WEAK = /\b(legal|valid|correct|good|ok|okay|fine|looks?)\b/i;
const BARE_SHEET = /^\W*(?:(?:is|how's|hows|how is)\s+)?(?:my|the)\s+(?:character\s+|player\s*)?sheet\W*(?:ok(?:ay)?|good|fine|right)?\W*$/i;

export function isSheetReview(question: string): boolean {
  const sheety = SHEETY.test(question);
  const chary = CHARY.test(question);
  if (STRONG.test(question) && (sheety || chary)) return true;
  if (WEAK.test(question) && (sheety || (chary && question.split(/\s+/).length <= 7))) return true;
  return BARE_SHEET.test(question);
}

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
  /** "hybrid" when meaning search took part, "keyword" when it was off or failed, "none" for small talk,
   *  "sheet" for a sheet review (the checker's findings, no SRD search). */
  retrieval: "hybrid" | "keyword" | "none" | "sheet";
  /** True when the model wrote "Fix:" / "Suggestion:" labels and the safety net removed them (the evals fail on it). */
  labelsStripped: boolean;
  /** A sheet review's findings from the checker; absent otherwise. */
  findings?: { severity: Severity; field: string; problem: string }[];
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
  // The structured sheet from the app (body.character); older apps only send the short brief.
  const structured = readSheet(body.character);
  const sheetData = structured ?? (sheet ? parseBrief(sheet) : null);
  const sheetText = structured ? labelledSheet(structured) : sheet;
  const review = !kind && !!sheetData && persona.mode !== "scribe" && isSheetReview(question);
  const reminder = voiceReminder(persona.mode, style, review);
  const finish = (content: string) => (reminder ? `${content}\n\n${reminder}` : content);
  const talk = async (content: string) =>
    tidy(
      await deps.chat({
        model: persona.model,
        temperature: temperatureFor(persona.mode, style),
        maxTokens: persona.maxTokens,
        messages: [
          { role: "system", content: systemPrompt(persona.mode, style) },
          ...historyMessages(history),
          // The voice reminder is the very last thing the model reads before it answers.
          { role: "user", content: finish(content) },
        ],
      }),
    );

  if (review) {
    // The checker decides what is wrong; the model explains it. No SRD search, and the footer
    // comes from the findings, never from the model.
    const findings = checkSheet(sheetData!);
    const raw = await talk(reviewMessage(question, sheetText, findings));
    // splitReply also strips any "Fix:" / "Suggestion:" labels the model still wrote.
    const reply = dropClosers(splitReply(raw).text);
    if (!reply) return { code: "empty_reply", error: "The Sage had nothing to say. Try asking another way." };
    const refs = [...new Map(findings.map((f) => [f.ref.title, f.ref])).values()];
    return {
      mode: persona.mode,
      persona: persona.name,
      reply,
      source: findingsSource(findings),
      sources: refs.map((r) => ({ title: r.title, citation: `SRD 5.2.1, ${r.title}, p. ${r.page}`, page: r.page })),
      corrections: [],
      grounded: true,
      smallTalk: false,
      chat: null,
      retrieval: "sheet",
      labelsStripped: hasLabels(raw),
      findings: findings.map(({ severity, field, problem }) => ({ severity, field, problem })),
    };
  }

  // "What about at level 5?" searches with the previous question's words too.
  const context = history.length && isFollowUp(question) ? history[history.length - 1].q : undefined;
  const found = kind
    ? null
    : await hybridSearch(srd, question, { limit: persona.srdLimit, semantic: deps.semantic, context });
  const party = found && partyId && ABOUT_PARTY.test(question) ? await deps.party(partyId) : "";
  const chat = kind ? { kind, hasHistory: history.length > 0 } : null;

  const raw = await talk(userMessage(question, found, found ? sheetText : "", party, chat));
  // The spoken answer and its short source note ("Alignment, p. 21") travel separately, so
  // text to speech never reads citations aloud. The footer names only extracts the model was
  // given; chat, lore, homebrew and declines get none.
  const split = splitReply(raw);
  const reply = persona.mode === "scribe" ? split.text : dropClosers(split.text);
  if (!reply) return { code: "empty_reply", error: "The Sage had nothing to say. Try asking another way." };
  const source = found && persona.mode !== "scribe" ? pickSource(split.source, reply, found.hits) : "";

  return {
    mode: persona.mode,
    persona: persona.name,
    reply,
    source,
    sources: found?.hits.map((hit) => ({ title: hit.title, citation: hit.citation, page: hit.page })) ?? [],
    corrections: found?.corrections ?? [],
    grounded: found?.grounded ?? false,
    smallTalk: !found,
    chat: kind,
    retrieval: found?.retrieval ?? "none",
    labelsStripped: hasLabels(raw),
  };
}
