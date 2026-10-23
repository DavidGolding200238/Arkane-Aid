// Retrieval eval: does the expected SRD entry land in the Sage's top 4? No Groq, no Supabase.
//
//   npm run eval:search
//
// Compares keyword (the bundled BM25 + typo search), semantic (gte-small, the same embeddings
// the seed script writes, searched here in memory the way match_srd does) and hybrid (what the
// deployed function does once srd_chunks is seeded). First run embeds the SRD (about a minute)
// into .cache/; later runs reuse it.
import { buildCache, loadEmbedder, type Piece } from "../scripts/srd-embed.ts";
import { hybridSearch, type SemanticMatch } from "../supabase/functions/_shared/hybrid.ts";
import { isFollowUp } from "../supabase/functions/_shared/history.ts";
import { isSmallTalk } from "../supabase/functions/_shared/smalltalk.ts";
import { srd } from "../supabase/functions/_shared/srd.ts";
import { byId, CASES, type EvalCase, writeResults } from "./lib.ts";

const LIMIT = 4;
const embed = await loadEmbedder();
const cache = await buildCache(embed);

/** match_srd in memory: nearest 3×count pieces by inner product, one row per entry, best first. */
function matchSrd(query: number[], pieces: Piece[], count = 8): SemanticMatch[] {
  const scored = pieces
    .map((p) => ({ p, similarity: p.embedding.reduce((sum, v, i) => sum + v * query[i], 0) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, count * 3);
  const best = new Map<number, SemanticMatch>();
  for (const { p, similarity } of scored) {
    const seen = best.get(p.chunk);
    if (!seen || similarity > seen.similarity) best.set(p.chunk, { chunk: p.chunk, name: p.name, similarity });
  }
  return [...best.values()].sort((a, b) => b.similarity - a.similarity).slice(0, count);
}

const semantic = async (text: string) => matchSrd((await embed([text]))[0], cache.pieces);

type Row = { id: string; kind: string; question: string; expect: string[]; keyword: string[]; semantic: string[]; hybrid: string[] };
const rows: Row[] = [];
const title = (id: number) => srd.rawTitle(id) ?? `#${id}`;

for (const c of CASES) {
  if (!c.expect?.length || c.small_talk || isSmallTalk(c.question)) continue;
  // A follow-up searches with the previous question's words too, as the function does.
  const previous: EvalCase | undefined = c.history_of ? byId.get(c.history_of) : undefined;
  const context = previous && isFollowUp(c.question) ? previous.question : undefined;
  const query = context ? `${c.question} ${context}` : c.question;
  const keyword = srd.search(query, { limit: LIMIT }).hits.map((h) => title(h.id));
  const sem = (await semantic(query)).slice(0, LIMIT).map((m) => title(m.chunk));
  const hybrid = (await hybridSearch(srd, c.question, { limit: LIMIT, semantic, context })).hits.map((h) => title(h.id));
  rows.push({ id: c.id, kind: c.kind, question: c.question, expect: c.expect, keyword, semantic: sem, hybrid });
}

const hit = (row: Row, method: "keyword" | "semantic" | "hybrid") => row.expect.some((e) => row[method].includes(e));
const methods = ["keyword", "semantic", "hybrid"] as const;
const recall = Object.fromEntries(methods.map((m) => [m, rows.filter((r) => hit(r, m)).length])) as Record<string, number>;
const kinds = [...new Set(rows.map((r) => r.kind))];

const pct = (n: number, d: number) => `${n}/${d} (${Math.round((100 * n) / d)}%)`;
const lines = [
  `# Sage retrieval eval (recall@${LIMIT})`,
  "",
  `${rows.length} questions with an expected SRD entry. Model ${cache.model} (${cache.dtype}), ${cache.pieces.length} pieces.`,
  "",
  "| Method | Recall@4 |",
  "| --- | --- |",
  ...methods.map((m) => `| ${m} | ${pct(recall[m], rows.length)} |`),
  "",
  "| Kind | " + methods.join(" | ") + " |",
  "| --- | " + methods.map(() => "---").join(" | ") + " |",
  ...kinds.map((k) => {
    const of = rows.filter((r) => r.kind === k);
    return `| ${k} | ${methods.map((m) => pct(of.filter((r) => hit(r, m)).length, of.length)).join(" | ")} |`;
  }),
  "",
  "| Case | Expected | keyword | semantic | hybrid |",
  "| --- | --- | --- | --- | --- |",
  ...rows.map((r) =>
    `| ${r.id} | ${r.expect.join(" / ")} | ${methods.map((m) => `${hit(r, m) ? "✅" : "❌"} ${r[m].join(", ")}`).join(" | ")} |`
  ),
  "",
];
const path = await writeResults("search", lines.join("\n"), { recall, total: rows.length, rows });
console.log(lines.slice(0, 7 + methods.length + 3 + kinds.length).join("\n"));
for (const r of rows) {
  const miss = methods.filter((m) => !hit(r, m));
  if (miss.length) console.log(`  miss ${miss.join("+")}: ${r.id} -> hybrid ${r.hybrid.join(", ")}`);
}
console.log(`\nScorecard: ${path}`);
