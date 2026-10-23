// Meaning search inside the sage function: embed the question with Supabase's built-in
// gte-small model (free, no API key) and ask Postgres for the closest SRD chunks (match_srd).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { SemanticMatch, SemanticSearch } from "./hybrid.ts";

type AiSession = { run(input: string, options: { mean_pool: boolean; normalize: boolean }): Promise<unknown> };
type SupabaseAi = { ai?: { Session: new (model: string) => AiSession } };

let session: AiSession | null = null;

/** null when the runtime has no Supabase.ai (local tests, old runtimes): keyword search only. */
export function semanticSearch(db: SupabaseClient, count = 8): SemanticSearch | undefined {
  const ai = (globalThis as { Supabase?: SupabaseAi }).Supabase?.ai;
  if (!ai) return undefined;
  return async (text) => {
    session ??= new ai.Session("gte-small");
    const output = await session.run(text.slice(0, 1000), { mean_pool: true, normalize: true });
    // number[] in current runtimes; accept a typed array too.
    const embedding = output && typeof output === "object" && "length" in output ? Array.from(output as ArrayLike<number>) : [];
    if (embedding.length !== 384) throw new Error("bad embedding");
    const { data, error } = await db.rpc("match_srd", { query_embedding: embedding, match_count: count });
    if (error) throw new Error(`match_srd: ${error.code ?? ""} ${error.message}`);
    return (Array.isArray(data) ? data : []) as SemanticMatch[];
  };
}
