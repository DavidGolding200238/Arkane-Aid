import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../context/AuthContext";
import { useParty } from "../context/PartyContext";
import {
  addCodexEntry,
  loadCodex,
  removeCodexEntry,
  updateCodexEntry,
  type CodexEntry,
  type CodexKind,
} from "../lib/codex";
import type { Character } from "../lib/character";
import { errorText } from "../lib/parties";
import type { AppScreen } from "../navigation/screens";
import PageHeader from "../components/PageHeader";
import { ScrollFades, useFadeSizes } from "../components/PageFade";
import CircleButton from "../components/CircleButton";
import NoteSheet from "../components/NoteSheet";
import { SpellList, WeaponList } from "../components/CodexArsenal";
import { ArchiveList } from "../components/CodexArchive";
import Rule from "../components/Rule";
import FadeRow from "../components/FadeRow";
import { ChevronDownIcon, QuillIcon } from "../components/icons";
import { InkButton, InkStroke, RuledLines } from "../components/Ink";
import { colors, fonts, inkText, useAppFonts, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");
// Printed section heading, as on the Character Sheet: red Cinzel with an illuminated first letter and a
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

type Tab = "all" | "note" | "item" | "weapon" | "spell" | "archive";

// "Sheet" opens the Character Sheet (the "ledger" screen). "Archive" lists all your sheets.
const TABS: { id: Tab | "ledger"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "note", label: "Notes" },
  { id: "item", label: "Items" },
  { id: "weapon", label: "Weapons" },
  { id: "spell", label: "Spells" },
  { id: "ledger", label: "Sheet" },
  { id: "archive", label: "Archive" },
];

const HEADINGS: Partial<Record<Tab, string>> = { weapon: "Weapons", spell: "Spells", archive: "Archive" };

type Props = {
  onBack: () => void;
  onOpen: (screen: AppScreen) => void;
  /** Opens a retired sheet from the Archive tab, read-only. */
  onViewRetired: (character: Character) => void;
  /** The tab to open on: the Archive when coming back from a retired sheet. */
  initialTab?: "archive";
};

function shortDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function kindFor(tab: Tab): CodexKind {
  if (tab === "item") return "item";
  return "note";
}

