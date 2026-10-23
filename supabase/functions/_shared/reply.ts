// Splits the model's reply into what is said and where it came from. The model is asked to end
// with one "Source: Alignment, p. 21" line; anything citation-like left in the body (an old
// "(SRD: Creation > ... > Step 4: Alignment, p. 21)" habit) is moved out too, so text to speech
// never reads page numbers or breadcrumbs aloud. The app shows the source as a small footer.

export type SplitReply = { text: string; source: string };

// A last line like "Source: Alignment, p. 21" or "(Sources: Cover, p. 15; Prone, p. 190)".
// It must follow the answer: on its own line, or after the last sentence on the same line.
const SOURCE_LINE = /(?:\n|(?<=[.!?…"'”]) )[ \t]*[([]?\s*(?:sources?|srd)\s*:\s*([^\n]+?)\s*[)\]]?[ \t]*$/i;
// "(SRD: ...)", "(SRD 5.2.1, ..., p. 21)", "(Source: ...)", "(... p. 21)" anywhere in the body.
const INLINE = /\s*[([]\s*(?:(?:SRD|sources?)\b[^()[\]]*|[^()[\]]*\bpp?\.\s*\d+[^()[\]]*)[)\]]/gi;
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
    if (!short || seen.has(short.toLowerCase())) continue;
    seen.add(short.toLowerCase());
    out.push(short);
  }
  return out.slice(0, MAX_SOURCES).join("; ");
}

export function splitReply(reply: string): SplitReply {
  let text = reply.trim();
  const found: string[] = [];
  const line = SOURCE_LINE.exec(text);
  if (line) {
    found.push(line[1]);
    text = text.slice(0, line.index).trimEnd();
  }
  text = text.replace(INLINE, (match) => {
    found.push(match.trim().replace(/^[([]\s*|\s*[)\]]$/g, ""));
    return "";
  });
  text = text.replace(/[ \t]+([.,;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { text, source: joinSources(found) };
}
