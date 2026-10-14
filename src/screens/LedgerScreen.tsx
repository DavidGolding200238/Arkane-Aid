import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import { AtkinsonHyperlegible_400Regular } from "@expo-google-fonts/atkinson-hyperlegible";
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

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");
const underline = require("../../assets/Splash Screen/Rectangle 4901.png");
const backCircle = require("../../assets/Codex/Rectangle 26.png");
const backChevron = require("../../assets/Codex/Polygon 21.png");
const sheet = require("../../assets/Ledger/Rectangle 28.png");
const portraitArt = require("../../assets/Ledger/Rectangle 27.png");
const statHead = require("../../assets/Ledger/Rectangle 39.png");
const statBody = require("../../assets/Ledger/Rectangle 4914.png");
const storyPanel = require("../../assets/Ledger/Rectangle 4909.png");
const paper = require("../../assets/Codex/Rectangle 28 (1).png");
const editCircle = require("../../assets/Codex/Rectangle 26.png");

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
  const { width } = useWindowDimensions();
  const s = width / 360;
  const { selected } = useParty();
  const partyId = selected?.party.id ?? null;
  const partyName = selected?.party.name ?? "No party";
  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    AtkinsonHyperlegible_400Regular,
  });
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

  const titleFont = fontsLoaded ? "CinzelDecorative_400Regular" : undefined;
  const bodyFont = fontsLoaded ? "AtkinsonHyperlegible_400Regular" : undefined;

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

  const boxW = Math.floor((width - 36 * s - 16 * s) / 3);
  const boxH = boxW * (90 / 91);
  const headH = boxH * (28 / 90);
  const side = 44 * s;

  const renderPicker = (field: "race" | "class", options: string[]) => {
    if (picker !== field) return null;
    const custom = field === "race" ? customRace : customClass;
    const current = draft[field];
    return (
      <View style={styles.picker}>
        <Text style={[styles.pickerLabel, titleFont ? { fontFamily: titleFont } : null]}>
          {field === "race" ? "Race" : "Class"}
        </Text>
        {options.map((option) => {
          const on = current === option;
          return (
            <Pressable key={option} onPress={() => choose(field, option)} style={[styles.option, on && styles.optionOn]}>
              <Text style={[styles.optionText, on && styles.optionTextOn, bodyFont ? { fontFamily: bodyFont } : null]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => (field === "race" ? setCustomRace(true) : setCustomClass(true))}
          style={[styles.option, custom && styles.optionOn]}
        >
          <Text style={[styles.optionText, custom && styles.optionTextOn, bodyFont ? { fontFamily: bodyFont } : null]}>
            Custom
          </Text>
        </Pressable>
        {custom ? (
          <TextInput
            style={[styles.customInput, bodyFont ? { fontFamily: bodyFont } : null]}
            value={current}
            onChangeText={(value) => setDraft((next) => ({ ...next, [field]: value }))}
            placeholder={field === "race" ? "Custom race" : "Custom class"}
            placeholderTextColor="#8A8175"
          />
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <View style={[styles.header, { paddingTop: 48 * s }]}>
        <Pressable onPress={onBack} hitSlop={10} style={{ width: side, height: 43 * s }}>
          <Image source={backCircle} style={styles.fill} resizeMode="stretch" />
          <Image source={backChevron} style={styles.chevron} resizeMode="contain" />
        </Pressable>
        <View style={styles.titleBox}>
          <Text style={[styles.title, titleFont ? { fontFamily: titleFont, fontSize: 22 * s } : { fontSize: 22 * s }]}>
            LEDGER
          </Text>
          <Image source={underline} style={{ width: 156 * s, height: 8 * s, marginTop: 2 }} resizeMode="contain" />
          <Text style={[styles.party, bodyFont ? { fontFamily: bodyFont } : null]}>{partyName}</Text>
        </View>
        <View style={{ width: side }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingHorizontal: 12 * s, paddingBottom: 96 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Image source={sheet} style={styles.fill} resizeMode="stretch" />
          <View style={{ paddingHorizontal: 14 * s, paddingTop: 14 * s, paddingBottom: 16 * s }}>
            <View style={styles.nameRow}>
              <View style={{ width: side }} />
              {editing ? (
                <TextInput
                  style={[styles.nameInput, titleFont ? { fontFamily: titleFont } : null]}
                  value={draft.name}
                  onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
                  placeholder="Name"
                  placeholderTextColor="#8A8175"
                />
              ) : (
                <Text style={[styles.name, titleFont ? { fontFamily: titleFont, fontSize: 18 * s } : { fontSize: 18 * s }]}>
                  {draft.name || "Unnamed"}
                </Text>
              )}
              <Pressable
                onPress={() => {
                  setEditing((on) => !on);
                  setPicker(null);
                }}
                style={{ width: side, height: 43 * s }}
              >
                <Image source={editCircle} style={styles.fill} resizeMode="stretch" />
              </Pressable>
            </View>

            <View style={[styles.portraitRing, { width: 152 * s, height: 152 * s, borderRadius: 76 * s }]}>
              <Pressable onPress={pickPortrait} style={[styles.portraitWrap, { width: 146 * s, height: 146 * s, borderRadius: 73 * s }]}>
                {row?.portrait_url ? (
                  <Image source={{ uri: row.portrait_url }} style={styles.fill} />
                ) : (
                  <Image source={portraitArt} style={styles.fill} resizeMode="cover" />
                )}
              </Pressable>
            </View>

            <View style={styles.metaRow}>
              {editing ? (
                <Pressable style={styles.metaInput} onPress={() => setPicker(picker === "race" ? null : "race")}>
                  <Text style={[styles.meta, bodyFont ? { fontFamily: bodyFont } : null]}>
                    {draft.race || "Choose race"}
                  </Text>
                </Pressable>
              ) : (
                <Text style={[styles.meta, bodyFont ? { fontFamily: bodyFont } : null]}>Race: {draft.race || "\u2014"}</Text>
              )}
              {editing ? (
                <Pressable style={[styles.metaInput, styles.metaRight]} onPress={() => setPicker(picker === "class" ? null : "class")}>
                  <Text style={[styles.meta, styles.metaRight, bodyFont ? { fontFamily: bodyFont } : null]}>
                    {draft.class || "Choose class"}
                  </Text>
                </Pressable>
              ) : (
                <Text style={[styles.meta, styles.metaRight, bodyFont ? { fontFamily: bodyFont } : null]}>
                  Class: {draft.class || "\u2014"}
                </Text>
              )}
            </View>
            {renderPicker("race", RACES)}
            {renderPicker("class", CLASSES)}

            <View style={styles.vitalRow}>
              <View style={styles.vital}>
                <Text style={[styles.vitalLabel, bodyFont ? { fontFamily: bodyFont } : null]}>Level</Text>
                {editing ? (
                  <TextInput
                    style={[styles.vitalInput, bodyFont ? { fontFamily: bodyFont } : null]}
                    keyboardType="number-pad"
                    value={String(draft.level)}
                    onChangeText={(value) => setDraft((current) => ({ ...current, level: clampLevel(value) }))}
                  />
                ) : (
                  <Text style={[styles.vitalValue, bodyFont ? { fontFamily: bodyFont } : null]}>{draft.level}</Text>
                )}
              </View>
              <View style={styles.vital}>
                <Text style={[styles.vitalLabel, bodyFont ? { fontFamily: bodyFont } : null]}>HP</Text>
                {editing ? (
                  <View style={styles.hpEdit}>
                    <TextInput
                      style={[styles.vitalInput, styles.hpInput, bodyFont ? { fontFamily: bodyFont } : null]}
                      keyboardType="number-pad"
                      value={String(draft.hp_current)}
                      onChangeText={(value) => setDraft((current) => ({ ...current, hp_current: clampHp(value, 0) }))}
                    />
                    <Text style={[styles.hpSlash, bodyFont ? { fontFamily: bodyFont } : null]}>/</Text>
                    <TextInput
                      style={[styles.vitalInput, styles.hpInput, bodyFont ? { fontFamily: bodyFont } : null]}
                      keyboardType="number-pad"
                      value={String(draft.hp_max)}
                      onChangeText={(value) => setDraft((current) => ({ ...current, hp_max: clampHp(value, 1) }))}
                    />
                  </View>
                ) : (
                  <Text style={[styles.vitalValue, bodyFont ? { fontFamily: bodyFont } : null]}>
                    {draft.hp_current}/{draft.hp_max}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.vitalRow}>
              <View style={styles.vital}>
                <Text style={[styles.vitalLabel, bodyFont ? { fontFamily: bodyFont } : null]}>AC</Text>
                {editing ? (
                  <TextInput
                    style={[styles.vitalInput, bodyFont ? { fontFamily: bodyFont } : null]}
                    keyboardType="number-pad"
                    value={String(draft.ac)}
                    onChangeText={(value) => setDraft((current) => ({ ...current, ac: clampRange(value, 0, 30, 10) }))}
                  />
                ) : (
                  <Text style={[styles.vitalValue, bodyFont ? { fontFamily: bodyFont } : null]}>{draft.ac}</Text>
                )}
              </View>
              <View style={styles.vital}>
                <Text style={[styles.vitalLabel, bodyFont ? { fontFamily: bodyFont } : null]}>Speed</Text>
                {editing ? (
                  <TextInput
                    style={[styles.vitalInput, bodyFont ? { fontFamily: bodyFont } : null]}
                    keyboardType="number-pad"
                    value={String(draft.speed)}
                    onChangeText={(value) => setDraft((current) => ({ ...current, speed: clampRange(value, 0, 120, 30) }))}
                  />
                ) : (
                  <Text style={[styles.vitalValue, bodyFont ? { fontFamily: bodyFont } : null]}>{draft.speed}</Text>
                )}
              </View>
              <View style={styles.vital}>
                <Text style={[styles.vitalLabel, bodyFont ? { fontFamily: bodyFont } : null]}>Bonus</Text>
                <Text style={[styles.vitalValue, bodyFont ? { fontFamily: bodyFont } : null]}>
                  +{proficiencyBonus(draft.level)}
                </Text>
              </View>
            </View>

            <View style={styles.rule} />

            <View style={styles.stats}>
              {STATS.map(([key, label]) => (
                <View key={key} style={{ width: boxW, height: boxH, marginBottom: 8 * s }}>
                  <Image source={statBody} style={styles.fill} resizeMode="stretch" />
                  <Image source={statHead} style={[styles.statHead, { height: headH }]} resizeMode="stretch" />
                  <Text style={[styles.statLabel, { height: headH, fontSize: 13 * s }, bodyFont ? { fontFamily: bodyFont } : null]}>
                    {label}
                  </Text>
                  {editing ? (
                    <TextInput
                      style={[styles.statInput, { top: headH }, bodyFont ? { fontFamily: bodyFont } : null]}
                      keyboardType="number-pad"
                      value={String(draft[key])}
                      onChangeText={(value) => setStat(key, value)}
                    />
                  ) : (
                    <Text style={[styles.statValue, { top: headH, fontSize: 28 * s }, bodyFont ? { fontFamily: bodyFont } : null]}>
                      {draft[key]}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={[styles.panel, { marginTop: 10 * s }]}>
          <Image source={storyPanel} style={styles.fill} resizeMode="stretch" />
          <View style={[styles.panelInner, { padding: 18 * s }]}>
            <Text style={[styles.section, titleFont ? { fontFamily: titleFont } : null]}>Background</Text>
            <View style={styles.sectionRule} />
            {editing ? (
              <TextInput
                style={[styles.storyInput, bodyFont ? { fontFamily: bodyFont } : null]}
                multiline
                scrollEnabled={false}
                value={draft.background}
                onChangeText={(background) => setDraft((current) => ({ ...current, background }))}
                placeholder="Background story"
                placeholderTextColor="#8A8175"
              />
            ) : (
              <Text style={[styles.story, bodyFont ? { fontFamily: bodyFont } : null]}>
                {draft.background || "No story yet."}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.paper, { marginTop: 10 * s }]}>
          <Image source={paper} style={styles.fill} resizeMode="stretch" />
          <View style={{ padding: 16 * s }}>
            <Text style={[styles.section, titleFont ? { fontFamily: titleFont } : null]}>Skills</Text>
            <View style={styles.sectionRule} />
            {editing ? (
              <View style={styles.chips}>
                {SKILLS.map((skill) => {
                  const on = draft.skills.includes(skill);
                  return (
                    <Pressable key={skill} onPress={() => toggleSkill(skill)} style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipText, on && styles.chipTextOn, bodyFont ? { fontFamily: bodyFont } : null]}>
                        {skill}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : draft.skills.length === 0 ? (
              <Text style={[styles.line, bodyFont ? { fontFamily: bodyFont } : null]}>None marked.</Text>
            ) : (
              <Text style={[styles.line, bodyFont ? { fontFamily: bodyFont } : null]}>{draft.skills.join(", ")}</Text>
            )}
          </View>
        </View>

        <View style={[styles.paper, { marginTop: 10 * s }]}>
          <Image source={paper} style={styles.fill} resizeMode="stretch" />
          <View style={{ padding: 16 * s }}>
            <Text style={[styles.section, titleFont ? { fontFamily: titleFont } : null]}>Languages</Text>
            <View style={styles.sectionRule} />
            {editing ? (
              <TextInput
                style={[styles.storyInput, bodyFont ? { fontFamily: bodyFont } : null]}
                multiline
                scrollEnabled={false}
                value={draft.languages}
                onChangeText={(languages) => setDraft((current) => ({ ...current, languages }))}
                placeholder="Common, Elvish"
                placeholderTextColor="#8A8175"
              />
            ) : (
              <Text style={[styles.line, bodyFont ? { fontFamily: bodyFont } : null]}>
                {draft.languages || "None listed."}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.paper, { marginTop: 10 * s }]}>
          <Image source={paper} style={styles.fill} resizeMode="stretch" />
          <View style={{ padding: 16 * s }}>
            <Text style={[styles.section, titleFont ? { fontFamily: titleFont } : null]}>Features</Text>
            <View style={styles.sectionRule} />
            {editing ? (
              <TextInput
                style={[styles.storyInput, bodyFont ? { fontFamily: bodyFont } : null]}
                multiline
                scrollEnabled={false}
                value={draft.features}
                onChangeText={(features) => setDraft((current) => ({ ...current, features }))}
                placeholder="Class features, fighting style, spells"
                placeholderTextColor="#8A8175"
              />
            ) : (
              <Text style={[styles.story, bodyFont ? { fontFamily: bodyFont } : null]}>
                {draft.features || "None yet."}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.paper, { marginTop: 10 * s }]}>
          <Image source={paper} style={styles.fill} resizeMode="stretch" />
          <View style={{ padding: 16 * s }}>
            <Text style={[styles.section, titleFont ? { fontFamily: titleFont } : null]}>Equipment</Text>
            <View style={styles.sectionRule} />
            {gear.length === 0 ? (
              <Text style={[styles.line, bodyFont ? { fontFamily: bodyFont } : null]}>Nothing carried.</Text>
            ) : null}
            {gear.map((item) => (
              <Pressable key={item.id} onPress={() => (editing ? dropGear(item.id) : undefined)}>
                <Text style={[styles.line, bodyFont ? { fontFamily: bodyFont } : null]}>
                  {item.name}
                  {editing ? "  \u00d7" : ""}
                </Text>
              </Pressable>
            ))}
            {editing ? (
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.addInput, bodyFont ? { fontFamily: bodyFont } : null]}
                  value={gearName}
                  onChangeText={setGearName}
                  placeholder="Add equipment"
                  placeholderTextColor="#8A8175"
                />
                <Pressable style={styles.addButton} onPress={addGear}>
                  <Text style={styles.addButtonText}>Add</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        <View style={[styles.paper, { marginTop: 10 * s }]}>
          <Image source={paper} style={styles.fill} resizeMode="stretch" />
          <View style={{ padding: 16 * s }}>
            <Text style={[styles.section, titleFont ? { fontFamily: titleFont } : null]}>Traits</Text>
            <View style={styles.sectionRule} />
            {traits.length === 0 ? (
              <Text style={[styles.line, bodyFont ? { fontFamily: bodyFont } : null]}>No traits yet.</Text>
            ) : null}
            {traits.map((item) => (
              <Pressable key={item.id} onPress={() => (editing ? dropTrait(item.id) : undefined)}>
                <Text style={[styles.line, bodyFont ? { fontFamily: bodyFont } : null]}>
                  {item.name}
                  {editing ? "  \u00d7" : ""}
                </Text>
              </Pressable>
            ))}
            {editing ? (
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.addInput, bodyFont ? { fontFamily: bodyFont } : null]}
                  value={traitName}
                  onChangeText={setTraitName}
                  placeholder="Add a trait"
                  placeholderTextColor="#8A8175"
                />
                <Pressable style={styles.addButton} onPress={addOneTrait}>
                  <Text style={styles.addButtonText}>Add</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        {!partyId ? (
          <Text style={[styles.note, bodyFont ? { fontFamily: bodyFont } : null]}>
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
          <Text style={[styles.note, bodyFont ? { fontFamily: bodyFont } : null]}>
            This sheet is only for {partyName}. A new party gets a new character.
          </Text>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {editing ? (
          <Pressable style={styles.save} onPress={persist} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#FEFCEB" />
            ) : (
              <Text style={[styles.saveText, bodyFont ? { fontFamily: bodyFont } : null]}>Save sheet</Text>
            )}
          </Pressable>
        ) : null}
        {editing && row ? (
          <Pressable style={styles.delete} onPress={removeSheet} disabled={busy}>
            <Text style={[styles.deleteText, bodyFont ? { fontFamily: bodyFont } : null]}>Delete sheet</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#E8D7B8" },
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  chevron: { position: "absolute", width: 18, height: 18, left: 13, top: 12 },
  titleBox: { flex: 1, alignItems: "center" },
  title: { color: "#1A1816", letterSpacing: 0.6 },
  party: { color: "#5A5348", fontSize: 13, marginTop: 2 },
  scroll: { flex: 1 },
  body: { gap: 4, alignItems: "stretch" },
  card: { overflow: "hidden", borderRadius: 4, alignSelf: "stretch" },
  nameRow: { flexDirection: "row", alignItems: "center" },
  name: { flex: 1, color: "#1A1816", textAlign: "center", letterSpacing: 0.4 },
  nameInput: {
    flex: 1,
    color: "#1A1816",
    fontSize: 18,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1816",
    paddingVertical: 4,
  },
  portraitRing: {
    alignSelf: "center",
    marginTop: 12,
    borderWidth: 3,
    borderColor: "#1A1816",
    alignItems: "center",
    justifyContent: "center",
  },
  portraitWrap: { overflow: "hidden", backgroundColor: "#C8B48A" },
  metaRow: { flexDirection: "row", marginTop: 14 },
  meta: { flex: 1, color: "#1A1816", fontSize: 14 },
  metaRight: { textAlign: "right" },
  metaInput: {
    flex: 1,
    color: "#1A1816",
    fontSize: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1816",
    paddingVertical: 2,
  },
  vitalRow: { flexDirection: "row", marginTop: 12, gap: 12 },
  vital: { flex: 1, alignItems: "center" },
  vitalLabel: { color: "#5A5348", fontSize: 12, letterSpacing: 0.6 },
  vitalValue: { color: "#1A1816", fontSize: 18, marginTop: 2 },
  vitalInput: {
    color: "#1A1816",
    fontSize: 18,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1816",
    minWidth: 36,
    paddingVertical: 2,
  },
  hpEdit: { flexDirection: "row", alignItems: "center", gap: 4 },
  hpInput: { minWidth: 42 },
  hpSlash: { color: "#1A1816", fontSize: 18 },
  picker: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 6,
    backgroundColor: "rgba(254,252,235,0.96)",
    overflow: "hidden",
  },
  pickerLabel: {
    color: "#1A1816",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1816",
    backgroundColor: "rgba(189,127,2,0.12)",
  },
  option: { paddingVertical: 9, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "rgba(26,24,22,0.12)" },
  optionOn: { backgroundColor: "rgba(196,69,54,0.12)" },
  optionText: { color: "#1A1816", fontSize: 15 },
  optionTextOn: { color: "#C44536" },
  customInput: {
    margin: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1816",
    color: "#1A1816",
    fontSize: 15,
    paddingVertical: 6,
  },
  rule: { height: 1, backgroundColor: "#1A1816", marginTop: 10, marginBottom: 12 },
  stats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  statHead: { position: "absolute", top: 0, left: 0, width: "100%" },
  statLabel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    color: "#FEFCEB",
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 13,
  },
  statValue: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 6,
    color: "#1A1816",
    textAlign: "center",
  },
  statInput: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    color: "#1A1816",
    textAlign: "center",
    fontSize: 22,
    padding: 0,
  },
  panel: { alignSelf: "stretch", overflow: "hidden", borderRadius: 4, minHeight: 120 },
  paper: { alignSelf: "stretch", overflow: "hidden", borderRadius: 4, minHeight: 96 },
  panelInner: { alignItems: "stretch" },
  section: { color: "#1A1816", fontSize: 18, textAlign: "center", alignSelf: "center" },
  sectionRule: { alignSelf: "center", width: 126, height: 1, backgroundColor: "#1A1816", marginTop: 4, marginBottom: 8 },
  story: { color: "#1A1816", fontSize: 15, lineHeight: 22, textAlign: "left" },
  storyInput: {
    minHeight: 88,
    color: "#1A1816",
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(254,252,235,0.7)",
  },
  chipOn: { backgroundColor: "#1A1816" },
  chipText: { color: "#1A1816", fontSize: 13 },
  chipTextOn: { color: "#FEFCEB" },
  line: { color: "#1A1816", fontSize: 16, lineHeight: 26, textAlign: "center" },
  addRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  addInput: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1816",
    color: "#1A1816",
    fontSize: 16,
    paddingVertical: 6,
  },
  addButton: {
    backgroundColor: "#C44536",
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  addButtonText: { color: "#FEFCEB", fontSize: 14 },
  note: { color: "#5A5348", fontSize: 13, textAlign: "center", marginTop: 10 },
  link: { color: "#A33A3A" },
  error: { color: "#A33A3A", fontSize: 14, marginTop: 8, textAlign: "center" },
  save: {
    marginTop: 12,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#C44536",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#FEFCEB", fontSize: 16 },
  delete: {
    marginTop: 8,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A33A3A",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: "#A33A3A", fontSize: 15 },
});
