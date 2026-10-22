// deno test supabase/functions/_shared/retrieval_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { editDistance, stem } from "./retrieval.ts";
import { srd } from "./srd.ts";

function top(question: string) {
  const result = srd.search(question);
  return { first: result.hits[0], result };
}

Deno.test("edit distance counts a swap as one typo", () => {
  assertEquals(editDistance("owlbaer", "owlbear"), 1);
  assertEquals(editDistance("firebal", "fireball"), 1);
  assertEquals(editDistance("grapled", "grappled"), 1);
});

Deno.test("stems meet across word forms", () => {
  assertEquals(stem("grappled"), stem("grapple"));
  assertEquals(stem("spells"), stem("spell"));
});

const cases: [string, string, string][] = [
  ["how much damage does firebal do", "Fireball", "spell"],
  ["what happens when im grapled", "Grappled", "condition"],
  ["owlbaer stats", "Owlbear", "monster"],
  ["magic missle", "Magic Missile", "spell"],
  ["cure wonds", "Cure Wounds", "spell"],
  ["how do death saves work", "Death Saving Throw", "glossary"],
  ["crit damage", "Critical Hit", "glossary"],
  ["what does the help action do", "Help", "glossary"],
  ["how does sneak attack work", "Level 1: Sneak Attack", "class"],
  ["half cover", "Cover", "rule"],
  ["does stunned end concentration", "Stunned", "condition"],
  ["vampyre bite", "Vampire", "monster"],
];

for (const [question, title, kind] of cases) {
  Deno.test(`"${question}" finds ${title}`, () => {
    const { first, result } = top(question);
    assert(first, "no hits");
    assertEquals(first.title, title);
    assertEquals(first.kind, kind);
    assert(result.grounded, "should be grounded");
    assert(first.citation.startsWith("SRD 5.2.1, "), first.citation);
  });
}

Deno.test("typos are reported as corrections", () => {
  const { result } = top("firebal");
  assertEquals(result.corrections, [{ from: "firebal", to: "Fireball" }]);
  assertEquals(top("owlbaer").result.corrections, [{ from: "owlbaer", to: "Owlbear" }]);
  assertEquals(top("grapled").result.corrections, [{ from: "grapled", to: "Grappled" }]);
});

Deno.test("real words are not 'corrected' into other entries", () => {
  assertEquals(top("cover").result.corrections, []);
  assertEquals(top("critical hit").result.corrections, []);
});

Deno.test("things outside the SRD are not grounded (lore fallback)", () => {
  assert(!top("tell me about the beholder").result.grounded);
  assert(!top("who is the god of the forge in the forgotten realms").result.grounded);
});

Deno.test("the extract stays within the character budget", () => {
  const { result } = top("vampire");
  const chars = result.hits.reduce((sum, hit) => sum + hit.text.length, 0);
  assert(chars <= 6000 || result.hits.length === 1, `too long: ${chars}`);
});

Deno.test("attribution is the CC-BY-4.0 statement", () => {
  assert(srd.attribution.includes("System Reference Document 5.2.1"));
  assert(srd.attribution.includes("creativecommons.org/licenses/by/4.0"));
});
