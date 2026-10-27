// Rolling from the Character Sheet (the dice pop-up's Check tab): which bonuses a check, save or
// attack gets, and what a roll means, under the 2024 rules. Plain TypeScript with no app imports,
// so the Deno test (scripts/check-rules.test.ts) can check it.
import { randomInt, type RollMode } from "./diceRoll";
import type { DieSides } from "./dicePolyhedra";

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export const ABILITIES: { key: AbilityKey; name: string; short: string }[] = [
  { key: "str", name: "Strength", short: "STR" },
  { key: "dex", name: "Dexterity", short: "DEX" },
  { key: "con", name: "Constitution", short: "CON" },
  { key: "int", name: "Intelligence", short: "INT" },
  { key: "wis", name: "Wisdom", short: "WIS" },
  { key: "cha", name: "Charisma", short: "CHA" },
];

export const abilityName = (key: AbilityKey) => ABILITIES.find((a) => a.key === key)!.name;

/** The 18 skills and the ability each one uses. */
export const SKILL_ABILITY: Record<string, AbilityKey> = {
  Acrobatics: "dex",
  "Animal Handling": "wis",
  Arcana: "int",
  Athletics: "str",
  Deception: "cha",
  History: "int",
  Insight: "wis",
  Intimidation: "cha",
  Investigation: "int",
  Medicine: "wis",
  Nature: "int",
  Perception: "wis",
  Performance: "cha",
  Persuasion: "cha",
  Religion: "int",
  "Sleight of Hand": "dex",
  Stealth: "dex",
  Survival: "wis",
};

/** Each class's saving throw proficiencies. */
export const CLASS_SAVES: Record<string, AbilityKey[]> = {
  barbarian: ["str", "con"],
  bard: ["dex", "cha"],
  cleric: ["wis", "cha"],
  druid: ["int", "wis"],
  fighter: ["str", "con"],
  monk: ["str", "dex"],
  paladin: ["wis", "cha"],
  ranger: ["str", "dex"],
  rogue: ["dex", "int"],
  sorcerer: ["con", "cha"],
  warlock: ["wis", "cha"],
  wizard: ["int", "wis"],
};

/** Each spellcasting class's spellcasting ability. Other classes pick one. */
export const CLASS_SPELL_ABILITY: Record<string, AbilityKey> = {
  bard: "cha",
  paladin: "cha",
  sorcerer: "cha",
  warlock: "cha",
  cleric: "wis",
  druid: "wis",
  ranger: "wis",
  wizard: "int",
  artificer: "int",
};

const classKey = (name: string | null | undefined) => (name ?? "").trim().toLowerCase();

export function classSaves(className: string | null | undefined): AbilityKey[] {
  return CLASS_SAVES[classKey(className)] ?? [];
}

export function spellAbilityFor(className: string | null | undefined): AbilityKey | null {
  return CLASS_SPELL_ABILITY[classKey(className)] ?? null;
}

/** What the rules need from the sheet. */
export type CheckSheet = {
  class: string | null;
  level: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  skills: string[];
  expertise: string[];
  /** Saves ticked on the sheet as well as the class's own (stored as "str", "dex", ...). */
  save_profs: string[];
};

export const abilityMod = (score: number) => Math.floor((score - 10) / 2);

export function proficiency(level: number) {
  return 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4);
}

export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** One BG3-style bonus card: a flat number ("Dexterity +3") or a bonus die ("Guidance +1d4"). */
export type Part = { label: string; value: number; die?: DieSides };

export type Extras = { guidance?: boolean; bless?: boolean };

export type Kind = "check" | "save" | "attack" | "death";

/** A d20 roll ready to throw: its name, the bonus cards, and whether it's an attack. */
export type D20Test = { title: string; kind: Kind; parts: Part[] };

const GUIDANCE: Part = { label: "Guidance", value: 0, die: 4 };
const BLESS: Part = { label: "Bless", value: 0, die: 4 };

function abilityPart(sheet: CheckSheet, key: AbilityKey): Part {
  return { label: abilityName(key), value: abilityMod(sheet[key]) };
}

/** Jack of All Trades: a Bard's feature from level 2 (2024 rules), so it follows the class and level
 *  on the sheet rather than a checkbox. */
export function hasJackOfAllTrades(sheet: { class: string | null | undefined; level: number }): boolean {
  return classKey(sheet.class) === "bard" && sheet.level >= 2;
}

