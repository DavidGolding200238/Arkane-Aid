// The sheet cases in evals/sage-eval.json, run through the real request path with Groq mocked:
// the deterministic parts (review detection, the checker's fixes, the footer) must already match
// what the eval expects, so a live eval failure can only be the model's wording.
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { ask, type AskReply } from "./ask.ts";
import evals from "../../../evals/sage-eval.json" with { type: "json" };
import { checkReply, type EvalCase, voiceCheck } from "../../../evals/lib.ts";

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

// The live eval's own checks: a checklist reply fails sheet-david, and each voice is checked.
const david = (evals.cases as EvalCase[]).find((c) => c.id === "sheet-david")!;
const failed = (reply: string, meta = {}) => checkReply(david, reply, meta).filter((c) => !c.pass).map((c) => c.name);
const LABEL_CHECK = 'no "Fix:" / "Suggestion:" labels';

Deno.test("sheet-david fails on Fix: / Suggestion: labels, or when the function had to strip them", () => {
  assert(david.no_labels);
  const checklist = 'Fix: Strength 30 exceeds the maximum of 20; lower it to 20 or less.\nFix: Features list "Lol".\nSuggestion: Give thy character a name.';
  assert(failed(checklist).includes(LABEL_CHECK));
  assert(failed("**Suggestion (Name):** name thy hero. Strength 20, features lol.").includes(LABEL_CHECK));
  const prose = 'Ah, young one, thy Strength of 30 soars past the 20 a hero may hold; lower it. Thy features say "Lol", so write Bardic Inspiration there.';
  assertFalse(failed(prose).includes(LABEL_CHECK));
  assert(failed(prose, { labelsStripped: true }).includes(LABEL_CHECK));
});

Deno.test("the tone check covers all three voices", () => {
  const wizard = "Ah, young one, thy Strength of 30 soars past 20.";
  const arbiter = "Your Strength of 30 is above the limit of 20. Lower it.";
  const bard = "A Strength of 30? What a tale! Lower it to 20, friend.";
  assert(voiceCheck("wizard", wizard).pass);
  assertFalse(voiceCheck("wizard", arbiter).pass);
  assert(voiceCheck("arbiter", arbiter).pass);
  assertFalse(voiceCheck("arbiter", wizard).pass);
  assert(voiceCheck("bard", bard).pass);
  assertFalse(voiceCheck("bard", arbiter).pass);
  for (const id of ["sheet-david", "sheet-review", "sheet-clean"]) assert(evals.tone.includes(id), id);
});
