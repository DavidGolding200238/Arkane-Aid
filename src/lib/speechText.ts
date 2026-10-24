// Keeping citations and markdown out of what the phone reads aloud.
//
// The sage function already sends the answer (`reply`) and its short source note (`source`)
// apart. These are the app's safety net: an older deployed function, or a model that slips a
// "(SRD: ... p. 21)" into the text, still never gets page numbers read out by expo-speech.
// Mirrors supabase/functions/_shared/reply.ts (kept free of regex lookbehind for Hermes).
// Pure functions, no React Native imports, so the function tests can check them with Deno.

// Mirrors dropLabels and pullSources in supabase/functions/_shared/reply.ts word for word.
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

/** "Step 4: Alignment, p. 21" from any breadcrumb form, without "SRD 5.2.1". */
export function shortCitation(raw: string): string {
  let text = raw.trim().replace(/^[([]|[)\].;]$/g, "").trim();
  text = text.replace(/^(?:SRD(?:\s*5\.2(?:\.1)?)?|sources?)\s*[:,]?\s*/i, "");
  const crumbs = text.split(/\s*>\s*/);
  text = crumbs[crumbs.length - 1].replace(/^Step \d+:\s*/i, "");
  text = text.replace(/\s*,?\s*\bpp?\.?\s*(\d+)/i, ", p. $1");
  return text.replace(/\s+/g, " ").replace(/^,\s*/, "").trim();
}

/** Splits a reply into the text to show and speak, and a short source note for the footer. */
export function splitSource(reply: string): { text: string; source: string } {
  const { text, found } = pullSources(reply);
  const seen = new Set<string>();
  const sources = found
    .flatMap((s) => s.split(/\s*;\s*/))
    .map(shortCitation)
    .filter((s) => s && !NOT_A_SOURCE.test(s) && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
  return { text, source: sources.slice(0, 2).join("; ") };
}

/** What expo-speech gets: no source note, no citations, no markdown symbols. */
export function speakable(text: string): string {
  return splitSource(text)
    .text.replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`#~|>]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\.(\s*\.)+/g, ".")
    .replace(/([!?:;,])\./g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
