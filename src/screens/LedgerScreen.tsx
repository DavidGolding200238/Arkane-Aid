import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
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
import Rule from "../components/Rule";
import { QuillVectorIcon } from "../components/icons";
import {
  CornerOrnaments,
  Flourish,
  HOLDER_FILL,
  INK_COLOR,
  INK_RADIUS,
  InkButton,
  InkCross,
  InkOutline,
  InkRing,
  InkStroke,
  RuledLines,
} from "../components/Ink";
import { colors, fonts, inkText, useAppFonts, useScale } from "../theme";
import { CLASSES, RACES } from "../lib/sheetLists";

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

// Printed section heading: the red Cinzel of the Home/Login wordmark, with the same drawn
// underline snug under the letters and as wide as the text.
function SectionTitle({ children, center, size }: { children: string; center?: boolean; size: number }) {
  return (
    <View style={[styles.sectionTitle, center ? styles.sectionCenter : styles.sectionLeft]}>
      {/* Illuminated first letter, half again as tall, like a drop cap in a printed tome. */}
      <Text style={[styles.section, { fontSize: size, lineHeight: Math.round(size * 1.6) }]}>
        <Text style={[styles.dropCap, { fontSize: Math.round(size * 1.5) }]}>{children.charAt(0)}</Text>
        {children.slice(1)}
      </Text>
      <Rule color={colors.rule} style={styles.sectionRule} />
    </View>
  );
}

// Small red label over a fill-in box (Race, Class, Level, HP...), like the printed captions
// on a paper character sheet.
function FieldLabel({ children, size }: { children: string; size: number }) {
  return (
    <Text style={[styles.fieldLabel, { fontSize: size }]} numberOfLines={1}>
      {children}
    </Text>
  );
}

// Big screens (tablets, foldables) keep a phone-width sheet instead of stretching it.
// 540 = 360 x 1.5, where s() stops growing anyway.
const MAX_SHEET = 540;

const STATS = [
  ["str", "STR"],
  ["dex", "DEX"],
  ["con", "CON"],
  ["int", "INT"],
  ["wis", "WIS"],
  ["cha", "CHA"],
] as const;

