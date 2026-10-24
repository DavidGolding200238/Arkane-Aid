import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  checkSheet,
  CLASSES,
  findingsSource,
  findingsText,
  isJunk,
  labelledSheet,
  parseBrief,
  RACES,
  readSheet,
  type Sheet,
} from "./sheet_check.ts";
import * as app from "../../../src/lib/sheetLists.ts";

/** David's sheet from the bug report: STR 30, "Traits: Yes", "Features: Lol", "Gear: Lol", Speed 30, a Bard. */
export const DAVID = {
  name: "David",
  race: "Human",
  class: "Bard",
  level: 1,
  hp_current: 9,
  hp_max: 9,
  ac: 12,
  speed: 30,
  str: 30,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
  skills: ["Performance", "Persuasion"],
  languages: "Common",
  features: "Lol",
  traits: ["Yes"],
  gear: ["Lol"],
};

const GOOD = {
  name: "Brakka",
  race: "Orc",
  class: "Barbarian",
  level: 1,
  hp_current: 14,
  hp_max: 14,
  ac: 14,
  speed: 30,
  str: 17,
  dex: 13,
  con: 15,
  int: 8,
  wis: 12,
  cha: 10,
  skills: ["Athletics", "Intimidation"],
  languages: "Common, Orc",
  features: "Rage, Unarmored Defense, Weapon Mastery",
  traits: ["Darkvision", "Relentless Endurance"],
  gear: ["Greataxe", "Handaxe"],
};

const check = (over: Record<string, unknown> = {}) => checkSheet(readSheet({ ...GOOD, ...over }) as Sheet);
const fixes = (findings: ReturnType<typeof checkSheet>) => findings.filter((f) => f.severity === "fix");
const suggestions = (findings: ReturnType<typeof checkSheet>) => findings.filter((f) => f.severity === "suggest");

Deno.test("the checker's race and class lists match the Ledger's", () => {
  assertEquals(RACES, app.RACES);
  assertEquals(CLASSES, app.CLASSES);
});

Deno.test("David's sheet: Strength 30, Traits Yes, Features Lol, Gear Lol are fixes", () => {
  const findings = checkSheet(readSheet(DAVID)!);
  const fix = fixes(findings);
  assertEquals(fix.map((f) => f.field), ["Strength", "Features", "Traits", "Gear"]);
  assertStringIncludes(fix[0].problem, "can't go above 20");
  assertStringIncludes(fix[1].problem, '"Lol"');
  assertStringIncludes(fix[1].fix, "Bardic Inspiration and Spellcasting");
  assertStringIncludes(fix[2].problem, '"Yes"');
  assertStringIncludes(fix[3].problem, '"Lol"');
});

Deno.test("David's sheet: Charisma not highest is a suggestion; Speed 30 and no alignment are not flagged", () => {
  const findings = checkSheet(readSheet(DAVID)!);
  const notes = suggestions(findings);
  assertEquals(notes.length, 1);
  assertStringIncludes(notes[0].problem, "Charisma is a Bard's main ability");
  const all = findingsText(findings).toLowerCase();
  for (const bad of ["speed", "spd", "alignment", "creature", "monster", "human"]) assert(!all.includes(bad), bad);
});

Deno.test("David's sheet: the footer comes from the findings", () => {
  assertEquals(findingsSource(checkSheet(readSheet(DAVID)!)), "Adjust Ability Scores, p. 21; Record Class Features, p. 22");
});

Deno.test("a clean sheet has no findings and no footer", () => {
  const findings = check();
  assertEquals(findings, []);
  assertEquals(findingsSource(findings), "");
  assertStringIncludes(findingsText(findings), "None");
});

Deno.test("ability scores: above 20 and below 1 are fixes; 20 is fine; 19+ may go to 30", () => {
  assertEquals(fixes(check({ dex: 21 })).map((f) => f.field), ["Dexterity"]);
  assertEquals(fixes(check({ int: 0 })).map((f) => f.field), ["Intelligence"]);
  assertEquals(fixes(check({ str: 20 })), []);
  assertEquals(fixes(check({ str: 24, level: 19 })), []);
  assertEquals(fixes(check({ str: 31, level: 20 })).map((f) => f.field), ["Strength"]);
});

Deno.test("level, HP, AC and Speed: only impossible values are fixes", () => {
  assertEquals(fixes(check({ level: 0 })).map((f) => f.field), ["Level"]);
  assertEquals(fixes(check({ level: 21 })).map((f) => f.field), ["Level"]);
  assertEquals(fixes(check({ hp_max: 0, hp_current: 0 })).map((f) => f.field), ["Hit Points"]);
  assertEquals(fixes(check({ hp_current: 0 })), [], "0 HP is down, not wrong");
  assertEquals(fixes(check({ hp_current: 20 })).map((f) => f.field), ["Hit Points"]);
  assertEquals(fixes(check({ ac: 0 })).map((f) => f.field), ["Armor Class"]);
  assertEquals(fixes(check({ ac: -1 })).map((f) => f.field), ["Armor Class"]);
  assertEquals(fixes(check({ speed: 0 })).map((f) => f.field), ["Speed"]);
  assertEquals(check({ speed: 35 }), []);
});

