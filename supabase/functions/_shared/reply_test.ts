// deno test supabase/functions/_shared/reply_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { dropClosers, pickSource, shortCitation, splitReply } from "./reply.ts";

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

Deno.test("footer variants: bold, plural, dashes, brackets, and not on the last line", () => {
  const cases: [string, string, string][] = [
    ["Half cover is +2 AC.\n**Source:** Cover, p. 179", "Half cover is +2 AC.", "Cover, p. 179"],
    ["Half cover is +2 AC.\nSources: Cover, p. 179; Prone, p. 190", "Half cover is +2 AC.", "Cover, p. 179; Prone, p. 190"],
    ["Half cover is +2 AC.\nSource — Cover, p. 179", "Half cover is +2 AC.", "Cover, p. 179"],
    ["Half cover is +2 AC.\nSource – Cover, p. 179", "Half cover is +2 AC.", "Cover, p. 179"],
    ["Half cover is +2 AC.\n(Source: Cover, p. 179)", "Half cover is +2 AC.", "Cover, p. 179"],
    ["Half cover is +2 AC.\n*Source: Cover, p. 179*", "Half cover is +2 AC.", "Cover, p. 179"],
    ["Half cover is +2 AC.\n- Source: Cover, p. 179.", "Half cover is +2 AC.", "Cover, p. 179"],
    ["Half cover is +2 AC. — Source: Cover, p. 179", "Half cover is +2 AC.", "Cover, p. 179"],
    ["Half cover is +2 AC. Sources: Cover, p. 179", "Half cover is +2 AC.", "Cover, p. 179"],
    ["Duck behind the wall!\nSource: Cover, p. 179\nA wall, a crate, a friend so stout,\nkeeps the arrows out!", "Duck behind the wall!\nA wall, a crate, a friend so stout,\nkeeps the arrows out!", "Cover, p. 179"],
    ["Half cover is +2 AC.\nSRD: Cover, p. 179", "Half cover is +2 AC.", "Cover, p. 179"],
    ["Half cover is +2 AC.\nSource: none", "Half cover is +2 AC.", ""],
  ];
  for (const [raw, text, source] of cases) assertEquals(splitReply(raw), { text, source }, raw);
});

Deno.test("words that only look like a source stay in the answer", () => {
  for (const text of ["Source of the curse: a hag.", "The sources say otherwise.", "The SRD covers this."]) {
    assertEquals(splitReply(text).text, text);
  }
});

const HITS = [
  { citation: "SRD 5.2.1, Rules Glossary > Cover, p. 179" },
  { citation: "SRD 5.2.1, Rules Glossary > Opportunity Attacks, p. 185" },
  { citation: "SRD 5.2.1, Spells > Fireball, p. 131" },
];

Deno.test("pickSource keeps a footer the model copied from the extracts", () => {
  assertEquals(pickSource("Cover, p. 179", "Half cover is +2 AC.", HITS), "Cover, p. 179");
  assertEquals(pickSource("Fireball, p. 131; Cover, p. 179", "x", HITS), "Fireball, p. 131; Cover, p. 179");
});

Deno.test("pickSource drops a made-up page and falls back to what the answer is about", () => {
  assertEquals(pickSource("Cover, p. 12", "Half cover is +2 AC.", HITS), "Cover, p. 179");
  assertEquals(pickSource("Grappled, p. 180", "It is the same as an opportunity attack.", HITS), "Opportunity Attacks, p. 185");
});

Deno.test("pickSource: a ruling with no Source line still gets one; lore and declines get none", () => {
  assertEquals(pickSource("", "Fireball deals 8d6 fire damage in a 20-foot sphere.", HITS), "Fireball, p. 131");
  assertEquals(pickSource("", "Lore: Fireball was first cast by a gnome.", HITS), "");
  assertEquals(pickSource("", "That lies outside my tome. Shall we get back to the game?", HITS), "");
});

Deno.test("help-desk closers are dropped; in-character offers stay", () => {
  assertEquals(dropClosers("Strength 30 is too high. Lower it to 20. Let me know if there's anything else I can help with."), "Strength 30 is too high. Lower it to 20.");
  assertEquals(dropClosers("Lower it to 20. I am happy to help you rebuild the sheet. Feel free to ask!"), "Lower it to 20.");
  assertEquals(dropClosers("Strength 30 is too high. Lower it to 20, and let me know if you need help fixing it."), "Strength 30 is too high. Lower it to 20.");
  assertEquals(dropClosers("Lower it to 20, and let me know if you need help."), "Lower it to 20.");
  assertEquals(dropClosers("Thy sheet is fine. If thou needest more, I am here to help."), "Thy sheet is fine. If thou needest more, I am here to help.");
  assertEquals(dropClosers("Lower it to 20.\nShall we mend thy runes together?"), "Lower it to 20.\nShall we mend thy runes together?");
  assertEquals(dropClosers("Happy to help!"), "Happy to help!");
});
