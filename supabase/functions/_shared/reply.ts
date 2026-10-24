// Splits the model's reply into what is said and where it came from. The model is asked to end
// with one "Source: Alignment, p. 21" line; anything citation-like left in the body (an old
// "(SRD: Creation > ... > Step 4: Alignment, p. 21)" habit) is moved out too, so text to speech
// never reads page numbers or breadcrumbs aloud. The app shows the source as a small footer.

export type SplitReply = { text: string; source: string };

// A line that is only a source note, anywhere in the reply: "Source: Cover, p. 179",
// "**Sources:** ...", "Source — ...", "(Source: ...)", "> SRD: ...". The model is asked for one
// last line, but it sometimes bolds it, uses a dash, or puts a Bard's couplet after it.
const SOURCE_ONLY_LINE = /^[ \t>*_~([•-]*(?:sources?|srd(?: ?5\.2(?:\.1)?)?)[ \t*_]*(?:[:：—–-]|,(?= ))[ \t*_]*([^\n]*?)[ \t*_)\].]*$/i;
// The same note after the last sentence on the same line: "... cover. Source: Cover, p. 179".
const SOURCE_AFTER = /([.!?…"'”)*_]|[ \t][—–-])[ \t]+[([]?[ \t*_]*(?:sources?|srd)[ \t*_]*[:：—–-][ \t*_]*([^\n]+?)[ \t*_)\]]*$/i;
// "(SRD: ...)", "(SRD 5.2.1, ..., p. 21)", "(Source: ...)", "(... p. 21)" anywhere in the body.
const INLINE = /\s*[([]\s*(?:(?:SRD|sources?)\b[^()[\]]*|[^()[\]]*\bpp?\.\s*\d+[^()[\]]*)[)\]]/gi;

// "Source: none" is not a source.
const NOT_A_SOURCE = /^(?:none|n\/?a|-+)$/i;

// A checklist label at the start of a line: "Fix:", "**Suggestion:**", "- Fix (Strength):",
// "1. Suggest -". Sheet reviews are asked for flowing prose; if a label still slips through, it is
// removed so the card reads naturally and text to speech never says it.
const LABEL = /^([ \t]*(?:[-•*][ \t]+|\d+[.)][ \t]+)?)[*_]*(?:fix(?:es)?|suggest(?:ions?)?)[*_]*(?:[ \t]*\([^)\n]*\))?[ \t]*[*_]*(?:[:：]|[ \t][—–-])[*_]*[ \t]*/i;

/** True when any line of the reply starts with a "Fix:" / "Suggestion:" label. */
export function hasLabels(reply: string): boolean {
  return reply.split("\n").some((line) => LABEL.test(line));
}

/** Strips "Fix:" / "Suggestion:" labels from line starts; a line that was only a label goes. */
export function dropLabels(reply: string): string {
  const out: string[] = [];
  for (const line of reply.split("\n")) {
    const m = LABEL.exec(line);
    if (!m) {
      out.push(line);
      continue;
    }
    const rest = line.slice(m[0].length).trim();
    if (rest) out.push(`${m[1]}${rest[0].toUpperCase()}${rest.slice(1)}`);
  }
  return out.join("\n");
}

