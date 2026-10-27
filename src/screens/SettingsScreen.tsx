import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useAnimatedValue,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Svg, { Circle, Path } from "react-native-svg";
import PageHeader from "../components/PageHeader";
import { ScrollFades, useFadeSizes } from "../components/PageFade";
import CircleButton from "../components/CircleButton";
import { RefreshIcon } from "../components/icons";
import { CornerOrnaments, Flourish, INK_COLOR, InkButton, InkOutline, INK_RADIUS, InkStroke } from "../components/Ink";
import { GuidanceTips } from "../components/Guidance";
import Rule from "../components/Rule";
import VoiceCarousel from "../components/VoiceCarousel";
import { useAuth } from "../context/AuthContext";
import { useParty } from "../context/PartyContext";
import { useVoice } from "../context/VoiceContext";
import {
  deleteParty,
  errorText,
  leaveParty,
  myProfile,
  partySeats,
  transferDm,
  type Membership,
  type Profile,
  type Seat,
} from "../lib/parties";
import type { AppScreen } from "../navigation/screens";
import { colors, fonts, inkText, useAppFonts, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");
// Glowing d20 badge, Figma 2280:302. 280 x 281 px at 3x, glow included.
const d20 = require("../../assets/images/tome/d20-badge.png");

// The Ledger sections' light paper, as on the Codex note sheets, in place of the old cream white, so the
// Tome shows two papers (the page and this one), not three. Its baked torn border is drawn oversize and
// clipped off, so only paper shows inside each box's ink rim.
const sheetPaper = require("../../assets/images/panels/panel-ledger-cream-fill.jpg");

// Light paper filling its parent, stopping just inside the fine ink rim drawn over it.
function SheetPaper() {
  const { s } = useScale();
  const bleed = s(6);
  const clip = s(1.2);
  return (
    <View pointerEvents="none" style={[styles.sheetClip, { top: clip, left: clip, right: clip, bottom: clip, borderRadius: s(INK_RADIUS) }]}>
      <View style={{ position: "absolute", top: -bleed, left: -bleed, right: -bleed, bottom: -bleed }}>
        <Image source={sheetPaper} style={styles.sheetImage} resizeMode="cover" />
      </View>
    </View>
  );
}

// A paper InkButton: the same button, its fill swapped for the light paper.
function PaperButton(props: Omit<ComponentProps<typeof InkButton>, "fill">) {
  return (
    <View style={{ width: props.width, height: props.height }}>
      <SheetPaper />
      <InkButton {...props} fill="none" />
    </View>
  );
}

// Printed section heading, as on the Ledger and Codex: red Cinzel with an illuminated first letter
// and a drawn underline as wide as the text.
function SectionTitle({ children, size, center }: { children: string; size: number; center?: boolean }) {
  // Measured, so the underline spans the whole heading on Android too ("100%" inside a shrink-wrapped
  // title collapsed to a short dash under the middle letters on device).
  // Centred titles stretch full width with centred text instead of shrink-wrapping: a box exactly as
  // wide as the measured line came out a sub-pixel short on Android, so "Personality" wrapped onto a
  // clipped second line and only "VOICE" showed. The underline then takes the drawn line's width.
  const [textW, setTextW] = useState(0);
  const stretch = center && Platform.OS !== "web";
  return (
    <View style={[styles.sectionTitle, center && (stretch ? styles.sectionStretch : styles.sectionCenter)]}>
      <Text
        style={[styles.section, stretch && styles.sectionTextCenter, { fontSize: size, lineHeight: Math.round(size * 1.6) }]}
        onLayout={stretch ? undefined : (e) => setTextW(Math.round(e.nativeEvent.layout.width))}
        onTextLayout={
          stretch
            ? (e) => setTextW(Math.ceil(Math.max(0, ...e.nativeEvent.lines.map((l) => l.width))))
            : undefined
        }
      >
        <Text style={[styles.dropCap, { fontSize: Math.round(size * 1.5) }]}>{children.charAt(0)}</Text>
        {children.slice(1)}
      </Text>
      {textW > 0 ? <Rule width={textW} color={INK_COLOR} style={styles.sectionRule} /> : null}
    </View>
  );
}

// A light-paper card edged in fine ink with small corner curls (Codex note card look).
function InkCard({ seed, children, style }: { seed: number; children: ReactNode; style?: object }) {
  const { s } = useScale();
  return (
    <View style={style}>
      <SheetPaper />
      <InkOutline seed={seed} radius={s(INK_RADIUS)} />
      <CornerOrnaments size={s(12)} inset={s(4)} />
      {children}
    </View>
  );
}

// The dotted leader of a book index, running from an entry to its marker at the right margin.
function Leader() {
  const { s } = useScale();
  const [w, setW] = useState(0);
  const h = s(6);
  const gap = s(4.5);
  const dots = w > s(8) ? Math.floor((w - s(8)) / gap) + 1 : 0;
  return (
    <View pointerEvents="none" style={[styles.flex, { height: h }]} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {w > 0 ? (
        <Svg width={w} height={h}>
          {Array.from({ length: dots }, (_, i) => (
            <Circle key={i} cx={s(4) + i * gap} cy={h / 2} r={s(0.65)} fill={INK_COLOR} fillOpacity={0.65} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

// One entry of the Tome's index: a red page numeral, the section's name in the serif, a dotted leader
// and a fine ink chevron that turns down while the section hangs open beneath it. While open the
// name is inked red, as the old toggle's label was.
function IndexEntry({
  numeral,
  label,
  active,
  onPress,
  accessibilityHint,
}: {
  numeral: string;
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityHint: string;
}) {
  const { s, fs } = useScale();
  const c = s(5); // half the chevron
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ expanded: active }}
      style={({ pressed }) => [styles.entry, { minHeight: s(48), gap: s(10) }, pressed && styles.pressed]}
    >
      <Text style={[styles.entryNumeral, { fontSize: fs(14), width: s(30) }]}>{numeral}</Text>
      <Text numberOfLines={1} style={[styles.entryLabel, { fontSize: fs(18) }, active && styles.toggleOn]}>
        {label}
      </Text>
      <Leader />
      <Svg width={c * 2 + 2} height={c * 2 + 2} style={{ transform: [{ rotate: active ? "90deg" : "0deg" }] }}>
        <Path
          d={`M${1 + c * 0.6} 1L${1 + c * 1.5} ${1 + c}L${1 + c * 0.6} ${1 + c * 2}`}
          stroke={active ? colors.activeTab : INK_COLOR}
          strokeWidth={1}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

// The active party's own actions, under its card. A player can leave (their sheet retires to their
// Archive). The DM can hand the party to another member, or delete it after typing its exact name.
function PartyActions({ row, seats, width, onDone }: { row: Membership; seats: Seat[]; width: number; onDone: () => Promise<void> }) {
  const { s, fs } = useScale();
  const [mode, setMode] = useState<"hand" | "delete" | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const party = row.party;
  const isDm = party.created_by === row.user_id;
  const others = seats.filter((seat) => seat.user_id !== row.user_id);
  const gap = s(10);
  const half = Math.floor((width - gap) / 2);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      setMode(null);
      setTyped("");
      setError("");
      // Reload the parties: one that is gone stops being the active party.
      await onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const leave = () =>
    Alert.alert("Leave party", "Your character sheet moves to the Archive. Party notes you wrote stay with the party.", [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => run(() => leaveParty(party.id)) },
    ]);

  const handTo = (seat: Seat) =>
    Alert.alert("Hand over DM", `Make ${seat.name} the DM of ${party.name}? You stay in the party as a player.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Hand over", onPress: () => run(() => transferDm(party.id, seat.user_id)) },
    ]);

  const toggle = (next: "hand" | "delete") => {
    setMode((now) => (now === next ? null : next));
    setTyped("");
    setError("");
  };

  return (
    <View style={{ marginTop: s(10) }}>
      {isDm ? (
        <View style={[styles.row, { gap }]}>
          <PaperButton label="Hand over DM" variant="parchment" width={half} height={s(36)} seed={67} onPress={() => toggle("hand")} disabled={busy} />
          <PaperButton
            label="Delete party"
            variant="parchment"
            labelColor={colors.wordmark}
            width={half}
            height={s(36)}
            seed={69}
            onPress={() => toggle("delete")}
            disabled={busy}
          />
        </View>
      ) : (
        <PaperButton
          label="Leave party"
          variant="parchment"
          labelColor={colors.wordmark}
          width={width}
          height={s(36)}
          seed={67}
          onPress={leave}
          busy={busy}
        />
      )}

      {mode === "hand" ? (
        <View style={{ marginTop: s(10) }}>
          <Text style={[styles.label, { fontSize: fs(13) }]}>Pick the new DM</Text>
          {others.length === 0 ? (
            <Text style={[styles.footnote, styles.left, { fontSize: fs(13), marginTop: s(4) }]}>
              No one else is in the party yet. Share the code {party.code}.
            </Text>
          ) : (
            others.map((seat) => (
              <View key={seat.user_id}>
                <Pressable
                  onPress={() => handTo(seat)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Make ${seat.name} the DM`}
                  style={({ pressed }) => [{ paddingVertical: s(8) }, pressed && styles.pressed]}
                >
                  <Text style={[styles.body, { fontSize: fs(15) }]} numberOfLines={1}>
                    {seat.name}
                  </Text>
                </Pressable>
                <Rule color={INK_COLOR} style={styles.faint} />
              </View>
            ))
          )}
        </View>
      ) : null}

      {mode === "delete" ? (
        <View style={{ marginTop: s(10), gap: s(8) }}>
          <Text style={[styles.error, { fontSize: fs(13), lineHeight: fs(18) }]}>
            Everyone&apos;s character sheets go to their Archive. The party&apos;s chat and shared notes are deleted forever.
          </Text>
          <Text style={[styles.footnote, styles.left, { fontSize: fs(13) }]}>Type {party.name} to confirm.</Text>
          <View>
            <TextInput
              style={[styles.body, styles.input, { fontSize: fs(15), paddingVertical: s(5) }]}
              value={typed}
              onChangeText={setTyped}
              placeholder={party.name}
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Party name"
            />
            <InkStroke seed={71} />
          </View>
          <InkButton
            label="Delete party forever"
            variant="red"
            width={width}
            height={s(40)}
            seed={73}
            onPress={() => run(() => deleteParty(party.id))}
            disabled={typed !== party.name}
            busy={busy}
          />
        </View>
      ) : null}

      {error ? <Text style={[styles.error, { fontSize: fs(13), marginTop: s(6) }]}>{error}</Text> : null}
    </View>
  );
}

