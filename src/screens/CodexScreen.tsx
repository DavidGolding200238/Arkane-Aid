import { useCallback, useEffect, useMemo, useState } from "react";
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
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import { AtkinsonHyperlegible_400Regular } from "@expo-google-fonts/atkinson-hyperlegible";
import { useParty } from "../context/PartyContext";
import {
  addCodexEntry,
  loadCodex,
  removeCodexEntry,
  type CodexEntry,
  type CodexKind,
} from "../lib/codex";
import { errorText } from "../lib/parties";
import type { AppScreen } from "../navigation/screens";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");
const underline = require("../../assets/Splash Screen/Rectangle 4901.png");
const backCircle = require("../../assets/Codex/Rectangle 26.png");
const backChevron = require("../../assets/Codex/Polygon 21.png");
const book = require("../../assets/Codex/Rectangle 28.png");
const cardArt = require("../../assets/Codex/Rectangle 28 (1).png");
const scrollMark = require("../../assets/Codex/Polygon 22.png");

type Tab = "all" | CodexKind;

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "note", label: "Notes" },
  { id: "item", label: "Items" },
  { id: "event", label: "Ledger" },
];

type Props = { onBack: () => void; onOpen: (screen: AppScreen) => void };

function shortDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function kindFor(tab: Tab): CodexKind {
  if (tab === "all") return "note";
  return tab;
}

