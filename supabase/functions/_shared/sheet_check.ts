// A deterministic check of a player character sheet. The Sage does not hunt for mistakes itself
// any more: this code finds them, and the model only explains what it is given, in its voice.
// Pure TypeScript with no imports, so Deno tests it directly and the rules never drift with a prompt.
//
// "fix"     something the creation rules (or plain sense) say is wrong.
// "suggest" a gentle note: legal, but worth a look.

export type Severity = "fix" | "suggest";

/** Where a finding comes from in the SRD 5.2.1 (short form, as the card footer shows it). */
export type SheetRef = { title: string; page: number };

export type Finding = {
  severity: Severity;
  /** Which part of the sheet, e.g. "Strength", "Gear". */
  field: string;
  /** What is off, in plain words. */
  problem: string;
  /** How to fix it (or what to consider). */
  fix: string;
  ref: SheetRef;
};

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

/** The sheet as the app sends it (all optional: old app versions only send the short brief). */
export type Sheet = {
  name?: string;
  race?: string;
  class?: string;
  level?: number;
  hp_current?: number;
  hp_max?: number;
  ac?: number;
  speed?: number;
  scores: Partial<Record<AbilityKey, number>>;
  skills: string[];
  languages: string[];
  features: string[];
  traits: string[];
  gear: string[];
  /** true when this came from the old short brief: missing fields there are unknown, not empty. */
  partial?: boolean;
};

// Keep equal to src/lib/sheetLists.ts (sheet_check_test.ts checks it).
export const RACES = ["Dragonborn", "Dwarf", "Elf", "Gnome", "Goliath", "Halfling", "Human", "Orc", "Tiefling"];
export const CLASSES = [
  "Barbarian",
  "Bard",
  "Cleric",
  "Druid",
  "Fighter",
  "Monk",
  "Paladin",
  "Ranger",
  "Rogue",
  "Sorcerer",
  "Warlock",
  "Wizard",
];

export const ABILITIES: [AbilityKey, string][] = [
  ["str", "Strength"],
  ["dex", "Dexterity"],
  ["con", "Constitution"],
  ["int", "Intelligence"],
  ["wis", "Wisdom"],
  ["cha", "Charisma"],
];
const ABILITY_NAME = Object.fromEntries(ABILITIES) as Record<AbilityKey, string>;

// SRD 5.2.1 Class Overview table (Step 1: Choose Class, p. 19).
const PRIMARY: Record<string, AbilityKey[]> = {
  Barbarian: ["str"],
  Bard: ["cha"],
  Cleric: ["wis"],
  Druid: ["wis"],
  Fighter: ["str", "dex"],
  Monk: ["dex", "wis"],
  Paladin: ["str", "cha"],
  Ranger: ["dex", "wis"],
  Rogue: ["dex"],
  Sorcerer: ["cha"],
  Warlock: ["cha"],
  Wizard: ["int"],
};

// Level 1 features of each class in the SRD 5.2.1, used to say what belongs under Features.
const LEVEL_1: Record<string, string> = {
  Barbarian: "Rage, Unarmored Defense and Weapon Mastery",
  Bard: "Bardic Inspiration and Spellcasting",
  Cleric: "Spellcasting and Divine Order",
  Druid: "Spellcasting, Druidic and Primal Order",
  Fighter: "Fighting Style, Second Wind and Weapon Mastery",
  Monk: "Martial Arts and Unarmored Defense",
  Paladin: "Lay On Hands, Spellcasting and Weapon Mastery",
  Ranger: "Spellcasting, Favored Enemy and Weapon Mastery",
  Rogue: "Expertise, Sneak Attack, Thieves' Cant and Weapon Mastery",
  Sorcerer: "Spellcasting and Innate Sorcery",
  Warlock: "Eldritch Invocations and Pact Magic",
  Wizard: "Spellcasting, Ritual Adept and Arcane Recovery",
};

