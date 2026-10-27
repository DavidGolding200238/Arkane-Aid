import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type HostInstance, type KeyboardTypeOptions } from "react-native";
import { EMPTY_DRAFT, loadCharacter, proficiencyBonus, saveCharacter, SheetUpdateNeeded, type Character } from "../lib/character";
import {
  holdWeapon,
  loadSpells,
  loadWeapons,
  removeSpell,
  removeWeapon,
  saveSpell,
  saveWeapon,
  signed,
  SPELL_LEVELS,
  SRD_SPELLS,
  SRD_WEAPONS,
  suggestedToHit,
  type Spell,
  type SpellDraft,
  type Weapon,
  type WeaponDraft,
} from "../lib/arsenal";
import { errorText } from "../lib/parties";
import NoteSheet from "./NoteSheet";
import FadeRow, { FadePaperContext } from "./FadeRow";
import { InkButton, InkStroke, RuledLines } from "./Ink";
import { colors, fonts, inkText, useScale } from "../theme";

// The Codex's Weapons and Spells tabs: each player's own list for this party, on light-paper cards
// like the session notes. Tap a card to edit it; "Add" (in the Codex header) opens a new one.

type ListProps = {
  partyId: string;
  /** The Codex header's Add button is open: show a blank form at the top. */
  adding: boolean;
  onCloseAdd: () => void;
  /** The page's inner width in dp. */
  width: number;
};

const EMPTY_WEAPON: WeaponDraft = { name: "", damage: "", damage_type: "", to_hit: null, properties: "", description: "" };
const emptySpell = (level: number): SpellDraft => ({
  name: "",
  level,
  school: "",
  casting_time: "",
  range: "",
  verbal: false,
  somatic: false,
  material: false,
  material_text: "",
  duration: "",
  description: "",
});

/** This player's sheet for the party, created blank on the first weapon or spell (a sheet holds them). */
function useSheet(partyId: string) {
  const [character, setCharacter] = useState<Character | null>(null);
  const ensure = async () => {
    if (character) return character;
    let made: Character;
    try {
      made = await saveCharacter(partyId, EMPTY_DRAFT, null);
    } catch (err) {
      if (!(err instanceof SheetUpdateNeeded)) throw err;
      made = err.saved;
    }
    setCharacter(made);
    return made;
  };
  return { character, setCharacter, ensure };
}

// A blank line to write on with a small label above, as in the Codex note form.
function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboard,
  maxLength,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboard?: KeyboardTypeOptions;
  maxLength?: number;
  onBlur?: () => void;
}) {
  const { s, fs } = useScale();
  const line = fs(22);
  return (
    <View style={{ flexGrow: 1, flexBasis: s(130) }}>
      <Text style={[styles.label, { fontSize: fs(12), lineHeight: fs(16) }]}>{label}</Text>
      {multiline ? (
        <View style={{ minHeight: line * 3 }}>
          <RuledLines lineHeight={line} />
          <TextInput
            style={[styles.input, styles.inputBody, { fontSize: fs(15), lineHeight: line, minHeight: line * 3 }]}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholder}
            maxLength={maxLength}
            multiline
          />
        </View>
      ) : (
        <>
          <TextInput
            style={[styles.input, { fontSize: fs(15), paddingVertical: s(4) }]}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholder}
            keyboardType={keyboard}
            maxLength={maxLength}
            onBlur={onBlur}
          />
          <InkStroke seed={label.length + 3} />
        </>
      )}
    </View>
  );
}