export function savesOf(sheet: CheckSheet): AbilityKey[] {
  const keys = new Set<AbilityKey>([...classSaves(sheet.class), ...(sheet.save_profs as AbilityKey[])]);
  return ABILITIES.map((a) => a.key).filter((k) => keys.has(k));
}

/** A skill check: ability mod, + PB if proficient (2 x PB with Expertise), or half PB (rounded down)
 *  with Jack of All Trades (a Bard from level 2) on a skill you're not proficient in. Guidance adds 1d4. */
export function skillCheck(sheet: CheckSheet, skill: string, extras: Extras = {}): D20Test {
  const ability = SKILL_ABILITY[skill] ?? "str";
  const pb = proficiency(sheet.level);
  const parts: Part[] = [abilityPart(sheet, ability)];
  if (sheet.skills.includes(skill)) {
    parts.push({ label: "Proficiency", value: pb });
    if (sheet.expertise.includes(skill)) parts.push({ label: "Expertise", value: pb });
  } else if (hasJackOfAllTrades(sheet)) {
    parts.push({ label: "Jack of All Trades", value: Math.floor(pb / 2) });
  }
  if (extras.guidance) parts.push(GUIDANCE);
  return { title: `${skill} check`, kind: "check", parts };
}

/** A plain ability check (no skill). In 2024 Guidance only works on skill checks, so it isn't added here. */
export function abilityCheck(sheet: CheckSheet, ability: AbilityKey, _extras: Extras = {}): D20Test {
  const parts: Part[] = [abilityPart(sheet, ability)];
  return { title: `${abilityName(ability)} check`, kind: "check", parts };
}

/** Initiative: a Dexterity check. Guidance doesn't apply to it. */
export function initiative(sheet: CheckSheet): D20Test {
  return { title: "Initiative", kind: "check", parts: [abilityPart(sheet, "dex")] };
}

/** A saving throw: ability mod, + PB if proficient in that save. Bless adds 1d4. */
export function savingThrow(sheet: CheckSheet, ability: AbilityKey, extras: Extras = {}): D20Test {
  const parts: Part[] = [abilityPart(sheet, ability)];
  if (savesOf(sheet).includes(ability)) parts.push({ label: "Proficiency", value: proficiency(sheet.level) });
  if (extras.bless) parts.push(BLESS);
  return { title: `${abilityName(ability)} save`, kind: "save", parts };
}

/** A death saving throw: a plain d20 (Bless still helps, as it's a saving throw). */
export function deathSave(extras: Extras = {}): D20Test {
  return { title: "Death save", kind: "death", parts: extras.bless ? [BLESS] : [] };
}

// ---------- Damage dice ----------

export type DamageDice = { count: number; sides: DieSides }[];
export type Damage = { dice: DamageDice; flat: number; text: string };

const SIDES = new Set([4, 6, 8, 10, 12, 20]);

/** Reads "2d6", "1d8 + 1d6", "1d4 + 1" or "1" (a Blowgun). null when there's nothing to roll. */
export function parseDamage(text: string): Damage | null {
  const dice: DamageDice = [];
  let flat = 0;
  const clean = text.replace(/\s+/g, "");
  if (!clean) return null;
  const terms = clean.match(/[+-]?[^+-]+/g) ?? [];
  for (const term of terms) {
    const sign = term.startsWith("-") ? -1 : 1;
    const body = term.replace(/^[+-]/, "");
    const d = /^(\d*)d(\d+)$/i.exec(body);
    if (d) {
      const count = Math.max(1, Math.min(40, Number(d[1] || 1)));
      const sides = Number(d[2]);
      if (!SIDES.has(sides) || sign < 0) return null;
      const same = dice.find((x) => x.sides === sides);
      if (same) same.count += count;
      else dice.push({ count, sides: sides as DieSides });
    } else if (/^\d+$/.test(body)) flat += sign * Number(body);
    else return null;
  }
  if (!dice.length && !flat) return null;
  return { dice, flat, text: text.trim() };
}

/** Cantrip damage dice grow with character level: x2 at 5, x3 at 11, x4 at 17. */
export function cantripMultiplier(level: number) {
  return level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
}

/** A cantrip's damage at this level (Fire Bolt 1d10 becomes 2d10 at level 5). Other spells are unchanged. */
export function scaleCantrip(damage: Damage | null, spellLevel: number, characterLevel: number): Damage | null {
  if (!damage || spellLevel !== 0) return damage;
  const m = cantripMultiplier(characterLevel);
  if (m === 1) return damage;
  const dice = damage.dice.map((d) => ({ count: d.count * m, sides: d.sides }));
  let text = dice.map((d) => `${d.count}d${d.sides}`).join(" + ");
  if (damage.flat > 0) text += ` + ${damage.flat}`;
  if (damage.flat < 0) text += ` − ${-damage.flat}`;
  return { dice, flat: damage.flat, text };
}

