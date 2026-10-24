// The sheet cases in evals/sage-eval.json, run through the real request path with Groq mocked:
// the deterministic parts (review detection, the checker's fixes, the footer) must already match
// what the eval expects, so a live eval failure can only be the model's wording.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { ask, type AskReply } from "./ask.ts";
import evals from "../../../evals/sage-eval.json" with { type: "json" };

type Case = { id: string; kind: string; question: string; sheet?: string; character?: Record<string, unknown>; fix_fields?: string[]; source?: string[]; no_source?: boolean };

for (const c of (evals.cases as Case[]).filter((c) => c.fix_fields)) {
  for (const voice of [{ mode: "sage", style: "wizard" }, { mode: "sage", style: "plain" }, { mode: "bard", style: "plain" }]) {
    Deno.test(`eval ${c.id} (${voice.mode}/${voice.style}): checker and footer match the eval`, async () => {
      const result = (await ask({ question: c.question, sheet: c.sheet ?? "", character: c.character, ...voice }, {
        chat: () => Promise.resolve("A fine start."),
        party: () => Promise.resolve(""),
      })) as AskReply;
      assertEquals(result.retrieval, "sheet");
      assertEquals(result.findings?.filter((f) => f.severity === "fix").map((f) => f.field), c.fix_fields);
      if (c.no_source) assertEquals(result.source, "");
      if (c.source) assert(c.source.some((s) => result.source.includes(s)), result.source);
    });
  }
}