// A searchable SRD list inside the form: type a few letters, tap a row to fill the form.
function SrdPicker<T>({
  items,
  title,
  sub,
  onPick,
}: {
  items: T[];
  title: (item: T) => string;
  sub: (item: T) => string;
  onPick: (item: T) => void;
}) {
  const { s, fs } = useScale();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? items.filter((item) => title(item).toLowerCase().includes(q)) : items).slice(0, 30);
  }, [items, query, title]);
  return (
    <View style={[styles.picker, { padding: s(8), gap: s(2) }]}>
      <TextInput
        style={[styles.input, { fontSize: fs(15), paddingVertical: s(4) }]}
        value={query}
        onChangeText={setQuery}
        placeholder="Search the SRD"
        placeholderTextColor={colors.placeholder}
        autoFocus
      />
      <InkStroke seed={12} />
      {shown.map((item) => (
        <Pressable
          key={title(item)}
          onPress={() => onPick(item)}
          style={({ pressed }) => [{ paddingVertical: s(6) }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={[styles.pickTitle, { fontSize: fs(15), lineHeight: fs(20) }]}>{title(item)}</Text>
          <Text style={[styles.pickSub, { fontSize: fs(12), lineHeight: fs(16) }]}>{sub(item)}</Text>
        </Pressable>
      ))}
      {shown.length === 0 ? <Text style={[styles.pickSub, { fontSize: fs(13) }]}>No match. Write your own above.</Text> : null}
    </View>
  );
}

// Save, Delete (asks once more) and Cancel along the bottom of a form.
function FormButtons({
  width,
  busy,
  onSave,
  onDelete,
  onCancel,
}: {
  width: number;
  busy: boolean;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const { s } = useScale();
  const [sure, setSure] = useState(false);
  const gap = s(8);
  const count = onDelete ? 3 : 2;
  const w = (width - gap * (count - 1)) / count;
  return (
    <View style={[styles.row, { gap, marginTop: s(4) }]}>
      <InkButton variant="red" label="Save" width={w} height={s(38)} seed={51} onPress={onSave} busy={busy} />
      {onDelete ? (
        <InkButton
          label={sure ? "Sure?" : "Delete"}
          labelColor={colors.wordmark}
          width={w}
          height={s(38)}
          seed={52}
          onPress={() => (sure ? onDelete() : setSure(true))}
          disabled={busy}
        />
      ) : null}
      <InkButton label="Cancel" width={w} height={s(38)} seed={53} onPress={onCancel} disabled={busy} />
    </View>
  );
}

function Card({ seed, children, onPress, hint }: { seed: number; children: ReactNode; onPress?: () => void; hint?: string }) {
  const { s } = useScale();
  // The card's paper, so a tab row inside it (the spell form's levels) fades into the sheet.
  const sheet = useRef<HostInstance>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const paper = useMemo(() => ({ kind: "sheet" as const, ref: sheet, w: size.w, h: size.h }), [size]);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityHint={hint}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View
        ref={sheet}
        style={{ padding: s(14), paddingBottom: s(12), gap: s(4) }}
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          setSize((old) => (old.w === w && old.h === h ? old : { w, h }));
        }}
      >
        <NoteSheet seed={seed} />
        <FadePaperContext.Provider value={paper}>{children}</FadePaperContext.Provider>
      </View>
    </Pressable>
  );
}

function useList<T>(partyId: string, load: (characterId: string) => Promise<T[]>) {
  const sheet = useSheet(partyId);
  const { setCharacter } = sheet;
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const found = await loadCharacter(partyId);
      setCharacter(found);
      setItems(found ? await load(found.id) : []);
      setError("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [partyId, load, setCharacter]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch from Supabase when the party changes
    refresh();
  }, [refresh]);
  return { ...sheet, items, setItems, loading, error, setError, refresh };
}

// ---------- Weapons ----------

