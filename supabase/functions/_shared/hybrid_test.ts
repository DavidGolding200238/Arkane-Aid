// deno test --allow-read supabase/functions/_shared/hybrid_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fuse, hybridSearch, type SemanticMatch } from "./hybrid.ts";
import { srd } from "./srd.ts";

const idOf = (title: string) => {
  for (let id = 0; ; id++) {
    const raw = srd.rawTitle(id);
    if (raw === undefined) throw new Error(`no ${title}`);
    if (raw === title) return id;
  }
};
const match = (title: string, similarity: number): SemanticMatch => ({ chunk: idOf(title), name: title, similarity });
const titles = (r: { hits: { title: string }[] }) => r.hits.map((h) => h.title);

Deno.test("fuse: an id high in both lists beats one high in only one", () => {
  const fused = fuse([[1, 2, 3], [3, 4, 1]]);
  assertEquals(fused[0].id, 1);
  assertEquals(fused[1].id, 3);
  assertEquals(fuse([[1], [2]], [0.5, 1])[0].id, 2);
});

Deno.test("no meaning search: exactly the keyword search", async () => {
  const question = "how does grappling work";
  const result = await hybridSearch(srd, question, { limit: 4 });
  const keyword = srd.search(question, { limit: 4 });
  assertEquals(result.retrieval, "keyword");
  assertEquals(titles(result), titles(keyword));
  assertEquals(result.grounded, keyword.grounded);
});

for (
  const [name, semantic] of [
    ["throws", () => Promise.reject(new Error("rpc down"))],
    ["times out", () => new Promise<SemanticMatch[]>(() => {})],
    ["returns nothing (not seeded)", () => Promise.resolve([])],
    ["returns rows that no longer line up", () => Promise.resolve([{ chunk: 0, name: "Not the title", similarity: 0.95 }])],
  ] as const
) {
  Deno.test(`meaning search ${name}: falls back to keyword only`, async () => {
    const question = "how much damage does firebal do";
    const result = await hybridSearch(srd, question, { limit: 4, semantic, timeoutMs: 50 });
    assertEquals(result.retrieval, "keyword");
    assertEquals(titles(result), titles(srd.search(question, { limit: 4 })));
    assertEquals(result.corrections, [{ from: "firebal", to: "Fireball" }]);
  });
}

Deno.test("meaning search finds what keywords cannot: running away -> Opportunity Attacks", async () => {
  const semantic = () => Promise.resolve([match("Opportunity Attacks", 0.86), match("Disengage [Action]", 0.84)]);
  const result = await hybridSearch(srd, "can I hit someone running away", { limit: 4, semantic });
  assertEquals(result.retrieval, "hybrid");
  assert(titles(result).slice(0, 2).includes("Opportunity Attacks"), titles(result).join(", "));
  assertEquals(result.hits.length, 4);
});

Deno.test("a named entry stays first even when meaning search disagrees", async () => {
  const semantic = () => Promise.resolve([match("Burning [Hazard]", 0.9), match("Delayed Blast Fireball", 0.89)]);
  const result = await hybridSearch(srd, "how much damage does fireball do", { limit: 4, semantic });
  assertEquals(result.hits[0].title, "Fireball");
});

Deno.test("follow-up context helps search, but only this message's typos are reported", async () => {
  const result = await hybridSearch(srd, "how long does it last?", { limit: 4, context: "how does a barbarian's rage work" });
  assert(titles(result).some((t) => t.includes("Rage")), titles(result).join(", "));
  const typo = await hybridSearch(srd, "and at level 5?", { limit: 4, context: "how much damage does firebal do" });
  assertEquals(typo.corrections, []);
});

Deno.test("stays inside the character budget", async () => {
  const semantic = () => Promise.resolve([match("Opportunity Attacks", 0.86)]);
  const result = await hybridSearch(srd, "can I hit someone running away", { limit: 4, maxChars: 1500, semantic });
  assert(result.hits.length >= 1);
  assert(result.hits.length === 1 || result.hits.reduce((n, h) => n + h.text.length, 0) <= 1500);
});
