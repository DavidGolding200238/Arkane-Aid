// One-off seed for the Sage's meaning search: embeds every SRD 5.2.1 piece with gte-small on
// your computer and writes them to public.srd_chunks. Free: the model runs locally (about a
// 35 MB download the first time), and Supabase only stores the rows.
//
//   npm run seed:srd -- --dry-run      embed only, write .cache/srd-embeddings.json
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:srd
//
// The service role key is from Supabase Dashboard > Project Settings > API keys. Put it in your
// shell for this one command only; never commit it or put it in the app.
// Re-running is safe: rows are upserted on (chunk, piece). The cache (gitignored) is reused,
// and the eval (evals/search.ts) reads it too.
import { pipeline } from "npm:@huggingface/transformers@3";
import { createClient } from "npm:@supabase/supabase-js@2";
import data from "../supabase/functions/_shared/srd/srd-5.2.1.json" with { type: "json" };
import { embedPieces } from "../supabase/functions/_shared/embed_text.ts";
import { citationFor, type SrdChunk } from "../supabase/functions/_shared/retrieval.ts";

export const MODEL = "Supabase/gte-small";
// Quantised weights, like the gte-small build Supabase.ai runs. Vectors differ from full
// precision only in the third decimal, so rankings match.
export const DTYPE = "q8";
export const CACHE = new URL("../.cache/srd-embeddings.json", import.meta.url);

export type Piece = { chunk: number; piece: number; name: string; citation: string; text: string; embedding: number[] };
export type Cache = { model: string; dtype: string; srd: string; pieces: Piece[] };

type Embedder = (texts: string[]) => Promise<number[][]>;

export async function loadEmbedder(): Promise<Embedder> {
  const extractor = await pipeline("feature-extraction", MODEL, { dtype: DTYPE });
  return async (texts) => {
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    return output.tolist() as number[][];
  };
}

const round = (v: number) => Math.round(v * 1e6) / 1e6;

export async function buildCache(embed?: Embedder): Promise<Cache> {
  const srd = data as { source: string; chunks: SrdChunk[] };
  try {
    const cached = JSON.parse(await Deno.readTextFile(CACHE)) as Cache;
    const expected = srd.chunks.reduce((n, c) => n + embedPieces(c).length, 0);
    if (cached.model === MODEL && cached.dtype === DTYPE && cached.pieces.length === expected) return cached;
  } catch {
    // No cache yet.
  }
  const embedder = embed ?? (await loadEmbedder());
  const todo: Omit<Piece, "embedding">[] = [];
  srd.chunks.forEach((chunk, id) =>
    embedPieces(chunk).forEach((text, piece) => todo.push({ chunk: id, piece, name: chunk.t, citation: citationFor(chunk), text }))
  );
  const pieces: Piece[] = [];
  const batch = 32;
  for (let i = 0; i < todo.length; i += batch) {
    const slice = todo.slice(i, i + batch);
    const vectors = await embedder(slice.map((p) => p.text));
    slice.forEach((p, j) => pieces.push({ ...p, embedding: vectors[j].map(round) }));
    if ((i / batch) % 10 === 0) console.log(`embedded ${Math.min(i + batch, todo.length)} / ${todo.length}`);
  }
  const cache: Cache = { model: MODEL, dtype: DTYPE, srd: srd.source, pieces };
  await Deno.mkdir(new URL(".", CACHE), { recursive: true });
  await Deno.writeTextFile(CACHE, JSON.stringify(cache));
  return cache;
}

async function main() {
  const dryRun = Deno.args.includes("--dry-run");
  const cache = await buildCache();
  console.log(`${cache.pieces.length} pieces from ${new Set(cache.pieces.map((p) => p.chunk)).size} SRD entries.`);
  if (dryRun) {
    console.log(`Dry run: nothing written to Supabase. Cache: ${CACHE.pathname}`);
    return;
  }
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for this command (never commit them).");
    Deno.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  for (let i = 0; i < cache.pieces.length; i += 200) {
    const rows = cache.pieces.slice(i, i + 200).map((p) => ({ ...p, embedding: JSON.stringify(p.embedding) }));
    const { error } = await db.from("srd_chunks").upsert(rows, { onConflict: "chunk,piece" });
    if (error) {
      console.error(`Upsert failed at row ${i}: ${error.message}. Did you run \`npx supabase db push\` first?`);
      Deno.exit(1);
    }
    console.log(`saved ${Math.min(i + 200, cache.pieces.length)} / ${cache.pieces.length}`);
  }
  // Entries past the end of the bundled SRD (only if the JSON ever shrinks).
  const last = Math.max(...cache.pieces.map((p) => p.chunk));
  const { error } = await db.from("srd_chunks").delete().gt("chunk", last);
  if (error) console.error(`Could not remove old rows: ${error.message}`);
  console.log("Done. The Sage uses meaning search from its next request.");
}

if (import.meta.main) await main();