function WeaponForm({
  start,
  toHitFor,
  width,
  busy,
  onSave,
  onDelete,
  onCancel,
}: {
  start: WeaponDraft;
  toHitFor: (properties: string) => { value: number; why: string };
  width: number;
  busy: boolean;
  onSave: (draft: WeaponDraft) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const { s, fs } = useScale();
  const [draft, setDraft] = useState(start);
  const [hit, setHit] = useState(start.to_hit === null ? "" : signed(start.to_hit));
  const [picking, setPicking] = useState(false);
  const set = (change: Partial<WeaponDraft>) => setDraft((d) => ({ ...d, ...change }));
  const suggested = toHitFor(draft.properties);
  // Phone number pads have no "+": type 3 and it reads +3 once you leave the box (start with - for a minus).
  const signHit = () => setHit((text) => (/^\d{1,2}$/.test(text.trim()) ? `+${text.trim()}` : text));
  const save = () => {
    const typed = /^\s*[+-]?\d{1,2}\s*$/.test(hit) ? Number(hit.replace("+", "")) : null;
    onSave({ ...draft, to_hit: typed });
  };
  return (
    <Card seed={61}>
      <View style={{ gap: s(10) }}>
        <View style={[styles.row, { gap: s(8), alignItems: "flex-end" }]}>
          <Field label="Name" value={draft.name} onChange={(name) => set({ name })} placeholder="Longsword" maxLength={80} />
          <InkButton
            label={picking ? "Close" : "SRD list"}
            width={s(96)}
            height={s(34)}
            seed={54}
            onPress={() => setPicking((on) => !on)}
          />
        </View>
        {picking ? (
          <SrdPicker
            items={SRD_WEAPONS}
            title={(w) => w.name}
            sub={(w) => `${w.group} \u00b7 ${w.damage} ${w.type}${w.properties ? ` \u00b7 ${w.properties}` : ""}`}
            onPick={(w) => {
              set({ name: w.name, damage: w.damage, damage_type: w.type, properties: w.properties });
              setHit("");
              setPicking(false);
            }}
          />
        ) : null}
        <View style={[styles.row, styles.wrap, { gap: s(10) }]}>
          <Field label="Damage" value={draft.damage} onChange={(damage) => set({ damage })} placeholder="1d8" maxLength={40} />
          <Field label="Damage type" value={draft.damage_type} onChange={(damage_type) => set({ damage_type })} placeholder="Slashing" maxLength={40} />
        </View>
        <View>
          <Field label="To hit" value={hit} onChange={setHit} onBlur={signHit} placeholder={signed(suggested.value)} keyboard="numeric" maxLength={3} />
          <Text style={[styles.hint, { fontSize: fs(12), lineHeight: fs(16), marginTop: s(3) }]}>
            Suggested {signed(suggested.value)} ({suggested.why}). Leave it blank to use that.
          </Text>
        </View>
        <Field label="Properties" value={draft.properties} onChange={(properties) => set({ properties })} placeholder="Versatile (1d10), Sap" maxLength={200} />
        <Field label="Description" value={draft.description} onChange={(description) => set({ description })} placeholder="Where you got it, how it looks" maxLength={1000} multiline />
        <FormButtons width={width - s(28)} busy={busy} onSave={save} onDelete={onDelete} onCancel={onCancel} />
      </View>
    </Card>
  );
}

export function WeaponList({ partyId, adding, onCloseAdd, width }: ListProps) {
  const { s, fs } = useScale();
  const list = useList<Weapon>(partyId, loadWeapons);
  const { character, items, setError } = list;
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // In hand first, then the rest in the order they were added.
  const sorted = useMemo(() => [...items.filter((w) => w.in_hand), ...items.filter((w) => !w.in_hand)], [items]);

  const toHitFor = (properties: string) => {
    const scores = { str: character?.str ?? 10, dex: character?.dex ?? 10 };
    const pb = proficiencyBonus(character?.level ?? 1);
    const p = properties.toLowerCase();
    const ability = p.includes("ammunition") ? "DEX" : p.includes("finesse") ? (scores.dex > scores.str ? "DEX" : "STR") : "STR";
    return { value: suggestedToHit(properties, scores, pb), why: `${ability} + Proficiency Bonus` };
  };

  const run = async (work: (characterId: string) => Promise<void>, done: () => void) => {
    setBusy(true);
    try {
      const sheet = await list.ensure();
      await work(sheet.id);
      done();
      list.setItems(await loadWeapons(sheet.id));
      setError("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const save = (draft: WeaponDraft, id: string | null) =>
    run(
      (cid) => saveWeapon(cid, draft, id, !id && items.length === 0),
      () => (id ? setEditing(null) : onCloseAdd())
    );

  const drop = (weapon: Weapon) =>
    run(
      async (cid) => {
        await removeWeapon(weapon.id);
        // Exactly one weapon is in hand while there are any: the next one takes its place.
        const next = items.find((w) => w.id !== weapon.id);
        if (weapon.in_hand && next) await holdWeapon(cid, next.id);
      },
      () => setEditing(null)
    );

  const hold = (weapon: Weapon) => run((cid) => holdWeapon(cid, weapon.id), () => {});

  const inner = width - s(28);
  return (
    <View style={{ gap: s(12) }}>
      {adding ? (
        <WeaponForm start={EMPTY_WEAPON} toHitFor={toHitFor} width={width} busy={busy} onSave={(d) => save(d, null)} onCancel={onCloseAdd} />
      ) : null}
      {!list.loading && items.length === 0 && !adding ? (
        <Text style={[styles.empty, { fontSize: fs(14) }]}>No weapons yet. Tap Add to write one in or pick from the SRD.</Text>
      ) : null}
      {sorted.map((weapon, i) =>
        editing === weapon.id ? (
          <WeaponForm
            key={weapon.id}
            start={weapon}
            toHitFor={toHitFor}
            width={width}
            busy={busy}
            onSave={(d) => save(d, weapon.id)}
            onDelete={() => drop(weapon)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <Card key={weapon.id} seed={80 + i} onPress={() => setEditing(weapon.id)} hint="Tap to edit">
            {weapon.in_hand ? (
              <View style={styles.handMark}>
                <Text style={[styles.inHand, { fontSize: fs(12), lineHeight: fs(16) }]}>IN HAND</Text>
                <View style={{ width: s(56) }}>
                  <InkStroke color={colors.wordmark} seed={9} />
                </View>
              </View>
            ) : null}
            <View style={[styles.row, { gap: s(8), alignItems: "center" }]}>
              <Text style={[styles.title, { fontSize: fs(16), lineHeight: fs(21) }]}>{weapon.name}</Text>
              {!weapon.in_hand ? (
                <InkButton label="Hold" width={s(70)} height={s(30)} seed={55 + i} onPress={() => hold(weapon)} disabled={busy} />
              ) : null}
            </View>
            <Text style={[styles.stat, { fontSize: fs(15), lineHeight: fs(20), maxWidth: inner }]}>
              {[
                `${signed(weapon.to_hit ?? toHitFor(weapon.properties).value)} to hit`,
                [weapon.damage, weapon.damage_type].filter(Boolean).join(" "),
              ]
                .filter(Boolean)
                .join(" \u00b7 ")}
            </Text>
            {weapon.properties ? <Text style={[styles.body, { fontSize: fs(14), lineHeight: fs(19) }]}>{weapon.properties}</Text> : null}
            {weapon.description ? (
              <Text style={[styles.body, styles.muted, { fontSize: fs(14), lineHeight: fs(19) }]} numberOfLines={3}>
                {weapon.description}
              </Text>
            ) : null}
          </Card>
        )
      )}
      {list.error ? <Text style={[styles.error, { fontSize: fs(14) }]}>{list.error}</Text> : null}
    </View>
  );
}

// ---------- Spells ----------

// The level tabs (Cantrip to 9th), red-underlined like the Codex tabs; scrolls sideways on narrow phones.
// The Codex page margin: the list's level row reaches past it so its tabs scroll to the screen edge.
const PAGE_MARGIN = 19;

function LevelTabs({
  level,
  onPick,
  counts,
  bleed = 0,
}: {
  level: number;
  onPick: (level: number) => void;
  counts?: number[];
  bleed?: number;
}) {
  const { s, fs } = useScale();
  return (
    <FadeRow gap={s(18)} inset={s(2)} bleed={bleed} active={level}>
      {SPELL_LEVELS.map((name, i) => {
        const on = i === level;
        const count = counts?.[i] ?? 0;
        return (
          <Pressable
            key={name}
            onPress={() => onPick(i)}
            hitSlop={6}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={styles.levelTab}
          >
            <Text style={[styles.levelLabel, on && styles.levelOn, { fontSize: fs(15), lineHeight: fs(22) }]}>
              {name}
              {count ? <Text style={[styles.count, { fontSize: fs(11) }]}>{` ${count}`}</Text> : null}
            </Text>
            <View style={{ alignSelf: "stretch", opacity: on ? 1 : 0, marginTop: -2 }}>
              <InkStroke color={colors.wordmark} seed={20 + i} />
            </View>
          </Pressable>
        );
      })}
    </FadeRow>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { s } = useScale();
  return (
    <InkButton
      variant={on ? "red" : "parchment"}
      label={label}
      width={s(44)}
      height={s(34)}
      seed={label.charCodeAt(0)}
      onPress={onPress}
    />
  );
}

function SpellForm({
  start,
  width,
  busy,
  onSave,
  onDelete,
  onCancel,
}: {
  start: SpellDraft;
  width: number;
  busy: boolean;
  onSave: (draft: SpellDraft) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const { s, fs } = useScale();
  const [draft, setDraft] = useState(start);
  const [picking, setPicking] = useState(false);
  const set = (change: Partial<SpellDraft>) => setDraft((d) => ({ ...d, ...change }));
  const srd = useMemo(() => SRD_SPELLS.filter((sp) => sp.level === draft.level), [draft.level]);
  return (
    <Card seed={62}>
      <View style={{ gap: s(10) }}>
        <View style={[styles.row, { gap: s(8), alignItems: "flex-end" }]}>
          <Field label="Name" value={draft.name} onChange={(name) => set({ name })} placeholder="Fire Bolt" maxLength={80} />
          <InkButton label={picking ? "Close" : "SRD list"} width={s(96)} height={s(34)} seed={56} onPress={() => setPicking((on) => !on)} />
        </View>
        <View>
          <Text style={[styles.label, { fontSize: fs(12), lineHeight: fs(16) }]}>Level</Text>
          <LevelTabs level={draft.level} onPick={(level) => set({ level })} />
        </View>
        {picking ? (
          <SrdPicker
            items={srd}
            title={(sp) => sp.name}
            sub={(sp) => `${sp.school} \u00b7 ${sp.casting_time}`}
            onPick={(sp) => {
              setDraft({ ...sp });
              setPicking(false);
            }}
          />
        ) : null}
        <View style={[styles.row, styles.wrap, { gap: s(10) }]}>
          <Field label="School" value={draft.school} onChange={(school) => set({ school })} placeholder="Evocation" maxLength={40} />
          <Field label="Casting time" value={draft.casting_time} onChange={(casting_time) => set({ casting_time })} placeholder="Action" maxLength={160} />
        </View>
        <View style={[styles.row, styles.wrap, { gap: s(10) }]}>
          <Field label="Range" value={draft.range} onChange={(range) => set({ range })} placeholder="120 feet" maxLength={80} />
          <Field label="Duration" value={draft.duration} onChange={(duration) => set({ duration })} placeholder="Instantaneous" maxLength={80} />
        </View>
        <View>
          <Text style={[styles.label, { fontSize: fs(12), lineHeight: fs(16), marginBottom: s(4) }]}>Components</Text>
          <View style={[styles.row, { gap: s(8) }]}>
            <Toggle label="V" on={draft.verbal} onPress={() => set({ verbal: !draft.verbal })} />
            <Toggle label="S" on={draft.somatic} onPress={() => set({ somatic: !draft.somatic })} />
            <Toggle label="M" on={draft.material} onPress={() => set({ material: !draft.material })} />
          </View>
        </View>
        {draft.material ? (
          <Field label="Material" value={draft.material_text} onChange={(material_text) => set({ material_text })} placeholder="A bit of fleece" maxLength={200} />
        ) : null}
        <Field label="Description" value={draft.description} onChange={(description) => set({ description })} placeholder="What the spell does" maxLength={2000} multiline />
        <FormButtons width={width - s(28)} busy={busy} onSave={() => onSave(draft)} onDelete={onDelete} onCancel={onCancel} />
      </View>
    </Card>
  );
}

function components(spell: Spell) {
  const parts = [spell.verbal && "V", spell.somatic && "S", spell.material && "M"].filter(Boolean).join(", ");
  if (!parts) return "";
  return spell.material && spell.material_text ? `${parts} (${spell.material_text})` : parts;
}

export function SpellList({ partyId, adding, onCloseAdd, width }: ListProps) {
  const { s, fs } = useScale();
  const list = useList<Spell>(partyId, loadSpells);
  const { items, setError } = list;
  const [level, setLevel] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const counts = useMemo(() => SPELL_LEVELS.map((_, i) => items.filter((sp) => sp.level === i).length), [items]);
  const shown = items.filter((sp) => sp.level === level);

  const run = async (work: (characterId: string) => Promise<void>, done: () => void) => {
    setBusy(true);
    try {
      const sheet = await list.ensure();
      await work(sheet.id);
      done();
      list.setItems(await loadSpells(sheet.id));
      setError("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const save = (draft: SpellDraft, id: string | null) =>
    run(
      (cid) => saveSpell(cid, draft, id),
      () => {
        setLevel(draft.level);
        if (id) setEditing(null);
        else onCloseAdd();
      }
    );

  const drop = (id: string) => run(() => removeSpell(id), () => setEditing(null));

  return (
    <View style={{ gap: s(12) }}>
      <LevelTabs level={level} onPick={setLevel} counts={counts} bleed={s(PAGE_MARGIN)} />
      {adding ? (
        <SpellForm key={`new-${level}`} start={emptySpell(level)} width={width} busy={busy} onSave={(d) => save(d, null)} onCancel={onCloseAdd} />
      ) : null}
      {!list.loading && shown.length === 0 && !adding ? (
        <Text style={[styles.empty, { fontSize: fs(14) }]}>
          {`No ${level === 0 ? "cantrips" : `${SPELL_LEVELS[level]} level spells`} yet. Tap Add to write one in or pick from the SRD.`}
        </Text>
      ) : null}
      {shown.map((spell, i) =>
        editing === spell.id ? (
          <SpellForm
            key={spell.id}
            start={spell}
            width={width}
            busy={busy}
            onSave={(d) => save(d, spell.id)}
            onDelete={() => drop(spell.id)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <Card key={spell.id} seed={90 + i} onPress={() => setEditing(spell.id)} hint="Tap to edit">
            <Text style={[styles.title, { fontSize: fs(16), lineHeight: fs(21) }]}>{spell.name}</Text>
            <Text style={[styles.muted, styles.body, { fontSize: fs(13), lineHeight: fs(18) }]}>
              {[spell.level === 0 ? "Cantrip" : `${SPELL_LEVELS[spell.level]} level`, spell.school].filter(Boolean).join(" \u00b7 ")}
            </Text>
            {[
              ["Casting time", spell.casting_time],
              ["Range", spell.range],
              ["Components", components(spell)],
              ["Duration", spell.duration],
            ].map(([name, value]) =>
              value ? (
                // Long casting times ("Reaction, which you take when...") wrap onto more lines.
                <Text key={name} style={[styles.body, { fontSize: fs(14), lineHeight: fs(19) }]}>
                  <Text style={styles.fieldName}>{name}: </Text>
                  {value}
                </Text>
              ) : null
            )}
            {spell.description ? (
              <Text style={[styles.body, styles.muted, { fontSize: fs(14), lineHeight: fs(19), marginTop: s(2) }]} numberOfLines={4}>
                {spell.description}
              </Text>
            ) : null}
          </Card>
        )
      )}
      {list.error ? <Text style={[styles.error, { fontSize: fs(14) }]}>{list.error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  wrap: { flexWrap: "wrap" },
  label: { fontFamily: fonts.headingBold, color: colors.muted, letterSpacing: 0.3 },
  hint: { fontFamily: fonts.heading, fontStyle: "italic", color: colors.muted },
  // Inputs are blank lines to write on: no box, a hand-inked stroke or ruled lines under them.
  input: { fontFamily: fonts.heading, color: colors.ink, paddingVertical: 4 },
  inputBody: { textAlignVertical: "top", paddingTop: 0, paddingBottom: 0 },
  picker: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.cardStroke, borderRadius: 2 },
  pickTitle: { fontFamily: fonts.headingBold, color: colors.ink },
  pickSub: { fontFamily: fonts.heading, color: colors.muted },
  pressed: { opacity: 0.85 },
  title: { flex: 1, fontFamily: fonts.headingBold, ...inkText.heading },
  stat: { fontFamily: fonts.headingBold, color: colors.ink, letterSpacing: 0.2 },
  body: { fontFamily: fonts.heading, color: colors.ink, letterSpacing: 0.2 },
  fieldName: { fontFamily: fonts.headingBold },
  muted: { color: colors.muted },
  handMark: { alignSelf: "flex-start" },
  inHand: { fontFamily: fonts.headingBold, color: colors.wordmark, letterSpacing: 1 },
  levelTab: { alignItems: "center" },
  levelLabel: { fontFamily: fonts.headingBold, color: colors.ink, letterSpacing: 0.3 },
  levelOn: { color: colors.activeTab },
  count: { fontFamily: fonts.heading, color: colors.muted },
  empty: { fontFamily: fonts.heading, fontStyle: "italic", color: colors.muted, textAlign: "center", marginTop: 18 },
  error: { fontFamily: fonts.body, color: colors.wordmark, marginTop: 8 },
});