/** The first damage dice in a spell's text ("...takes 1d10 Fire damage" -> 1d10). Healing isn't damage. */
export function spellDamage(description: string): Damage | null {
  const m = /(\d+d\d+(?:\s*\+\s*\d+)?)\s+[A-Za-z]+\s+damage/i.exec(description) ?? /(\d+d\d+(?:\s*\+\s*\d+)?)\s+damage/i.exec(description);
  return m ? parseDamage(m[1]) : null;
}

// ---------- Weapons and spells ----------

export type WeaponLike = { name: string; damage: string; damage_type: string; to_hit: number | null; properties: string };
export type SpellLike = { name: string; level: number; description: string };

/** Strength, or Dexterity for a ranged weapon, the better of the two for Finesse (as suggestedToHit). */
export function weaponAbility(sheet: CheckSheet, properties: string): AbilityKey {
  const p = properties.toLowerCase();
  if (p.includes("ammunition")) return "dex";
  if (p.includes("finesse")) return abilityMod(sheet.dex) > abilityMod(sheet.str) ? "dex" : "str";
  return "str";
}

/** A weapon attack: ability mod + PB, or the to-hit written in the Codex. Bless adds 1d4. */
export function weaponAttack(sheet: CheckSheet, weapon: WeaponLike, extras: Extras = {}): D20Test {
  const ability = weaponAbility(sheet, weapon.properties);
  const parts: Part[] =
    weapon.to_hit !== null
      ? [{ label: "Written to hit", value: weapon.to_hit }]
      : [abilityPart(sheet, ability), { label: "Proficiency", value: proficiency(sheet.level) }];
  if (extras.bless) parts.push(BLESS);
  return { title: `${weapon.name} attack`, kind: "attack", parts };
}

/** The weapon's damage: its dice plus the attack's ability mod. */
export function weaponDamage(sheet: CheckSheet, weapon: WeaponLike): Damage | null {
  const base = parseDamage(weapon.damage);
  if (!base) return null;
  return { ...base, flat: base.flat + abilityMod(sheet[weaponAbility(sheet, weapon.properties)]) };
}

export type SpellKind = "attack" | "save" | null;

export function spellKind(spell: SpellLike): SpellKind {
  if (/spell attack/i.test(spell.description)) return "attack";
  if (spellSaveAbility(spell)) return "save";
  return null;
}

/** The ability the target saves with ("makes a Dexterity saving throw" -> dex). */
export function spellSaveAbility(spell: SpellLike): AbilityKey | null {
  const m = /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i.exec(spell.description);
  return m ? ABILITIES.find((a) => a.name.toLowerCase() === m[1].toLowerCase())!.key : null;
}

/** A spell attack: spellcasting mod + PB. Bless adds 1d4. */
export function spellAttack(sheet: CheckSheet, spell: SpellLike, ability: AbilityKey, extras: Extras = {}): D20Test {
  const parts: Part[] = [abilityPart(sheet, ability), { label: "Proficiency", value: proficiency(sheet.level) }];
  if (extras.bless) parts.push(BLESS);
  return { title: `${spell.name} attack`, kind: "attack", parts };
}

/** Spell save DC = 8 + spellcasting mod + PB, as cards. */
export function spellSaveDC(sheet: CheckSheet, ability: AbilityKey) {
  const parts: Part[] = [
    { label: "Base", value: 8 },
    abilityPart(sheet, ability),
    { label: "Proficiency", value: proficiency(sheet.level) },
  ];
  return { dc: parts.reduce((sum, p) => sum + p.value, 0), parts };
}

// ---------- Rolling ----------

export type { RollMode };
export type ThrownDie = { sides: DieSides; value: number; kept: boolean; label?: string };

export type Outcome = "success" | "fail" | "hit" | "miss" | "crit" | null;

export type D20Result = {
  test: D20Test;
  /** Every die thrown: the d20 (two with advantage or disadvantage), then any bonus d4s. */
  dice: ThrownDie[];
  natural: number;
  flat: number;
  total: number;
  /** For attacks the DC box is the target's AC. */
  dc: number | null;
  outcome: Outcome;
  mode: RollMode;
};

