// Everything the sage function does between "here is the request body" and "here is the reply",
// with Groq and the party lookup passed in, so tests can run the whole path with Groq mocked.
import type { ChatAnswer, ChatRequest } from "./groq.ts";
import { isBusy, tidy } from "./groq.ts";
import { reviewMessage, userMessage } from "./message.ts";
import {
  type Flavour,
  flavourOf,
  PERSONAS,
  resolveMode,
  type SageStyle,
  systemPrompt,
  temperatureFor,
  voiceReminder,
} from "./personas.ts";
import { type ChatKind, chatKind } from "./smalltalk.ts";
import { dropClosers, hasLabels, pickSource, splitReply } from "./reply.ts";
import {
  checkSheet,
  findingsSource,
  isTemplate,
  labelledSheet,
  parseBrief,
  readSheet,
  type Severity,
  TEMPLATE_SHEET,
} from "./sheet_check.ts";
import { srd } from "./srd.ts";
import { hybridSearch, type SemanticSearch } from "./hybrid.ts";
import { historyMessages, isFollowUp, isVague, readHistory } from "./history.ts";
import { text } from "./http.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Questions that are about the table as a whole get the party's sheets as context.
const ABOUT_PARTY = /\b(party|we|our|us|everyone|everybody|anyone|anybody|who|group|team|together|all of)\b/i;
// "Check my sheet", "What do you think of my character sheet": a sheet review. The sheet checker
// finds the problems; the model only explains them. The question has to name the sheet and ask
// for a verdict, so "does my character add proficiency to the check" stays a rules question.
const SHEETY = /\b(sheet|playersheet|charsheet|build|stats|ability scores)\b/i;
const CHARY = /\b(?!chapter|chatter)cha[a-z]{0,4}ters?\b|\bcaracters?\b|\bpc\b/i;
const STRONG =
  /\b(check (?:my|the|over|out|this)|review|look (?:over|at)|wrong|mistakes?|errors?|fix (?:my|the|this)|problems?|issues?|think (?:of|about)|what do you think|thoughts?|opinion|rate|rating|feedback|critique)\b/i;
