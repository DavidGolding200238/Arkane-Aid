// Shared SRD 5.2.1 knowledge base for every persona (Sage, Scribe, Bard).
//
// Free-tier friendly: the chunked SRD ships inside the function bundle as JSON (about 1.5 MB),
// and search is an in-memory BM25 index with typo-tolerant name matching. No database calls,
// no embeddings, no paid search. The index is built once per cold start (tens of ms).
//
// Typo tolerance works in two layers:
//   1. Names: every window of 1-4 query words is compared with every entry title
//      (spell, monster, condition, rule) by Damerau-Levenshtein, so "firebal" finds Fireball
//      and "owlbaer" finds Owlbear.
//   2. Words: a query word the SRD never uses is corrected to the closest SRD word
//      (one edit for words of 5-7 letters, two for longer ones), so "grapled" searches "grappled".
// A word that is ordinary English (a bundled SCOWL list, see srd.ts) is never "corrected", so
// "hello" stays hello instead of turning into "hells". Corrections are only guesses: the Sage is
// told they may be wrong (see message.ts).

export type SrdChunk = {
  t: string; // title, e.g. "Fireball" or "Grappled [Condition]"
  p: string[]; // breadcrumb path, e.g. ["Spells", "Spell Descriptions"]
  pg: number; // page in the SRD 5.2.1 PDF
  k: string; // kind: spell | monster | condition | rule | class | item | equipment | glossary
  x: string; // text
  n?: number; // part number when a long entry was split
};

export type SrdData = { source: string; attribution: string; chunks: SrdChunk[] };

export type SrdHit = {
  id: number;
  title: string;
  kind: string;
  page: number;
  part?: number;
  citation: string;
  text: string;
  score: number;
};

export type Correction = { from: string; to: string };

export type SearchResult = {
  hits: SrdHit[];
  corrections: Correction[];
  /** True when at least one hit is a confident match, not just a few shared words. */
  grounded: boolean;
};

const STOP = new Set(
  (
    "a an and are as at be but by can could did do does doing for from get gets got had has have how i if in into is it its " +
    "me my of on or our so that the their them then there these they this to us was we what when where which who why will " +
    "with would you your yours he she his her him isnt dont doesnt cant whats hows any some much many more most just also " +
    "about over under than too very rule rules work works happen happens mean means use using used tell explain okay ok please " +
    "sage scribe bard dm"
  ).split(" "),
);

// Table talk and UK spellings, mapped onto the SRD's own words before searching.
const ALIASES: [RegExp, string][] = [
  [/\bdeath saves?\b/g, "death saving throw"],
  [/\bsaves?\b/g, "saving throw"],
  [/\bac\b/g, "armor class"],
  [/\b(hp|hit pts)\b/g, "hit points"],
  [/\btemp hit points\b/g, "temporary hit points"],
  [/\bcrits?\b/g, "critical hit"],
  [/\bnat(ural)? 20\b/g, "critical hit"],
  [/\b(aoo|attacks? of opportunity)\b/g, "opportunity attack"],
  [/\bdisadv\b/g, "disadvantage"],
  [/\badv\b/g, "advantage"],
  [/\bdc\b/g, "difficulty class"],
  [/\bconc\b/g, "concentration"],
  [/\barmour\b/g, "armor"],
  [/\bdefence\b/g, "defense"],
  [/\bhonour\b/g, "honor"],
  [/\bfavour(ed)?\b/g, "favor$1"],
  [/\bcolour\b/g, "color"],
];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/'s\b/g, "")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

function expandAliases(text: string): string {
  let out = ` ${normalize(text)} `;
  for (const [pattern, replacement] of ALIASES) out = out.replace(pattern, replacement);
  return out.replace(/\s+/g, " ").trim();
}

export function stem(word: string): string {
  if (word.length <= 4 || /\d/.test(word)) return word;
  for (const [suffix, repl] of [
    ["ies", "y"],
    ["ing", ""],
    ["ed", ""],
    ["es", ""],
    ["s", ""],
  ] as const) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) {
      const base = word.slice(0, -suffix.length) + repl;
      // grappled -> grappl, grapple -> grappl: drop a trailing e so both forms meet.
      return base.endsWith("e") ? base.slice(0, -1) : base;
    }
  }
  return word.endsWith("e") ? word.slice(0, -1) : word;
}

function words(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

/** Damerau-Levenshtein (optimal string alignment), stopping early once past `max`. */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** How many typos a word or name of this length may carry. Short words are never guessed at. */
function allowedEdits(length: number): number {
  if (length < 5) return 0;
  if (length < 8) return 1;
  return 2;
}

/** A guess must still look like the word: at most one letter in five may differ. */
const MIN_CLOSENESS = 0.8;

/** Title without tags like "[Condition]". */
function cleanTitle(title: string): string {
  return title.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
}

/** The names a title can be asked for by: "Level 1: Sneak Attack" is also "Sneak Attack",
 *  "Grappling Hook (2 GP)" is also "Grappling Hook", "Rogue Subclass: Thief" is also "Thief". */
function nameForms(title: string): string[] {
  const base = cleanTitle(title);
  const forms = new Set([base]);
  const noCost = base.replace(/\s*\([^)]*\)\s*$/, "").trim();
  forms.add(noCost);
  const colon = noCost.lastIndexOf(":");
  if (colon > 0) forms.add(noCost.slice(colon + 1).trim());
  return [...forms].map(normalize).filter((f) => f.length >= 3);
}