export const flatBonus = (parts: Part[]) => parts.reduce((sum, p) => sum + (p.die ? 0 : p.value), 0);

/** "+5", "+5 +1d4" or "+1d4": the bonus under the d20. */
export function bonusText(parts: Part[]) {
  const flat = flatBonus(parts);
  const dice = parts.filter((p) => p.die).map((p) => `+1d${p.die}`);
  if (!dice.length) return signed(flat);
  return flat ? `${signed(flat)} ${dice.join(" ")}` : dice.join(" ");
}

/** What a d20 total means. Only attacks treat a natural 20 or 1 as an automatic hit or miss. */
export function outcomeOf(kind: Kind, natural: number, total: number, dc: number | null): Outcome {
  if (kind === "attack") {
    if (natural === 20) return "crit";
    if (natural === 1) return "miss";
    if (dc === null) return null;
    return total >= dc ? "hit" : "miss";
  }
  if (kind === "death") {
    // A death save always has its own DC of 10; the 1 and 20 are handled by applyDeathSave.
    return total >= 10 ? "success" : "fail";
  }
  if (dc === null) return null;
  return total >= dc ? "success" : "fail";
}

export function rollD20(test: D20Test, mode: RollMode, dc: number | null, rng: (sides: number) => number = randomInt): D20Result {
  const first = rng(20);
  const dice: ThrownDie[] = [{ sides: 20, value: first, kept: true }];
  let natural = first;
  if (mode !== "normal") {
    const second = rng(20);
    const keepSecond = mode === "advantage" ? second > first : second < first;
    dice[0].kept = !keepSecond;
    dice.push({ sides: 20, value: second, kept: keepSecond });
    natural = keepSecond ? second : first;
  }
  let extra = 0;
  for (const p of test.parts) {
    if (!p.die) continue;
    const v = rng(p.die);
    extra += v;
    dice.push({ sides: p.die, value: v, kept: true, label: p.label });
  }
  const flat = flatBonus(test.parts);
  const total = natural + flat + extra;
  const usedDc = test.kind === "death" ? 10 : dc;
  return { test, dice, natural, flat, total, dc: usedDc, outcome: outcomeOf(test.kind, natural, total, usedDc), mode };
}

export type DamageResult = { dice: ThrownDie[]; flat: number; total: number; crit: boolean; expression: string };

/** The dice a damage roll throws: on a critical hit every die is rolled twice; the flat bonus isn't doubled. */
export function damageDice(damage: Damage, crit: boolean): DamageDice {
  return damage.dice.map((d) => ({ sides: d.sides, count: crit ? d.count * 2 : d.count }));
}

export function damageExpression(damage: Damage, crit: boolean) {
  const dice = damageDice(damage, crit).map((d) => `${d.count}d${d.sides}`);
  let text = dice.join(" + ");
  if (damage.flat > 0) text += `${text ? " + " : ""}${damage.flat}`;
  if (damage.flat < 0) text += ` − ${-damage.flat}`;
  return text || "0";
}

export function rollDamage(damage: Damage, crit: boolean, rng: (sides: number) => number = randomInt): DamageResult {
  const dice: ThrownDie[] = [];
  for (const d of damageDice(damage, crit)) for (let i = 0; i < d.count; i += 1) dice.push({ sides: d.sides, value: rng(d.sides), kept: true });
  const total = Math.max(0, dice.reduce((sum, d) => sum + d.value, 0) + damage.flat);
  return { dice, flat: damage.flat, total, crit, expression: damageExpression(damage, crit) };
}

// ---------- Death saves ----------

export type DeathTally = { successes: number; failures: number };
export type DeathState = "rolling" | "stable" | "dead" | "revived";

export const NEW_TALLY: DeathTally = { successes: 0, failures: 0 };

/** One death save: 10 or more succeeds, a natural 1 is two failures, a natural 20 regains 1 HP
 *  (which ends the saves). Three successes: stable. Three failures: dead. */
export function applyDeathSave(tally: DeathTally, natural: number, total: number): { tally: DeathTally; state: DeathState } {
  if (natural === 20) return { tally: { ...NEW_TALLY }, state: "revived" };
  const next = { ...tally };
  if (natural === 1) next.failures += 2;
  else if (total >= 10) next.successes += 1;
  else next.failures += 1;
  next.successes = Math.min(3, next.successes);
  next.failures = Math.min(3, next.failures);
  const state: DeathState = next.failures >= 3 ? "dead" : next.successes >= 3 ? "stable" : "rolling";
  return { tally: next, state };
}
