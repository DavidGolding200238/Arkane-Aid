import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useParty } from "../context/PartyContext";
import {
  addEquipment,
  addTrait,
  deleteCharacter,
  loadCharacter,
  loadEquipment,
  loadTraits,
  removeEquipment,
  removeTrait,
  proficiencyBonus,
  saveCharacter,
  SKILLS,
  uploadPortrait,
  type Character,
  type CharacterDraft,
  type Equipment,
  type Trait,
} from "../lib/character";
import { errorText } from "../lib/parties";
import type { AppScreen } from "../navigation/screens";
import PageHeader from "../components/PageHeader";
import ParchmentPanel from "../components/ParchmentPanel";
import CircleButton from "../components/CircleButton";
import ThemedButton from "../components/ThemedButton";
import Rule from "../components/Rule";
import { QuillIcon } from "../components/icons";
import { colors, fonts, inkText, useAppFonts, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");
const portraitArt = require("../../assets/images/ledger/portrait-placeholder.jpg");
// Hand-inked outline from Figma's portrait frame (2167:647), transparent everywhere else.
const portraitInk = require("../../assets/images/ledger/portrait-ink.png");
// The photo is clipped to this share of the outline's size so its edge sits
// under the wobbly ink line (the ink runs from about 97% to 101% of the art).
const PORTRAIT_PHOTO = 0.99;
const statHead = require("../../assets/images/ledger/stat-header.png");
const statBody = require("../../assets/images/ledger/stat-body.png");

// Figma ability box (Group 873): torn paper body (2167:686, with its drop
// shadow) and the red textured header (2167:658) laid over its top edge.
// Art sizes are 3x pixels; the paper itself is 279 x 276 of the 292 x 296 body
// export, the rest is the torn edge overhang and the shadow.
// The header's red texture comes from Figma; its torn, ink-rimmed edge is a
// mask built to match the paper's edge (the Figma layer itself is square).
// It overhangs the paper by about 1.5 dp so it covers the paper's top stroke.
const BODY = { w: 292, h: 296, paperX: 7, paperY: 1, paperW: 279, paperH: 276 };
const HEAD = { w: 272, h: 85, overhang: 0.016 };

function StatFrame({
  label,
  children,
  width,
  labelSize,
}: {
  label: string;
  children: ReactNode;
  width: number;
  labelSize: number;
}) {
  const k = width / BODY.paperW;
  const height = BODY.paperH * k;
  const over = width * HEAD.overhang;
  const headW = width + over * 2;
  const headH = headW * (HEAD.h / HEAD.w);
  return (
    <View style={{ width, height }}>
      <Image
        source={statBody}
        style={{
          position: "absolute",
          left: -BODY.paperX * k,
          top: -BODY.paperY * k,
          width: BODY.w * k,
          height: BODY.h * k,
        }}
        resizeMode="stretch"
      />
      <View style={[styles.statHead, { top: -over, left: -over, width: headW, height: headH }]}>
        <Image source={statHead} style={styles.fill} resizeMode="stretch" />
        <Text style={[styles.statLabel, { fontSize: labelSize }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.statValueBox}>{children}</View>
    </View>
  );
}

// Asul Bold heading with a drawn underline as wide as the text.
function SectionTitle({ children, center, size }: { children: string; center?: boolean; size: number }) {
  return (
    <View style={[styles.sectionTitle, center ? styles.sectionCenter : styles.sectionLeft]}>
      <Text style={[styles.section, { fontSize: size }]}>{children}</Text>
      <Rule color={colors.ink} style={styles.sectionRule} />
    </View>
  );
}

const STATS = [
  ["str", "STR"],
  ["dex", "DEX"],
  ["con", "CON"],
  ["int", "INT"],
  ["wis", "WIS"],
  ["cha", "CHA"],
] as const;

type StatKey = (typeof STATS)[number][0];

const RACES = [
  "Dragonborn",
  "Dwarf",
  "Elf",
  "Gnome",
  "Goliath",
  "Halfling",
  "Human",
  "Orc",
  "Tiefling",
];

const CLASSES = [
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

const EMPTY: CharacterDraft = {
  name: "",
  class: "",
  race: "",
  background: "",
  level: 1,
  hp_current: 10,
  hp_max: 10,
  ac: 10,
  speed: 30,
  languages: "",
  features: "",
  skills: [],
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

type Props = { onBack: () => void; onOpen: (screen: AppScreen) => void };
type Picker = "race" | "class" | null;

function clampStat(value: string) {
  const n = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(n)) return 1;
  return Math.min(30, Math.max(1, n));
}

function clampLevel(value: string) {
  const n = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(n)) return 1;
  return Math.min(20, Math.max(1, n));
}

function clampHp(value: string, min: number) {
  const n = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(n)) return min;
  return Math.min(999, Math.max(min, n));
}

function clampRange(value: string, min: number, max: number, fallback: number) {
  const n = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function draftFrom(row: Character | null): CharacterDraft {
  if (!row) return EMPTY;
  return {
    name: row.name ?? "",
    class: row.class ?? "",
    race: row.race ?? "",
    background: row.background ?? "",
    level: row.level ?? 1,
    hp_current: row.hp_current ?? 10,
    hp_max: row.hp_max ?? 10,
    ac: row.ac ?? 10,
    speed: row.speed ?? 30,
    languages: row.languages ?? "",
    features: row.features ?? "",
    skills: row.skills ?? [],
    str: row.str,
    dex: row.dex,
    con: row.con,
    int: row.int,
    wis: row.wis,
    cha: row.cha,
  };
}

export default function LedgerScreen({ onBack, onOpen }: Props) {
  const { width, s, fs } = useScale();
  const { selected } = useParty();
  const partyId = selected?.party.id ?? null;
  const partyName = selected?.party.name ?? "No party";
  const fontsLoaded = useAppFonts();
  const [row, setRow] = useState<Character | null>(null);
  const [draft, setDraft] = useState<CharacterDraft>(EMPTY);
  const [gear, setGear] = useState<Equipment[]>([]);
  const [traits, setTraits] = useState<Trait[]>([]);
  const [gearName, setGearName] = useState("");
  const [traitName, setTraitName] = useState("");
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState<Picker>(null);
  const [customRace, setCustomRace] = useState(false);
  const [customClass, setCustomClass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const next = await loadCharacter(partyId);
      setRow(next);
      setDraft(draftFrom(next));
      setGear(next ? await loadEquipment(next.id) : []);
      setTraits(next ? await loadTraits(next.id) : []);
      setError("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }, [partyId]);

  useEffect(() => {
    load();
  }, [load]);

  const setStat = (key: StatKey, value: string) => {
    setDraft((current) => ({ ...current, [key]: clampStat(value) }));
  };

  const toggleSkill = (skill: string) => {
    setDraft((current) => {
      const on = current.skills.includes(skill);
      return { ...current, skills: on ? current.skills.filter((item) => item !== skill) : [...current.skills, skill] };
    });
  };

  const persist = async () => {
    setBusy(true);
    try {
      const saved = await saveCharacter(partyId, draft, row);
      setRow(saved);
      setDraft(draftFrom(saved));
      setEditing(false);
      setPicker(null);
      setError("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const ensureRow = async () => {
    if (row) return row;
    const saved = await saveCharacter(partyId, draft, null);
    setRow(saved);
    return saved;
  };

  const pickPortrait = async () => {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo access is off. Allow it to set the portrait.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (picked.canceled || !picked.assets[0]) return;
    setBusy(true);
    try {
      const saved = await ensureRow();
      const url = await uploadPortrait(saved.id, picked.assets[0].uri);
      setRow({ ...saved, portrait_url: url });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const addGear = async () => {
    setBusy(true);
    try {
      const saved = await ensureRow();
      await addEquipment(saved.id, gearName);
      setGearName("");
      setGear(await loadEquipment(saved.id));
      setError("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const dropGear = async (id: string) => {
    if (!row) return;
    setBusy(true);
    try {
      await removeEquipment(id);
      setGear(await loadEquipment(row.id));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const addOneTrait = async () => {
    setBusy(true);
    try {
      const saved = await ensureRow();
      await addTrait(saved.id, traitName);
      setTraitName("");
      setTraits(await loadTraits(saved.id));
      setError("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const dropTrait = async (id: string) => {
    if (!row) return;
    setBusy(true);
    try {
      await removeTrait(id);
      setTraits(await loadTraits(row.id));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const removeSheet = () => {
    if (!row) return;
    Alert.alert("Delete sheet", `Remove this character from ${partyName}? Other parties keep theirs.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await deleteCharacter(row);
            setRow(null);
            setDraft(EMPTY);
            setGear([]);
            setTraits([]);
            setEditing(false);
            setError("");
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const choose = (field: "race" | "class", value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === "race") setCustomRace(false);
    if (field === "class") setCustomClass(false);
    setPicker(null);
  };

  if (!fontsLoaded) return <View style={styles.root} />;

  // Ability boxes: three per row, Figma proportions 91 x 90 with a 28 high header.
  const pagePad = s(12);
  const sheetPad = s(16);
  const statGap = s(14);
  const boxW = Math.floor((width - pagePad * 2 - sheetPad * 2 - 2 - statGap * 2) / 3);
  const edit = s(44);
  const portrait = s(152);

  const statValue: StyleProp<TextStyle> = [styles.statValue, { fontSize: fs(30) }];

  const renderPicker = (field: "race" | "class", options: string[]) => {
    if (picker !== field) return null;
    const custom = field === "race" ? customRace : customClass;
    const current = draft[field];
    return (
      <View style={[styles.picker, { marginTop: s(10) }]}>
        <Text style={[styles.pickerLabel, { fontSize: fs(15) }]}>{field === "race" ? "Race" : "Class"}</Text>
        {options.map((option) => {
          const on = current === option;
          return (
            <Pressable key={option} onPress={() => choose(field, option)} style={[styles.option, on && styles.optionOn]}>
              <Text style={[styles.optionText, on && styles.optionTextOn, { fontSize: fs(15) }]}>{option}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => (field === "race" ? setCustomRace(true) : setCustomClass(true))}
          style={[styles.option, custom && styles.optionOn]}
        >
          <Text style={[styles.optionText, custom && styles.optionTextOn, { fontSize: fs(15) }]}>Custom</Text>
        </Pressable>
        {custom ? (
          <TextInput
            style={[styles.customInput, { fontSize: fs(15) }]}
            value={current}
            onChangeText={(value) => setDraft((next) => ({ ...next, [field]: value }))}
            placeholder={field === "race" ? "Custom race" : "Custom class"}
            placeholderTextColor={colors.placeholder}
          />
        ) : null}
      </View>
    );
  };

  const listItem = (name: string, onRemove: () => void, key: string) => (
    <Pressable key={key} onPress={() => (editing ? onRemove() : undefined)} disabled={!editing}>
      <Text style={[styles.listItem, { fontSize: fs(16), lineHeight: fs(26) }]}>
        {name}
        {editing ? <Text style={styles.remove}>{"  \u00d7"}</Text> : null}
      </Text>
    </Pressable>
  );

  const addRow = (value: string, onChange: (v: string) => void, placeholder: string, onAdd: () => void) => (
    <View style={[styles.addRow, { marginTop: s(8), gap: s(8) }]}>
      <TextInput
        style={[styles.addInput, { fontSize: fs(16) }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
      />
      <ThemedButton size="small" label="Add" onPress={onAdd} />
    </View>
  );

  const textSection = (
    title: string,
    value: string,
    field: "languages" | "features",
    placeholder: string,
    empty: string,
  ) => (
    <ParchmentPanel variant="ledger" style={{ marginTop: s(10) }} contentStyle={{ padding: s(16) }}>
      <SectionTitle size={fs(18)}>{title}</SectionTitle>
      {editing ? (
        <TextInput
          style={[styles.storyInput, { fontSize: fs(15), lineHeight: fs(22), minHeight: s(72) }]}
          multiline
          scrollEnabled={false}
          value={value}
          onChangeText={(next) => setDraft((current) => ({ ...current, [field]: next }))}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
        />
      ) : (
        <Text style={[styles.story, { fontSize: fs(15), lineHeight: fs(22) }]}>{value || empty}</Text>
      )}
    </ParchmentPanel>
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <PageHeader title="Ledger" subtitle={partyName} onBack={onBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: pagePad, paddingTop: s(4), paddingBottom: s(24) }}
        keyboardShouldPersistTaps="handled"
      >
        <ParchmentPanel variant="ledger" contentStyle={{ paddingHorizontal: sheetPad, paddingTop: s(12), paddingBottom: s(14) }}>
          <View style={styles.nameRow}>
            <View style={{ width: edit }} />
            {editing ? (
              <TextInput
                style={[styles.nameInput, { fontSize: fs(18) }]}
                value={draft.name}
                onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
                placeholder="Name"
                placeholderTextColor={colors.placeholder}
              />
            ) : (
              <Text style={[styles.name, { fontSize: fs(18) }]} numberOfLines={2}>
                {draft.name || "Unnamed"}
              </Text>
            )}
            <CircleButton
              size={edit}
              accessibilityLabel={editing ? "Stop editing" : "Edit sheet"}
              onPress={() => {
                setEditing((on) => !on);
                setPicker(null);
              }}
              style={editing && styles.editOn}
            >
              <QuillIcon circleSize={edit} />
            </CircleButton>
          </View>

          <View style={[styles.portraitBox, { width: portrait, height: portrait, marginTop: s(12) }]}>
            <Pressable
              onPress={pickPortrait}
              accessibilityRole="imagebutton"
              accessibilityLabel="Change portrait"
              style={[
                styles.portraitWrap,
                {
                  width: portrait * PORTRAIT_PHOTO,
                  height: portrait * PORTRAIT_PHOTO,
                  borderRadius: (portrait * PORTRAIT_PHOTO) / 2,
                },
              ]}
            >
              {row?.portrait_url ? (
                <Image source={{ uri: row.portrait_url }} style={styles.fill} />
              ) : (
                <Image source={portraitArt} style={styles.fill} resizeMode="cover" />
              )}
            </Pressable>
            <View style={styles.portraitInk} pointerEvents="none">
              <Image source={portraitInk} style={styles.fill} resizeMode="stretch" />
            </View>
          </View>

          <View style={[styles.metaRow, { marginTop: s(14), gap: s(12) }]}>
            {editing ? (
              <Pressable style={styles.metaInput} onPress={() => setPicker(picker === "race" ? null : "race")}>
                <Text style={[styles.meta, { fontSize: fs(14) }]}>{draft.race || "Choose race"}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.meta, { fontSize: fs(14) }]}>Race: {draft.race || "\u2014"}</Text>
            )}
            {editing ? (
              <Pressable style={styles.metaInput} onPress={() => setPicker(picker === "class" ? null : "class")}>
                <Text style={[styles.meta, styles.metaRight, { fontSize: fs(14) }]}>{draft.class || "Choose class"}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.meta, styles.metaRight, { fontSize: fs(14) }]}>Class: {draft.class || "\u2014"}</Text>
            )}
          </View>
          {renderPicker("race", RACES)}
          {renderPicker("class", CLASSES)}

          <View style={styles.vitalRow}>
            <View style={styles.vital}>
              <Text style={styles.vitalLabel}>Level</Text>
              {editing ? (
                <TextInput
                  style={styles.vitalInput}
                  keyboardType="number-pad"
                  value={String(draft.level)}
                  onChangeText={(value) => setDraft((current) => ({ ...current, level: clampLevel(value) }))}
                />
              ) : (
                <Text style={styles.vitalValue}>{draft.level}</Text>
              )}
            </View>
            <View style={[styles.vital, styles.vitalWide]}>
              <Text style={styles.vitalLabel}>HP</Text>
              {editing ? (
                <View style={styles.hpEdit}>
                  <TextInput
                    style={[styles.vitalInput, styles.hpInput]}
                    keyboardType="number-pad"
                    value={String(draft.hp_current)}
                    onChangeText={(value) => setDraft((current) => ({ ...current, hp_current: clampHp(value, 0) }))}
                  />
                  <Text style={styles.hpSlash}>/</Text>
                  <TextInput
                    style={[styles.vitalInput, styles.hpInput]}
                    keyboardType="number-pad"
                    value={String(draft.hp_max)}
                    onChangeText={(value) => setDraft((current) => ({ ...current, hp_max: clampHp(value, 1) }))}
                  />
                </View>
              ) : (
                <Text style={styles.vitalValue}>
                  {draft.hp_current}/{draft.hp_max}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.vitalRow}>
            <View style={styles.vital}>
              <Text style={styles.vitalLabel}>AC</Text>
              {editing ? (
                <TextInput
                  style={styles.vitalInput}
                  keyboardType="number-pad"
                  value={String(draft.ac)}
                  onChangeText={(value) => setDraft((current) => ({ ...current, ac: clampRange(value, 0, 30, 10) }))}
                />
              ) : (
                <Text style={styles.vitalValue}>{draft.ac}</Text>
              )}
            </View>
            <View style={styles.vital}>
              <Text style={styles.vitalLabel}>Speed</Text>
              {editing ? (
                <TextInput
                  style={styles.vitalInput}
                  keyboardType="number-pad"
                  value={String(draft.speed)}
                  onChangeText={(value) => setDraft((current) => ({ ...current, speed: clampRange(value, 0, 120, 30) }))}
                />
              ) : (
                <Text style={styles.vitalValue}>{draft.speed}</Text>
              )}
            </View>
            <View style={styles.vital}>
              <Text style={styles.vitalLabel}>Bonus</Text>
              <Text style={styles.vitalValue}>+{proficiencyBonus(draft.level)}</Text>
            </View>
          </View>

          <Rule color={colors.ink} style={styles.rule} />

          <View style={[styles.stats, { columnGap: statGap, rowGap: s(14) }]}>
            {STATS.map(([key, label]) => (
              <StatFrame key={key} label={label} width={boxW} labelSize={fs(15)}>
                {editing ? (
                  <TextInput
                    style={[styles.statInput, { fontSize: fs(26) }]}
                    keyboardType="number-pad"
                    value={String(draft[key])}
                    onChangeText={(value) => setStat(key, value)}
                  />
                ) : (
                  <Text style={statValue}>{draft[key]}</Text>
                )}
              </StatFrame>
            ))}
          </View>
        </ParchmentPanel>

        <ParchmentPanel variant="ledger" style={{ marginTop: s(10) }} contentStyle={{ padding: s(18), minHeight: s(120) }}>
          <SectionTitle center size={fs(18)}>
            Background
          </SectionTitle>
          {editing ? (
            <TextInput
              style={[styles.storyInput, { fontSize: fs(15), lineHeight: fs(22), minHeight: s(88) }]}
              multiline
              scrollEnabled={false}
              value={draft.background}
              onChangeText={(background) => setDraft((current) => ({ ...current, background }))}
              placeholder="Background story"
              placeholderTextColor={colors.placeholder}
            />
          ) : (
            <Text style={[styles.story, { fontSize: fs(15), lineHeight: fs(22) }]}>
              {draft.background || "No story yet."}
            </Text>
          )}
        </ParchmentPanel>

        <ParchmentPanel variant="ledger" style={{ marginTop: s(10) }} contentStyle={{ padding: s(16) }}>
          <SectionTitle size={fs(18)}>Skills</SectionTitle>
          {editing ? (
            <View style={[styles.chips, { gap: s(6) }]}>
              {SKILLS.map((skill) => {
                const on = draft.skills.includes(skill);
                return (
                  <Pressable key={skill} onPress={() => toggleSkill(skill)} style={[styles.chip, on && styles.chipOn]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn, { fontSize: fs(13) }]}>{skill}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.story, { fontSize: fs(15), lineHeight: fs(22) }]}>
              {draft.skills.length === 0 ? "None marked." : draft.skills.join(", ")}
            </Text>
          )}
        </ParchmentPanel>

        {textSection("Languages", draft.languages, "languages", "Common, Elvish", "None listed.")}
        {textSection("Features", draft.features, "features", "Class features, fighting style, spells", "None yet.")}

        <ParchmentPanel variant="ledger" style={{ marginTop: s(10) }} contentStyle={{ padding: s(16) }}>
          <SectionTitle size={fs(18)}>Equipment</SectionTitle>
          {gear.length === 0 ? (
            <Text style={[styles.listItem, styles.listEmpty, { fontSize: fs(16), lineHeight: fs(26) }]}>Nothing carried.</Text>
          ) : null}
          {gear.map((item) => listItem(item.name, () => dropGear(item.id), item.id))}
          {editing ? addRow(gearName, setGearName, "Add equipment", addGear) : null}
        </ParchmentPanel>

        <ParchmentPanel variant="ledger" style={{ marginTop: s(10) }} contentStyle={{ padding: s(16) }}>
          <SectionTitle size={fs(18)}>Traits</SectionTitle>
          {traits.length === 0 ? (
            <Text style={[styles.listItem, styles.listEmpty, { fontSize: fs(16), lineHeight: fs(26) }]}>No traits yet.</Text>
          ) : null}
          {traits.map((item) => listItem(item.name, () => dropTrait(item.id), item.id))}
          {editing ? addRow(traitName, setTraitName, "Add a trait", addOneTrait) : null}
        </ParchmentPanel>

        {!partyId ? (
          <Text style={[styles.note, { fontSize: fs(13), marginTop: s(12) }]}>
            Not in a party yet.{" "}
            <Text style={styles.link} onPress={() => onOpen("create")}>
              Create
            </Text>
            {" \u00b7 "}
            <Text style={styles.link} onPress={() => onOpen("join")}>
              Join
            </Text>
          </Text>
        ) : (
          <Text style={[styles.note, { fontSize: fs(13), marginTop: s(12) }]}>
            This sheet is only for {partyName}. A new party gets a new character.
          </Text>
        )}

        {error ? <Text style={[styles.error, { fontSize: fs(14) }]}>{error}</Text> : null}

        {editing ? (
          <View style={[styles.actions, { marginTop: s(14), gap: s(10) }]}>
            <ThemedButton label="Save sheet" onPress={persist} busy={busy} />
            {row ? <ThemedButton label="Delete sheet" variant="outline" onPress={removeSheet} disabled={busy} /> : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.wash },
  parchment: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0.28,
  },
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  scroll: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  name: { flex: 1, fontFamily: fonts.titleBold, textAlign: "center", letterSpacing: 0.4, ...inkText.heading },
  nameInput: {
    flex: 1,
    fontFamily: fonts.titleBold,
    color: colors.ink,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    paddingVertical: 4,
    marginHorizontal: 6,
  },
  editOn: { opacity: 0.75 },
  portraitBox: { alignSelf: "center", alignItems: "center", justifyContent: "center" },
  portraitInk: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  portraitWrap: { overflow: "hidden", backgroundColor: colors.portrait },
  metaRow: { flexDirection: "row" },
  meta: { flex: 1, fontFamily: fonts.heading, color: colors.ink },
  metaRight: { textAlign: "right" },
  metaInput: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    paddingVertical: 2,
  },
  // Level, HP, AC, Speed and Bonus keep the original 125ce45 layout and sizes.
  // Same structure as 125ce45 (two rows, label over value). Both rows sit on one
  // three-column grid: Level lines up with AC, and HP takes the other two
  // columns so long values like 120/120 have room, centred over Speed/Bonus.
  vitalRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 14 },
  vital: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  vitalWide: { flex: 2 },
  vitalLabel: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, letterSpacing: 0.6 },
  vitalValue: { fontFamily: fonts.body, color: colors.ink, fontSize: 18, marginTop: 4, fontVariant: ["tabular-nums"] },
  vitalInput: {
    fontFamily: fonts.body,
    color: colors.ink,
    fontSize: 18,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
    minWidth: 48,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  hpEdit: { flexDirection: "row", alignItems: "center", gap: 6 },
  hpInput: { minWidth: 56 },
  hpSlash: { fontFamily: fonts.body, color: colors.ink, fontSize: 18 },
  rule: { marginTop: 10, marginBottom: 12 },
  stats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  statHead: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: { fontFamily: fonts.heading, color: colors.statLabel, textAlign: "center", letterSpacing: 0.6 },
  statValueBox: { flex: 1, marginTop: "31%", alignItems: "center", justifyContent: "center" },
  statValue: { fontFamily: fonts.stat, color: colors.ink, textAlign: "center", includeFontPadding: false },
  statInput: {
    fontFamily: fonts.stat,
    color: colors.ink,
    textAlign: "center",
    padding: 0,
    minWidth: 40,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  picker: {
    borderWidth: 1,
    borderColor: colors.cardStroke,
    borderRadius: 5,
    backgroundColor: "rgba(254,252,235,0.96)",
    overflow: "hidden",
  },
  pickerLabel: {
    fontFamily: fonts.headingBold,
    color: colors.ink,
    textAlign: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardStroke,
    backgroundColor: "rgba(189,127,2,0.12)",
  },
  option: { paddingVertical: 9, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "rgba(26,24,22,0.12)" },
  optionOn: { backgroundColor: "rgba(196,69,54,0.12)" },
  optionText: { fontFamily: fonts.heading, color: colors.ink },
  optionTextOn: { color: colors.primary },
  customInput: {
    fontFamily: fonts.body,
    margin: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    color: colors.ink,
    paddingVertical: 6,
  },
  sectionTitle: { marginBottom: 8 },
  sectionCenter: { alignSelf: "center" },
  sectionLeft: { alignSelf: "flex-start" },
  section: { fontFamily: fonts.headingBold, ...inkText.heading },
  sectionRule: { marginTop: 2 },
  story: { fontFamily: fonts.body, color: colors.ink, textAlign: "left" },
  storyInput: { fontFamily: fonts.body, color: colors.ink, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    borderWidth: 1,
    borderColor: colors.cardStroke,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(254,252,235,0.7)",
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.heading, color: colors.ink },
  chipTextOn: { color: colors.cream },
  listItem: { fontFamily: fonts.heading, color: colors.ink, textAlign: "left" },
  listEmpty: { color: colors.muted },
  remove: { color: colors.wordmark },
  addRow: { flexDirection: "row", alignItems: "center" },
  addInput: {
    flex: 1,
    fontFamily: fonts.body,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    color: colors.ink,
    paddingVertical: 6,
  },
  note: { fontFamily: fonts.body, color: colors.muted, textAlign: "center" },
  link: { color: colors.wordmark },
  error: { fontFamily: fonts.body, color: colors.wordmark, marginTop: 8, textAlign: "center" },
  actions: { alignSelf: "stretch" },
});