export const REFS = {
  adjust: { title: "Adjust Ability Scores", page: 21 },
  generate: { title: "Generate Your Scores", page: 21 },
  chooseClass: { title: "Choose Class", page: 19 },
  species: { title: "Choose a Species", page: 20 },
  level: { title: "Level Advancement", page: 23 },
  numbers: { title: "Fill In Numbers", page: 22 },
  features: { title: "Record Class Features", page: 22 },
  equipment: { title: "Choose Starting Equipment", page: 20 },
  create: { title: "Create Your Character", page: 19 },
} satisfies Record<string, SheetRef>;

// Whole entries that are filler, not content ("Lol", "Yes", "asdf").
const JUNK = new Set(
  (
    "lol lool lmao lmfao rofl yes yeah yep yup no nope nah ok okay k test testing tester asdf asdfg asdfgh " +
    "qwerty qwer idk dunno blah stuff things thing whatever something sth xxx xx x tbd todo placeholder " +
    "hi hello hey hmm meh haha hehe abc abcd 123 1234 poop sdf jkl fdsa aaa zzz dsfdsf fff"
  ).split(" "),
);
// Honest "nothing here" entries: empty, not junk.
const EMPTY_ENTRY = /^\s*(?:none(?: yet)?|nothing|n\/?a|-+)?\s*\.?\s*$/i;

function norm(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim();
}

/** True for an entry that is filler rather than a real feature, trait or item. */
export function isJunk(entry: string): boolean {
  if (EMPTY_ENTRY.test(entry)) return false;
  const n = norm(entry);
  if (!n) return true; // "???", "!!", "..."
  if (JUNK.has(n)) return true;
  const word = n.replace(/\s+/g, "");
  if (/^(.)\1{2,}$/.test(word)) return true; // "aaaa"
  if (/^(?:ha|he|lo)+l?h?$/.test(word) && word.length >= 4) return true; // "hahaha", "lolol"
  if (/^[bcdfghjklmnpqrstvwxz]{4,}$/.test(word)) return true; // "sdfgh", keyboard mash
  return false;
}

/** Splits a free-text field ("Rage, Unarmored Defense" or one per line) into entries. */
export function entries(value: unknown, max = 12): string[] {
  const raw = Array.isArray(value) ? value.map((v) => String(v ?? "")) : String(value ?? "").split(/[\n,;•]+/);
  return raw.map((v) => v.replace(/\s+/g, " ").trim().slice(0, 60)).filter((v) => !EMPTY_ENTRY.test(v)).slice(0, max);
}

function num(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

function str(value: unknown, max = 40): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.replace(/\s+/g, " ").trim().slice(0, max);
  return t || undefined;
}

/** Reads the structured sheet the app sends (body.character). null when there is none. */
export function readSheet(value: unknown): Sheet | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const scores: Partial<Record<AbilityKey, number>> = {};
  for (const [key] of ABILITIES) {
    const n = num(v[key]);
    if (n !== undefined) scores[key] = n;
  }
  return {
    name: str(v.name),
    race: str(v.race ?? v.species),
    class: str(v.class),
    level: num(v.level),
    hp_current: num(v.hp_current),
    hp_max: num(v.hp_max),
    ac: num(v.ac),
    speed: num(v.speed),
    scores,
    skills: entries(v.skills, 18),
    languages: entries(v.languages, 8),
    features: entries(v.features, 12),
    traits: entries(v.traits, 8),
    gear: entries(v.gear, 12),
  };
}

function known(list: string[], value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  return list.find((item) => item.toLowerCase() === v);
}

/** Best effort for old app versions that only send the short brief:
 *  "Brakka Human Fighter L1. AC14 SPD30 PB+2 HP 12/12. STR15 DEX14 ... Gear: ... Traits: ... Features: ..." */
