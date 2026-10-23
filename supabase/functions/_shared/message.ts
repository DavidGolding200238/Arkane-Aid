// The user message the model sees: SRD extracts, possible spelling fixes, the sheet, the party.
import type { SearchResult } from "./retrieval.ts";

/** Marks a greeting or small talk, so the persona greets back instead of looking anything up. */
export const SMALL_TALK_NOTE =
  "<small_talk>The player is only greeting you, thanking you or chatting. This is not a rules question. " +
  "Reply in your own voice with a short greeting and an offer to help with rules, spells, monsters or the table. " +
  "One or two short sentences. No Lore: or Homebrew idea: label, no citation.</small_talk>";

export function userMessage(
  question: string,
  found: SearchResult | null,
  sheet: string,
  party: string,
): string {
  if (!found) return `${SMALL_TALK_NOTE}\n\nMessage: ${question}`;
  const parts: string[] = [];
  if (found.hits.length) {
    const extracts = found.hits.map((hit) => `[${hit.citation}]\n${hit.text}`).join("\n\n");
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
