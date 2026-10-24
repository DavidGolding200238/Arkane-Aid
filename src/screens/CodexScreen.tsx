import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
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
import CircleButton from "../components/CircleButton";
import Rule from "../components/Rule";
import { ChevronDownIcon, QuillIcon } from "../components/icons";
import { CornerOrnaments, InkButton, InkOutline, InkStroke, RuledLines, INK_RADIUS } from "../components/Ink";
import { colors, fonts, inkText, useAppFonts, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");
// The Ledger sections' light paper (no torn edge: it is clipped off), so each note is its own small sheet.
const notePaper = require("../../assets/images/panels/panel-ledger-cream-fill.jpg");

// One note's sheet: the Ledger panel paper, drawn a little oversize and clipped so its baked border never
// shows, edged in a fine hand-inked line with the Ledger's corner curls. Fills its parent.
function NoteSheet({ seed }: { seed: number }) {
  const { s } = useScale();
  const bleed = s(6);
  const clip = s(1.2);
  return (
    <>
      <View pointerEvents="none" style={[styles.sheetClip, { top: clip, left: clip, right: clip, bottom: clip, borderRadius: s(INK_RADIUS) }]}>
        <View style={{ position: "absolute", top: -bleed, left: -bleed, right: -bleed, bottom: -bleed }}>
          <Image source={notePaper} style={styles.sheetPaper} resizeMode="cover" />
        </View>
      </View>
      <InkOutline seed={seed} radius={s(INK_RADIUS)} />
      <CornerOrnaments size={s(12)} inset={s(4)} />
    </>
  );
}

// Printed section heading, as on the Ledger: red Cinzel with an illuminated first letter and a
// drawn underline as wide as the text.
function SectionTitle({ children, size }: { children: string; size: number }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.section, { fontSize: size, lineHeight: Math.round(size * 1.6) }]}>
        <Text style={[styles.dropCap, { fontSize: Math.round(size * 1.5) }]}>{children.charAt(0)}</Text>
        {children.slice(1)}
      </Text>
      <Rule color={colors.rule} style={styles.sectionRule} />
    </View>
  );
}

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
  const { width } = useWindowDimensions();
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch from Supabase when the party changes
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
  // Text sits on faint ruled writing lines, like the Ledger's story boxes.
  const bodyLine = fs(21);
  const formLine = fs(24);
  // No outer book any more: the heading, tabs and notes sit straight on the page, in the same margins.
  const pagePad = s(19);
  // The Save button spans the page's inner width.
  const saveW = Math.max(s(120), width - pagePad * 2);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <PageHeader title="Codex" subtitle={selected?.party.name ?? "No party"} onBack={onBack} />

      <View style={[styles.book, { marginTop: s(6), marginBottom: s(12) }]}>
        <View style={{ paddingHorizontal: pagePad, paddingTop: s(6), paddingBottom: s(8) }}>
          <View style={styles.sessionRow}>
            <SectionTitle size={fs(18)}>Session notes</SectionTitle>
            <InkButton
              variant={writing ? "parchment" : "red"}
              label={writing ? "Close" : "Add"}
              labelColor={writing ? colors.wordmark : undefined}
              width={s(70)}
              height={s(32)}
              seed={writing ? 42 : 41}
              onPress={() => setWriting((on) => !on)}
            />
          </View>

          <View style={[styles.tabs, { marginTop: s(4) }]}>
            {TABS.map((item, i) => {
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
                  <Text
                    style={[styles.tabLabel, on && styles.tabOn, { fontSize: fs(16), lineHeight: fs(24) }]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {/* The open tab is underlined in red ink, like a marked page. */}
                  <View style={[styles.tabMark, { width: "72%", opacity: on ? 1 : 0 }]}>
                    <InkStroke color={colors.wordmark} seed={8 + i} />
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Rule color={colors.rule} style={{ marginTop: s(1), opacity: 0.55 }} />

          {writing ? (
            <View style={[styles.form, { marginTop: s(10), gap: s(10) }]}>
              <View>
                <TextInput
                  style={[styles.input, { fontSize: fs(16), paddingVertical: s(5) }]}
                  value={title}
                  onChangeText={setTitle}
                  placeholder={tab === "item" ? "Item name" : "Title"}
                  placeholderTextColor={colors.placeholder}
                />
                <InkStroke seed={3} />
              </View>
              <View style={{ minHeight: formLine * 3 }}>
                <RuledLines lineHeight={formLine} />
                <TextInput
                  style={[
                    styles.input,
                    styles.inputBody,
                    { fontSize: fs(15), lineHeight: formLine, minHeight: Math.max(s(56), formLine * 3) },
                  ]}
                  value={body}
                  onChangeText={setBody}
                  placeholder="What happened"
                  placeholderTextColor={colors.placeholder}
                  multiline
                />
              </View>
              <InkButton
                variant="red"
                label={`Save ${tab === "item" ? "item" : "note"}`}
                width={saveW}
                height={s(42)}
                seed={43}
                onPress={save}
                busy={busy}
                disabled={!partyId}
              />
            </View>
          ) : null}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingHorizontal: pagePad, paddingTop: s(10), paddingBottom: s(16), gap: s(12) }}
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

          {shown.map((row, i) => (
            <Pressable
              key={row.id}
              onLongPress={() => drop(row.id)}
              accessibilityHint="Long press to delete"
              style={({ pressed }) => pressed && styles.cardPressed}
            >
              <View style={[styles.card, { minHeight: s(132), padding: s(14), paddingBottom: s(10) }]}>
                {/* Each note is its own light-paper sheet on the page, like the Ledger's Equipment and
                    Traits sections: fine pen frame, corner curls, ruled lines. */}
                <NoteSheet seed={70 + i} />
                <View style={[styles.cardTop, { gap: s(8) }]}>
                  <Text style={[styles.cardTitle, { fontSize: fs(16), lineHeight: fs(21) }]} numberOfLines={2}>
                    {row.title || "Untitled"}
                  </Text>
                  <CircleButton size={badge}>
                    <QuillIcon circleSize={badge} />
                  </CircleButton>
                </View>
                <View style={[styles.cardBodyWrap, { marginTop: s(4), minHeight: bodyLine * 2 }]}>
                  <RuledLines lineHeight={bodyLine} />
                  <Text style={[styles.cardBody, { fontSize: fs(14), lineHeight: bodyLine }]} numberOfLines={3}>
                    {row.body}
                  </Text>
                </View>
                <Text style={[styles.date, { fontSize: fs(16), marginTop: s(6) }]}>{shortDate(row.created_at)}</Text>
              </View>
            </Pressable>
          ))}

          {error ? <Text style={[styles.error, { fontSize: fs(14) }]}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.chevronWrap, { paddingTop: s(4), paddingBottom: s(10) }]} pointerEvents="none">
          <ChevronDownIcon width={s(32)} />
        </View>
      </View>
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
  sheetClip: { position: "absolute", overflow: "hidden" },
  sheetPaper: { width: "100%", height: "100%" },
  sessionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  // Same printed heading as the Ledger's section titles.
  sectionTitle: { alignSelf: "flex-start", flexShrink: 1 },
  section: {
    fontFamily: fonts.title,
    color: colors.wordmark,
    letterSpacing: 0.4,
    ...inkText.red,
  },
  sectionRule: { marginTop: -3 },
  dropCap: { fontFamily: fonts.titleBold, color: colors.wordmark },
  tabs: { flexDirection: "row" },
  tab: { flex: 1, alignItems: "center" },
  tabLabel: { fontFamily: fonts.headingBold, color: colors.ink, letterSpacing: 0.3 },
  tabOn: { color: colors.activeTab },
  tabMark: { marginTop: -2 },
  form: {},
  // Inputs are blank lines to write on: no box, a hand-inked stroke or ruled lines under them.
  input: {
    fontFamily: fonts.heading,
    color: colors.ink,
    paddingVertical: 4,
  },
  inputBody: { textAlignVertical: "top", paddingTop: 0, paddingBottom: 0 },
  scroll: { flex: 1 },
  // Muted italic serif, like the Ledger's footnotes.
  empty: { fontFamily: fonts.heading, fontStyle: "italic", color: colors.muted, textAlign: "center", marginTop: 18 },
  link: { color: colors.wordmark },
  cardPressed: { opacity: 0.85 },
  card: { justifyContent: "space-between" },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  cardTitle: { flex: 1, fontFamily: fonts.headingBold, ...inkText.heading },
  cardBodyWrap: { flexGrow: 1 },
  cardBody: { fontFamily: fonts.heading, color: colors.ink, letterSpacing: 0.2 },
  date: { fontFamily: fonts.headingBold, color: colors.ink, textAlign: "right", letterSpacing: 0.3 },
  error: { fontFamily: fonts.body, color: colors.wordmark, marginTop: 8 },
  chevronWrap: { alignItems: "center" },
});
