// The user message the model sees: SRD extracts, possible spelling fixes, the sheet, the party.
import type { SearchResult } from "./retrieval.ts";
import { shortCitation } from "./reply.ts";
import type { ChatKind } from "./smalltalk.ts";
import { type Finding, findingsText } from "./sheet_check.ts";

/** Short notes for chat (no SRD block, so these stay cheap). How to chat is in the system prompt. */
export function chatNote(kind: ChatKind, hasHistory: boolean): string {
  const note = {
    greeting: hasHistory
      ? "The player says hello again mid-conversation. Reply in one short line and carry on; do not start over."
      : "The player greets you. Greet back in one short line and ask how you can help.",
    thanks:
      "The player thanks you. Take it warmly in a line, tied to what you just helped with if there was something.",
    farewell: "The player is saying goodbye. Bid them farewell in one short line.",
    chat: hasHistory
      ? "A reaction or casual chat, not a rules question and not a greeting. Answer it naturally, following on from what was just said. Do not greet."
      : "A reaction or casual chat, not a rules question and not a greeting. Answer it naturally and lightly offer to help. Do not greet.",
  }[kind];
  return `<chat>${note}</chat>`;
}

// Sheet reviews: the checker (sheet_check.ts) has already found what is wrong. The model only
// explains those findings in its voice; it never hunts for errors itself and gets no SRD text.
const ONLY =
  "Only mention the findings listed; never call anything else wrong; never mention creatures or monsters; player characters only.";
export const SHEET_REVIEW_NOTE =
  "<sheet_review>The app's sheet checker found the findings above. Explain them kindly, fixes first: what is off and how to fix it, " +
  `a short sentence or two each; suggestions are gentle and optional. ${ONLY} No Source line.</sheet_review>`;
export const SHEET_PRAISE_NOTE =
  "<sheet_review>The app's sheet checker found nothing to fix. Praise the sheet briefly, two sentences at most, naming one thing that works. " +
  `${ONLY} No Source line.</sheet_review>`;

/** The user message for a sheet review: the labelled sheet, the findings, and how to explain them. */
export function reviewMessage(question: string, sheet: string, findings: Finding[]): string {
  return [
    `<sheet>\n${sheet}\n</sheet>`,
    `<findings>\n${findingsText(findings)}\n</findings>`,
    findings.length ? SHEET_REVIEW_NOTE : SHEET_PRAISE_NOTE,
    `Question: ${question}`,
  ].join("\n\n");
}

export function userMessage(
  question: string,
  found: SearchResult | null,
  sheet: string,
  party: string,
  chat: { kind: ChatKind; hasHistory: boolean } | null = null,
): string {
  if (!found) return `${chatNote(chat?.kind ?? "chat", chat?.hasHistory ?? false)}\n\nMessage: ${question}`;
  const parts: string[] = [];
  if (found.hits.length) {
    // Short tags ("Alignment, p. 21") keep the prompt small and are what the Source line copies.
    const extracts = found.hits.map((hit) => `[${shortCitation(hit.citation)}]\n${hit.text}`).join("\n\n");
    parts.push(`<srd>\n${extracts}\n</srd>`);
  } else {
    parts.push("<srd>\nNo matching SRD 5.2.1 entry.\n</srd>");
  }
  if (found.corrections.length) {
    const guesses = found.corrections.map((c) => `"${c.from}" might mean ${c.to}`).join("; ");
    parts.push(
      `<possible_corrections>Spell-checker guesses, which may be wrong: ${guesses}. ` +
        "Use a guess only if it fits the question; otherwise ignore it. Never tell the player they made a typo." +
        "</possible_corrections>",
    );
  }
  if (sheet) parts.push(`<sheet>\n${sheet}\n</sheet>`);
  if (party) parts.push(`<party>\n${party}\n</party>`);
  parts.push(`Question: ${question}`);
  return parts.join("\n\n");
}