type Props = { onBack: () => void; onOpen: (screen: AppScreen) => void };
type Section = "account" | "guidance" | null;

// "Tome": the settings screen. Under the d20 and "Bound to" sits an index page, like an old book's:
// Account (sign-in and parties) and Guidance (quick how-to tips) each drop open beneath their entry,
// one at a time. The Sage's voice is picked below the index (Wizard, Arbiter or Bard, saved in
// VoiceContext and read by the Sage screen).
export default function SettingsScreen({ onBack, onOpen }: Props) {
  const fontsLoaded = useAppFonts();
  const { s, fs, width } = useScale();
  const { user, signOut } = useAuth();
  const { memberships, selected, select, refresh, loading, error } = useParty();
  const { readAloud, setReadAloud } = useVoice();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [seats, setSeats] = useState<Record<string, Seat[]>>({});
  const [open, setOpen] = useState<Section>(null);
  const [boundW, setBoundW] = useState(0);
  // Layout for the Sage page's soft fades: the page size, and the scroll area's place on it.
  const fade = useFadeSizes();
  const [screen, setScreen] = useState({ w: 0, h: 0 });
  const [scrollBox, setScrollBox] = useState({ y: 0, h: 0 });
  // The reload icon turns while the party list is loading.
  const spin = useAnimatedValue(0);
  useEffect(() => {
    if (!loading) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [loading, spin]);
  const turn = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  useEffect(() => {
    myProfile()
      .then(setProfile)
      .catch((err) => setProfileError(errorText(err)));
  }, [user?.id]);

  useEffect(() => {
    let live = true;
    Promise.all(
      memberships.map(async (row) => [row.party.id, await partySeats(row.party.id)] as const)
    )
      .then((rows) => {
        if (!live) return;
        const next: Record<string, Seat[]> = {};
        for (const [id, list] of rows) next[id] = list;
        setSeats(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [memberships]);

  if (!fontsLoaded) return <View style={styles.root} />;

  const boundTo = selected?.party.name ?? profile?.display_name ?? user?.email ?? "No one yet";
  const toggle = (section: Exclude<Section, null>) => setOpen((now) => (now === section ? null : section));
  const pagePad = s(20);
  const panelPad = s(16);
  // Create | Join share one row inside the parties panel, equal width.
  const pairGap = s(10);
  const pairW = Math.floor((width - pagePad * 2 - panelPad * 2 - pairGap) / 2) - s(2);
  // The width inside a party card (its padding is s(14) a side), for the active party's actions.
  const cardInnerW = Math.floor(width - pagePad * 2 - panelPad * 2 - s(28)) - s(2);
  // The index page reaches indexBleed past the page margin; its padding keeps the dropdowns' contents
  // where the old panels' contents were (page margin + panel padding).
  const indexBleed = s(12);
  const indexPad = indexBleed + panelPad;

  return (
    // Keyed so it mounts fresh after the font-loading placeholder: a reused view never reports
    // its layout again, and the fades need the page size.
    <View key="page" style={styles.root} onLayout={(e) => setScreen({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <PageHeader title="Tome" onBack={onBack} />

      <ScrollView
        style={styles.scroll}
        // Room for the top and bottom of the page to scroll clear of the fades, as on the Sage page.
        contentContainerStyle={{ paddingHorizontal: pagePad, paddingTop: fade.tail, paddingBottom: s(28) + fade.line }}
        keyboardShouldPersistTaps="handled"
        onLayout={(e) => setScrollBox({ y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
        removeClippedSubviews={false}
      >
        <View style={styles.center}>
          <Image
            source={d20}
            style={{ width: s(84), height: s(84), marginTop: -s(4) }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <View style={[styles.bound, { marginTop: s(2) }]}>
            <Text
              style={[styles.boundText, { fontSize: fs(16) }]}
              numberOfLines={1}
              onLayout={(e) => setBoundW(Math.round(e.nativeEvent.layout.width))}
            >
              <Text style={styles.boundLabel}>Bound to : </Text>
              {boundTo}
            </Text>
            {boundW > 0 ? <Rule width={boundW} color={INK_COLOR} style={{ marginTop: s(2) }} /> : null}
          </View>
        </View>

        {/* The index page: the light paper leaf, edged in fine ink with corner curls. It reaches a little
            wider than the page margin so every section's contents keep their old width and place. */}
        <View style={[styles.indexPage, { marginTop: s(20), marginHorizontal: -indexBleed, paddingHorizontal: indexPad, paddingTop: s(12), paddingBottom: s(16) }]}>
          <SheetPaper />
          <InkOutline seed={47} radius={s(INK_RADIUS)} />
          <CornerOrnaments size={s(16)} inset={s(5)} />
          <View style={{ marginBottom: s(6) }}>
            <SectionTitle center size={fs(20)}>
              Index
            </SectionTitle>
          </View>

          <IndexEntry
            numeral="I."
            label="Account"
            active={open === "account"}
            onPress={() => toggle("account")}
            accessibilityHint="Shows your sign-in and parties"
          />
          {open === "account" ? (
            <View style={[styles.dropdown, { paddingTop: s(4), paddingBottom: s(16), gap: s(10) }]}>
                <View>
                  <Text style={[styles.label, { fontSize: fs(13) }]}>Signed in</Text>
                  <Text style={[styles.body, { fontSize: fs(15) }]} numberOfLines={1}>
                    {user?.email}
                  </Text>
                  <Text style={[styles.meta, { fontSize: fs(13) }]}>{profile?.display_name ?? "No profile row yet"}</Text>
                  {profileError ? <Text style={[styles.error, { fontSize: fs(14) }]}>{profileError}</Text> : null}
                </View>

                <Rule color={INK_COLOR} />

                <View style={styles.headingRow}>
                  <SectionTitle size={fs(18)}>Parties</SectionTitle>
                  <CircleButton
                    size={s(32)}
                    onPress={refresh}
                    disabled={loading}
                    accessibilityLabel="Reload parties"
                    style={loading ? styles.dim : undefined}
                  >
                    <Animated.View style={{ transform: [{ rotate: turn }] }}>
                      <RefreshIcon circleSize={s(32)} />
                    </Animated.View>
                  </CircleButton>
                </View>
                {error ? <Text style={[styles.error, styles.footnote, { fontSize: fs(14) }]}>{error}</Text> : null}
                {memberships.length === 0 ? (
                  <Text style={[styles.footnote, { fontSize: fs(14) }]}>None yet. Create one, or join with a code from your DM.</Text>
                ) : null}
                {memberships.map((row, index) => {
                  const on = selected?.party.id === row.party.id;
                  const mine = seats[row.party.id]?.find((seat) => seat.user_id === row.user_id)?.name;
                  return (
                    <Pressable
                      key={`${row.party.id}-${row.role}-${index}`}
                      onPress={() => select(row.party.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${row.party.name}${on ? ", active party" : ""}`}
                      style={({ pressed }) => [!on && styles.cardIdle, pressed && styles.pressed]}
                    >
                      <InkCard seed={70 + index} style={{ paddingHorizontal: s(14), paddingVertical: s(12) }}>
                        <View style={styles.cardTop}>
                          <Text style={[styles.cardTitle, on && styles.cardTitleOn, { fontSize: fs(16) }]} numberOfLines={1}>
                            {row.party.name}
                          </Text>
                          {on ? (
                            <View style={[styles.tag, { paddingHorizontal: s(8), paddingVertical: s(3) }]}>
                              <InkOutline seed={90 + index} radius={s(INK_RADIUS)} fill={colors.primary} strokeWidth={s(0.7)} />
                              <Text style={[styles.tagText, { fontSize: fs(11) }]}>ACTIVE</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.meta, { fontSize: fs(13) }]}>
                          {row.party.code} · {row.role}
                          {mine ? ` · ${mine}` : ""}
                        </Text>
                        {(seats[row.party.id] ?? []).map((seat) => (
                          <Text key={seat.user_id} style={[styles.seat, { fontSize: fs(13), marginTop: s(3) }]}>
                            {seat.name} · {seat.role}
                          </Text>
                        ))}
                        {on ? (
                          <PartyActions row={row} seats={seats[row.party.id] ?? []} width={cardInnerW} onDone={refresh} />
                        ) : (
                          <Text style={[styles.hint, { fontSize: fs(12), marginTop: s(4) }]}>Tap to make active</Text>
                        )}
                      </InkCard>
                    </Pressable>
                  );
                })}

                <View style={[styles.row, { gap: pairGap, marginTop: s(4) }]}>
                  <InkButton label="Create party" variant="red" width={pairW} height={s(40)} seed={61} onPress={() => onOpen("create")} />
                  <PaperButton label="Join party" variant="parchment" width={pairW} height={s(40)} seed={63} onPress={() => onOpen("join")} />
                </View>
                <View style={[styles.center, { marginTop: s(6) }]}>
                  <PaperButton
                    label="Sign out"
                    variant="parchment"
                    labelColor={colors.wordmark}
                    width={s(128)}
                    height={s(40)}
                    seed={65}
                    onPress={() => signOut()}
                  />
                </View>
            </View>
          ) : null}
          <Rule color={INK_COLOR} />

          <IndexEntry
            numeral="II."
            label="Guidance"
            active={open === "guidance"}
            onPress={() => toggle("guidance")}
            accessibilityHint="Shows how to use Arkane Aid"
          />
          {open === "guidance" ? (
            <View style={[styles.dropdown, { paddingTop: s(4), paddingBottom: s(16), gap: s(10) }]}>
                <SectionTitle size={fs(18)}>How to use Arkane Aid</SectionTitle>
                <GuidanceTips />
            </View>
          ) : null}
          <Rule color={INK_COLOR} />

        </View>

        <View style={[styles.center, { marginTop: s(22) }]}>
          <Flourish width={s(84)} color={INK_COLOR} />
        </View>
        <View style={{ marginTop: s(12), marginBottom: s(4) }}>
          <SectionTitle center size={fs(20)}>
            Voice Personality
          </SectionTitle>
        </View>
        <VoiceCarousel />

        {/* Read replies aloud: on by default. Off = the Sage only writes its replies (for a DM who
            would rather read them out), and anything being read now stops. Saved on the device. */}
        <InkCard seed={81} style={{ marginTop: s(18), paddingHorizontal: s(16), paddingVertical: s(14) }}>
          <View style={[styles.headingRow, { gap: s(12) }]}>
            <View style={styles.flex}>
              <Text style={[styles.tipTitle, { fontSize: fs(16) }]}>Read replies aloud</Text>
              <Text style={[styles.footnote, styles.left, { fontSize: fs(13), lineHeight: fs(18), marginTop: 2 }]}>
                {readAloud ? "The Sage speaks each reply." : "Silent. Replies are written only."}
              </Text>
            </View>
            <Switch
              value={readAloud}
              onValueChange={setReadAloud}
              trackColor={{ false: colors.portrait, true: colors.primary }}
              thumbColor={colors.cream}
              ios_backgroundColor={colors.portrait}
              accessibilityLabel="Read replies aloud"
              // react-native-web colours the "on" thumb from activeThumbColor (teal by default); native ignores it.
              {...({ activeThumbColor: colors.cream } as object)}
            />
          </View>
        </InkCard>
      </ScrollView>
      {/* The Sage page's fades: the page melts into the paper under the header and above the tab bar. */}
      <ScrollFades screen={screen} box={scrollBox} />
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
  scroll: { flex: 1 },
  center: { alignItems: "center" },
  bound: { alignSelf: "center", maxWidth: "100%" },
  boundText: { fontFamily: fonts.headingBold, color: colors.ink, textAlign: "center", includeFontPadding: false, letterSpacing: 0.3 },
  boundLabel: { fontFamily: fonts.title, color: colors.wordmark, letterSpacing: 0.4 },
  indexPage: { alignSelf: "stretch" },
  entry: { flexDirection: "row", alignItems: "center" },
  entryNumeral: { fontFamily: fonts.title, color: colors.wordmark, letterSpacing: 0.4, ...inkText.red },
  entryLabel: { fontFamily: fonts.heading, color: colors.ink, letterSpacing: 0.3, includeFontPadding: false, flexShrink: 1 },
  dropdown: {},
  toggleOn: { color: colors.activeTab },
  sectionTitle: { alignSelf: "flex-start", flexShrink: 1 },
  sectionCenter: { alignSelf: "center" },
  sectionStretch: { alignSelf: "stretch" },
  sectionTextCenter: { textAlign: "center" },
  section: { fontFamily: fonts.title, color: colors.wordmark, letterSpacing: 0.4, ...inkText.red },
  sectionRule: { marginTop: -3 },
  dropCap: { fontFamily: fonts.titleBold, color: colors.wordmark },
  sheetClip: { position: "absolute", overflow: "hidden" },
  sheetImage: { width: "100%", height: "100%" },
  // Muted italic serif, like the Ledger and Codex footnotes.
  footnote: { fontFamily: fonts.heading, fontStyle: "italic", color: colors.muted },
  left: { textAlign: "left" },
  row: { flexDirection: "row", alignItems: "flex-start" },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dim: { opacity: 0.6 },
  flex: { flex: 1 },
  label: { fontFamily: fonts.headingBold, color: colors.wordmark, letterSpacing: 0.4, ...inkText.red },
  body: { fontFamily: fonts.heading, color: colors.ink },
  meta: { fontFamily: fonts.heading, color: colors.muted, marginTop: 2 },
  seat: { fontFamily: fonts.heading, color: colors.ink },
  hint: { fontFamily: fonts.heading, color: colors.muted, fontStyle: "italic" },
  error: { fontFamily: fonts.body, color: colors.wordmark },
  cardIdle: { opacity: 0.82 },
  pressed: { opacity: 0.7 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontFamily: fonts.headingBold, ...inkText.heading },
  cardTitleOn: { color: colors.activeTab },
  tag: {},
  tagText: { fontFamily: fonts.headingBold, color: colors.cream, letterSpacing: 0.8 },
  tipNumber: { fontFamily: fonts.stat, color: colors.wordmark, textAlign: "center" },
  tipTitle: { fontFamily: fonts.headingBold, ...inkText.heading },
  input: { width: "100%" },
  faint: { opacity: 0.35 },
});
