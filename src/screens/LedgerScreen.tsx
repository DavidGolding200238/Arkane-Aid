import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  loadCharacter,
  loadEquipment,
  removeEquipment,
  saveCharacter,
  uploadPortrait,
  type Character,
  type CharacterDraft,
  type Equipment,
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

const EMPTY: CharacterDraft = {
  name: "",
  class: "",
  race: "",
  background: "",
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
  traits: "",
};

type Props = { onBack: () => void; onOpen: (screen: AppScreen) => void };

function clampStat(value: string) {
  const n = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(n)) return 1;
  return Math.min(30, Math.max(1, n));
}

function draftFrom(row: Character | null): CharacterDraft {
  if (!row) return EMPTY;
  return {
    name: row.name ?? "",
    class: row.class ?? "",
    race: row.race ?? "",
    background: row.background ?? "",
    str: row.str,
    dex: row.dex,
    con: row.con,
    int: row.int,
    wis: row.wis,
    cha: row.cha,
    traits: row.traits ?? "",
  };
}

export default function LedgerScreen({ onBack, onOpen }: Props) {
  const { width } = useWindowDimensions();
  const s = width / 360;
  const { selected } = useParty();
  const partyId = selected?.party.id ?? null;
  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    AtkinsonHyperlegible_400Regular,
  });
  const [row, setRow] = useState<Character | null>(null);
  const [draft, setDraft] = useState<CharacterDraft>(EMPTY);
  const [gear, setGear] = useState<Equipment[]>([]);
  const [gearName, setGearName] = useState("");
  const [editing, setEditing] = useState(false);
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

  const persist = async () => {
    setBusy(true);
    try {
      const saved = await saveCharacter(partyId, draft, row);
      setRow(saved);
      setDraft(draftFrom(saved));
      setEditing(false);
      setError("");
    } catch (err) {
      const message = errorText(err);
      if (message.startsWith("Sheet saved except traits")) {
        const saved = await loadCharacter(partyId);
        setRow(saved);
        if (saved) setDraft((current) => ({ ...draftFrom(saved), traits: current.traits }));
      }
      setError(message);
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

  const boxW = Math.floor((width - 36 * s - 16 * s) / 3);
  const boxH = boxW * (90 / 91);
  const headH = boxH * (28 / 90);
  const traitLines = draft.traits.split("\n").map((line) => line.trim()).filter(Boolean);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <View style={[styles.header, { paddingTop: 48 * s }]}>
        <Pressable onPress={onBack} hitSlop={10} style={{ width: 44 * s, height: 43 * s }}>
          <Image source={backCircle} style={styles.fill} resizeMode="stretch" />
          <Image source={backChevron} style={styles.chevron} resizeMode="contain" />
        </Pressable>
        <View style={styles.titleBox}>
          <Text style={[styles.title, titleFont ? { fontFamily: titleFont, fontSize: 22 * s } : { fontSize: 22 * s }]}>
            LEDGER
          </Text>
          <Image source={underline} style={{ width: 156 * s, height: 8 * s, marginTop: 2 }} resizeMode="contain" />
        </View>
        <View style={{ width: 44 * s }} />
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
              <Pressable onPress={() => setEditing((on) => !on)} style={{ width: 44 * s, height: 43 * s }}>
                <Image source={editCircle} style={styles.fill} resizeMode="stretch" />
              </Pressable>
            </View>

            <Pressable onPress={pickPortrait} style={[styles.portraitWrap, { width: 146 * s, height: 146 * s, borderRadius: 73 * s }]}>
              {row?.portrait_url ? (
                <Image source={{ uri: row.portrait_url }} style={styles.fill} />
              ) : (
                <Image source={portraitArt} style={styles.fill} resizeMode="cover" />
              )}
            </Pressable>

            <View style={styles.metaRow}>
              {editing ? (
                <TextInput
                  style={[styles.metaInput, bodyFont ? { fontFamily: bodyFont } : null]}
                  value={draft.race}
                  onChangeText={(race) => setDraft((current) => ({ ...current, race }))}
                  placeholder="Race"
                  placeholderTextColor="#8A8175"
                />
              ) : (
                <Text style={[styles.meta, bodyFont ? { fontFamily: bodyFont } : null]}>Race: {draft.race || "—"}</Text>
              )}
              {editing ? (
                <TextInput
                  style={[styles.metaInput, styles.metaRight, bodyFont ? { fontFamily: bodyFont } : null]}
                  value={draft.class}
                  onChangeText={(klass) => setDraft((current) => ({ ...current, class: klass }))}
                  placeholder="Class"
                  placeholderTextColor="#8A8175"
                />
              ) : (
                <Text style={[styles.meta, styles.metaRight, bodyFont ? { fontFamily: bodyFont } : null]}>
                  Class: {draft.class || "—"}
                </Text>
              )}
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
                    <Text style={[styles.statValue, { top: headH, fontSize: 28 * s }, titleFont ? { fontFamily: titleFont } : null]}>
                      {draft[key]}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={[styles.panel, { minHeight: 160 * s, marginTop: 10 * s }]}>
          <Image source={storyPanel} style={styles.fill} resizeMode="stretch" />
          <View style={{ padding: 16 * s }}>
            <Text style={[styles.section, titleFont ? { fontFamily: titleFont } : null]}>Background</Text>
            <View style={styles.sectionRule} />
            {editing ? (
              <TextInput
                style={[styles.storyInput, bodyFont ? { fontFamily: bodyFont } : null]}
                multiline
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

        <View style={styles.block}>
          <Text style={[styles.section, titleFont ? { fontFamily: titleFont } : null]}>Equipment</Text>
          <View style={styles.sectionRule} />
          {gear.length === 0 ? <Text style={[styles.line, bodyFont ? { fontFamily: bodyFont } : null]}>Nothing carried.</Text> : null}
          {gear.map((item) => (
            <Pressable key={item.id} onPress={() => (editing ? dropGear(item.id) : undefined)}>
              <Text style={[styles.line, bodyFont ? { fontFamily: bodyFont } : null]}>
                {item.name}
                {editing ? "  ×" : ""}
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

        <View style={styles.block}>
          <Text style={[styles.section, titleFont ? { fontFamily: titleFont } : null]}>Traits</Text>
          <View style={styles.sectionRule} />
          {editing ? (
            <TextInput
              style={[styles.storyInput, bodyFont ? { fontFamily: bodyFont } : null]}
              multiline
              value={draft.traits}
              onChangeText={(traits) => setDraft((current) => ({ ...current, traits }))}
              placeholder="One trait per line"
              placeholderTextColor="#8A8175"
            />
          ) : traitLines.length === 0 ? (
            <Text style={[styles.line, bodyFont ? { fontFamily: bodyFont } : null]}>No traits yet.</Text>
          ) : (
            traitLines.map((line) => (
              <Text key={line} style={[styles.line, bodyFont ? { fontFamily: bodyFont } : null]}>
                {line}
              </Text>
            ))
          )}
        </View>

        {!partyId ? (
          <Text style={[styles.note, bodyFont ? { fontFamily: bodyFont } : null]}>
            Not in a party yet.{" "}
            <Text style={styles.link} onPress={() => onOpen("create")}>
              Create
            </Text>
            {" · "}
            <Text style={styles.link} onPress={() => onOpen("join")}>
              Join
            </Text>
          </Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {editing ? (
          <Pressable style={styles.save} onPress={persist} disabled={busy}>
            {busy ? <ActivityIndicator color="#FEFCEB" /> : <Text style={[styles.saveText, bodyFont ? { fontFamily: bodyFont } : null]}>Save sheet</Text>}
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
  scroll: { flex: 1 },
  body: { gap: 4 },
  card: { overflow: "hidden", borderRadius: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  portraitWrap: { alignSelf: "center", overflow: "hidden", marginTop: 12, backgroundColor: "#C8B48A" },
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
  panel: { overflow: "hidden", borderRadius: 4 },
  section: { color: "#1A1816", fontSize: 18, textAlign: "center" },
  sectionRule: { alignSelf: "center", width: 126, height: 1, backgroundColor: "#1A1816", marginTop: 4, marginBottom: 8 },
  story: { color: "#1A1816", fontSize: 15, lineHeight: 22 },
  storyInput: {
    minHeight: 88,
    color: "#1A1816",
    fontSize: 15,
    textAlignVertical: "top",
  },
  block: { paddingHorizontal: 16, paddingTop: 16 },
  line: { color: "#1A1816", fontSize: 16, lineHeight: 26 },
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
  note: { color: "#5A5348", fontSize: 14, textAlign: "center", marginTop: 8 },
  link: { color: "#A33A3A" },
  error: { color: "#A33A3A", fontSize: 14, marginTop: 8 },
  save: {
    marginTop: 12,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#C44536",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#FEFCEB", fontSize: 16 },
});
