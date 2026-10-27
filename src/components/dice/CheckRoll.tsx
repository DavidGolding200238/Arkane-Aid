// The Check tab of the dice pop-up: rolls straight from the Character Sheet and the Codex (weapons
// and spells), like the check screen in Baldur's Gate 3. Pick what you're rolling, see each bonus as
// a small ink card, set a DC (or AC) if you know it, and roll. The rules live in lib/dice/checkRules.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, useAnimatedValue, View, type ScrollViewInstance } from "react-native";

import { HOLDER_FILL, INK_DARK, INK_RADIUS, InkButton, InkOutline, InkRing } from "../Ink";
import DiceTray from "./DiceTray";
import { useParty } from "../../context/PartyContext";
import { loadCharacter, SKILLS, type Character } from "../../lib/character";
import { loadSpells, loadWeapons, type Spell, type Weapon } from "../../lib/arsenal";
import { tapHaptic } from "../../lib/haptics";
import {
  ABILITIES,
  abilityCheck,
  scaleCantrip,
  abilityMod,
  abilityName,
  applyDeathSave,
  bonusText,
  damageDice,
  damageExpression,
  deathSave,
  flatBonus,
  initiative,
  NEW_TALLY,
  parseDamage,
  rollD20,
  rollDamage,
  savesOf,
  savingThrow,
  signed,
  skillCheck,
  spellAbilityFor,
  spellAttack,
  spellDamage,
  spellKind,
  spellSaveAbility,
  spellSaveDC,
  weaponAbility,
  weaponAttack,
  weaponDamage,
  type AbilityKey,
  type D20Result,
  type D20Test,
  type Damage,
  type DamageResult,
  type DeathState,
  type DeathTally,
  type Part,
  type RollMode,
  type ThrownDie,
} from "../../lib/dice/checkRules";
import { DiceStage, MAX_SHOWN, type StageDie } from "../../lib/dice/diceStage";
import { landHaptic, nat1Haptic, nat20Haptic, rattleHaptic } from "../../lib/dice/diceHaptics";
import { useShake } from "../../lib/dice/useShake";
import { colors, fonts, inkText, useScale } from "../../theme";

type Category = "skill" | "save" | "ability" | "attack" | "death";
const CATEGORIES: { key: Category; label: string }[] = [
  { key: "skill", label: "Skill" },
  { key: "save", label: "Save" },
  { key: "ability", label: "Ability" },
  { key: "attack", label: "Attack" },
  { key: "death", label: "Death" },
];

const DC_MIN = 5;
const DC_MAX = 30;
const DC_START = 10;
const CASTING: AbilityKey[] = ["int", "wis", "cha"];
const TRAY_MIN_CHECK = 120;

/** What you last rolled, so reopening the pop-up (or switching tabs) keeps it until the app restarts. */
type Memory = {
  category: Category;
  picks: Partial<Record<Category, string>>;
  mode: RollMode;
  guidance: boolean;
  bless: boolean;
  dc: number | null;
  castWith: AbilityKey | null;
  tally: DeathTally;
  deathState: DeathState;
};
let memory: Memory = {
  category: "skill",
  picks: {},
  mode: "normal",
  guidance: false,
  bless: false,
  dc: null,
  castWith: null,
  tally: { ...NEW_TALLY },
  deathState: "rolling",
};

type Sheet = { character: Character; weapons: Weapon[]; spells: Spell[] };
type Load = { status: "loading" } | { status: "none" } | { status: "error" } | ({ status: "ready" } & Sheet);

// The sheet is fetched each time the pop-up opens (it may have changed), but the last one is shown
// straight away so the tab never flashes empty.
let lastSheet: { partyId: string; sheet: Sheet } | null = null;

type Choice = { key: string; label: string; bonus: string; a11y: string };

/** What the selected choice rolls. A d20 test, or (a save spell) a DC the target has to beat. */
type Plan = {
  test: D20Test | null;
  saveDC: { dc: number; parts: Part[]; ability: AbilityKey } | null;
  damage: Damage | null;
  damageType: string;
  damageParts: Part[];
  /** The class has no spellcasting ability of its own: the player picks one. */
  castPick: boolean;
};

type Shown =
  | { type: "d20"; key: string; r: D20Result; death?: { state: DeathState; natural: number } }
  | { type: "damage"; key: string; r: DamageResult }
  | null;

