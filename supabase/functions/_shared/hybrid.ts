// Hybrid retrieval: the keyword/typo search (retrieval.ts) plus meaning search (gte-small
// embeddings in pgvector, see migrations/*_srd_chunks.sql), merged by reciprocal rank fusion.
//
// Meaning search finds "can I hit someone running away" -> Opportunity Attacks, which shares
// no keyword with the question. Keyword search stays in charge of names and typos: an entry
// the question names ("firebal" -> Fireball) is pinned first. If meaning search is missing
// (not seeded, RPC error, slow), the result is exactly the keyword search, so nothing breaks.
import { normalize, type SearchResult, type SrdHit, type SrdIndex } from "./retrieval.ts";

/** One meaning-search match: the chunk id (index in srd-5.2.1.json) and its stored title. */
export type SemanticMatch = { chunk: number; name: string; similarity: number };
/** Embeds the text and returns the closest SRD chunks, best first. */
export type SemanticSearch = (text: string) => Promise<SemanticMatch[]>;

export type HybridResult = SearchResult & { retrieval: "hybrid" | "keyword" };

/** Keyword hits at least this strong come from a named entry and keep their place at the top
 *  (at most MAX_PINS, so "AC" naming four "Armor Class" entries cannot crowd out Cover). */
const PIN_SCORE = 20;
const MAX_PINS = 2;
/** gte-small rates short equipment blurbs ("Push", "Net") close to almost any action question.
 *  Most questions are about rules, so rules text gets a small nudge in the meaning ranking. */
const RULES_KINDS = new Set(["rule", "glossary", "condition"]);
const RULES_NUDGE = 0.012;
/** Keyword results count half in the fusion when they found no named entry or strong match. */
const WEAK_KEYWORD_WEIGHT = 0.5;
/** Meaning matches this far below the best one are dropped as noise. */
const SEMANTIC_SPREAD = 0.06;
/** A meaning match this close counts as grounded on its own. */
const SEMANTIC_GROUNDED = 0.88;
const RRF_K = 60;
const CANDIDATES = 8;

/** Reciprocal rank fusion: each list adds weight / (k + rank) to an id's score. */
export function fuse(lists: number[][], weights: number[] = [], k = RRF_K): { id: number; score: number }[] {
  const scores = new Map<number, number>();
  lists.forEach((list, n) => {
    const weight = weights[n] ?? 1;
    list.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + weight / (k + rank + 1)));
  });
  return [...scores.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("semantic search timed out")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export type HybridOptions = {
  limit?: number;
  maxChars?: number;
  semantic?: SemanticSearch;
  /** Extra words for the search only (the previous question, for a follow-up). */
  context?: string;
  timeoutMs?: number;
};

export async function hybridSearch(index: SrdIndex, question: string, options: HybridOptions = {}): Promise<HybridResult> {
  const limit = options.limit ?? 4;
  const maxChars = options.maxChars ?? 6000;
  const query = options.context ? `${question} ${options.context}` : question;
  const keyword = index.search(query, { limit: CANDIDATES, maxChars: Number.POSITIVE_INFINITY });
  // Only report spelling guesses for words the player typed in this message.
  const typed = new Set(normalize(question).split(" "));
  const corrections = options.context
    ? keyword.corrections.filter((c) => c.from.split(" ").every((w) => typed.has(w)))
    : keyword.corrections;

  let semantic: SemanticMatch[] = [];
  if (options.semantic) {
    try {
      const matches = await withTimeout(options.semantic(query), options.timeoutMs ?? 4000);
      // A row only counts if it still lines up with the bundled SRD (same id, same title).
      const valid = matches.filter((m) => Number.isInteger(m.chunk) && index.rawTitle(m.chunk) === m.name);
      const best = valid[0]?.similarity ?? 0;
      const nudged = (m: SemanticMatch) => m.similarity + (RULES_KINDS.has(index.hitFor(m.chunk).kind) ? RULES_NUDGE : 0);
      semantic = valid
        .filter((m) => m.similarity >= best - SEMANTIC_SPREAD)
        .sort((a, b) => nudged(b) - nudged(a));
    } catch (error) {
      console.error("sage: meaning search unavailable, keyword only", error instanceof Error ? error.message : error);
    }
  }

  const byId = new Map<number, SrdHit>(keyword.hits.map((hit) => [hit.id, hit]));
  const pinned = keyword.hits.filter((hit) => hit.score >= PIN_SCORE).slice(0, MAX_PINS).map((hit) => hit.id);
  const fused = fuse(
    [keyword.hits.map((hit) => hit.id), semantic.map((m) => m.chunk)],
    [keyword.grounded ? 1 : WEAK_KEYWORD_WEIGHT, 1],
  );
  const order = [...pinned, ...fused.map((f) => f.id).filter((id) => !pinned.includes(id))];

  const hits: SrdHit[] = [];
  let used = 0;
  for (const id of order) {
    if (hits.length >= limit) break;
    const hit = byId.get(id) ?? index.hitFor(id, 0);
    if (used + hit.text.length > maxChars && hits.length > 0) continue;
    used += hit.text.length;
    hits.push(hit);
  }
  const grounded = keyword.grounded || semantic.some((m) => m.similarity >= SEMANTIC_GROUNDED);
  return { hits, corrections, grounded, retrieval: semantic.length ? "hybrid" : "keyword" };
}