function stemPhrase(phrase: string): string {
  return phrase.split(" ").map(stem).join(" ");
}

export function citationFor(chunk: SrdChunk): string {
  const trail = [...chunk.p, cleanTitle(chunk.t)].filter(Boolean).join(" > ");
  return `SRD 5.2.1, ${trail}, p. ${chunk.pg}`;
}

type Name = { norm: string; stemmed: string; display: string; ids: number[] };

export class SrdIndex {
  readonly attribution: string;
  private chunks: SrdChunk[];
  private tf: Map<string, number>[] = [];
  private len: number[] = [];
  private df = new Map<string, number>();
  private avgLen = 1;
  private wordFreq = new Map<string, number>(); // raw (unstemmed) words, for spelling correction
  private names: Name[] = [];
  private english: Set<string>;

  /** english: common English words (lowercase) that are never treated as typos. */
  constructor(data: SrdData, english: Iterable<string> = []) {
    this.attribution = data.attribution;
    this.english = new Set(english);
    this.chunks = data.chunks;
    const byName = new Map<string, Name>();
    let total = 0;
    data.chunks.forEach((chunk, id) => {
      const tf = new Map<string, number>();
      const add = (text: string, weight: number) => {
        for (const w of words(text)) {
          this.wordFreq.set(w, (this.wordFreq.get(w) ?? 0) + 1);
          if (STOP.has(w)) continue;
          const s = stem(w);
          tf.set(s, (tf.get(s) ?? 0) + weight);
        }
      };
      add(cleanTitle(chunk.t), 4);
      add(chunk.p.slice(1).join(" "), 1);
      add(chunk.x, 1);
      let length = 0;
      for (const [term, count] of tf) {
        length += count;
        this.df.set(term, (this.df.get(term) ?? 0) + 1);
      }
      this.tf.push(tf);
      this.len.push(length);
      total += length;

      // The section a stat block sits in is a name too: "Goblins" finds Goblin Warrior and Goblin Boss.
      const section = chunk.k === "monster" && chunk.p.length > 1 ? nameForms(chunk.p[chunk.p.length - 1]) : [];
      for (const norm of [...nameForms(chunk.t), ...section]) {
        const entry = byName.get(norm) ?? { norm, stemmed: stemPhrase(norm), display: cleanTitle(chunk.t), ids: [] };
        if (!entry.ids.includes(id)) entry.ids.push(id);
        byName.set(norm, entry);
      }
    });
    this.avgLen = total / Math.max(1, data.chunks.length);
    this.names = [...byName.values()];
  }

  get size() {
    return this.chunks.length;
  }

  /** A word that is not a typo: the SRD uses it, it is common English, or it has a digit. */
  private known(word: string): boolean {
    return this.wordFreq.has(word) || this.english.has(word) || STOP.has(word) || /\d/.test(word);
  }

  /** Closest SRD word to a word that is neither in the SRD nor common English, or null.
   *  Same first letter, close spelling, and a word that starts the same way wins a tie
   *  ("firebal" -> "fireball"), then the more common SRD word. */
  correctWord(word: string): string | null {
    if (this.known(word)) return null;
    const max = allowedEdits(word.length);
    if (!max) return null;
    let best: string | null = null;
    let bestDist = max + 1;
    let bestPrefix = false;
    let bestFreq = 0;
    for (const [candidate, freq] of this.wordFreq) {
      if (candidate[0] !== word[0] || Math.abs(candidate.length - word.length) > max) continue;
      const dist = editDistance(word, candidate, max);
      if (dist > max || 1 - dist / Math.max(word.length, candidate.length) < MIN_CLOSENESS) continue;
      const prefix = candidate.startsWith(word) || word.startsWith(candidate);
      const better =
        dist < bestDist ||
        (dist === bestDist && prefix && !bestPrefix) ||
        (dist === bestDist && prefix === bestPrefix && freq > bestFreq);
      if (better) {
        best = candidate;
        bestDist = dist;
        bestPrefix = prefix;
        bestFreq = freq;
      }
    }
    return best;
  }