export default function CodexScreen({ onBack, onOpen, onViewRetired, initialTab }: Props) {
  const { s, fs } = useScale();
  const { width } = useWindowDimensions();
  const { selected } = useParty();
  const { user } = useAuth();
  const partyId = selected?.party.id ?? null;
  const fontsLoaded = useAppFonts();
  const [tab, setTab] = useState<Tab>(initialTab ?? "all");
  const [rows, setRows] = useState<CodexEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // The note being edited (null: the form adds a new one).
  const [editingId, setEditingId] = useState<string | null>(null);
  // Layout for the Sage page's soft fades: the page size, and the notes list's place on it
  // (the book's top plus the list's top inside the book).
  const fade = useFadeSizes();
  const [screen, setScreen] = useState({ w: 0, h: 0 });
  const [bookY, setBookY] = useState(0);
  const [list, setList] = useState({ y: 0, h: 0 });

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
    // Weapons and Spells have their own forms, so an open note form closes when moving to or from them.
    if (HEADINGS[id] || HEADINGS[tab]) closeForm();
    setTab(id);
  };

  const closeForm = () => {
    setWriting(false);
    setEditingId(null);
    setTitle("");
    setBody("");
  };

  // Tap your own note to edit it in the form above the list.
  const edit = (row: CodexEntry) => {
    setEditingId(row.id);
    setTitle(row.title ?? "");
    setBody(row.body);
    setWriting(true);
  };

  const save = async () => {
    if (!partyId) return;
    setBusy(true);
    try {
      if (editingId) await updateCodexEntry(editingId, title, body);
      else await addCodexEntry(partyId, kindFor(tab), title, body);
      closeForm();
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
    // Keyed so it mounts fresh after the font-loading placeholder: a reused view never reports
    // its layout again, and the fades need the page size.
    // Padding for the keyboard keeps a weapon or spell being edited low in the list in view.
    <KeyboardAvoidingView key="page" behavior="padding" style={styles.root} onLayout={(e) => setScreen({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <PageHeader title="Codex" subtitle={selected?.party.name ?? "No party"} onBack={onBack} />

      <View
        style={[styles.book, { marginTop: s(6), marginBottom: s(12) }]}
        onLayout={(e) => setBookY(e.nativeEvent.layout.y)}
      >
        <View style={{ paddingHorizontal: pagePad, paddingTop: s(6), paddingBottom: s(8) }}>
          <View style={[styles.sessionRow, { minHeight: s(32) }]}>
            <SectionTitle size={fs(18)}>{HEADINGS[tab] ?? "Session notes"}</SectionTitle>
            {tab === "archive" ? null : (
              <InkButton
                variant={writing ? "parchment" : "red"}
                label={writing ? "Close" : "Add"}
                labelColor={writing ? colors.wordmark : undefined}
                width={s(70)}
                height={s(32)}
                seed={writing ? 42 : 41}
                onPress={() => (writing ? closeForm() : setWriting(true))}
                disabled={!partyId}
              />
            )}
          </View>

          {/* The tabs scroll sideways, at their own widths with even gaps, reaching to the screen
              edges, with a paper fade on the side that has more. */}
          <FadeRow
            gap={s(18)}
            bleed={pagePad}
            active={Math.max(0, TABS.findIndex((item) => item.id === tab))}
            style={{ marginTop: s(4) }}
          >
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
                  <Text style={[styles.tabLabel, on && styles.tabOn, { fontSize: fs(15), lineHeight: fs(24) }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {/* The open tab is underlined in red ink, like a marked page. */}
                  <View style={[styles.tabMark, { width: "72%", opacity: on ? 1 : 0 }]}>
                    <InkStroke color={colors.wordmark} seed={8 + i} />
                  </View>
                </Pressable>
              );
            })}
          </FadeRow>
          <Rule color={colors.rule} style={{ marginTop: s(1), opacity: 0.55 }} />

          {writing && !HEADINGS[tab] ? (
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
                label={editingId ? "Save changes" : `Save ${tab === "item" ? "item" : "note"}`}
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
          // Room for the first and last notes to scroll clear of the fades, as on the Sage page.
          contentContainerStyle={{
            paddingHorizontal: pagePad,
            paddingTop: fade.tail,
            paddingBottom: s(16) + fade.line,
            gap: s(12),
          }}
          keyboardShouldPersistTaps="handled"
          onLayout={(e) => setList({ y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
        >
          {tab === "archive" ? (
            <ArchiveList onView={onViewRetired} />
          ) : !partyId ? (
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
          ) : tab === "weapon" ? (
            <WeaponList partyId={partyId} adding={writing} onCloseAdd={closeForm} width={saveW} />
          ) : tab === "spell" ? (
            <SpellList partyId={partyId} adding={writing} onCloseAdd={closeForm} width={saveW} />
          ) : shown.length === 0 && !busy ? (
            <Text style={[styles.empty, { fontSize: fs(14) }]}>Nothing recorded yet.</Text>
          ) : null}

          {(HEADINGS[tab] ? [] : shown).map((row, i) => (
            <Pressable
              key={row.id}
              onPress={row.author_id === user?.id ? () => edit(row) : undefined}
              onLongPress={() => drop(row.id)}
              accessibilityHint={row.author_id === user?.id ? "Tap to edit, long press to delete" : "Long press to delete"}
              style={({ pressed }) => pressed && styles.cardPressed}
            >
              <View style={[styles.card, { minHeight: s(132), padding: s(14), paddingBottom: s(10) }]}>
                {/* Each note is its own light-paper sheet on the page, like the Character Sheet's Equipment and
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

      {/* The Sage page's fades: notes melt into the paper under the tabs and above the arrow
          instead of being cut off. */}
      <ScrollFades screen={screen} box={{ y: bookY + list.y, h: list.h }} />
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
  book: { flex: 1 },
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
  tab: { alignItems: "center" },
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
