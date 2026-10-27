import { supabase } from "./supabase";
import { errorText } from "./parties";
import srdSpells from "./srdSpells.json";

// The Codex's Weapons and Spells: one list each per character (so per player per party).
// Tables from supabase/migrations/20261027000007_sheet_rework.sql.

export type Weapon = {
  id: string;
  character_id: string;
  name: string;
  damage: string;
  damage_type: string;
  /** null: work it out from the sheet (see suggestedToHit). */
  to_hit: number | null;
  properties: string;
  description: string;
  in_hand: boolean;
};

export type WeaponDraft = Omit<Weapon, "id" | "character_id" | "in_hand">;

export type Spell = {
  id: string;
  character_id: string;
  name: string;
  /** 0 is a cantrip. */
  level: number;
  school: string;
  casting_time: string;
  range: string;
  verbal: boolean;
  somatic: boolean;
  material: boolean;
  material_text: string;
  duration: string;
  description: string;
};

export type SpellDraft = Omit<Spell, "id" | "character_id">;

export type SrdWeapon = { name: string; damage: string; type: string; properties: string; group: string };

// SRD 5.2.1 Weapons table (Equipment > Weapons), without cost and weight.
const W = (group: string, rows: [string, string, string, string][]): SrdWeapon[] =>
  rows.map(([name, damage, type, properties]) => ({ name, damage, type, properties, group }));
export const SRD_WEAPONS: SrdWeapon[] = [
  ...W("Simple Melee", [
    ["Club", "1d4", "Bludgeoning", "Light"],
    ["Dagger", "1d4", "Piercing", "Finesse, Light, Thrown (20/60)"],
    ["Greatclub", "1d8", "Bludgeoning", "Two-Handed"],
    ["Handaxe", "1d6", "Slashing", "Light, Thrown (20/60)"],
    ["Javelin", "1d6", "Piercing", "Thrown (30/120)"],
    ["Light Hammer", "1d4", "Bludgeoning", "Light, Thrown (20/60)"],
    ["Mace", "1d6", "Bludgeoning", ""],
    ["Quarterstaff", "1d6", "Bludgeoning", "Versatile (1d8)"],
    ["Sickle", "1d4", "Slashing", "Light"],
    ["Spear", "1d6", "Piercing", "Thrown (20/60), Versatile (1d8)"],
  ]),
  ...W("Simple Ranged", [
    ["Dart", "1d4", "Piercing", "Finesse, Thrown (20/60)"],
    ["Light Crossbow", "1d8", "Piercing", "Ammunition (80/320; Bolt), Loading, Two-Handed"],
    ["Shortbow", "1d6", "Piercing", "Ammunition (80/320; Arrow), Two-Handed"],
    ["Sling", "1d4", "Bludgeoning", "Ammunition (30/120; Bullet)"],
  ]),
  ...W("Martial Melee", [
    ["Battleaxe", "1d8", "Slashing", "Versatile (1d10)"],
    ["Flail", "1d8", "Bludgeoning", ""],
    ["Glaive", "1d10", "Slashing", "Heavy, Reach, Two-Handed"],
    ["Greataxe", "1d12", "Slashing", "Heavy, Two-Handed"],
    ["Greatsword", "2d6", "Slashing", "Heavy, Two-Handed"],
    ["Halberd", "1d10", "Slashing", "Heavy, Reach, Two-Handed"],
    ["Lance", "1d10", "Piercing", "Heavy, Reach, Two-Handed (unless mounted)"],
    ["Longsword", "1d8", "Slashing", "Versatile (1d10)"],
    ["Maul", "2d6", "Bludgeoning", "Heavy, Two-Handed"],
    ["Morningstar", "1d8", "Piercing", ""],
    ["Pike", "1d10", "Piercing", "Heavy, Reach, Two-Handed"],
    ["Rapier", "1d8", "Piercing", "Finesse"],
    ["Scimitar", "1d6", "Slashing", "Finesse, Light"],
    ["Shortsword", "1d6", "Piercing", "Finesse, Light"],
    ["Trident", "1d8", "Piercing", "Thrown (20/60), Versatile (1d10)"],
    ["Warhammer", "1d8", "Bludgeoning", "Versatile (1d10)"],
    ["War Pick", "1d8", "Piercing", "Versatile (1d10)"],
    ["Whip", "1d4", "Slashing", "Finesse, Reach"],
  ]),
  ...W("Martial Ranged", [
    ["Blowgun", "1", "Piercing", "Ammunition (25/100; Needle), Loading"],
    ["Hand Crossbow", "1d6", "Piercing", "Ammunition (30/120; Bolt), Light, Loading"],
    ["Heavy Crossbow", "1d10", "Piercing", "Ammunition (100/400; Bolt), Heavy, Loading, Two-Handed"],
    ["Longbow", "1d8", "Piercing", "Ammunition (150/600; Arrow), Heavy, Two-Handed"],
    ["Musket", "1d12", "Piercing", "Ammunition (40/120; Bullet), Loading, Two-Handed"],
    ["Pistol", "1d10", "Piercing", "Ammunition (30/90; Bullet), Loading"],
  ]),
];

type SrdSpellRow = {
  name: string;
  level: number;
  school: string;
  time: string;
  range: string;
  v: boolean;
  s: boolean;
  m: string;
  duration: string;
  desc: string;
};

/** SRD 5.2.1 spells (built by scripts/build-srd-spells.py), as drafts ready to add. */
export const SRD_SPELLS: SpellDraft[] = (srdSpells as SrdSpellRow[]).map((row) => ({
  name: row.name,
  level: row.level,
  school: row.school,
  casting_time: row.time,
  range: row.range,
  verbal: row.v,
  somatic: row.s,
  material: !!row.m,
  material_text: row.m.trim(),
  duration: row.duration,
  description: row.desc,
}));