export function parseBrief(brief: string): Sheet | null {
  if (!brief.trim()) return null;
  const scores: Partial<Record<AbilityKey, number>> = {};
  for (const [key] of ABILITIES) {
    const m = new RegExp(`\\b${key}\\s*:?\\s*(-?\\d+)`, "i").exec(brief);
    if (m) scores[key] = Number(m[1]);
  }
  const grab = (re: RegExp) => {
    const m = re.exec(brief);
    return m ? Number(m[1]) : undefined;
  };
  const list = (label: string) => {
    const m = new RegExp(`\\b${label}:\\s*([^\\n]*?)(?=\\.\\s+(?:Skills|Gear|Traits|Features):|\\n|$)`, "i").exec(brief);
    return m ? entries(m[1].replace(/\.$/, "")) : [];
  };
  const firstLine = brief.split(/[.\n]/)[0];
  const words = firstLine.split(/\s+/);
  const hp = /\bHP\s*(-?\d+)\s*\/\s*(-?\d+)/i.exec(brief);
  return {
    race: words.map((w) => known(RACES, w)).find(Boolean),
    class: words.map((w) => known(CLASSES, w)).find(Boolean),
    level: grab(/\bL(?:evel)?\s*(\d+)\b/),
    ac: grab(/\bAC\s*:?\s*(-?\d+)/i),
    speed: grab(/\b(?:SPD|Speed)\s*:?\s*(-?\d+)/i),
    hp_current: hp ? Number(hp[1]) : undefined,
    hp_max: hp ? Number(hp[2]) : undefined,
    scores,
    skills: list("Skills"),
    languages: [],
    features: list("Features"),
    traits: list("Traits"),
    gear: list("Gear"),
    partial: true,
  };
}

/** The Ledger's blank starting sheet (EMPTY in src/screens/LedgerScreen.tsx): what a new player sees
 *  before they fill anything in. It is drawn on the phone and only stored on "Save sheet", so the
 *  app sends no sheet for it; the Sage reviews this instead. Keep equal to EMPTY. */
export const TEMPLATE_SHEET: Sheet = {
  level: 1,
  hp_current: 10,
  hp_max: 10,
  ac: 10,
  speed: 30,
  scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  skills: [],
  languages: [],
  features: [],
  traits: [],
  gear: [],
};

/** True when every ability score is filled in and still the starting 10. */
function allTens(sheet: Sheet): boolean {
  return ABILITIES.every(([key]) => sheet.scores[key] === 10);
}

/** True for the untouched starting template (saved or not): no name, species, class, lists, all 10s. */
export function isTemplate(sheet: Sheet): boolean {
  return !sheet.partial && !sheet.name && !sheet.race && !sheet.class && allTens(sheet) &&
    !sheet.features.length && !sheet.traits.length && !sheet.skills.length && !sheet.gear.length;
}

/** Ability Score Improvements by level (4, 8, 12, 16) and the Epic Boon at 19, each worth +2. */
function boosts(level: number): number {
  return [4, 8, 12, 16, 19].filter((l) => level >= l).length;
}

const quote = (items: string[]) => items.map((i) => `"${i}"`).join(", ");