export default function CheckRoll({ rollW }: { rollW: number }) {
  const { s, fs } = useScale();
  const { selected } = useParty();
  const partyId = selected?.party.id ?? null;
  const [load, setLoad] = useState<Load>(() =>
    lastSheet && lastSheet.partyId === partyId ? { status: "ready", ...lastSheet.sheet } : { status: "loading" },
  );

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const character = await loadCharacter(partyId);
        if (!live) return;
        if (!character) {
          setLoad({ status: "none" });
          return;
        }
        const [weapons, spells] = await Promise.all([
          loadWeapons(character.id).catch(() => [] as Weapon[]),
          loadSpells(character.id).catch(() => [] as Spell[]),
        ]);
        if (!live) return;
        const sheet = { character, weapons, spells };
        if (partyId) lastSheet = { partyId, sheet };
        setLoad({ status: "ready", ...sheet });
      } catch {
        if (live) setLoad((prev) => (prev.status === "ready" ? prev : { status: "error" }));
      }
    })();
    return () => {
      live = false;
    };
  }, [partyId]);

  if (load.status !== "ready") {
    const message =
      load.status === "loading"
        ? "Opening your Character Sheet…"
        : load.status === "none"
          ? "No Character Sheet in this party yet. Fill one in from Home, or use Free roll."
          : "Couldn't open your Character Sheet. Check your connection, or use Free roll.";
    return (
      <View style={[styles.empty, { padding: s(24) }]}>
        <Text style={[styles.emptyText, { fontSize: fs(16), lineHeight: fs(22) }]}>{message}</Text>
      </View>
    );
  }
  return <Checks rollW={rollW} sheet={load} />;
}

