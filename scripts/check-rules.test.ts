// Checks the Character Sheet roll rules behind the dice pop-up's Check tab (2024 rules).
// Run: npm run test:dice
import {
  abilityCheck,
  applyDeathSave,
  bonusText,
  classSaves,
  deathSave,
  flatBonus,
  hasJackOfAllTrades,
  initiative,
  NEW_TALLY,
  outcomeOf,
  parseDamage,
  proficiency,
  rollD20,
  rollDamage,
  savingThrow,
  skillCheck,
  spellAbilityFor,
  spellAttack,
  spellDamage,
  scaleCantrip,
  damageDice,
  spellKind,
  spellSaveAbility,
  spellSaveDC,
  weaponAttack,
  weaponDamage,
  type CheckSheet,
} from "../src/lib/dice/checkRules.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
function eq<T>(got: T, want: T, msg: string) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) throw new Error(`${msg}: got ${a}, want ${b}`);
}

// A level 5 Bard (PB +3): Dex 16 (+3), Cha 18 (+4), Str 8 (-1).
const bard: CheckSheet = {
  class: "Bard",
  level: 5,
  str: 8,
  dex: 16,
  con: 12,
  int: 10,
  wis: 13,
  cha: 18,
  skills: ["Stealth", "Persuasion", "Performance"],
  expertise: ["Stealth"],
  save_profs: [],
};

/** Dice that come up in a fixed order. */
function dice(...values: number[]) {
  let i = 0;
  return (sides: number) => {
    const v = values[i++];
    assert(v !== undefined, "ran out of dice");
    assert(v >= 1 && v <= sides, `d${sides} can't show ${v}`);
    return v;
  };
}

Deno.test("proficiency bonus by level", () => {
  eq([1, 4, 5, 8, 9, 13, 17, 20].map(proficiency), [2, 2, 3, 3, 4, 5, 6, 6], "PB");
});

Deno.test("skills: proficiency, expertise and Jack of All Trades", () => {
  const stealth = skillCheck(bard, "Stealth");
  eq(stealth.parts.map((p) => p.label), ["Dexterity", "Proficiency", "Expertise"], "stealth cards");
  eq(flatBonus(stealth.parts), 3 + 3 + 3, "expertise doubles PB");
  eq(flatBonus(skillCheck(bard, "Persuasion").parts), 4 + 3, "proficient");
  const athletics = skillCheck(bard, "Athletics");
  eq(athletics.parts.map((p) => p.label), ["Strength", "Jack of All Trades"], "JoaT card");
  eq(flatBonus(athletics.parts), -1 + 1, "half PB rounded down");
  eq(flatBonus(skillCheck({ ...bard, class: "Wizard" }, "Athletics").parts), -1, "no JoaT for a Wizard");
  eq(flatBonus(skillCheck({ ...bard, level: 1 }, "Athletics").parts), -1, "no JoaT for a level 1 Bard");
  // Expertise without proficiency does nothing (the sheet only offers it on proficient skills).
  eq(flatBonus(skillCheck({ ...bard, expertise: ["Arcana"] }, "Arcana").parts), 0 + 1, "expertise needs proficiency");
});

Deno.test("Jack of All Trades: a Bard from level 2, any case", () => {
  eq(hasJackOfAllTrades({ class: "Bard", level: 2 }), true, "Bard 2");
  eq(hasJackOfAllTrades({ class: " bard ", level: 20 }), true, "lower case, spaces");
  eq(hasJackOfAllTrades({ class: "BARD", level: 5 }), true, "upper case");
  eq(hasJackOfAllTrades({ class: "Bard", level: 1 }), false, "Bard 1");
  eq(hasJackOfAllTrades({ class: "Rogue", level: 5 }), false, "other class");
  eq(hasJackOfAllTrades({ class: "Bardic Rogue", level: 5 }), false, "only the Bard class");
  eq(hasJackOfAllTrades({ class: null, level: 5 }), false, "no class");
});

Deno.test("Guidance adds 1d4 to skill checks only", () => {
  const check = skillCheck(bard, "Stealth", { guidance: true, bless: true });
  eq(check.parts.filter((p) => p.die).map((p) => p.label), ["Guidance"], "check: Guidance, not Bless");
  eq(bonusText(check.parts), "+9 +1d4", "bonus text");
  eq(abilityCheck(bard, "wis", { guidance: true }).parts.map((p) => p.label), ["Wisdom"], "raw check: no Guidance in 2024");
  const save = savingThrow(bard, "dex", { guidance: true, bless: true });
  eq(save.parts.filter((p) => p.die).map((p) => p.label), ["Bless"], "save: Bless, not Guidance");
});

Deno.test("initiative is a Dexterity check without Guidance", () => {
  const init = initiative(bard);
  eq(init.kind, "check", "kind");
  eq(init.parts, [{ label: "Dexterity", value: 3 }], "only Dex");
});