export default function CodexScreen({ onBack, onOpen }: Props) {
  const { width } = useWindowDimensions();
  const s = width / 360;
  const { selected } = useParty();
  const partyId = selected?.party.id ?? null;
  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    AtkinsonHyperlegible_400Regular,
  });
  const [tab, setTab] = useState<Tab>("all");
  const [rows, setRows] = useState<CodexEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const titleFont = fontsLoaded ? "CinzelDecorative_400Regular" : undefined;
  const bodyFont = fontsLoaded ? "AtkinsonHyperlegible_400Regular" : undefined;

  const load = useCallback(async () => {
    if (!partyId) {
      setRows([]);
      return;
    }
    setBusy(true);
    try {
      setRows(await loadCodex(partyId));
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

  const shown = useMemo(() => {
    if (tab === "all") return rows;
    return rows.filter((row) => row.kind === tab);
  }, [rows, tab]);

  const save = async () => {
    if (!partyId) return;
    setBusy(true);
    try {
      await addCodexEntry(partyId, kindFor(tab), title, body);
      setTitle("");
      setBody("");
      setWriting(false);
      setRows(await loadCodex(partyId));
      setError("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const drop = async (id: string) => {
    if (!partyId) return;
    setBusy(true);
    try {
      await removeCodexEntry(id);
      setRows(await loadCodex(partyId));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

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
            CODEX
          </Text>
          <Image source={underline} style={{ width: 156 * s, height: 8 * s, marginTop: 2 }} resizeMode="contain" />
        </View>
        <View style={{ width: 44 * s }} />
      </View>

      <View style={[styles.book, { marginHorizontal: 12 * s, marginTop: 6 * s }]}>
        <Image source={book} style={styles.fill} resizeMode="stretch" />
        <View style={{ paddingHorizontal: 14 * s, paddingTop: 14 * s, paddingBottom: 8 * s }}>
          <View style={styles.sessionRow}>
            <Text style={[styles.session, bodyFont ? { fontFamily: bodyFont, fontSize: 16 * s } : { fontSize: 16 * s }]}>
              Session notes
            </Text>
            <Pressable onPress={() => setWriting((on) => !on)} hitSlop={8}>
              <Text style={[styles.add, bodyFont ? { fontFamily: bodyFont } : null]}>{writing ? "Close" : "Add"}</Text>
            </Pressable>
          </View>

          <View style={styles.tabs}>
            {TABS.map((item) => {
              const on = item.id === tab;
              return (
                <Pressable key={item.id} onPress={() => setTab(item.id)} style={styles.tab}>
                  <Text
                    style={[
                      styles.tabLabel,
                      on && styles.tabOn,
                      bodyFont ? { fontFamily: bodyFont, fontSize: 14 * s } : { fontSize: 14 * s },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {on ? <View style={styles.tabRule} /> : <View style={styles.tabRuleOff} />}
                </Pressable>
              );
            })}
          </View>

          {writing ? (
            <View style={styles.form}>
              <TextInput
                style={[styles.input, bodyFont ? { fontFamily: bodyFont } : null]}
                value={title}
                onChangeText={setTitle}
                placeholder={tab === "item" ? "Item name" : tab === "event" ? "Event title" : "Title"}
                placeholderTextColor="#8A8175"
              />
              <TextInput
                style={[styles.input, styles.inputBody, bodyFont ? { fontFamily: bodyFont } : null]}
                value={body}
                onChangeText={setBody}
                placeholder="What happened"
                placeholderTextColor="#8A8175"
                multiline
              />
              <Pressable style={styles.save} onPress={save} disabled={busy || !partyId}>
                {busy ? (
                  <ActivityIndicator color="#FEFCEB" />
                ) : (
                  <Text style={[styles.saveText, bodyFont ? { fontFamily: bodyFont } : null]}>
                    Save {tab === "all" ? "note" : tab}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingHorizontal: 10 * s, paddingBottom: 18 * s, gap: 10 * s }}
          keyboardShouldPersistTaps="handled"
        >
          {!partyId ? (
            <Text style={[styles.empty, bodyFont ? { fontFamily: bodyFont } : null]}>
              Not in a party yet.{" "}
              <Text style={styles.link} onPress={() => onOpen("create")}>
                Create
              </Text>
              {" · "}
              <Text style={styles.link} onPress={() => onOpen("join")}>
                Join
              </Text>
            </Text>
          ) : shown.length === 0 && !busy ? (
            <Text style={[styles.empty, bodyFont ? { fontFamily: bodyFont } : null]}>
              Nothing recorded yet.
            </Text>
          ) : null}

          {shown.map((row) => (
            <Pressable
              key={row.id}
              onLongPress={() => drop(row.id)}
              style={{ minHeight: 120 * s }}
            >
              <Image source={cardArt} style={styles.fill} resizeMode="stretch" />
              <View style={{ paddingHorizontal: 12 * s, paddingTop: 10 * s, paddingBottom: 12 * s }}>
                <View style={styles.cardTop}>
                  <Text
                    style={[
                      styles.cardTitle,
                      bodyFont ? { fontFamily: bodyFont, fontSize: 15 * s } : { fontSize: 15 * s },
                    ]}
                    numberOfLines={2}
                  >
                    {row.title || "Untitled"}
                  </Text>
                  <View style={{ width: 36 * s, height: 36 * s }}>
                    <Image source={backCircle} style={styles.fill} resizeMode="stretch" />
                  </View>
                </View>
                <Text
                  style={[styles.cardBody, bodyFont ? { fontFamily: bodyFont, fontSize: 13 * s } : { fontSize: 13 * s }]}
                  numberOfLines={3}
                >
                  {row.body}
                </Text>
                <Text style={[styles.date, bodyFont ? { fontFamily: bodyFont, fontSize: 12 * s } : { fontSize: 12 * s }]}>
                  {shortDate(row.created_at)}
                </Text>
              </View>
            </Pressable>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.chevronWrap}>
          <Image source={scrollMark} style={{ width: 28 * s, height: 22 * s }} resizeMode="contain" />
        </View>
      </View>
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
  book: { flex: 1, marginBottom: 72, overflow: "hidden", borderRadius: 4 },
  sessionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  session: { color: "#1A1816" },
  add: { color: "#A33A3A", fontSize: 14 },
  tabs: { flexDirection: "row", marginTop: 10, gap: 6 },
  tab: { flex: 1, alignItems: "center" },
  tabLabel: { color: "#1A1816" },
  tabOn: { fontWeight: "700" },
  tabRule: { marginTop: 3, height: 1, width: "70%", backgroundColor: "#1A1816" },
  tabRuleOff: { marginTop: 3, height: 1, width: "70%" },
  form: { marginTop: 10, gap: 6 },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: "#1A1816",
    color: "#1A1816",
    fontSize: 15,
    paddingVertical: 4,
  },
  inputBody: { minHeight: 56, textAlignVertical: "top" },
  save: {
    height: 36,
    borderRadius: 8,
    backgroundColor: "#C44536",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#FEFCEB", fontSize: 14 },
  scroll: { flex: 1 },
  empty: { color: "#5A5348", fontSize: 14, textAlign: "center", marginTop: 18 },
  link: { color: "#A33A3A" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cardTitle: { flex: 1, color: "#1A1816", lineHeight: 20 },
  cardBody: { color: "#1A1816", lineHeight: 18, marginTop: 6 },
  date: { color: "#1A1816", textAlign: "right", marginTop: 8 },
  error: { color: "#A33A3A", fontSize: 14, marginTop: 8 },
  chevronWrap: { alignItems: "center", paddingBottom: 8 },
});