function Checks({ rollW, sheet }: { rollW: number; sheet: Sheet }) {
  const { s, fs } = useScale();
  const { character: c, weapons, spells } = sheet;
  const [category, setCategoryState] = useState<Category>(memory.category);
  const [picks, setPicks] = useState(memory.picks);
  const [mode, setModeState] = useState<RollMode>(memory.mode);
  const [guidance, setGuidance] = useState(memory.guidance);
  const [bless, setBless] = useState(memory.bless);
  const [dc, setDcState] = useState<number | null>(memory.dc);
  const [castWith, setCastWith] = useState<AbilityKey | null>(memory.castWith);
  const [tally, setTally] = useState<DeathTally>(memory.tally);
  const [deathState, setDeathState] = useState<DeathState>(memory.deathState);
  const [lastShown, setShown] = useState<Shown>(null);
  const [rolling, setRolling] = useState(false);
  // The natural 20 from the last to-hit roll of this attack, so its damage is a critical.
  const [critFor, setCritFor] = useState<string | null>(null);

  useEffect(() => {
    memory = { category, picks, mode, guidance, bless, dc, castWith, tally, deathState };
  }, [category, picks, mode, guidance, bless, dc, castWith, tally, deathState]);

  // ----- The choices on the sheet -----
  const ownSpellAbility = spellAbilityFor(c.class);
  const bestCasting = CASTING.reduce((best, k) => (c[k] > c[best] ? k : best), "int" as AbilityKey);
  const casting: AbilityKey = ownSpellAbility ?? castWith ?? bestCasting;
  const attackSpells = useMemo(() => spells.filter((sp) => spellKind(sp) !== null), [spells]);
  const saves = savesOf(c);

  const choices: Choice[] = useMemo(() => {
    switch (category) {
      case "skill":
        return SKILLS.map((skill) => {
          const t = skillCheck(c, skill);
          return { key: skill, label: skill, bonus: signed(flatBonus(t.parts)), a11y: `${skill} check` };
        });
      case "save":
        return ABILITIES.map((a) => {
          const t = savingThrow(c, a.key);
          return { key: a.key, label: a.short, bonus: signed(flatBonus(t.parts)), a11y: `${a.name} save${saves.includes(a.key) ? ", proficient" : ""}` };
        });
      case "ability":
        return [
          { key: "init", label: "Initiative", bonus: signed(abilityMod(c.dex)), a11y: "Initiative" },
          ...ABILITIES.map((a) => ({ key: a.key, label: a.short, bonus: signed(abilityMod(c[a.key])), a11y: `${a.name} check` })),
        ];
      case "attack":
        return [
          ...weapons.map((w) => ({ key: `w:${w.id}`, label: w.name, bonus: signed(flatBonus(weaponAttack(c, w).parts)), a11y: `${w.name} attack` })),
          ...attackSpells.map((sp) =>
            spellKind(sp) === "attack"
              ? { key: `s:${sp.id}`, label: sp.name, bonus: signed(flatBonus(spellAttack(c, sp, casting).parts)), a11y: `${sp.name} spell attack` }
              : { key: `s:${sp.id}`, label: sp.name, bonus: `DC ${spellSaveDC(c, casting).dc}`, a11y: `${sp.name} spell save` },
          ),
        ];
      case "death":
        return [];
    }
  }, [category, c, weapons, attackSpells, casting, saves]);

  const pick = category === "death" ? "death" : picks[category] && choices.some((ch) => ch.key === picks[category]) ? picks[category]! : choices[0]?.key ?? null;
  const pickKey = `${category}:${pick ?? ""}`;

  // Keep the picked chip in view (it may be far along the row, e.g. Stealth).
  const chipRow = useRef<ScrollViewInstance>(null);
  const chipX = useRef<Record<string, number>>({});
  const scrollToPick = useCallback(
    (animated: boolean) => {
      const x = pick ? chipX.current[`${category}:${pick}`] : undefined;
      if (x !== undefined) chipRow.current?.scrollTo({ x: Math.max(0, x - s(24)), animated });
    },
    [category, pick, s],
  );
  useEffect(() => {
    scrollToPick(true);
  }, [scrollToPick]);

  const plan: Plan | null = useMemo(() => {
    const extras = { guidance, bless };
    const none = { saveDC: null, damage: null, damageType: "", damageParts: [] as Part[], castPick: false };
    if (!pick) return null;
    switch (category) {
      case "skill":
        return { ...none, test: skillCheck(c, pick, extras) };
      case "save":
        return { ...none, test: savingThrow(c, pick as AbilityKey, extras) };
      case "ability":
        return { ...none, test: pick === "init" ? initiative(c) : abilityCheck(c, pick as AbilityKey, extras) };
      case "death":
        return { ...none, test: deathSave(extras) };
      case "attack": {
        if (pick.startsWith("w:")) {
          const w = weapons.find((x) => `w:${x.id}` === pick);
          if (!w) return null;
          const dice = parseDamage(w.damage);
          const mod = abilityMod(c[weaponAbility(c, w.properties)]);
          return {
            ...none,
            test: weaponAttack(c, w, extras),
            damage: weaponDamage(c, w),
            damageType: w.damage_type,
            damageParts: dice
              ? [
                  { label: w.name, value: 0, die: undefined, dice: dice.text } as Part & { dice: string },
                  { label: abilityName(weaponAbility(c, w.properties)), value: mod },
                ]
              : [],
          };
        }
        const sp = spells.find((x) => `s:${x.id}` === pick);
        if (!sp) return null;
        const dmg = scaleCantrip(spellDamage(sp.description), sp.level, c.level);
        const typeMatch = sp.description.match(/\d+d\d+\s+([a-z]+)\s+damage/i);
        const damageParts = dmg ? [{ label: sp.name, value: 0, dice: dmg.text } as Part & { dice: string }] : [];
        const base = { ...none, damage: dmg, damageType: typeMatch ? typeMatch[1].toLowerCase() : "", damageParts, castPick: !ownSpellAbility };
        if (spellKind(sp) === "attack") return { ...base, test: spellAttack(c, sp, casting, extras) };
        const save = spellSaveDC(c, casting);
        return { ...base, test: null, saveDC: { ...save, ability: spellSaveAbility(sp) ?? "dex" } };
      }
    }
  }, [category, pick, c, weapons, spells, guidance, bless, casting, ownSpellAbility]);

  // ----- The tray -----
  const [stage] = useState(() => new DiceStage());
  const flash = useAnimatedValue(0);
  const pending = useRef<{ shown: Shown; dice: StageDie[] } | null>(null);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const landRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stage.dispose(), [stage]);
  useEffect(
    () => () => {
      if (fallback.current) clearTimeout(fallback.current);
    },
    [],
  );

  // A result only shows while its choice is still picked.
  const shown = lastShown && lastShown.key === pickKey ? lastShown : null;

  // Between rolls the tray shows what you're about to throw: the d20 (two with advantage), and a d4 for
  // Guidance or Bless; or, for a spell the target saves against, its damage dice.
  const idleDice: StageDie[] = useMemo(() => {
    if (!plan) return [];
    if (plan.test) {
      const twice = plan.test.kind !== "death" && mode !== "normal";
      const d20s: StageDie[] = Array.from({ length: twice ? 2 : 1 }, () => ({ sides: 20, value: 20 }));
      return [...d20s, ...plan.test.parts.filter((p) => p.die).map((p) => ({ sides: p.die!, value: p.die! }))];
    }
    if (plan.damage) return toStage(damageDice(plan.damage, false).flatMap((d) => Array.from({ length: d.count }, () => ({ sides: d.sides, value: d.sides, kept: true }))));
    return [];
  }, [plan, mode]);
  const idleSig = idleDice.map((d) => d.sides).join(",");

  useEffect(() => {
    if (stage.busy || pending.current || shown) return;
    stage.show(idleDice);
    // Only the dice's shape matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, idleSig, shown]);

  useEffect(() => {
    const land = () => {
      if (fallback.current) clearTimeout(fallback.current);
      fallback.current = null;
      const done = pending.current;
      pending.current = null;
      setRolling(false);
      if (!done || !done.shown) return;
      const result = done.shown;
      setShown(result);
      const natural = result.type === "d20" ? result.r.natural : null;
      if (natural === 20) nat20Haptic();
      if (natural === 1) {
        nat1Haptic();
        flash.setValue(0.6);
        Animated.timing(flash, { toValue: 0, duration: 700, useNativeDriver: true }).start();
      }
    };
    const unlisten = stage.listen({ impact: () => landHaptic(), settled: land });
    landRef.current = land;
    return () => {
      unlisten();
      landRef.current = null;
    };
  }, [stage, flash]);

  const throwDice = useCallback(
    (result: Shown, dice: ThrownDie[]) => {
      const thrown = toStage(dice).slice(0, MAX_SHOWN);
      const entry = { shown: result, dice: thrown };
      pending.current = entry;
      setShown(null);
      setRolling(true);
      stage.roll(thrown);
      if (fallback.current) clearTimeout(fallback.current);
      fallback.current = setTimeout(() => {
        fallback.current = null;
        if (pending.current !== entry) return;
        stage.show(thrown);
        landRef.current?.();
      }, 6000);
    },
    [stage],
  );

  const busy = () => stage.busy || pending.current !== null;

  const rollTest = useCallback(() => {
    if (busy() || !plan?.test) return;
    if (category === "death" && (deathState === "stable" || deathState === "dead")) return;
    const r = rollD20(plan.test, plan.test.kind === "death" ? "normal" : mode, dc);
    if (category === "death") {
      const next = applyDeathSave(tally, r.natural, r.total);
      setTally(next.tally);
      setDeathState(next.state);
      throwDice({ type: "d20", key: pickKey, r, death: { state: next.state, natural: r.natural } }, r.dice);
      return;
    }
    if (plan.test.kind === "attack") setCritFor(r.natural === 20 ? pickKey : null);
    throwDice({ type: "d20", key: pickKey, r }, r.dice);
    // stage and the refs never change; busy() reads them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, category, deathState, mode, dc, tally, pickKey, throwDice]);

  const crit = critFor === pickKey;
  const rollDmg = useCallback(() => {
    if (busy() || !plan?.damage) return;
    const r = rollDamage(plan.damage, crit && !!plan.test);
    throwDice({ type: "damage", key: pickKey, r }, r.dice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, crit, pickKey, throwDice]);

  const primary = plan?.test ? rollTest : rollDmg;
  useShake(true, {
    onJolt: () => {
      if (stage.busy) return;
      stage.rattle();
      rattleHaptic();
    },
    onShakeEnd: primary,
  });

  // ----- Setters (each clears the old result) -----
  const fresh = () => {
    pending.current = null;
    setShown(null);
    setCritFor(null);
  };
  const setCategory = (next: Category) => {
    fresh();
    setCategoryState(next);
  };
  const setPick = (key: string) => {
    fresh();
    setPicks((prev) => ({ ...prev, [category]: key }));
  };
  const setMode = (next: RollMode) => {
    fresh();
    setModeState(next);
  };
  const setDc = (next: number | null) => {
    fresh();
    setDcState(next);
  };
  const resetDeath = () => {
    fresh();
    setTally({ ...NEW_TALLY });
    setDeathState("rolling");
  };

  // ----- What the result area says -----
  const isAttack = plan?.test?.kind === "attack";
  const isDeath = category === "death";
  const deathDone = isDeath && (deathState === "stable" || deathState === "dead");
  const isSaveSpell = !!plan?.saveDC;
  const guidanceOn = category === "skill";
  const blessOn = category === "save" || category === "death" || (category === "attack" && !isSaveSpell);
  const dcLabel = isAttack ? "AC" : "DC";

  const choiceName = choices.find((ch) => ch.key === pick)?.label ?? "";
  const title = !plan
    ? ""
    : isSaveSpell
      ? choiceName
      : plan.test!.title;

  let headline: { text: string; color: string; sub?: string } = { text: title, color: colors.ink };
  let line = "";
  let cards: (Part & { dice?: string; rolled?: number })[] = [];
  if (plan?.test) {
    cards = plan.test.parts;
    line = `d20 ${bonusText(plan.test.parts)}${!isDeath && mode !== "normal" ? ` · ${mode === "advantage" ? "Advantage" : "Disadvantage"}` : ""}${!isDeath && dc !== null ? ` · ${dcLabel} ${dc}` : ""}`;
  } else if (plan?.saveDC) {
    cards = plan.saveDC.parts;
    line = `Spell save DC ${plan.saveDC.dc} · ${abilityName(plan.saveDC.ability)} save`;
  }

  if (shown?.type === "d20") {
    const r = shown.r;
    const d20s = r.dice.filter((d) => d.sides === 20);
    const natText = d20s.length > 1 ? `d20 ${d20s.find((d) => d.kept)!.value} (${d20s.find((d) => !d.kept)!.value})` : `d20 ${r.natural}`;
    const extra = r.dice.filter((d) => d.sides !== 20 || d.label).map((d) => ` + ${d.label ?? "d" + d.sides} ${d.value}`);
    line = `${natText}${r.flat ? (r.flat > 0 ? ` + ${r.flat}` : ` − ${-r.flat}`) : ""}${extra.join("")} = ${r.total}`;
    cards = r.test.parts.map((p) => (p.die ? { ...p, rolled: r.dice.find((d) => d.label === p.label)?.value } : p));
    if (shown.death) {
      const { state, natural } = shown.death;
      const what = natural === 20 ? "Natural 20! Regain 1 HP" : natural === 1 ? "Natural 1: two failures" : r.total >= 10 ? "Success" : "Failure";
      const after = state === "stable" ? " · Stable" : state === "dead" ? " · Dead" : "";
      headline = { text: `${r.total}  ${what}${after}`, color: natural === 20 ? colors.gold : r.total >= 10 && natural !== 1 ? colors.ink : colors.wordmark };
    } else {
      const o = r.outcome;
      const word =
        o === "crit" ? "Critical hit!" : o === "hit" ? "Hit" : o === "miss" ? (r.natural === 1 ? "Natural 1 · Miss" : "Miss") : o === "success" ? "Success" : o === "fail" ? "Fail" : "";
      const nat = !word && r.natural === 20 ? "Natural 20" : !word && r.natural === 1 ? "Natural 1" : "";
      headline = {
        text: `${r.total}${word || nat ? `  ${word || nat}` : ""}`,
        color: o === "crit" || (r.natural === 20 && o !== "fail") ? colors.gold : o === "fail" || o === "miss" ? colors.wordmark : colors.ink,
      };
    }
  } else if (shown?.type === "damage") {
    const r = shown.r;
    const byDie = r.dice.map((d) => d.value).join(", ");
    line = `${r.expression}: ${byDie}${r.flat ? (r.flat > 0 ? ` + ${r.flat}` : ` − ${-r.flat}`) : ""} = ${r.total}`;
    headline = { text: `${r.total} ${plan?.damageType ? `${plan.damageType} ` : ""}damage`, color: r.crit ? colors.gold : colors.ink };
    cards = [...(plan?.damageParts ?? [])];
    if (r.crit) cards.push({ label: "Critical", value: 0, dice: "dice ×2" });
  } else if (rolling) {
    headline = { text: "Rolling…", color: colors.muted };
  }

  const damageLabel = plan?.damage ? `${crit && plan.test ? "Crit " : isSaveSpell ? "Roll damage " : "Damage "}${damageExpression(plan.damage, crit && !!plan.test)}` : "No damage dice";

  const dieCount = shown?.type === "damage" ? shown.r.dice.length : shown?.type === "d20" ? shown.r.dice.length : idleDice.length;
  const trayTop = dieCount > MAX_SHOWN ? `Showing ${MAX_SHOWN} of ${dieCount} dice · all are counted` : null;
  const trayBottom = isSaveSpell && plan?.saveDC
    ? `Spell save DC ${plan.saveDC.dc} · ${abilityName(plan.saveDC.ability)}`
    : plan?.test && !shown && !rolling
      ? `${bonusText(plan.test.parts)}${isDeath ? " · DC 10" : dc !== null ? ` · ${dcLabel} ${dc}` : ""}`
      : null;
  const natGold = shown?.type === "d20" && shown.r.natural === 20;

  return (
    <>
      <Segment
        items={CATEGORIES.map((cat) => ({ key: cat.key, label: cat.label }))}
        value={category}
        onPick={(k) => setCategory(k as Category)}
        disabled={rolling}
        seedBase={110}
        height={s(32)}
        style={{ marginTop: s(6) }}
      />

      {isDeath ? (
        <DeathTallyRow tally={tally} state={deathState} onReset={resetDeath} disabled={rolling} />
      ) : (
        <ScrollView
          ref={chipRow}
          key={category}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: s(6), flexGrow: 0 }}
          contentContainerStyle={{ gap: s(6), paddingRight: s(4) }}
        >
          {choices.length ? (
            choices.map((ch, i) => {
              const on = ch.key === pick;
              return (
                <Pressable
                  key={ch.key}
                  onLayout={(e) => {
                    chipX.current[`${category}:${ch.key}`] = e.nativeEvent.layout.x;
                    if (on) scrollToPick(false);
                  }}
                  disabled={rolling}
                  onPress={() => {
                    tapHaptic();
                    setPick(ch.key);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={ch.a11y}
                  accessibilityState={{ selected: on, disabled: rolling }}
                  style={[styles.choice, { height: s(34), paddingHorizontal: s(10) }]}
                >
                  <InkOutline seed={130 + (i % 20)} radius={s(INK_RADIUS)} fill={on ? INK_DARK : HOLDER_FILL} />
                  <Text style={[styles.choiceText, { fontSize: fs(14) }, on && styles.textOn]} numberOfLines={1}>
                    {ch.label} <Text style={[styles.choiceBonus, on && styles.textOn]}>{ch.bonus}</Text>
                  </Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={[styles.note, { fontSize: fs(13), height: s(34), lineHeight: s(34) }]}>
              No weapons or attack spells in the Codex yet.
            </Text>
          )}
        </ScrollView>
      )}

      <DiceTray stage={stage} gold={natGold} flash={flash} minHeight={s(TRAY_MIN_CHECK)} topNote={trayTop} bottomNote={trayBottom} />

      <View style={[styles.result, { height: s(108), marginTop: s(6) }]} accessibilityLiveRegion="polite">
        <Text style={[styles.headline, { fontSize: fs(shown ? 26 : 20), lineHeight: fs(shown ? 32 : 26), color: headline.color }]} numberOfLines={1} adjustsFontSizeToFit>
          {headline.text}
        </Text>
        {line ? (
          <Text style={[styles.line, { fontSize: fs(13), marginTop: s(1) }]} numberOfLines={1} adjustsFontSizeToFit>
            {line}
          </Text>
        ) : null}
        <View style={[styles.cards, { gap: s(5), marginTop: s(5) }]}>
          {cards.map((p, i) => (
            <InkCard key={`${p.label}-${i}`} label={p.label} value={p.dice ? p.dice : p.die ? `+1d${p.die}${p.rolled ? ` (${p.rolled})` : ""}` : p.label === "Base" ? String(p.value) : signed(p.value)} seed={150 + i} gold={!!p.die || p.label === "Critical"} />
          ))}
        </View>
      </View>

      {isDeath ? (
        <Text style={[styles.note, { fontSize: fs(12), marginTop: s(6), height: s(32) }]} numberOfLines={2}>
          10 or more succeeds. A natural 1 counts as two failures; a natural 20 regains 1 HP.
        </Text>
      ) : (
        <Segment
          items={[
            { key: "disadvantage", label: "Disadvantage" },
            { key: "normal", label: "Normal" },
            { key: "advantage", label: "Advantage" },
          ]}
          value={mode}
          onPick={(k) => setMode(k as RollMode)}
          disabled={rolling || isSaveSpell}
          seedBase={90}
          height={s(32)}
          style={{ marginTop: s(6), opacity: isSaveSpell ? 0.45 : 1 }}
        />
      )}

      <View style={[styles.toggles, { marginTop: s(8), gap: s(6), height: s(34) }]}>
        {plan?.castPick ? (
          CASTING.map((k, i) => (
            <Toggle key={k} label={`Cast with ${k.toUpperCase()}`} short={k.toUpperCase()} on={casting === k} seed={170 + i} disabled={rolling} onPress={() => { fresh(); setCastWith(k); }} />
          ))
        ) : (
          <>
            {guidanceOn ? <Toggle label="Guidance, plus 1d4" short="Guidance" on={guidance} seed={175} disabled={rolling} onPress={() => { fresh(); setGuidance(!guidance); }} /> : null}
            {blessOn ? <Toggle label="Bless, plus 1d4" short="Bless" on={bless} seed={176} disabled={rolling} onPress={() => { fresh(); setBless(!bless); }} /> : null}
            {!guidanceOn && !blessOn && !isSaveSpell ? <Text style={[styles.note, { flex: 1, fontSize: fs(12) }]} numberOfLines={2}>{pick === "init" ? "Initiative is a Dexterity check. Guidance doesn't apply." : "Guidance only works on skill checks."}</Text> : null}
            {isSaveSpell ? <Text style={[styles.note, { flex: 1, fontSize: fs(12) }]} numberOfLines={2}>Each target makes a {abilityName(plan!.saveDC!.ability)} save against your DC.</Text> : null}
          </>
        )}
        {plan?.test && !isDeath ? <DcBox label={dcLabel} value={dc} onChange={setDc} disabled={rolling} /> : null}
      </View>

      <View style={[styles.buttons, { marginTop: s(10), gap: s(8) }]}>
        {plan?.test && !isAttack ? (
          <InkButton
            label={rolling ? "Rolling…" : deathDone ? (deathState === "dead" ? "Dead · Reset to roll again" : "Stable · Reset to roll again") : isDeath ? "Roll death save" : "Roll"}
            variant="red"
            width={rollW}
            height={s(44)}
            seed={77}
            onPress={rollTest}
            disabled={rolling || deathDone}
          />
        ) : isAttack ? (
          <>
            <InkButton label={rolling ? "Rolling…" : "Roll to hit"} variant="red" width={(rollW - s(8)) * 0.48} height={s(44)} seed={77} onPress={rollTest} disabled={rolling} />
            <InkButton label={damageLabel} variant="parchment" width={(rollW - s(8)) * 0.52} height={s(44)} seed={78} onPress={rollDmg} disabled={rolling || !plan?.damage} />
          </>
        ) : isSaveSpell ? (
          <InkButton label={rolling ? "Rolling…" : plan?.damage ? damageLabel : "No damage dice to roll"} variant="red" width={rollW} height={s(44)} seed={77} onPress={rollDmg} disabled={rolling || !plan?.damage} />
        ) : (
          <InkButton label="Roll" variant="red" width={rollW} height={s(44)} seed={77} onPress={() => undefined} disabled />
        )}
      </View>
    </>
  );
}

const toStage = (dice: { sides: StageDie["sides"]; value: number; kept?: boolean }[]): StageDie[] =>
  dice.map((d) => ({ sides: d.sides, value: d.value, kept: d.kept }));

function Segment({
  items,
  value,
  onPick,
  disabled,
  seedBase,
  height,
  style,
}: {
  items: { key: string; label: string }[];
  value: string;
  onPick: (key: string) => void;
  disabled: boolean;
  seedBase: number;
  height: number;
  style?: object;
}) {
  const { s, fs } = useScale();
  return (
    <View style={[styles.segment, { gap: s(5) }, style]}>
      {items.map((item, i) => {
        const on = item.key === value;
        return (
          <Pressable
            key={item.key}
            disabled={disabled}
            onPress={() => {
              if (on) return;
              tapHaptic();
              onPick(item.key);
            }}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: on, disabled }}
            style={[styles.segmentItem, { height, paddingHorizontal: s(3) }]}
          >
            <InkOutline seed={seedBase + i} radius={s(INK_RADIUS)} fill={on ? INK_DARK : HOLDER_FILL} />
            <Text style={[styles.segmentText, { fontSize: fs(13) }, on && styles.textOn]} numberOfLines={1} adjustsFontSizeToFit>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One bonus as a small ink card: "Dexterity +3", "Guidance +1d4". */
function InkCard({ label, value, seed, gold }: { label: string; value: string; seed: number; gold: boolean }) {
  const { s, fs } = useScale();
  return (
    <View style={[styles.card, { height: s(24), paddingHorizontal: s(8), gap: s(4) }]}>
      <InkOutline seed={seed} radius={s(INK_RADIUS)} fill={HOLDER_FILL} color={gold ? colors.gold : undefined} />
      <Text style={[styles.cardLabel, { fontSize: fs(12) }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.cardValue, { fontSize: fs(13) }, gold && { color: colors.panelStroke }]}>{value}</Text>
    </View>
  );
}

function Toggle({ label, short, on, seed, disabled, onPress }: { label: string; short: string; on: boolean; seed: number; disabled: boolean; onPress: () => void }) {
  const { s, fs } = useScale();
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled }}
      style={[styles.toggle, { paddingHorizontal: s(6) }]}
    >
      <InkOutline seed={seed} radius={s(INK_RADIUS)} fill={on ? INK_DARK : HOLDER_FILL} />
      <Text style={[styles.segmentText, { fontSize: fs(13) }, on && styles.textOn]} numberOfLines={1} adjustsFontSizeToFit>
        {on ? "✓ " : ""}
        {short}
        {short === "Guidance" || short === "Bless" ? " +1d4" : ""}
      </Text>
    </Pressable>
  );
}

/** The DC (or the target's AC): empty until you set one. − / + step it; tapping the number clears it. */
function DcBox({ label, value, onChange, disabled }: { label: string; value: number | null; onChange: (v: number | null) => void; disabled: boolean }) {
  const { s, fs } = useScale();
  const ring = s(30);
  const step = (sign: -1 | 1) => (
    <Pressable
      disabled={disabled || (value !== null && (sign < 0 ? value <= DC_MIN : value >= DC_MAX))}
      onPress={() => {
        tapHaptic();
        onChange(value === null ? DC_START : Math.max(DC_MIN, Math.min(DC_MAX, value + sign)));
      }}
      accessibilityRole="button"
      accessibilityLabel={`${sign > 0 ? "Raise" : "Lower"} ${label}`}
      hitSlop={6}
      style={({ pressed }) => [styles.round, { width: ring, height: ring, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}
    >
      <View style={styles.ring} pointerEvents="none">
        <InkRing size={ring} seed={sign > 0 ? 19 : 23} dots={false} />
      </View>
      <Text style={[styles.stepSign, { fontSize: fs(18) }]}>{sign > 0 ? "+" : "−"}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.dcBox, { gap: s(4) }]}>
      {step(-1)}
      <Pressable
        disabled={disabled || value === null}
        onPress={() => {
          tapHaptic();
          onChange(null);
        }}
        accessibilityRole="button"
        accessibilityLabel={value === null ? `No ${label}` : `${label} ${value}, tap to clear`}
        style={[styles.dcMiddle, { width: s(58), height: s(34) }]}
      >
        <InkOutline seed={label.length + 60} radius={s(INK_RADIUS)} fill={HOLDER_FILL} />
        <Text style={[styles.dcText, { fontSize: fs(value === null ? 12 : 16) }]} numberOfLines={1} adjustsFontSizeToFit>
          {value === null ? `No ${label}` : `${label} ${value}`}
        </Text>
      </Pressable>
      {step(1)}
    </View>
  );
}

function DeathTallyRow({ tally, state, onReset, disabled }: { tally: DeathTally; state: DeathState; onReset: () => void; disabled: boolean }) {
  const { s, fs } = useScale();
  const dot = s(18);
  const marks = (n: number, color: string, seed: number, name: string) => (
    <View style={[styles.marks, { gap: s(3) }]} accessible accessibilityLabel={`${n} of 3 ${name}`}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: dot, height: dot }}>
          {i < n ? <View style={[styles.markFill, { backgroundColor: color, borderRadius: dot / 2, margin: s(3) }]} /> : null}
          <View style={styles.ring} pointerEvents="none">
            <InkRing size={dot} seed={seed + i} dots={false} />
          </View>
        </View>
      ))}
    </View>
  );
  return (
    <View style={[styles.tallyRow, { marginTop: s(6), height: s(34), gap: s(8) }]}>
      <Text style={[styles.tallyLabel, { fontSize: fs(12) }]}>Successes</Text>
      {marks(tally.successes, colors.ink, 180, "successes")}
      <Text style={[styles.tallyLabel, { fontSize: fs(12), marginLeft: s(4) }]}>Failures</Text>
      {marks(tally.failures, colors.wordmark, 190, "failures")}
      <View style={{ flex: 1 }} />
      <Pressable
        disabled={disabled || (state === "rolling" && tally.successes === 0 && tally.failures === 0)}
        onPress={() => {
          tapHaptic();
          onReset();
        }}
        accessibilityRole="button"
        accessibilityLabel="Reset death saves"
        style={[styles.toggleSmall, { height: s(30), paddingHorizontal: s(10) }]}
      >
        <InkOutline seed={199} radius={s(INK_RADIUS)} fill={HOLDER_FILL} />
        <Text style={[styles.segmentText, { fontSize: fs(13) }]}>Reset</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontFamily: fonts.body, color: colors.muted, textAlign: "center" },
  choice: { alignItems: "center", justifyContent: "center" },
  choiceText: { fontFamily: fonts.headingBold, color: colors.ink },
  choiceBonus: { fontFamily: fonts.stat, color: colors.muted },
  textOn: { color: colors.cream },
  note: { fontFamily: fonts.bodyItalic, color: colors.muted },
  result: { alignItems: "center", justifyContent: "flex-start", overflow: "hidden" },
  headline: { fontFamily: fonts.title, textAlign: "center", ...inkText.heading },
  line: { fontFamily: fonts.headingBold, color: colors.ink, textAlign: "center" },
  cards: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  card: { flexDirection: "row", alignItems: "center" },
  cardLabel: { fontFamily: fonts.body, color: colors.muted },
  cardValue: { fontFamily: fonts.headingBold, color: colors.ink },
  segment: { flexDirection: "row" },
  segmentItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  segmentText: { fontFamily: fonts.headingBold, color: colors.ink },
  toggles: { flexDirection: "row", alignItems: "center" },
  toggle: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  toggleSmall: { alignItems: "center", justifyContent: "center" },
  dcBox: { flexDirection: "row", alignItems: "center" },
  dcMiddle: { alignItems: "center", justifyContent: "center" },
  dcText: { fontFamily: fonts.headingBold, color: colors.ink },
  round: { alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", top: 0, left: 0 },
  stepSign: { fontFamily: fonts.headingBold, color: colors.ink },
  buttons: { flexDirection: "row", justifyContent: "center" },
  tallyRow: { flexDirection: "row", alignItems: "center" },
  tallyLabel: { fontFamily: fonts.headingBold, color: colors.muted },
  marks: { flexDirection: "row" },
  markFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
});
