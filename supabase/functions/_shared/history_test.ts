// deno test --allow-read supabase/functions/_shared/history_test.ts
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { historyMessages, isFollowUp, MAX_HISTORY_CHARS, readHistory } from "./history.ts";

Deno.test("keeps the last 3 valid exchanges, oldest first", () => {
  const raw = [1, 2, 3, 4, 5].map((n) => ({ q: `q${n}`, a: `a${n}` }));
  assertEquals(readHistory(raw).map((t) => t.q), ["q3", "q4", "q5"]);
  assertEquals(readHistory("nope"), []);
  assertEquals(readHistory([{ q: "x" }, { q: 1, a: 2 }, null, { q: " ", a: "y" }]), []);
});

Deno.test("long questions and replies are clipped, and the total stays about 600 tokens", () => {
  const long = "word ".repeat(400);
  const turns = readHistory([{ q: long, a: long }, { q: long, a: long }, { q: long, a: long }]);
  for (const t of turns) {
    assert(t.q.length <= 300 && t.a.length <= 500);
    assert(t.a.endsWith("…"));
  }
  assert(turns.reduce((n, t) => n + t.q.length + t.a.length, 0) <= MAX_HISTORY_CHARS);
  assertEquals(turns.length, 3);
});

Deno.test("history becomes user/assistant turns", () => {
  assertEquals(historyMessages([{ q: "how does rage work", a: "Bonus action..." }]), [
    { role: "user", content: "Question: how does rage work" },
    { role: "assistant", content: "Bonus action..." },
  ]);
});

Deno.test("follow-ups are short and lean on the last message", () => {
  for (const q of ["how long does it last?", "what about at level 5?", "and the Bard?", "does it stack", "what if they're prone"]) {
    assert(isFollowUp(q), q);
  }
  for (const q of ["how does grappling work", "what does prone do", "how much damage does fireball do at level 3"]) {
    assertFalse(isFollowUp(q), q);
  }
});