  /** Entry titles named in the question. Exact (by stem) or, when the question has a word the
   *  SRD never uses, close by spelling. Returns the best match per name with closeness (0..1]. */
  private matchNames(queryWords: string[]): { name: Name; closeness: number; typed: string }[] {
    const found = new Map<string, { name: Name; closeness: number; typed: string }>();
    for (let size = 4; size >= 1; size--) {
      for (let start = 0; start + size <= queryWords.length; start++) {
        const slice = queryWords.slice(start, start + size);
        if (STOP.has(slice[0]) || STOP.has(slice[slice.length - 1])) continue;
        const phrase = slice.join(" ");
        const stemmed = stemPhrase(phrase);
        const unknown = slice.some((w) => !this.known(w));
        const max = unknown ? allowedEdits(phrase.replace(/ /g, "").length) : 0;
        for (const name of this.names) {
          let dist: number;
          if (name.stemmed === stemmed) dist = 0;
          else if (!max || name.norm.length < 5 || Math.abs(name.norm.length - phrase.length) > max) continue;
          else dist = editDistance(phrase, name.norm, max);
          if (dist > max) continue;
          const closeness = 1 - dist / Math.max(phrase.length, name.norm.length);
          if (closeness < MIN_CLOSENESS) continue;
          const prev = found.get(name.norm);
          if (!prev || prev.closeness < closeness) found.set(name.norm, { name, closeness, typed: phrase });
        }
      }
    }
    // Keep only the closest spelling fix for each typed phrase ("grapled" -> Grappled, not Grappler too).
    const bestForTyped = new Map<string, number>();
    for (const hit of found.values()) bestForTyped.set(hit.typed, Math.max(bestForTyped.get(hit.typed) ?? 0, hit.closeness));
    const kept = [...found.values()].filter((hit) => hit.closeness === bestForTyped.get(hit.typed));
    // A guess on part of a phrase that already matched as a whole is noise ("wonds" -> Wands
    // when "cure wonds" -> Cure Wounds).
    return kept.filter(
      (hit) =>
        hit.closeness === 1 ||
        !kept.some((other) => other.typed.length > hit.typed.length && ` ${other.typed} `.includes(` ${hit.typed} `)),
    );
  }

  /** How rare a name's words are (0..1). "Spells" or "Actions" is a weak signal; "Owlbear" is strong. */
  private rarity(name: Name): number {
    const terms = name.stemmed.split(" ");
    const n = this.chunks.length;
    let best = 0;
    for (const term of terms) {
      const df = this.df.get(term) ?? 1;
      best = Math.max(best, Math.log(n / df));
    }
    return Math.min(1, (best + (terms.length - 1) * 2) / 5);
  }

  search(question: string, options: { limit?: number; maxChars?: number } = {}): SearchResult {
    const limit = options.limit ?? 4;
    const maxChars = options.maxChars ?? 6000;
    const queryWords = expandAliases(question).split(" ").filter(Boolean);
    const corrections: Correction[] = [];

    const nameHits = this.matchNames(queryWords);
    for (const hit of nameHits) {
      if (hit.closeness < 1) corrections.push({ from: hit.typed, to: hit.name.display });
    }

    // Words already fixed by a name match take the name's spelling ("cure wonds" -> "cure wounds").
    const fixedByName = new Map<string, string>();
    for (const hit of nameHits) {
      const typed = hit.typed.split(" ");
      const named = hit.name.norm.split(" ");
      if (hit.closeness < 1 && typed.length === named.length) typed.forEach((w, i) => fixedByName.set(w, named[i]));
    }

    const terms: string[] = [];
    for (const w of queryWords) {
      if (STOP.has(w)) continue;
      const fixed = fixedByName.get(w) ?? this.correctWord(w);
      if (fixed && fixed !== w) {
        if (!fixedByName.has(w)) corrections.push({ from: w, to: fixed });
        terms.push(stem(fixed));
      } else {
        terms.push(stem(w));
      }
    }

    const scores = new Map<number, number>();
    const n = this.chunks.length;
    const k1 = 1.2;
    const b = 0.75;
    for (const term of new Set(terms)) {
      const df = this.df.get(term);
      if (!df) continue;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      for (let id = 0; id < n; id++) {
        const f = this.tf[id].get(term);
        if (!f) continue;
        const s = idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * this.len[id]) / this.avgLen)));
        scores.set(id, (scores.get(id) ?? 0) + s);
      }
    }

    // A named entry outranks everything that merely shares words with the question.
    let strongest = 0;
    for (const hit of nameHits) {
      const weight = 25 * hit.closeness * hit.closeness * this.rarity(hit.name);
      strongest = Math.max(strongest, weight);
      hit.name.ids.forEach((id, i) => scores.set(id, (scores.get(id) ?? 0) + weight - i * 0.5));
    }

    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const hits: SrdHit[] = [];
    let used = 0;
    // Weak matches far below the best one are noise that only costs tokens.
    const floor = (ranked[0]?.[1] ?? 0) * 0.35;
    for (const [id, score] of ranked) {
      if (hits.length >= limit || score < floor) break;
      const chunk = this.chunks[id];
      if (used + chunk.x.length > maxChars && hits.length > 0) continue;
      used += chunk.x.length;
      hits.push({
        id,
        title: cleanTitle(chunk.t),
        kind: chunk.k,
        page: chunk.pg,
        part: chunk.n,
        citation: citationFor(chunk),
        text: chunk.x,
        score: Math.round(score * 100) / 100,
      });
    }
    const top = hits[0]?.score ?? 0;
    return { hits, corrections, grounded: strongest >= 12 || top >= 18 };
  }
}
