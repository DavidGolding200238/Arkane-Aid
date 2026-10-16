import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
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
import PageHeader from "../components/PageHeader";
import ParchmentPanel from "../components/ParchmentPanel";
import CircleButton from "../components/CircleButton";
import ThemedButton from "../components/ThemedButton";
import Rule from "../components/Rule";
import { ChevronDownIcon, QuillIcon } from "../components/icons";
import { colors, fonts, useAppFonts, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");

type Tab = "all" | "note" | "item";

const TABS: { id: Tab | "ledger"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "note", label: "Notes" },
  { id: "item", label: "Items" },
  { id: "ledger", label: "Ledger" },
];

type Props = { onBack: () => void; onOpen: (screen: AppScreen) => void };

function shortDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function kindFor(tab: Tab): CodexKind {
  if (tab === "item") return "item";
  return "note";
}

export default function CodexScreen({ onBack, onOpen }: Props) {
  const { s, fs } = useScale();
  const { selected } = useParty();
  const partyId = selected?.party.id ?? null;
  const fontsLoaded = useAppFonts();
  const [tab, setTab] = useState<Tab>("all");
  const [rows, setRows] = useState<CodexEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

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
    const session = rows.filter((row) => row.kind !== "event");
    if (tab === "all") return session;
    return session.filter((row) => row.kind === tab);
  }, [rows, tab]);

  const openTab = (id: Tab | "ledger") => {
    if (id === "ledger") {
      onOpen("ledger");
      return;
    }
    setTab(id);
  };

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

  if (!fontsLoaded) return <View style={styles.root} />;

  const badge = s(38);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <PageHeader title="Codex" subtitle={selected?.party.name ?? "No party"} onBack={onBack} />

      <ParchmentPanel
        style={[styles.book, { marginHorizontal: s(19), marginTop: s(6), marginBottom: s(12) }]}
        contentStyle={styles.bookInner}
      >
        <View style={{ paddingHorizontal: s(12), paddingTop: s(12), paddingBottom: s(8) }}>
          <View style={styles.sessionRow}>
            <Text style={[styles.session, { fontSize: fs(18) }]}>Session notes</Text>
            <ThemedButton
              size="small"
              variant={writing ? "outline" : "primary"}
              label={writing ? "Close" : "Add"}
              onPress={() => setWriting((on) => !on)}
            />
          </View>

          <View style={[styles.tabs, { marginTop: s(10) }]}>
            {TABS.map((item) => {
              const on = item.id === tab;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => openTab(item.id)}
                  style={styles.tab}
                  hitSlop={6}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.tabLabel, on && styles.tabOn, { fontSize: fs(17) }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Rule style={{ marginTop: s(2) }} />

          {writing ? (
            <View style={[styles.form, { marginTop: s(10), gap: s(8) }]}>
              <TextInput
                style={[styles.input, { fontSize: fs(15) }]}
                value={title}
                onChangeText={setTitle}
                placeholder={tab === "item" ? "Item name" : "Title"}
                placeholderTextColor={colors.placeholder}
              />
              <TextInput
                style={[styles.input, styles.inputBody, { fontSize: fs(15), minHeight: s(56) }]}
                value={body}
                onChangeText={setBody}
                placeholder="What happened"
                placeholderTextColor={colors.placeholder}
                multiline
              />
              <ThemedButton
                label={`Save ${tab === "item" ? "item" : "note"}`}
                onPress={save}
                busy={busy}
                disabled={!partyId}
              />
            </View>
          ) : null}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingHorizontal: s(10), paddingTop: s(4), paddingBottom: s(16), gap: s(12) }}
          keyboardShouldPersistTaps="handled"
        >
          {!partyId ? (
            <Text style={[styles.empty, { fontSize: fs(14) }]}>
              Not in a party yet.{" "}
              <Text style={styles.link} onPress={() => onOpen("create")}>
                Create
              </Text>
              {" \u00b7 "}
              <Text style={styles.link} onPress={() => onOpen("join")}>
                Join
              </Text>
            </Text>
          ) : shown.length === 0 && !busy ? (
            <Text style={[styles.empty, { fontSize: fs(14) }]}>Nothing recorded yet.</Text>
          ) : null}

          {shown.map((row) => (
            <Pressable
              key={row.id}
              onLongPress={() => drop(row.id)}
              accessibilityHint="Long press to delete"
              style={({ pressed }) => pressed && styles.cardPressed}
            >
              <ParchmentPanel
                variant="card"
                contentStyle={[styles.card, { minHeight: s(132), padding: s(12), paddingBottom: s(10) }]}
              >
                <View style={[styles.cardTop, { gap: s(8) }]}>
                  <Text style={[styles.cardTitle, { fontSize: fs(15), lineHeight: fs(20) }]} numberOfLines={2}>
                    {row.title || "Untitled"}
                  </Text>
                  <CircleButton size={badge}>
                    <QuillIcon circleSize={badge} />
                  </CircleButton>
                </View>
                <Text
                  style={[styles.cardBody, { fontSize: fs(13), lineHeight: fs(19), marginTop: s(6) }]}
                  numberOfLines={3}
                >
                  {row.body}
                </Text>
                <Text style={[styles.date, { fontSize: fs(18), marginTop: s(8) }]}>{shortDate(row.created_at)}</Text>
              </ParchmentPanel>
            </Pressable>
          ))}

          {error ? <Text style={[styles.error, { fontSize: fs(14) }]}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.chevronWrap, { paddingTop: s(4), paddingBottom: s(8) }]} pointerEvents="none">
          <ChevronDownIcon width={s(32)} />
        </View>
      </ParchmentPanel>
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
  book: { flex: 1 },
  bookInner: { flex: 1 },
  sessionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  session: { fontFamily: fonts.headingBold, color: colors.ink },
  tabs: { flexDirection: "row" },
  tab: { flex: 1, alignItems: "center" },
  tabLabel: { fontFamily: fonts.headingBold, color: colors.ink },
  tabOn: { color: colors.activeTab },
  form: {},
  input: {
    fontFamily: fonts.body,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    color: colors.ink,
    paddingVertical: 4,
  },
  inputBody: { textAlignVertical: "top" },
  scroll: { flex: 1 },
  empty: { fontFamily: fonts.body, color: colors.muted, textAlign: "center", marginTop: 18 },
  link: { color: colors.wordmark },
  cardPressed: { opacity: 0.85 },
  card: { justifyContent: "space-between" },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  cardTitle: { flex: 1, fontFamily: fonts.headingBold, color: colors.ink },
  cardBody: { flexGrow: 1, fontFamily: fonts.body, color: colors.ink, letterSpacing: 1 },
  date: { fontFamily: fonts.headingBold, color: colors.ink, textAlign: "right" },
  error: { fontFamily: fonts.body, color: colors.wordmark, marginTop: 8 },
  chevronWrap: { alignItems: "center" },
});
