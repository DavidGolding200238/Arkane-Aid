// Rolling: the numbers are decided here first, then the 3D dice are animated to land on them.
// Plain TypeScript, no React, so the Deno test can check it.
import type { DieSides } from "./dicePolyhedra";

export type RollMode = "normal" | "advantage" | "disadvantage";
/** How many of each die, e.g. { 6: 8 } for 8d6. */
export type DicePool = Partial<Record<DieSides, number>>;

export type RolledDie = {
  sides: DieSides;
  value: number;
  /** False for the d20 that advantage or disadvantage threw away. */
  kept: boolean;
};

export type RollResult = {
  dice: RolledDie[];
  bonus: number;
  mode: RollMode;
  total: number;
  /** Set when a single d20 (the kept one) came up 20 or 1. */
  natural: 20 | 1 | null;
};

/** At most this many of one die, and in the whole pool. 40d6 covers Meteor Swarm. */
export const MAX_PER_DIE = 40;
export const MAX_POOL = 60;
export const MAX_BONUS = 99;

const ORDER: DieSides[] = [20, 12, 10, 8, 6, 4];

type CryptoLike = { getRandomValues?: (a: Uint32Array) => Uint32Array };

/** A whole number from 1 to `sides`. Uses crypto.getRandomValues when the runtime has it (with
 *  rejection sampling, so no face is favoured), otherwise Math.random. */
export function randomInt(sides: number): number {
  const c = (globalThis as { crypto?: CryptoLike }).crypto;
  if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / sides) * sides;
    for (let i = 0; i < 8; i += 1) {
      c.getRandomValues(buf);
      if (buf[0] < limit) return (buf[0] % sides) + 1;
    }
  }
  return Math.floor(Math.random() * sides) + 1;
}

export function poolSize(pool: DicePool) {
  return ORDER.reduce((sum, s) => sum + (pool[s] ?? 0), 0);
}

/** Advantage and disadvantage only make sense for one d20 on its own (a check, save or attack). */
export function canUseAdvantage(pool: DicePool) {
  return (pool[20] ?? 0) === 1 && poolSize(pool) === 1;
}

export function rollPool(pool: DicePool, bonus: number, mode: RollMode): RollResult {
  const twoD20 = mode !== "normal" && canUseAdvantage(pool);
  const dice: RolledDie[] = [];
  for (const sides of ORDER) {
    const count = Math.min(MAX_PER_DIE, Math.max(0, Math.floor(pool[sides] ?? 0)));
    for (let i = 0; i < count; i += 1) dice.push({ sides, value: randomInt(sides), kept: true });
  }
  if (twoD20) {
    const first = dice[0];
    const second: RolledDie = { sides: 20, value: randomInt(20), kept: true };
    const keepSecond = mode === "advantage" ? second.value > first.value : second.value < first.value;
    if (keepSecond) first.kept = false;
    else second.kept = false;
    dice.push(second);
  }
  const total = dice.reduce((sum, d) => sum + (d.kept ? d.value : 0), 0) + bonus;
  const keptD20 = dice.filter((d) => d.sides === 20 && d.kept);
  const onlyD20 = keptD20.length === 1 && dice.every((d) => d.sides === 20);
  const nat = onlyD20 ? keptD20[0].value : 0;
  return { dice, bonus, mode: twoD20 ? mode : "normal", total, natural: nat === 20 ? 20 : nat === 1 ? 1 : null };
}

/** "2d6 + 1d4 + 3" for the pool. */
export function poolExpression(pool: DicePool, bonus: number) {
  const parts = ORDER.filter((s) => (pool[s] ?? 0) > 0).map((s) => `${pool[s]}d${s}`);
  let text = parts.join(" + ") || "No dice";
  if (bonus > 0) text += ` + ${bonus}`;
  if (bonus < 0) text += ` − ${-bonus}`;
  return text;
}

/** The result as text: the expression, and each die's number grouped by die. */
export function formatRoll(result: RollResult) {
  const pool: DicePool = {};
  for (const d of result.dice) if (d.kept || result.mode === "normal") pool[d.sides] = (pool[d.sides] ?? 0) + 1;
  const expression = poolExpression(pool, result.bonus);
  let breakdown: string;
  if (result.mode !== "normal") {
    const [a, b] = result.dice;
    const kept = a.kept ? a : b;
    breakdown = `${result.mode === "advantage" ? "Advantage" : "Disadvantage"}: ${a.value} and ${b.value}, kept ${kept.value}`;
  } else {
    breakdown = ORDER.filter((s) => pool[s])
      .map((s) => {
        const values = result.dice.filter((d) => d.sides === s).map((d) => d.value);
        return `d${s}: ${values.join(", ")}`;
      })
      .join("  ·  ");
  }
  if (result.bonus) breakdown += `  ·  ${result.bonus > 0 ? "+" : "−"}${Math.abs(result.bonus)}`;
  return { expression, breakdown };
}