Deno.test("saves: class defaults plus ticked extras", () => {
  eq(classSaves("Barbarian"), ["str", "con"], "barbarian");
  eq(classSaves("wizard"), ["int", "wis"], "wizard (any case)");
  eq(classSaves("Artificer"), [], "no 2024 PHB entry");
  eq(flatBonus(savingThrow(bard, "cha").parts), 4 + 3, "bard Cha save proficient");
  eq(flatBonus(savingThrow(bard, "con").parts), 1, "bard Con save not proficient");
  eq(flatBonus(savingThrow({ ...bard, save_profs: ["con"] }, "con").parts), 1 + 3, "ticked Con save");
});

Deno.test("advantage keeps the higher d20, disadvantage the lower", () => {
  const test = abilityCheck(bard, "dex");
  const adv = rollD20(test, "advantage", null, dice(4, 15));
  eq([adv.natural, adv.total, adv.dice.map((d) => d.kept)], [15, 18, [false, true]], "advantage");
  const dis = rollD20(test, "disadvantage", null, dice(4, 15));
  eq([dis.natural, dis.total, dis.dice.map((d) => d.kept)], [4, 7, [true, false]], "disadvantage");
});

Deno.test("bonus d4s are thrown and added", () => {
  const r = rollD20(skillCheck(bard, "Stealth", { guidance: true }), "normal", 15, dice(5, 3));
  eq([r.dice.length, r.total, r.outcome], [2, 5 + 9 + 3, "success"], "guidance d4");
});

Deno.test("a DC gives success or fail; no DC gives neither", () => {
  const test = skillCheck(bard, "Persuasion"); // +7
  eq(rollD20(test, "normal", 15, dice(8)).outcome, "success", "15 vs DC 15");
  eq(rollD20(test, "normal", 16, dice(8)).outcome, "fail", "15 vs DC 16");
  eq(rollD20(test, "normal", null, dice(8)).outcome, null, "no DC");
});

Deno.test("natural 20 and 1 only decide attacks", () => {
  eq(outcomeOf("check", 20, 22, 25), "fail", "nat 20 check can fail");
  eq(outcomeOf("save", 1, 12, 10), "success", "nat 1 save can succeed");
  eq(outcomeOf("attack", 20, 21, 30), "crit", "nat 20 always hits");
  eq(outcomeOf("attack", 20, 21, null), "crit", "crit with no AC");
  eq(outcomeOf("attack", 1, 12, 5), "miss", "nat 1 always misses");
  eq(outcomeOf("attack", 12, 17, 17), "hit", "meets AC");
  eq(outcomeOf("attack", 12, 16, 17), "miss", "under AC");
  eq(outcomeOf("attack", 12, 16, null), null, "no AC");
});

Deno.test("weapon attacks and damage", () => {
  const rapier = { name: "Rapier", damage: "1d8", damage_type: "Piercing", to_hit: null, properties: "Finesse" };
  const atk = weaponAttack(bard, rapier, { bless: true });
  eq(atk.parts.map((p) => [p.label, p.value]), [["Dexterity", 3], ["Proficiency", 3], ["Bless", 0]], "finesse uses Dex");
  const club = { name: "Club", damage: "1d4", damage_type: "Bludgeoning", to_hit: null, properties: "Light" };
  eq(flatBonus(weaponAttack(bard, club).parts), -1 + 3, "melee uses Str");
  eq(flatBonus(weaponAttack(bard, { ...club, to_hit: 7 }).parts), 7, "written to-hit wins");
  eq(weaponDamage(bard, rapier), { dice: [{ count: 1, sides: 8 }], flat: 3, text: "1d8" }, "damage adds the mod");
  const blowgun = { name: "Blowgun", damage: "1", damage_type: "Piercing", to_hit: null, properties: "Ammunition" };
  eq(weaponDamage(bard, blowgun), { dice: [], flat: 4, text: "1" }, "flat damage");
});

Deno.test("a critical hit doubles the dice, not the modifier", () => {
  const greatsword = parseDamage("2d6")!;
  const dmg = { ...greatsword, flat: 3 };
  const crit = rollDamage(dmg, true, dice(6, 5, 4, 3));
  eq([crit.dice.length, crit.total, crit.expression], [4, 6 + 5 + 4 + 3 + 3, "4d6 + 3"], "crit");
  const hit = rollDamage(dmg, false, dice(6, 5));
  eq([hit.dice.length, hit.total, hit.expression], [2, 14, "2d6 + 3"], "normal");
  eq(rollDamage({ dice: [{ count: 1, sides: 4 }], flat: -3, text: "" }, false, dice(1)).total, 0, "never below 0");
});

Deno.test("damage text parsing", () => {
  eq(parseDamage("1d8 + 1d6"), { dice: [{ count: 1, sides: 8 }, { count: 1, sides: 6 }], flat: 0, text: "1d8 + 1d6" }, "two dice");
  eq(parseDamage("d10+2")?.flat, 2, "implicit 1 and flat");
  eq(parseDamage("1d7"), null, "no such die");
  eq(parseDamage(""), null, "empty");
});

