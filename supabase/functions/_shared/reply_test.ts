// deno test supabase/functions/_shared/reply_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { shortCitation, splitReply } from "./reply.ts";

Deno.test("the Wizard's old inline breadcrumb citations move out of the spoken text", () => {
  const raw = "Your sheet is missing an alignment. Those are the clear issues. " +
    "(SRD: Creation > Create Your Character > Step 4: Alignment, p. 21; SRD: Creation > Create Your Character > Step 5: Character Creation Details, p. 22)";
  assertEquals(splitReply(raw), {
    text: "Your sheet is missing an alignment. Those are the clear issues.",
    source: "Alignment, p. 21; Character Creation Details, p. 22",
  });
});

Deno.test("a Source line on its own line or after the last sentence", () => {
  assertEquals(splitReply("Fireball deals 8d6.\nSource: Fireball, p. 131"), { text: "Fireball deals 8d6.", source: "Fireball, p. 131" });
  assertEquals(splitReply("Half cover is +2 AC. Source: Cover, p. 179"), { text: "Half cover is +2 AC.", source: "Cover, p. 179" });
  assertEquals(splitReply("Prone is bad.\n(Sources: Prone, p. 190; Cover, p. 179; Dash, p. 180)").source, "Prone, p. 190; Cover, p. 179");
});

Deno.test("citations mid-sentence are removed cleanly", () => {
  assertEquals(splitReply("Half cover gives +2 AC (SRD 5.2.1, Rules Glossary > Cover, p. 179). Nice.").text, "Half cover gives +2 AC. Nice.");
});

Deno.test("ordinary words and brackets are left alone", () => {
  for (const text of ["The source of the curse is unknown.", "Lore: Asmodeus rules the Nine Hells.", "Roll a d20 (with Advantage)."]) {
    assertEquals(splitReply(text), { text, source: "" });
  }
  assertEquals(splitReply("Source: Cover, p. 179").text, "Source: Cover, p. 179");
});

Deno.test("short citations", () => {
  assertEquals(shortCitation("SRD 5.2.1, Creation > Create Your Character > Step 4: Alignment, p. 21"), "Alignment, p. 21");
  assertEquals(shortCitation("SRD: Fireball, p. 131"), "Fireball, p. 131");
  assertEquals(shortCitation("Classes > Barbarian > Level 1: Rage, p. 28"), "Level 1: Rage, p. 28");
});
