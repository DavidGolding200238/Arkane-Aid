import { useEffect, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useAnimatedValue,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import PageHeader from "../components/PageHeader";
import CircleButton from "../components/CircleButton";
import ParchmentPanel from "../components/ParchmentPanel";
import { RefreshIcon } from "../components/icons";
import { CornerOrnaments, Flourish, HOLDER_FILL, INK_COLOR, InkButton, InkOutline, InkStroke, INK_RADIUS } from "../components/Ink";
import Rule from "../components/Rule";
import VoiceCarousel from "../components/VoiceCarousel";
import { useAuth } from "../context/AuthContext";
import { useParty } from "../context/PartyContext";
import { useVoice } from "../context/VoiceContext";
import { errorText, myProfile, partySeats, type Profile, type Seat } from "../lib/parties";
import type { AppScreen } from "../navigation/screens";
import { colors, fonts, inkText, useAppFonts, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");
// Glowing d20 badge, Figma 2280:302. 280 x 281 px at 3x, glow included.
const d20 = require("../../assets/images/tome/d20-badge.png");

// Opaque cream-white card paper, as on the Codex note cards: a real backgroundColor, so it paints on
// every platform, with the fine ink outline drawn over it.
const CARD_FILL = "#FBF6EA";

// Printed section heading, as on the Ledger and Codex: red Cinzel with an illuminated first letter
// and a drawn underline as wide as the text.
function SectionTitle({ children, size, center }: { children: string; size: number; center?: boolean }) {
  // Measured, so the underline spans the whole heading on Android too ("100%" inside a shrink-wrapped
  // title collapsed to a short dash under the middle letters on device).
  const [textW, setTextW] = useState(0);
  return (
    <View style={[styles.sectionTitle, center && styles.sectionCenter]}>
      <Text
        style={[styles.section, { fontSize: size, lineHeight: Math.round(size * 1.6) }]}
        onLayout={(e) => setTextW(Math.round(e.nativeEvent.layout.width))}
      >
        <Text style={[styles.dropCap, { fontSize: Math.round(size * 1.5) }]}>{children.charAt(0)}</Text>
        {children.slice(1)}
      </Text>
      {textW > 0 ? <Rule width={textW} color={INK_COLOR} style={styles.sectionRule} /> : null}
    </View>
  );
}

// A cream card edged in fine ink with small corner curls (Codex note card look).
function InkCard({ seed, children, style }: { seed: number; children: ReactNode; style?: object }) {
  const { s } = useScale();
  const inset = s(1.2);
  return (
    <View style={style}>
      <View style={[styles.cardFill, { top: inset, left: inset, right: inset, bottom: inset, borderRadius: s(INK_RADIUS) }]} />
      <InkOutline seed={seed} radius={s(INK_RADIUS)} />
      <CornerOrnaments size={s(12)} inset={s(4)} />
      {children}
    </View>
  );
}

// ACCOUNT / GUIDANCE: cream paper edged in fine ink. While its section is open the button reads as
// pressed in, like the Ledger quill: a second inked rim inside, a red label and a red pen mark under it.
function SectionToggle({
  label,
  active,
  onPress,
  accessibilityHint,
  seed,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityHint: string;
  seed: number;
}) {
  const { s, fs } = useScale();
  const w = s(181);
  const h = s(38);
  const size = fs(14);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ expanded: active }}
      hitSlop={{ top: Math.max(4, Math.ceil((s(44) - h) / 2)), bottom: Math.max(4, Math.ceil((s(44) - h) / 2)), left: 4, right: 4 }}
      style={({ pressed }) => [{ width: w, height: h, alignItems: "center", justifyContent: "center" }, pressed && styles.togglePressed]}
    >
      <InkOutline seed={seed} radius={s(INK_RADIUS)} fill={HOLDER_FILL} />
      {active ? <InkOutline seed={seed + 3} radius={s(INK_RADIUS)} style={{ margin: s(3.5) }} strokeWidth={s(0.6)} /> : null}
      <Text
        numberOfLines={1}
        style={[styles.toggleLabel, { fontSize: size, lineHeight: Math.round(size * 1.2) }, active && styles.toggleOn]}
      >
        {label.toUpperCase()}
      </Text>
      {active ? (
        <View style={{ width: s(52), marginTop: s(1) }}>
          <InkStroke color={colors.wordmark} seed={seed} />
        </View>
      ) : null}
    </Pressable>
  );
}

type Props = { onBack: () => void; onOpen: (screen: AppScreen) => void };
type Section = "account" | "guidance" | null;