Deno.test("spellcasting ability by class", () => {
  eq(["Bard", "Paladin", "Sorcerer", "Warlock"].map(spellAbilityFor), ["cha", "cha", "cha", "cha"], "Cha casters");
  eq(["Cleric", "Druid", "Ranger"].map(spellAbilityFor), ["wis", "wis", "wis"], "Wis casters");
  eq(["Wizard", "Artificer"].map(spellAbilityFor), ["int", "int"], "Int casters");
  eq(["Fighter", "Rogue", null, ""].map(spellAbilityFor), [null, null, null, null], "the player picks");
});

const fireBolt = {
  name: "Fire Bolt",
  level: 0,
  description: "You hurl a mote of fire. Make a ranged spell attack against the target. On a hit, the target takes 1d10 Fire damage.",
};
const fireball = {
  name: "Fireball",
  level: 3,
  description: "Each creature in a 20-foot-radius Sphere makes a Dexterity saving throw, taking 8d6 Fire damage on a failed save or half as much damage on a successful one.",
};
const bless = { name: "Bless", level: 1, description: "Whenever a target makes an attack roll or a saving throw before the spell ends, the target adds 1d4." };

Deno.test("spell attacks: spellcasting mod + PB, the Codex spell's dice", () => {
  eq(spellKind(fireBolt), "attack", "kind");
  const atk = spellAttack(bard, fireBolt, "cha");
  eq(atk.parts.map((p) => [p.label, p.value]), [["Charisma", 4], ["Proficiency", 3]], "to hit");
  eq(atk.kind, "attack", "attack kind");
  eq(spellDamage(fireBolt.description), { dice: [{ count: 1, sides: 10 }], flat: 0, text: "1d10" }, "damage, no mod");
  const crit = rollD20(atk, "normal", null, dice(20));
  eq(crit.outcome, "crit", "spell crit");
  eq(rollDamage(spellDamage(fireBolt.description)!, true, dice(3, 9)).total, 12, "crit doubles spell dice");
});

Deno.test("save spells: DC = 8 + mod + PB and the save ability", () => {
  eq(spellKind(fireball), "save", "kind");
  eq(spellSaveAbility(fireball), "dex", "Dex save");
  const { dc, parts } = spellSaveDC(bard, "cha");
  eq(dc, 8 + 4 + 3, "DC");
  eq(parts.map((p) => p.label), ["Base", "Charisma", "Proficiency"], "DC cards");
  eq(spellDamage(fireball.description)?.dice, [{ count: 8, sides: 6 }], "fireball damage");
  eq(spellKind(bless), null, "a buff isn't an attack or save spell");
  eq(spellDamage("You regain 2d8 Hit Points."), null, "healing isn't damage");
});

Deno.test("death saves", () => {
  const plain = deathSave();
  eq(plain.parts, [], "a plain d20");
  eq(rollD20(plain, "normal", null, dice(10)).outcome, "success", "10 succeeds");
  eq(rollD20(plain, "normal", 25, dice(9)).outcome, "fail", "9 fails, any DC box is ignored");
  let t = applyDeathSave(NEW_TALLY, 12, 12);
  eq(t, { tally: { successes: 1, failures: 0 }, state: "rolling" }, "success");
  t = applyDeathSave(t.tally, 1, 1);
  eq(t, { tally: { successes: 1, failures: 2 }, state: "rolling" }, "nat 1 is two failures");
  t = applyDeathSave(t.tally, 5, 5);
  eq(t, { tally: { successes: 1, failures: 3 }, state: "dead" }, "third failure");
  eq(applyDeathSave({ successes: 2, failures: 2 }, 20, 20), { tally: { successes: 0, failures: 0 }, state: "revived" }, "nat 20 regains 1 HP");
  eq(applyDeathSave({ successes: 2, failures: 0 }, 15, 15).state, "stable", "three successes");
  eq(applyDeathSave({ successes: 0, failures: 2 }, 1, 1).tally.failures, 3, "capped at 3");
  // Bless's d4 can lift a 9 to a success, but a natural 1 is still two failures.
  const blessed = rollD20(deathSave({ bless: true }), "normal", null, dice(9, 2));
  eq([blessed.total, blessed.outcome], [11, "success"], "Bless on a death save");
});

Deno.test("cantrip damage scales at levels 5, 11 and 17", () => {
  const d = spellDamage("A creature takes 1d10 Fire damage.");
  eq(scaleCantrip(d, 0, 4)?.text, "1d10", "level 4");
  eq(scaleCantrip(d, 0, 5)?.text, "2d10", "level 5");
  eq(scaleCantrip(d, 0, 11)?.text, "3d10", "level 11");
  eq(scaleCantrip(d, 0, 17)?.dice, [{ count: 4, sides: 10 }], "level 17");
  eq(scaleCantrip(d, 1, 17)?.text, "1d10", "levelled spells don't scale");
  eq(damageDice(scaleCantrip(d, 0, 5)!, true), [{ sides: 10, count: 4 }], "crit doubles scaled dice");
});
