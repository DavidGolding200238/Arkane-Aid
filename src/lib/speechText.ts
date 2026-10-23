// Keeping citations and markdown out of what the phone reads aloud.
//
// The sage function already sends the answer (`reply`) and its short source note (`source`)
// apart. These are the app's safety net: an older deployed function, or a model that slips a
// "(SRD: ... p. 21)" into the text, still never gets page numbers read out by expo-speech.
// Mirrors supabase/functions/_shared/reply.ts (kept free of regex lookbehind for Hermes).
// Pure functions, no React Native imports, so the function tests can check them with Deno.

// A last line, or a last sentence, starting "Source:" / "Sources:" / "SRD:".
const SOURCE_LINE = /(\n|[.!?…"'”] )[ \t]*[([]?\s*(?:sources?|srd)\s*:\s*([^\n]+?)\s*[)\]]?[ \t]*$/i;
// "(SRD: ...)", "(SRD 5.2.1, ..., p. 21)", "(Source: ...)", "(... p. 21)" anywhere in the text.
const INLINE = /\s*[([]\s*(?:(?:SRD|sources?)\b[^()[\]]*|[^()[\]]*\bpp?\.\s*\d+[^()[\]]*)[)\]]/gi;

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
  let text = reply.trim();
  const found: string[] = [];
  const line = SOURCE_LINE.exec(text);
  if (line) {
    found.push(line[2]);
    // Keep the sentence's own full stop; drop the newline or space before "Source:".
    text = text.slice(0, line.index + (line[1] === "\n" ? 0 : 1)).trimEnd();
  }
  text = text.replace(INLINE, (match) => {
    found.push(match.trim().replace(/^[([]\s*|\s*[)\]]$/g, ""));
    return "";
  });
  text = text.replace(/[ \t]+([.,;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const seen = new Set<string>();
  const sources = found
    .flatMap((s) => s.split(/\s*;\s*/))
    .map(shortCitation)
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
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