const WEAK = /\b(legal|valid|correct|good|ok|okay|fine|looks?)\b/i;
const BARE_SHEET =
  /^\W*(?:(?:is|how's|hows|how is)\s+)?(?:my|the)\s+(?:character\s+|player\s*)?sheet\W*(?:ok(?:ay)?|good|fine|right)?\W*$/i;

export function isSheetReview(question: string): boolean {
  const sheety = SHEETY.test(question);
  const chary = CHARY.test(question);
  if (STRONG.test(question) && (sheety || chary)) return true;
  if (WEAK.test(question) && (sheety || (chary && question.split(/\s+/).length <= 7))) return true;
  return BARE_SHEET.test(question);
}

// A sheet question with no saved sheet (the app sends none until "Save sheet"), or the untouched
// starting template saved as is: the Sage reviews the Ledger's blank template as INCOMPLETE. The
// reply is a fixed line per voice, never a model call, so no voice can praise a blank sheet or
// brush the player off. It names what is missing and where to fill it in.
const TEMPLATE_REVIEW: Record<Flavour, (party: boolean) => string> = {
  wizard: (party) =>
    "Thy sheet is still the Ledger's blank starting page, so it is not finished yet. It has no species, no class " +
    "and no name, all six ability scores still sit at 10, and no traits or features are written. Open the Ledger, " +
    "tap the quill, fill these in and press Save sheet" +
    (party ? "" : ". If thou playest with a party, join it on the Tome first, for each party keeps its own sheet") +
    ". Then ask me again and I shall read it gladly.",
  plain: (party) =>
    "Your sheet is still the blank starting template, so it's incomplete. It has no species, no class and no name, " +
    "all six ability scores are still 10, and no traits or features are written. Open the Ledger, tap the quill, " +
    "fill these in and press Save sheet" +
    (party ? "" : ". If you play with a party, join it on the Tome first, because each party keeps its own sheet") +
    ". Then ask me again and I'll review it.",
  bard: (party) =>
    "Your sheet's a blank page, your tale's still unsung! No species, no class and no name, all six scores still 10, " +
    "and no traits or features yet. Open the Ledger, tap the quill, fill these in and press Save sheet" +
    (party ? "" : ". Got a party? Join it on the Tome first, for each party keeps its own sheet") +
    ". Then ask again, and I'll sing what I see.",
};
/** Recognises a TEMPLATE_REVIEW reply in the history, so "what must I do?" after it gets the same steps. */
const NO_SHEET_MARK = /press Save sheet/;

// A cut-off question with nothing to lean on ("where must I"): ask again instead of guessing from
// a weak SRD match on filler words.
const SAY_AGAIN: Record<Flavour, string> = {
  wizard:
    "Forgive me, I caught only part of thy question. Ask it once more, and hold the orb until thou art done speaking.",
  plain: "I only caught part of that. Ask it again, and keep holding the orb until you finish speaking.",
  bard: "I caught but a scrap of that verse! Sing it again, and hold the orb till the very last word.",
};

// The big model is busy or rate-limited and the question is a rules question: the small fallback
// model makes rules up too often, so the Sage asks the player to try again instead.
export const BUSY: Record<Flavour, string> = {
  wizard: "Forgive me, the stars are crowded and my tome will not open just now. Ask me again in a moment.",
  plain: "The Sage is busy right now. Ask again in a moment.",
  bard: "My lute's mid-tune and the hall is packed! Ask again in a moment, friend.",
};

function fixedReply(mode: string, persona: string, reply: string): AskReply {
  return {
    mode,
    persona,
    reply,
    source: "",
    sources: [],
    corrections: [],
    grounded: true,
    smallTalk: false,
    chat: null,
    retrieval: "none",
    labelsStripped: false,
    model: "none",
  };
}

export type AskDeps = {
  /** One Groq chat call (groq.ts chatWithModel with the key bound, or a mock). A bare string
   *  means the requested model answered. */
  chat: (request: ChatRequest) => Promise<string | ChatAnswer>;
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
  /** The model that wrote the reply ("none" for a fixed reply with no model call). */
  model: string;
  /** True for the "Sage is busy, ask again" reply. */
  busy?: boolean;
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
  const talk = async (content: string, fallback = true): Promise<ChatAnswer> => {
    const answer = await deps.chat({
      model: persona.model,
      temperature: temperatureFor(persona.mode, style),
      maxTokens: persona.maxTokens,
      messages: [
        { role: "system", content: systemPrompt(persona.mode, style) },
        ...historyMessages(history),
        // The voice reminder is the very last thing the model reads before it answers.
        { role: "user", content: finish(content) },
      ],
      fallback,
    });
    return typeof answer === "string"
      ? { text: tidy(answer), model: persona.model }
      : { text: tidy(answer.text), model: answer.model };
  };

  const flavour = flavourOf(persona.mode, style);
  if (!kind && flavour && (!sheetData || isTemplate(sheetData))) {
    // A sheet question, or "where must I?" right after the template review, with still no sheet.
    const last = history[history.length - 1];
    const afterReview = !!last && NO_SHEET_MARK.test(last.a) && isFollowUp(question);
    if (isSheetReview(question) || afterReview) {
      const findings = checkSheet(TEMPLATE_SHEET);
      const refs = [...new Map(findings.map((f) => [f.ref.title, f.ref])).values()];
      return {
        ...fixedReply(persona.mode, persona.name, TEMPLATE_REVIEW[flavour](!!partyId)),
        source: findingsSource(findings),
        sources: refs.map((r) => ({ title: r.title, citation: `SRD 5.2.1, ${r.title}, p. ${r.page}`, page: r.page })),
        retrieval: "sheet",
        findings: findings.map(({ severity, field, problem }) => ({ severity, field, problem })),
      };
    }
  }
  if (!kind && flavour && !history.length && isVague(question)) {
    return fixedReply(persona.mode, persona.name, SAY_AGAIN[flavour]);
  }

  if (review) {
    // The checker decides what is wrong; the model explains it. No SRD search, and the footer
    // comes from the findings, never from the model.
    const findings = checkSheet(sheetData!);
    const { text: raw, model } = await talk(reviewMessage(question, sheetText, findings));
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
      model,
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

  // A rules answer (not chat, not the Scribe) never comes from the small fallback model.
  const rules = !!found && !!flavour;
  let answer: ChatAnswer;
  try {
    answer = await talk(userMessage(question, found, found ? sheetText : "", party, chat), !rules);
  } catch (error) {
    if (!rules || !isBusy(error)) throw error;
    return { ...fixedReply(persona.mode, persona.name, BUSY[flavour!]), grounded: false, busy: true };
  }
  const raw = answer.text;
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
    model: answer.model,
  };
}
