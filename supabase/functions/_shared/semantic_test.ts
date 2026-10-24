// deno test --allow-read supabase/functions/_shared/semantic_test.ts
// Fakes Supabase.ai and the database client to check the call shape against the migration
// (20261023000006_srd_vectors.sql: match_srd(query_embedding vector(384), match_count integer)).
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { semanticSearch } from "./semantic.ts";

type Call = { fn: string; args: Record<string, unknown> };

function fakeDb(result: { data: unknown; error: unknown }, calls: Call[]) {
  return { rpc: (fn: string, args: Record<string, unknown>) => (calls.push({ fn, args }), Promise.resolve(result)) } as unknown as SupabaseClient;
}

let output: unknown = Array.from({ length: 384 }, (_, i) => i / 384);
const inputs: string[] = [];
const g = globalThis as { Supabase?: unknown };

Deno.test("no Supabase.ai in the runtime: keyword search only", () => {
  delete g.Supabase;
  assertEquals(semanticSearch(fakeDb({ data: [], error: null }, [])), undefined);
});

Deno.test("embeds with gte-small and calls match_srd with a plain array of 384", async () => {
  g.Supabase = {
    ai: {
      Session: class {
        constructor(readonly model: string) {
          if (model !== "gte-small") throw new Error(model);
        }
        run(input: string, options: { mean_pool: boolean; normalize: boolean }) {
          assertEquals(options, { mean_pool: true, normalize: true });
          inputs.push(input);
          return Promise.resolve(output);
        }
      },
    },
  };
  const calls: Call[] = [];
  const rows = [{ chunk: 3, name: "Grappled", similarity: 0.9 }];
  const search = semanticSearch(fakeDb({ data: rows, error: null }, calls), 5)!;
  assertEquals(await search("x".repeat(3000)), rows);
  assertEquals(inputs.at(-1)!.length, 1000);
  assertEquals(calls[0].fn, "match_srd");
  assertEquals(Object.keys(calls[0].args).sort(), ["match_count", "query_embedding"]);
  assertEquals(calls[0].args.match_count, 5);
  assertEquals(Array.isArray(calls[0].args.query_embedding), true);
  assertEquals((calls[0].args.query_embedding as number[]).length, 384);

  // A typed array from the runtime is turned into a plain array (JSON-serialisable for PostgREST).
  output = new Float32Array(384).fill(0.5);
  await search("fireball");
  assertEquals(Array.isArray(calls[1].args.query_embedding), true);
});

Deno.test("a bad embedding or a database error throws (hybrid falls back to keywords)", async () => {
  output = [1, 2, 3];
  const search = semanticSearch(fakeDb({ data: null, error: null }, []))!;
  await assertRejects(() => search("prone"), Error, "bad embedding");
  output = new Array(384).fill(0);
  const failing = semanticSearch(fakeDb({ data: null, error: { code: "42883", message: "function does not exist" } }, []))!;
  await assertRejects(() => failing("prone"), Error, "match_srd");
  delete g.Supabase;
});