const TIPS = [
  { title: "Sign in", body: "Use your email and password. Your sheet and notes follow your account to any phone." },
  { title: "Gather a party", body: "The DM taps Create party and shares the 6-character code. Players tap Join party and enter it." },
  { title: "Fill your Ledger", body: "Add your portrait, abilities, HP, AC and gear so the Sage can read your sheet." },
  { title: "Ask the Sage", body: "Type or speak any rule or lore question. Rough spelling is fine; it reads your sheet when it helps." },
  { title: "Scribe the Codex", body: "Keep session notes, quests and lore in the Codex so the whole party sees the same story." },
];

// "Tome": the settings screen. Account and party tools sit behind ACCOUNT,
// quick how-to tips behind GUIDANCE, and the Sage's voice is picked below
// (Wizard, Arbiter or Bard, saved in VoiceContext and read by the Sage screen).
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

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <PageHeader title="Tome" onBack={onBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: pagePad, paddingBottom: s(28) }}
        keyboardShouldPersistTaps="handled"
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

          <View style={{ marginTop: s(18), gap: s(17), alignItems: "center" }}>
            <SectionToggle
              label="Account"
              active={open === "account"}
              onPress={() => toggle("account")}
              accessibilityHint="Shows your sign-in and parties"
              seed={51}
            />
            <SectionToggle
              label="Guidance"
              active={open === "guidance"}
              onPress={() => toggle("guidance")}
              accessibilityHint="Shows how to use Arkane Aid"
              seed={57}
            />
          </View>
        </View>

        {open === "account" ? (
          <ParchmentPanel
            variant="ledger"
            style={{ marginTop: s(18) }}
            contentStyle={{ paddingHorizontal: panelPad, paddingTop: s(14), paddingBottom: s(16), gap: s(10) }}
          >
            <CornerOrnaments size={s(16)} inset={s(5)} />
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
                    {!on ? (
                      <Text style={[styles.hint, { fontSize: fs(12), marginTop: s(4) }]}>Tap to make active</Text>
                    ) : null}
                  </InkCard>
                </Pressable>
              );
            })}

            <View style={[styles.row, { gap: pairGap, marginTop: s(4) }]}>
              <InkButton label="Create party" variant="red" width={pairW} height={s(40)} seed={61} onPress={() => onOpen("create")} />
              <InkButton label="Join party" variant="parchment" width={pairW} height={s(40)} seed={63} onPress={() => onOpen("join")} />
            </View>
            <View style={[styles.center, { marginTop: s(6) }]}>
              <InkButton
                label="Sign out"
                variant="parchment"
                labelColor={colors.wordmark}
                width={s(128)}
                height={s(40)}
                seed={65}
                onPress={() => signOut()}
              />
            </View>
          </ParchmentPanel>
        ) : null}

        {open === "guidance" ? (
          <ParchmentPanel
            variant="ledger"
            style={{ marginTop: s(18) }}
            contentStyle={{ paddingHorizontal: s(16), paddingTop: s(14), paddingBottom: s(16), gap: s(10) }}
          >
            <CornerOrnaments size={s(16)} inset={s(5)} />
            <SectionTitle size={fs(18)}>How to use the Tome</SectionTitle>
            {TIPS.map((tip, index) => (
              <View key={tip.title} style={[styles.row, { gap: s(10) }]}>
                <Text style={[styles.tipNumber, { fontSize: fs(20), width: s(18) }]}>{index + 1}</Text>
                <View style={styles.flex}>
                  <Text style={[styles.tipTitle, { fontSize: fs(15) }]}>{tip.title}</Text>
                  <Text style={[styles.body, { fontSize: fs(14), lineHeight: fs(20) }]}>{tip.body}</Text>
                </View>
              </View>
            ))}
          </ParchmentPanel>
        ) : null}

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
  togglePressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  toggleLabel: {
    fontFamily: fonts.headingBold,
    color: colors.ink,
    letterSpacing: 0.6,
    includeFontPadding: false,
    textAlignVertical: "center",
    textAlign: "center",
  },
  toggleOn: { color: colors.activeTab },
  sectionTitle: { alignSelf: "flex-start", flexShrink: 1 },
  sectionCenter: { alignSelf: "center" },
  section: { fontFamily: fonts.title, color: colors.wordmark, letterSpacing: 0.4, ...inkText.red },
  sectionRule: { marginTop: -3 },
  dropCap: { fontFamily: fonts.titleBold, color: colors.wordmark },
  cardFill: { position: "absolute", backgroundColor: CARD_FILL },
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
});