/** Every finding for a sheet: fixes first, then suggestions. Never flags labels or style. */
export function checkSheet(sheet: Sheet): Finding[] {
  const out: Finding[] = [];
  const add = (severity: Severity, field: string, problem: string, fix: string, ref: SheetRef) =>
    out.push({ severity, field, problem, fix, ref });
  const level = sheet.level;
  const klass = known(CLASSES, sheet.class);
  const race = known(RACES, sheet.race);

  // Race and class. A custom one is allowed by the app, so it is only a note.
  if (!sheet.partial || sheet.race !== undefined) {
    if (!sheet.race) add("fix", "Species", "No species (race) is chosen.", `Pick one, such as ${RACES.slice(0, 3).join(", ")} or ${RACES[6]}.`, REFS.species);
    else if (!race) add("suggest", "Species", `"${sheet.race}" is not one of the SRD species.`, "That is fine if your DM allows it; check it with them.", REFS.species);
  }
  if (!sheet.partial || sheet.class !== undefined) {
    if (!sheet.class) add("fix", "Class", "No class is chosen.", "Pick one of the twelve classes.", REFS.chooseClass);
    else if (!klass) add("suggest", "Class", `"${sheet.class}" is not one of the SRD classes.`, "That is fine if your DM allows it; check it with them.", REFS.chooseClass);
  }
  if (!sheet.partial && !sheet.name) add("suggest", "Name", "The character has no name.", "Give them one.", REFS.create);

  if (level === undefined) {
    if (!sheet.partial) add("fix", "Level", "No level is set.", "Set a level from 1 to 20; new characters start at 1.", REFS.level);
  } else if (level < 1 || level > 20) {
    add("fix", "Level", `Level ${level} is outside 1 to 20.`, "Set a level from 1 to 20.", REFS.level);
  }

  // Ability scores. Creation can't raise a score above 20; only the Epic Boons at level 19+ can.
  const cap = level !== undefined && level >= 19 ? 30 : 20;
  for (const [key, name] of ABILITIES) {
    const score = sheet.scores[key];
    if (score === undefined) {
      if (!sheet.partial) add("fix", name, `${name} has no score.`, "Fill in all six ability scores.", REFS.generate);
      continue;
    }
    if (score > cap) {
      add("fix", name, `${name} is ${score}, but a player character's score can't go above ${cap}${cap === 20 ? " at this level" : ""}.`, `Lower it to ${cap} or less.`, REFS.adjust);
    } else if (score < 1) {
      add("fix", name, `${name} is ${score}; scores start at 1.`, "Raise it to at least 1; creation scores are 3 or more.", REFS.generate);
    }
  }

  if (!sheet.partial && allTens(sheet)) {
    add("fix", "Ability Scores", "All six ability scores are still the starting 10.", "Set them with the standard array (15, 14, 13, 12, 10, 8), point buy or a roll.", REFS.generate);
  }

  // Hit points, Armor Class, Speed. 0 current HP is legal (down and dying); a 0 maximum is not.
  if (sheet.hp_max !== undefined && sheet.hp_max <= 0) {
    add("fix", "Hit Points", `Maximum Hit Points are ${sheet.hp_max}.`, "At level 1 it is your class's Hit Die maximum plus your Constitution modifier.", REFS.numbers);
  } else if (sheet.hp_current !== undefined && sheet.hp_current < 0) {
    add("fix", "Hit Points", `Current Hit Points are ${sheet.hp_current}; they never drop below 0.`, "Set them to 0 or more.", REFS.numbers);
  } else if (sheet.hp_current !== undefined && sheet.hp_max !== undefined && sheet.hp_current > sheet.hp_max) {
    add("fix", "Hit Points", `Current Hit Points (${sheet.hp_current}) are above the maximum (${sheet.hp_max}).`, "Lower them to the maximum; extra points are Temporary Hit Points.", REFS.numbers);
  }
  if (sheet.ac !== undefined && sheet.ac <= 0) {
    add("fix", "Armor Class", `Armor Class is ${sheet.ac}.`, "Without armor it is 10 plus your Dexterity modifier.", REFS.numbers);
  }
  if (sheet.speed !== undefined && sheet.speed <= 0) {
    add("fix", "Speed", `Speed is ${sheet.speed} ft.`, "Use your species' Speed, usually 30 ft.", REFS.species);
  }

  // Filler text in the lists.
  const junk = (field: string, items: string[], fix: string, ref: SheetRef) => {
    const bad = items.filter(isJunk);
    if (bad.length) add("fix", field, `${field} has placeholder text: ${quote(bad)}.`, fix, ref);
    return bad.length > 0;
  };
  const featureFix = klass
    ? `Replace it with your class features; a level 1 ${klass} has ${LEVEL_1[klass]}.`
    : "Replace it with your class features.";
  const badFeatures = junk("Features", sheet.features, featureFix, REFS.features);
  junk("Traits", sheet.traits, "Replace it with your species traits, or clear it.", REFS.species);
  junk("Gear", sheet.gear, "Replace it with your starting equipment from your class and background.", REFS.equipment);
  if (!sheet.partial && !badFeatures && !sheet.features.length) {
    add("suggest", "Features", "No class features are written down.", klass ? `A level 1 ${klass} has ${LEVEL_1[klass]}.` : "Pick a class, then write down its level 1 features.", REFS.features);
  }
  if (!sheet.partial && !sheet.traits.length) {
    add("suggest", "Traits", "No species traits are written down.", race ? `Write down the ${race} traits.` : "Pick a species, then write down its traits.", REFS.species);
  }

  // Gentle notes on the scores.
  const all = ABILITIES.map(([key]) => sheet.scores[key]).filter((s): s is number => s !== undefined);
  if (klass && all.length === 6) {
    const main = PRIMARY[klass];
    const best = Math.max(...main.map((k) => sheet.scores[k] ?? 0));
    const top = Math.max(...all);
    if (best < top) {
      const topName = ABILITIES.find(([k]) => sheet.scores[k] === top)![1];
      const mainNames = main.map((k) => ABILITY_NAME[k]).join(main.length > 1 && klass === "Fighter" ? " or " : " and ");
      add("suggest", "Ability Scores", `${mainNames} is a ${klass}'s main ability, but your highest score is ${topName}.`, `Consider putting your best score in ${mainNames}.`, REFS.chooseClass);
    }
    const total = all.reduce((sum, s) => sum + Math.min(Math.max(s, 0), cap), 0);
    const high = 75 + 2 * boosts(level ?? 1) + 6;
    if (total > high || total < 60) {
      add("suggest", "Ability Scores", `Your scores add up to ${total}, ${total > high ? "well above" : "well below"} the standard array or point buy (about 72 to 75 at level 1).`, "Fine if you rolled them; just check the method with your DM.", REFS.generate);
    }
  }

  return [...out.filter((f) => f.severity === "fix"), ...out.filter((f) => f.severity === "suggest")];
}