Deno.test("missing race or class is a fix; a custom one is only a suggestion", () => {
  assertEquals(fixes(check({ race: "" })).map((f) => f.field), ["Species"]);
  assertEquals(fixes(check({ class: null })).map((f) => f.field), ["Class"]);
  const custom = check({ race: "Half-Elf", class: "Artificer" });
  assertEquals(fixes(custom), []);
  assertEquals(suggestions(custom).map((f) => f.field), ["Species", "Class"]);
});

Deno.test("missing ability scores are fixes on a full sheet", () => {
  assertEquals(fixes(check({ wis: undefined })).map((f) => f.field), ["Wisdom"]);
});

Deno.test("placeholder text is caught; real entries and empty fields are not", () => {
  for (const junk of ["lol", "Lol", "LOL!", "yes", "Yes.", "test", "asdf", "idk", "???", "hahaha", "sdfgh", "aaaa", "xxx"]) {
    assert(isJunk(junk), junk);
  }
  for (const real of ["Rage", "Darkvision", "Thieves' Cant", "Rope (50 ft)", "Lute", "Yew wand", "Lockpicks", "Healer's Kit", "None", "STR", "SPD"]) {
    assert(!isJunk(real), real);
  }
});

Deno.test("no class features written down is a suggestion that names the level 1 features", () => {
  const notes = suggestions(check({ features: "" }));
  assertEquals(notes.map((f) => f.field), ["Features"]);
  assertStringIncludes(notes[0].fix, "Rage, Unarmored Defense and Weapon Mastery");
});

Deno.test("score totals far from the array or point buy get a gentle note, not a fix", () => {
  const rolled = check({ str: 18, dex: 16, con: 17, int: 14, wis: 15, cha: 14 });
  assertEquals(fixes(rolled), []);
  assertEquals(suggestions(rolled).map((f) => f.field), ["Ability Scores"]);
  assertStringIncludes(suggestions(rolled)[0].problem, "well above");
  // Standard array plus a background bonus is fine.
  assertEquals(check({ str: 17, dex: 14, con: 14, int: 8, wis: 12, cha: 10 }), []);
});

Deno.test("labelled sheet spells out every label: Speed: 30 ft, never SPD", () => {
  const text = labelledSheet(readSheet(DAVID)!);
  assertStringIncludes(text, "Speed: 30 ft");
  assertStringIncludes(text, "Strength 30");
  assertStringIncludes(text, "Armor Class: 12");
  assertStringIncludes(text, "Hit Points: 9 of 9");
  assertStringIncludes(text, "Features: Lol");
  for (const label of ["SPD", "STR", "AC1", "PB+"]) assert(!text.includes(label), label);
});

Deno.test("old app brief: David's sheet still gets the same fixes, without guessing unknown fields", () => {
  const brief =
    "David Human Bard L1. AC12 SPD30 PB+2 HP 9/9. STR30 DEX10 CON10 INT10 WIS10 CHA10. Skills: Performance, Persuasion. Gear: Lol. Traits: Yes. Features: Lol";
  const sheet = parseBrief(brief)!;
  assertEquals(sheet.class, "Bard");
  assertEquals(sheet.race, "Human");
  assertEquals(sheet.speed, 30);
  assertEquals(sheet.gear, ["Lol"]);
  const findings = checkSheet(sheet);
  assertEquals(fixes(findings).map((f) => f.field), ["Strength", "Features", "Traits", "Gear"]);
  // A race the brief can't place is unknown, not missing.
  const odd = checkSheet(parseBrief("Brakka Half-Orc Barbarian L1. AC14 SPD30 PB+2 HP 15/15. STR30 DEX14 CON16 INT8 WIS12 CHA10")!);
  assertEquals(fixes(odd).map((f) => f.field), ["Strength"]);
});

Deno.test("findings reach the model as a data table with neutral kinds, never Fix/Suggestion labels", () => {
  const text = findingsText(checkSheet(readSheet(DAVID)!));
  const lines = text.split("\n");
  assertEquals(lines[0], "kind | field | what is off | remedy");
  assert(lines[1].startsWith("must change | Strength | Strength is 30"), lines[1]);
  assert(lines[lines.length - 1].startsWith("optional | Ability Scores |"), lines[lines.length - 1]);
  assert(!/\bfix\b|suggestion/i.test(text), text);
});

Deno.test("a pipe in the player's own text cannot break the findings table", () => {
  const text = findingsText(check({ race: "Elf | Orc" }));
  assert(text.includes("Elf / Orc"), text);
  for (const row of text.split("\n")) assertEquals(row.split(" | ").length, 4, row);
});