type StatKey = (typeof STATS)[number][0];


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
  const { width, height, s, fs } = useScale();
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch from Supabase when the party changes
    load();
  }, [load]);

  const setStat = (key: StatKey, value: string) => {
    setDraft((current) => ({ ...current, [key]: clampStat(value) }));
  };

  const toggleSkill = (skill: string) => {
    setDraft((current) => {
      const on = current.skills.includes(skill);
      return {
        ...current,
        skills: on ? current.skills.filter((item) => item !== skill) : [...current.skills, skill],
      };
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
  const pageW = Math.min(width, MAX_SHEET);
  const pagePad = s(12);
  // Save / Delete span the page.
  const actionW = pageW - pagePad * 2;
  const sheetPad = s(16);
  const statGap = s(14);
  const boxW = Math.floor((pageW - pagePad * 2 - sheetPad * 2 - 2 - statGap * 2) / 3);
  const edit = s(44);
  // Slightly smaller on short phones, so more of the sheet shows above the fold.
  const portrait = Math.round(s(152) * Math.min(1, Math.max(0.85, height / 900)));
  const ring = portrait + s(18);

  const statValue: StyleProp<TextStyle> = [styles.statValue, { fontSize: fs(30) }];

  // Text blocks sit on faint ruled writing lines; these are the line spacings.
  const storyLine = fs(22);
  const listLine = fs(26);
  const storyText: StyleProp<TextStyle> = [styles.story, { fontSize: fs(15), lineHeight: storyLine }];
  const emptyText: StyleProp<TextStyle> = [styles.empty, { fontSize: fs(15) }];

  // Level, HP, AC, Speed and Bonus: a red caption over an inked holder you could write in.
  const vitalLabel: StyleProp<TextStyle> = [styles.fieldLabel, { fontSize: fs(11), marginBottom: s(3) }];
  const vitalValue: StyleProp<TextStyle> = [styles.vitalValue, { fontSize: fs(20) }];
  const vitalInput: StyleProp<TextStyle> = [styles.vitalInput, { fontSize: fs(20) }];
  const holderW = s(66);
  const hpW = holderW;
  const holderH = s(30);
  const flourishW = s(64);
  const holder = (seed: number, w: number, child: ReactNode) => (
    <View style={[styles.holder, { width: w, height: holderH }]}>
      <InkOutline seed={seed} radius={s(INK_RADIUS)} fill={HOLDER_FILL} />
      {/* Its own layer, so the value always paints over the cream fill (web stacks absolute layers above inputs). */}
      <View style={styles.holderBody}>{child}</View>
    </View>
  );

  const renderPicker = (field: "race" | "class", options: string[]) => {
    if (picker !== field) return null;
    const custom = field === "race" ? customRace : customClass;
    const current = draft[field];
    return (
      <View
        style={[
          styles.picker,
          {
            marginTop: s(10),
            paddingTop: s(10),
            paddingBottom: s(8),
            paddingHorizontal: s(8),
          },
        ]}
      >
        <InkOutline fill="rgba(254,252,235,0.96)" radius={s(INK_RADIUS)} seed={field === "race" ? 21 : 23} />
        <SectionTitle center size={fs(15)}>
          {field === "race" ? "Race" : "Class"}
        </SectionTitle>
        {options.map((option) => {
          const on = current === option;
          return (
            <View key={option}>
              <Pressable
                onPress={() => choose(field, option)}
                style={[styles.option, { paddingVertical: s(8), paddingHorizontal: s(10) }, on && styles.optionOn]}
              >
                <Text style={[styles.optionText, on && styles.optionTextOn, { fontSize: fs(15) }]}>{option}</Text>
              </Pressable>
              <Rule color={colors.rule} style={styles.optionRule} />
            </View>
          );
        })}
        <Pressable
          onPress={() => (field === "race" ? setCustomRace(true) : setCustomClass(true))}
          style={[styles.option, { paddingVertical: s(8), paddingHorizontal: s(10) }, custom && styles.optionOn]}
        >
          <Text style={[styles.optionText, custom && styles.optionTextOn, { fontSize: fs(15) }]}>Custom</Text>
        </Pressable>
        {custom ? (
          <View style={{ margin: s(10) }}>
            <TextInput
              style={[styles.lineInput, { fontSize: fs(15), paddingVertical: s(6) }]}
              value={current}
              onChangeText={(value) => setDraft((next) => ({ ...next, [field]: value }))}
              placeholder={field === "race" ? "Custom race" : "Custom class"}
              placeholderTextColor={colors.placeholder}
            />
            <InkStroke seed={field === "race" ? 5 : 6} />
          </View>
        ) : null}
      </View>
    );
  };

  const listItem = (name: string, onRemove: () => void, key: string) => (
    <Pressable key={key} onPress={() => (editing ? onRemove() : undefined)} disabled={!editing} style={styles.listRow}>
      <Text style={[styles.listItem, { fontSize: fs(16), lineHeight: listLine }]}>{name}</Text>
      {editing ? (
        <View style={{ marginLeft: s(8), marginTop: (listLine - fs(11)) / 2 + fs(1) }}>
          <InkCross size={fs(11)} seed={name.length} />
        </View>
      ) : null}
    </Pressable>
  );

  const addRow = (value: string, onChange: (v: string) => void, placeholder: string, onAdd: () => void) => (
    <View style={[styles.addRow, { marginTop: s(8), gap: s(8) }]}>
      <View style={styles.addField}>
        <TextInput
          style={[styles.lineInput, styles.serifInput, { fontSize: fs(16), paddingVertical: s(6) }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
        />
        <InkStroke seed={placeholder.length} />
      </View>
      <InkButton label="Add" variant="red" width={s(64)} height={s(34)} seed={placeholder.length + 40} onPress={onAdd} />
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
      <CornerOrnaments size={s(16)} inset={s(5)} />
      <SectionTitle size={fs(18)}>{title}</SectionTitle>
      <View style={{ minHeight: storyLine * 2 }}>
        <RuledLines lineHeight={storyLine} />
        {editing ? (
          <TextInput
            style={[styles.storyInput, { fontSize: fs(15), lineHeight: storyLine, minHeight: s(72) }]}
            multiline
            scrollEnabled={false}
            value={value}
            onChangeText={(next) => setDraft((current) => ({ ...current, [field]: next }))}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholder}
          />
        ) : (
          <Text style={value ? storyText : [storyText, emptyText]}>{value || empty}</Text>
        )}
      </View>
    </ParchmentPanel>
  );

  return (
    // Lifts the sheet above the keyboard while typing, the same way the Sage screen does.
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <PageHeader title="Ledger" subtitle={partyName} onBack={onBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.page,
          {
            paddingHorizontal: pagePad,
            paddingTop: s(4),
            paddingBottom: s(24),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ParchmentPanel
          variant="ledger"
          contentStyle={{
            paddingHorizontal: sheetPad,
            paddingTop: s(12),
            paddingBottom: s(14),
          }}
        >
          <View style={styles.nameRow}>
            <View style={{ width: edit }} />
            {editing ? (
              <View style={[styles.nameEdit, { marginHorizontal: s(6) }]}>
                {/* Wraps onto a second line like the read-only name instead of running under the quill. */}
                <TextInput
                  style={[
                    styles.nameInput,
                    {
                      fontSize: fs(18),
                      lineHeight: fs(24),
                      paddingVertical: s(2),
                    },
                  ]}
                  multiline
                  scrollEnabled={false}
                  submitBehavior="blurAndSubmit"
                  value={draft.name}
                  onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
                  placeholder="Name"
                  placeholderTextColor={colors.placeholder}
                />
                <Rule color={colors.rule} />
              </View>
            ) : (
              <View style={[styles.nameEdit, { marginHorizontal: s(6) }]}>
                <Text style={[styles.name, { fontSize: fs(18) }]} numberOfLines={2}>
                  {draft.name || "Unnamed"}
                </Text>
                <Rule width={s(150)} color={colors.ink} style={{ marginTop: s(3) }} />
              </View>
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
              {/* Editing: the red button reads as pressed in, with a dark inked ring inside its rim. */}
              {editing ? (
                <View style={[styles.editPressed, { width: edit, height: edit, borderRadius: edit / 2 }]}>
                  <InkRing size={edit} color={colors.ink} strokeWidth={s(1.2)} seed={13} dots={false} />
                </View>
              ) : null}
              <QuillVectorIcon circleSize={edit} />
            </CircleButton>
          </View>

          <View style={[styles.portraitBox, { width: ring, height: ring, marginTop: s(6) }]}>
            {/* Second, finer ring with four studs: a framed portrait even before a picture is added. */}
            <View style={styles.portraitRing} pointerEvents="none">
              <InkRing size={ring} seed={9} />
            </View>
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
            <View
              style={[
                styles.portraitInk,
                {
                  width: portrait,
                  height: portrait,
                  top: (ring - portrait) / 2,
                  left: (ring - portrait) / 2,
                },
              ]}
              pointerEvents="none"
            >
              <Image source={portraitInk} style={styles.fill} resizeMode="stretch" />
            </View>
          </View>

          {/* Race and Class: labelled fill-in boxes, as on a printed sheet. Editing opens the same pickers. */}
          <View style={[styles.metaRow, { marginTop: s(14), gap: s(12) }]}>
            {(["race", "class"] as const).map((field) => {
              const value = draft[field];
              const boxStyle = [
                styles.metaBox,
                {
                  paddingHorizontal: s(10),
                  paddingTop: s(6),
                  paddingBottom: s(8),
                },
              ];
              const inner = (
                <>
                  <InkOutline seed={field === "race" ? 3 : 7} radius={s(INK_RADIUS)} />
                  <FieldLabel size={fs(11)}>{field === "race" ? "Race" : "Class"}</FieldLabel>
                  <Text
                    style={[styles.meta, { fontSize: fs(15), marginTop: s(2) }, !value && styles.metaEmpty]}
                    numberOfLines={1}
                  >
                    {value || (editing ? (field === "race" ? "Choose race" : "Choose class") : "\u2014")}
                  </Text>
                </>
              );
              return editing ? (
                <Pressable key={field} style={boxStyle} onPress={() => setPicker(picker === field ? null : field)}>
                  {inner}
                </Pressable>
              ) : (
                <View key={field} style={boxStyle}>
                  {inner}
                </View>
              );
            })}
          </View>
          {renderPicker("race", RACES)}
          {renderPicker("class", CLASSES)}

          {/* Same grid as before: Level over AC, HP over Bonus, the middle of the first row empty. */}
          <View style={[styles.vitalRow, { marginTop: s(12) }]}>
            <View style={[styles.vital, { paddingHorizontal: s(4) }]}>
              <Text style={vitalLabel} numberOfLines={1}>
                Level
              </Text>
              {holder(
                41,
                holderW,
                editing ? (
                  <TextInput
                    style={vitalInput}
                    keyboardType="number-pad"
                    value={String(draft.level)}
                    onChangeText={(value) =>
                      setDraft((current) => ({
                        ...current,
                        level: clampLevel(value),
                      }))
                    }
                  />
                ) : (
                  <Text style={vitalValue}>{draft.level}</Text>
                ),
              )}
            </View>
            {/* The empty middle cell carries a small printer's flourish, so the gap reads as intended. */}
            <View style={[styles.vital, styles.vitalMid, { paddingBottom: (holderH - flourishW * 0.3) / 2 }]}>
              <Flourish width={flourishW} color={colors.cardStroke} />
            </View>
            <View style={styles.vital}>
              <Text style={vitalLabel} numberOfLines={1}>
                HP
              </Text>
              {holder(
                43,
                hpW,
                editing ? (
                  <View style={styles.hpEdit}>
                    <TextInput
                      style={[vitalInput, { fontSize: fs(17) }]}
                      keyboardType="number-pad"
                      value={String(draft.hp_current)}
                      onChangeText={(value) =>
                        setDraft((current) => ({
                          ...current,
                          hp_current: clampHp(value, 0),
                        }))
                      }
                    />
                    <Text style={[styles.hpSlash, { fontSize: fs(17) }]}>/</Text>
                    <TextInput
                      style={[vitalInput, { fontSize: fs(17) }]}
                      keyboardType="number-pad"
                      value={String(draft.hp_max)}
                      onChangeText={(value) =>
                        setDraft((current) => ({
                          ...current,
                          hp_max: clampHp(value, 1),
                        }))
                      }
                    />
                  </View>
                ) : (
                  <Text style={vitalValue}>
                    {draft.hp_current}/{draft.hp_max}
                  </Text>
                ),
              )}
            </View>
          </View>

          <View style={[styles.vitalRow, { marginTop: s(8) }]}>
            <View style={[styles.vital, { paddingHorizontal: s(4) }]}>
              <Text style={vitalLabel} numberOfLines={1}>
                AC
              </Text>
              {holder(
                45,
                holderW,
                editing ? (
                  <TextInput
                    style={vitalInput}
                    keyboardType="number-pad"
                    value={String(draft.ac)}
                    onChangeText={(value) =>
                      setDraft((current) => ({
                        ...current,
                        ac: clampRange(value, 0, 30, 10),
                      }))
                    }
                  />
                ) : (
                  <Text style={vitalValue}>{draft.ac}</Text>
                ),
              )}
            </View>
            <View style={[styles.vital, { paddingHorizontal: s(4) }]}>
              <Text style={vitalLabel} numberOfLines={1}>
                Speed
              </Text>
              {holder(
                47,
                holderW,
                editing ? (
                  <TextInput
                    style={vitalInput}
                    keyboardType="number-pad"
                    value={String(draft.speed)}
                    onChangeText={(value) =>
                      setDraft((current) => ({
                        ...current,
                        speed: clampRange(value, 0, 120, 30),
                      }))
                    }
                  />
                ) : (
                  <Text style={vitalValue}>{draft.speed}</Text>
                ),
              )}
            </View>
            <View style={[styles.vital, { paddingHorizontal: s(4) }]}>
              <Text style={vitalLabel} numberOfLines={1}>
                Bonus
              </Text>
              {holder(49, holderW, <Text style={vitalValue}>+{proficiencyBonus(draft.level)}</Text>)}
            </View>
          </View>

          <Rule color={colors.ink} thickness={1.4} style={{ marginTop: s(12), marginBottom: s(12) }} />

          <View style={[styles.stats, { columnGap: statGap, rowGap: s(14) }]}>
            {STATS.map(([key, label]) => (
              <StatFrame key={key} label={label} width={boxW} labelSize={fs(15)}>
                {editing ? (
                  <View style={styles.statEdit}>
                    <TextInput
                      style={[styles.statInput, { fontSize: fs(26), width: boxW * 0.6 }]}
                      keyboardType="number-pad"
                      value={String(draft[key])}
                      onChangeText={(value) => setStat(key, value)}
                    />
                    <Rule width={boxW * 0.46} color={colors.rule} />
                  </View>
                ) : (
                  <Text style={statValue}>{draft[key]}</Text>
                )}
              </StatFrame>
            ))}
          </View>
        </ParchmentPanel>

        <ParchmentPanel variant="ledger" style={{ marginTop: s(10) }} contentStyle={{ padding: s(18), minHeight: s(120) }}>
          <CornerOrnaments size={s(16)} inset={s(5)} />
          <SectionTitle center size={fs(18)}>
            Background
          </SectionTitle>
          <View style={{ minHeight: storyLine * 3 }}>
            <RuledLines lineHeight={storyLine} />
            {editing ? (
              <TextInput
                style={[styles.storyInput, { fontSize: fs(15), lineHeight: storyLine, minHeight: s(88) }]}
                multiline
                scrollEnabled={false}
                value={draft.background}
                onChangeText={(background) => setDraft((current) => ({ ...current, background }))}
                placeholder="Background story"
                placeholderTextColor={colors.placeholder}
              />
            ) : (
              <Text style={draft.background ? storyText : [storyText, emptyText]}>{draft.background || "No story yet."}</Text>
            )}
          </View>
        </ParchmentPanel>

        <ParchmentPanel variant="ledger" style={{ marginTop: s(10) }} contentStyle={{ padding: s(16) }}>
          <CornerOrnaments size={s(16)} inset={s(5)} />
          <SectionTitle size={fs(18)}>Skills</SectionTitle>
          {editing ? (
            <View style={[styles.chips, { gap: s(6) }]}>
              {SKILLS.map((skill, i) => {
                const on = draft.skills.includes(skill);
                return (
                  <Pressable
                    key={skill}
                    onPress={() => toggleSkill(skill)}
                    style={[styles.chip, { paddingHorizontal: s(10), paddingVertical: s(5) }]}
                  >
                    <InkOutline
                      seed={60 + i}
                      radius={s(INK_RADIUS)}
                      color={on ? colors.wordmark : INK_COLOR}
                      fill={on ? colors.primary : "rgba(254,252,235,0.7)"}
                    />
                    <Text style={[styles.chipText, on && styles.chipTextOn, { fontSize: fs(13) }]}>{skill}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={{ minHeight: storyLine * 2 }}>
              <RuledLines lineHeight={storyLine} />
              <Text style={draft.skills.length === 0 ? [storyText, emptyText] : storyText}>
                {draft.skills.length === 0 ? "None marked." : draft.skills.join(", ")}
              </Text>
            </View>
          )}
        </ParchmentPanel>

        {textSection("Languages", draft.languages, "languages", "Common, Elvish", "None listed.")}
        {textSection("Features", draft.features, "features", "Class features, fighting style, spells", "None yet.")}

        <ParchmentPanel variant="ledger" style={{ marginTop: s(10) }} contentStyle={{ padding: s(16) }}>
          <CornerOrnaments size={s(16)} inset={s(5)} />
          <SectionTitle size={fs(18)}>Equipment</SectionTitle>
          <View style={{ minHeight: listLine * 2 }}>
            <RuledLines lineHeight={listLine} />
            {gear.length === 0 ? <Text style={[emptyText, { lineHeight: listLine }]}>Nothing carried.</Text> : null}
            {gear.map((item) => listItem(item.name, () => dropGear(item.id), item.id))}
          </View>
          {editing ? addRow(gearName, setGearName, "Add equipment", addGear) : null}
        </ParchmentPanel>

        <ParchmentPanel variant="ledger" style={{ marginTop: s(10) }} contentStyle={{ padding: s(16) }}>
          <CornerOrnaments size={s(16)} inset={s(5)} />
          <SectionTitle size={fs(18)}>Traits</SectionTitle>
          <View style={{ minHeight: listLine * 2 }}>
            <RuledLines lineHeight={listLine} />
            {traits.length === 0 ? <Text style={[emptyText, { lineHeight: listLine }]}>No traits yet.</Text> : null}
            {traits.map((item) => listItem(item.name, () => dropTrait(item.id), item.id))}
          </View>
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
            <InkButton label="Save sheet" variant="red" width={actionW} height={s(44)} seed={33} onPress={persist} busy={busy} />
            {row ? (
              <InkButton
                label="Delete sheet"
                variant="parchment"
                labelColor={colors.wordmark}
                seed={35}
                width={actionW}
                height={s(44)}
                onPress={removeSheet}
                disabled={busy}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
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
  fill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  scroll: { flex: 1 },
  page: { width: "100%", maxWidth: MAX_SHEET, alignSelf: "center" },
  nameRow: { flexDirection: "row", alignItems: "center" },
  name: {
    fontFamily: fonts.titleBold,
    textAlign: "center",
    letterSpacing: 0.4,
    ...inkText.heading,
  },
  nameEdit: { flex: 1, minWidth: 0 },
  nameInput: {
    width: "100%",
    fontFamily: fonts.titleBold,
    color: colors.ink,
    textAlign: "center",
  },
  editOn: { transform: [{ scale: 0.95 }] },
  editPressed: { position: "absolute", top: 0, left: 0, backgroundColor: "rgba(26,24,22,0.16)" },
  portraitBox: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  portraitInk: { position: "absolute" },
  portraitRing: { position: "absolute", top: 0, left: 0 },
  portraitWrap: { overflow: "hidden", backgroundColor: colors.portrait },
  metaRow: { flexDirection: "row" },
  metaBox: { flex: 1, minWidth: 0 },
  meta: { fontFamily: fonts.heading, color: colors.ink },
  metaEmpty: { fontFamily: fonts.body, color: colors.muted },
  // Red printed caption: the Cinzel of the wordmark (its lower case draws as small capitals).
  fieldLabel: {
    fontFamily: fonts.title,
    color: colors.wordmark,
    letterSpacing: 0.6,
    ...inkText.red,
  },
  // Level, HP, AC, Speed and Bonus keep the 125ce45 structure: two rows on one three-column
  // grid, label over value, Level centred over AC and HP over Bonus. Each value now sits in a
  // hand-inked holder (outline only, no paper behind it).
  vitalRow: { flexDirection: "row", alignItems: "flex-start" },
  vital: { flex: 1, alignItems: "center" },
  vitalMid: { alignSelf: "stretch", justifyContent: "flex-end" },
  holder: { alignItems: "center", justifyContent: "center" },
  holderBody: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  vitalValue: {
    fontFamily: fonts.stat,
    color: colors.ink,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  vitalInput: {
    flex: 1,
    alignSelf: "stretch",
    minWidth: 0,
    fontFamily: fonts.stat,
    color: colors.ink,
    textAlign: "center",
    padding: 0,
  },
  hpEdit: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    flex: 1,
    paddingHorizontal: 4,
  },
  hpSlash: { fontFamily: fonts.stat, color: colors.ink },
  stats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  statHead: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    fontFamily: fonts.heading,
    color: colors.statLabel,
    textAlign: "center",
    letterSpacing: 0.6,
  },
  statValueBox: {
    flex: 1,
    marginTop: "31%",
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontFamily: fonts.stat,
    color: colors.ink,
    textAlign: "center",
    includeFontPadding: false,
  },
  statEdit: { alignItems: "center" },
  statInput: {
    fontFamily: fonts.stat,
    color: colors.ink,
    textAlign: "center",
    padding: 0,
  },
  picker: {},
  option: { borderRadius: 4 },
  optionOn: { backgroundColor: "rgba(196,69,54,0.12)" },
  optionRule: { opacity: 0.25 },
  optionText: { fontFamily: fonts.heading, color: colors.ink },
  optionTextOn: { color: colors.primary },
  // Inputs drawn as a blank line: no box border, a hand-inked Rule sits under each one.
  lineInput: { width: "100%", fontFamily: fonts.body, color: colors.ink },
  sectionTitle: { marginBottom: 8 },
  sectionCenter: { alignSelf: "center" },
  sectionLeft: { alignSelf: "flex-start" },
  section: {
    fontFamily: fonts.title,
    color: colors.wordmark,
    letterSpacing: 0.4,
    ...inkText.red,
  },
  sectionRule: { marginTop: -3 },
  dropCap: { fontFamily: fonts.titleBold, color: colors.wordmark },
  story: { fontFamily: fonts.body, color: colors.ink, textAlign: "left" },
  storyInput: {
    fontFamily: fonts.body,
    color: colors.ink,
    textAlignVertical: "top",
    paddingTop: 0,
    paddingBottom: 0,
  },
  // One quiet style for every empty section ("No story yet.", "None marked.", "Nothing carried."...).
  empty: { fontFamily: fonts.body, color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: {},
  chipText: { fontFamily: fonts.heading, color: colors.ink },
  chipTextOn: { color: colors.cream },
  listItem: { fontFamily: fonts.heading, color: colors.ink, textAlign: "left", flexShrink: 1 },
  listRow: { flexDirection: "row", alignItems: "flex-start" },
  serifInput: { fontFamily: fonts.heading },
  addRow: { flexDirection: "row", alignItems: "center" },
  addField: { flex: 1, minWidth: 0 },
  // Muted italic serif, like a scribe's note at the foot of the page.
  note: { fontFamily: fonts.heading, fontStyle: "italic", color: colors.muted, textAlign: "center" },
  link: { color: colors.wordmark },
  error: {
    fontFamily: fonts.body,
    color: colors.wordmark,
    marginTop: 8,
    textAlign: "center",
  },
  actions: { alignSelf: "stretch" },
});