/** Moves every source note out of the text. Kept free of regex lookbehind (Hermes). */
function pullSources(reply: string): { text: string; found: string[] } {
  const found: string[] = [];
  const lines: string[] = [];
  const unlabelled = dropLabels(reply);
  for (const line of unlabelled.trim().split("\n")) {
    const own = SOURCE_ONLY_LINE.exec(line);
    if (own) {
      if (own[1].trim()) found.push(own[1]);
      continue;
    }
    lines.push(line);
  }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  // Nothing but a source note: leave it, rather than an empty reply.
  if (!lines.some((l) => l.trim())) return { text: unlabelled.trim(), found: [] };
  if (lines.length) {
    const last = lines[lines.length - 1];
    const after = SOURCE_AFTER.exec(last);
    if (after) {
      found.push(after[2]);
      // Keep the sentence's own full stop; drop a dash before "Source".
      const keep = /[—–-]$/.test(after[1].trim()) ? 0 : after[1].length;
      lines[lines.length - 1] = last.slice(0, after.index + keep).trimEnd();
    }
  }
  let text = lines.join("\n");
  text = text.replace(INLINE, (match) => {
    found.push(match.trim().replace(/^[([]\s*|\s*[)\]]$/g, ""));
    return "";
  });
  text = text.replace(/[ \t]+([.,;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { text, found };
}
const MAX_SOURCES = 2;

/** One short citation: "Step 4: Alignment, p. 21" from any breadcrumb form, without "SRD 5.2.1". */
export function shortCitation(raw: string): string {
  let text = raw.trim().replace(/^[([]|[)\].;]$/g, "").trim();
  text = text.replace(/^(?:SRD(?:\s*5\.2(?:\.1)?)?|sources?)\s*[:,]?\s*/i, "");
  const crumbs = text.split(/\s*>\s*/);
  text = crumbs[crumbs.length - 1];
  // "Step 4: Alignment" reads better as "Alignment"; "Level 1: Rage" stays (the level matters).
  text = text.replace(/^Step \d+:\s*/i, "");
  text = text.replace(/\s*,?\s*\bpp?\.?\s*(\d+)/i, ", p. $1");
  return text.replace(/\s+/g, " ").replace(/^,\s*/, "").trim();
}

function joinSources(items: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items.flatMap((s) => s.split(/\s*;\s*/))) {
    const short = shortCitation(item);
    if (!short || NOT_A_SOURCE.test(short) || seen.has(short.toLowerCase())) continue;
    seen.add(short.toLowerCase());
    out.push(short);
  }
  return out.slice(0, MAX_SOURCES).join("; ");
}

export function splitReply(reply: string): SplitReply {
  const { text, found } = pullSources(reply);
  return { text, source: joinSources(found) };
}

const STOP = new Set(["the", "of", "and", "a", "an", "to", "in", "on", "for", "with", "your", "you", "level", "step", "or"]);

function titleOf(citation: string): string {
  return shortCitation(citation).replace(/,\s*p\.\s*\d+$/, "").trim();
}

function words(text: string): string[] {
  return text.toLowerCase().replace(/[’']/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
}

const stemWord = (w: string) => w.replace(/(?:es|s)$/, "");

/**
 * The footer for a rules answer. The model's own Source line is kept only where it names an
 * extract it was given (so no page is ever made up). When it wrote none, the first extract whose
 * title the answer actually talks about is used, so a real ruling always shows where it came from.
 * Lore, homebrew and declines name no extract, so they get no footer.
 */
export function pickSource(modelSource: string, reply: string, hits: { citation: string }[]): string {
  if (/^\W*(?:lore|homebrew idea)\s*:/i.test(reply)) return "";
  const given = hits.map((h) => shortCitation(h.citation));
  const kept = modelSource
    .split(/\s*;\s*/)
    .map((s) => {
      // Same title can sit on two pages (Alignment, p. 21 and p. 254): keep the page the model named.
      const title = titleOf(s).toLowerCase();
      const same = given.filter((g) => titleOf(g).toLowerCase() === title);
      return same.find((g) => g.toLowerCase() === s.trim().toLowerCase()) ?? same[0];
    })
    .filter((s): s is string => !!s);
  if (kept.length) return [...new Set(kept)].slice(0, MAX_SOURCES).join("; ");
  const said = new Set(words(reply).map(stemWord));
  for (const hit of hits) {
    const need = words(titleOf(hit.citation)).map(stemWord);
    if (need.length && need.every((w) => said.has(w))) return shortCitation(hit.citation);
  }
  return "";
}

// Help-desk sign-offs that break the voice. An offer in character ("Shall we mend it together?") stays.
const CLOSER = /(?:let me know\b|happy to help|glad to help|feel free to|hope (?:this|that) helps|if you have any (?:other |more |further )?questions|(?:is there )?anything else (?:i can|you need|to)\b|don't hesitate to)/i;
// A closer starts the sentence ("I am happy to help...") or follows ", and" / ", so" / ",".
const LEAD = /^(?:(?:and|so|also|just|please|i am|i'm|i'd be|i would be|we are|we're|if you need anything(?: else)?,?)\s+)*/i;

/** Drops a help-desk closing sentence or clause ("Let me know if there's anything else") from the end. */
export function dropClosers(text: string): string {
  let out = text.trim();
  for (let i = 0; i < 2; i++) {
    const m = /(^|[.!?…"”]\s+|\n)([^.!?…\n]*[.!?…]?["”]?)\s*$/.exec(out);
    if (!m) break;
    const sentence = m[2];
    const hit = CLOSER.exec(sentence);
    if (!hit) break;
    const head = out.slice(0, m.index + m[1].trimEnd().length).trimEnd();
    if (LEAD.exec(sentence)![0].length === hit.index) {
      if (!head) break; // the whole reply is the closer: leave it
      out = head;
      continue;
    }
    // "Lower it to 20, and let me know if you need help." -> "Lower it to 20."
    const clause = /,\s*(?:and\s+|so\s+)?(?:(?:i am|i'm|i'd be|please|just)\s+)?$/i.exec(sentence.slice(0, hit.index));
    if (!clause) break;
    out = `${head}${head ? " " : ""}${sentence.slice(0, clause.index).trim()}.`.trim();
  }
  return out;
}
