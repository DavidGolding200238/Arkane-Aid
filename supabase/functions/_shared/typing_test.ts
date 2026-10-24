// The app's typewriter timing (src/lib/typing.ts), tested here with the other pure helpers.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { revealCount, TYPING_CPS, typingDuration } from "../../../src/lib/typing.ts";

Deno.test("typing runs at a steady 40 to 60 characters a second", () => {
  assert(TYPING_CPS >= 40 && TYPING_CPS <= 60);
  assertEquals(revealCount(1000, 500), TYPING_CPS);
  assertEquals(revealCount(2000, 500), TYPING_CPS * 2);
});

Deno.test("each frame reveals a few letters, never words at a time", () => {
  // 60 fps frames: one or two characters each, evenly.
  const frames = Array.from({ length: 60 }, (_, i) => revealCount((i + 1) * (1000 / 60), 1000));
  const steps = frames.map((n, i) => n - (i ? frames[i - 1] : 0));
  assert(steps.every((step) => step <= 2), steps.join(","));
  // A dropped frame catches up instead of slowing down.
  assertEquals(revealCount(500, 1000), Math.floor(TYPING_CPS / 2));
});

Deno.test("typing is time based and clamps at the end", () => {
  assertEquals(revealCount(0, 10), 0);
  assertEquals(revealCount(-5, 10), 0);
  assertEquals(revealCount(60_000, 10), 10);
  assertEquals(revealCount(100, 0), 0);
  assertEquals(typingDuration(TYPING_CPS * 3), 3000);
});

Deno.test("an emoji is never cut in half", () => {
  const text = "a🎲b";
  for (let ms = 0; ms < 200; ms += 1) {
    const n = revealCount(ms, text.length, text, 55);
    const code = n > 0 ? text.charCodeAt(n - 1) : 0;
    assert(!(code >= 0xd800 && code <= 0xdbff), `cut at ${n}`);
  }
});