/** The sheet as short labelled lines for the model ("Speed: 30 ft"), so nothing reads like an error. */
export function labelledSheet(sheet: Sheet): string {
  const lines: string[] = [];
  const who = [sheet.name && `Name: ${sheet.name}`, sheet.race && `Species: ${sheet.race}`, sheet.class && `Class: ${sheet.class}`, sheet.level !== undefined && `Level: ${sheet.level}`];
  lines.push(who.filter(Boolean).join("; "));
  const pb = sheet.level !== undefined ? 2 + Math.floor((Math.min(20, Math.max(1, sheet.level)) - 1) / 4) : undefined;
  const combat = [
    sheet.hp_max !== undefined && `Hit Points: ${sheet.hp_current ?? sheet.hp_max} of ${sheet.hp_max}`,
    sheet.ac !== undefined && `Armor Class: ${sheet.ac}`,
    sheet.speed !== undefined && `Speed: ${sheet.speed} ft`,
    pb !== undefined && `Proficiency Bonus: +${pb}`,
  ];
  lines.push(combat.filter(Boolean).join("; "));
  const scores = ABILITIES.filter(([k]) => sheet.scores[k] !== undefined).map(([k, name]) => `${name} ${sheet.scores[k]}`);
  if (scores.length) lines.push(`Ability scores: ${scores.join(", ")}`);
  const list = (label: string, items: string[], max: number) => {
    if (items.length) lines.push(`${label}: ${items.slice(0, max).join(", ")}`);
  };
  list("Skills", sheet.skills, 8);
  list("Languages", sheet.languages, 4);
  list("Features", sheet.features, 6);
  list("Traits", sheet.traits, 4);
  list("Gear", sheet.gear, 6);
  return lines.filter(Boolean).join("\n");
}

/** "must change" for a fix, "optional" for a suggestion: neutral words with nothing to copy as a label. */
export const KIND_WORD: Record<Severity, string> = { fix: "must change", suggest: "optional" };

const cell = (value: string) => value.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

/**
 * The findings as the model reads them: a compact table, one row each, fixes first. It is data,
 * not prose, so there are no "Fix:" lines for the model to echo back as a checklist.
 */
export function findingsText(findings: Finding[]): string {
  if (!findings.length) return "None. The sheet follows the creation rules.";
  const rows = findings.map((f) => [KIND_WORD[f.severity], f.field, f.problem, f.fix].map(cell).join(" | "));
  return ["kind | field | what is off | remedy", ...rows].join("\n");
}

/** The card footer for a review, built from the findings: "Adjust Ability Scores, p. 21; ...". */
export function findingsSource(findings: Finding[], max = 2): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of findings) {
    const key = `${f.ref.title}, p. ${f.ref.page}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out.slice(0, max).join("; ");
}