const mod = (score: number) => Math.floor((score - 10) / 2);

/** The usual attack bonus: Strength, or Dexterity for a Finesse or ranged weapon (the better of the
 *  two for Finesse), plus the Proficiency Bonus. */
export function suggestedToHit(properties: string, scores: { str: number; dex: number }, proficiency: number) {
  const p = properties.toLowerCase();
  const ranged = p.includes("ammunition");
  const finesse = p.includes("finesse");
  const ability = ranged ? mod(scores.dex) : finesse ? Math.max(mod(scores.str), mod(scores.dex)) : mod(scores.str);
  return ability + proficiency;
}

export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export const SPELL_LEVELS = ["Cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

export const MIGRATION_HINT =
  "Weapons and spells need the latest database update. Run npx supabase db push (migration 20261027000007).";

function missingTable(err: unknown, table: string) {
  const text = String(errorText(err)).toLowerCase();
  return text.includes(table) || text.includes("schema cache");
}

const WEAPON_COLUMNS = "id, character_id, name, damage, damage_type, to_hit, properties, description, in_hand";

export async function loadWeapons(characterId: string): Promise<Weapon[]> {
  const { data, error } = await supabase
    .from("character_weapons")
    .select(WEAPON_COLUMNS)
    .eq("character_id", characterId)
    .order("created_at", { ascending: true });
  if (error) {
    if (missingTable(error, "character_weapons")) return [];
    throw error;
  }
  return (data ?? []) as Weapon[];
}

function weaponRow(draft: WeaponDraft) {
  const name = draft.name.trim().slice(0, 80);
  if (!name) throw new Error("Name the weapon.");
  return {
    name,
    damage: draft.damage.trim().slice(0, 40),
    damage_type: draft.damage_type.trim().slice(0, 40),
    to_hit: draft.to_hit === null ? null : Math.max(-10, Math.min(30, Math.round(draft.to_hit))),
    properties: draft.properties.trim().slice(0, 200),
    description: draft.description.trim().slice(0, 1000),
  };
}

/** Adds a weapon (id null) or saves changes to one. The first weapon goes in hand. */
export async function saveWeapon(characterId: string, draft: WeaponDraft, id: string | null, first = false) {
  const row = weaponRow(draft);
  const query = id
    ? supabase.from("character_weapons").update(row).eq("id", id)
    : supabase.from("character_weapons").insert({ ...row, character_id: characterId, in_hand: first });
  const { error } = await query;
  if (error) throw missingTable(error, "character_weapons") ? new Error(MIGRATION_HINT) : error;
}

export async function removeWeapon(id: string) {
  const { error } = await supabase.from("character_weapons").delete().eq("id", id);
  if (error) throw error;
}

/** Puts one weapon in hand; every other weapon of the character goes out of hand first. */
export async function holdWeapon(characterId: string, id: string) {
  const off = await supabase.from("character_weapons").update({ in_hand: false }).eq("character_id", characterId).neq("id", id);
  if (off.error) throw off.error;
  const on = await supabase.from("character_weapons").update({ in_hand: true }).eq("id", id);
  if (on.error) throw on.error;
}

const SPELL_COLUMNS =
  "id, character_id, name, level, school, casting_time, range, verbal, somatic, material, material_text, duration, description";

export async function loadSpells(characterId: string): Promise<Spell[]> {
  const { data, error } = await supabase
    .from("character_spells")
    .select(SPELL_COLUMNS)
    .eq("character_id", characterId)
    .order("level", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    if (missingTable(error, "character_spells")) return [];
    throw error;
  }
  return (data ?? []) as Spell[];
}

export async function saveSpell(characterId: string, draft: SpellDraft, id: string | null) {
  const name = draft.name.trim().slice(0, 80);
  if (!name) throw new Error("Name the spell.");
  const row = {
    name,
    level: Math.max(0, Math.min(9, Math.round(draft.level))),
    school: draft.school.trim().slice(0, 40),
    casting_time: draft.casting_time.trim().slice(0, 160),
    range: draft.range.trim().slice(0, 80),
    verbal: draft.verbal,
    somatic: draft.somatic,
    material: draft.material,
    material_text: draft.material ? draft.material_text.trim().slice(0, 200) : "",
    duration: draft.duration.trim().slice(0, 80),
    description: draft.description.trim().slice(0, 2000),
  };
  const query = id
    ? supabase.from("character_spells").update(row).eq("id", id)
    : supabase.from("character_spells").insert({ ...row, character_id: characterId });
  const { error } = await query;
  if (error) throw missingTable(error, "character_spells") ? new Error(MIGRATION_HINT) : error;
}

export async function removeSpell(id: string) {
  const { error } = await supabase.from("character_spells").delete().eq("id", id);
  if (error) throw error;
}

/** "Longsword +5, 1d8 Slashing (Versatile (1d10))": the in-hand weapon for the Sage. */
export function weaponLine(weapon: Weapon, toHit: number) {
  const hit = signed(weapon.to_hit ?? toHit);
  const damage = [weapon.damage, weapon.damage_type].filter(Boolean).join(" ");
  const props = weapon.properties ? ` (${weapon.properties})` : "";
  return `${weapon.name} ${hit} to hit${damage ? `, ${damage}` : ""}${props}`.slice(0, 160);
}

/** "Fire Bolt (cantrip)", "Shield (1st)": a spell for the Sage. */
export function spellLine(spell: Spell) {
  return `${spell.name} (${spell.level === 0 ? "cantrip" : SPELL_LEVELS[spell.level] ?? spell.level})`;
}
