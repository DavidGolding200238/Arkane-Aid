import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import PageHeader from "../components/PageHeader";
import ParchmentPanel from "../components/ParchmentPanel";
import Rule from "../components/Rule";
import ThemedButton from "../components/ThemedButton";
import TornButton from "../components/TornButton";
import VoiceCarousel from "../components/VoiceCarousel";
import { useAuth } from "../context/AuthContext";
import { useParty } from "../context/PartyContext";
import { errorText, myProfile, partySeats, type Profile, type Seat } from "../lib/parties";
import type { AppScreen } from "../navigation/screens";
import { colors, fonts, useAppFonts, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");
// Glowing d20 badge, Figma 2280:302. 280 x 281 px at 3x, glow included.
const d20 = require("../../assets/images/tome/d20-badge.png");

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
// (saved in VoiceContext; Sage starts reading it in a later step).
export default function SettingsScreen({ onBack, onOpen }: Props) {
  const fontsLoaded = useAppFonts();
  const { s, fs } = useScale();
  const { user, signOut } = useAuth();
  const { memberships, selected, select, refresh, loading, error } = useParty();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [seats, setSeats] = useState<Record<string, Seat[]>>({});
  const [open, setOpen] = useState<Section>(null);

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
            <Text style={[styles.boundText, { fontSize: fs(16) }]} numberOfLines={1}>
              Bound to : {boundTo}
            </Text>
            <Rule thickness={1.5} color={colors.rule} style={{ marginTop: s(1) }} />
          </View>

          <View style={{ marginTop: s(18), gap: s(17), alignItems: "center" }}>
            <TornButton
              label="Account"
              active={open === "account"}
              onPress={() => toggle("account")}
              accessibilityHint="Shows your sign-in and parties"
            />
            <TornButton
              label="Guidance"
              active={open === "guidance"}
              onPress={() => toggle("guidance")}
              accessibilityHint="Shows how to use Arkane Aid"
            />
          </View>
        </View>

        {open === "account" ? (
          <ParchmentPanel
            variant="ledger"
            style={{ marginTop: s(18) }}
            contentStyle={{ paddingHorizontal: s(16), paddingTop: s(14), paddingBottom: s(16), gap: s(10) }}
          >
            <View>
              <Text style={[styles.label, { fontSize: fs(13) }]}>Signed in</Text>
              <Text style={[styles.body, { fontSize: fs(15) }]} numberOfLines={1}>
                {user?.email}
              </Text>
              <Text style={[styles.meta, { fontSize: fs(13) }]}>{profile?.display_name ?? "No profile row yet"}</Text>
              {profileError ? <Text style={[styles.error, { fontSize: fs(14) }]}>{profileError}</Text> : null}
            </View>

            <Rule />

            <Text style={[styles.heading, { fontSize: fs(18) }]}>Parties</Text>
            {error ? <Text style={[styles.error, { fontSize: fs(14) }]}>{error}</Text> : null}
            {memberships.length === 0 ? (
              <Text style={[styles.meta, { fontSize: fs(14) }]}>None yet. Create one, or join with a code from your DM.</Text>
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
                  <ParchmentPanel
                    variant="card"
                    contentStyle={{ paddingHorizontal: s(14), paddingVertical: s(12) }}
                  >
                    <View style={styles.cardTop}>
                      <Text style={[styles.cardTitle, on && styles.cardTitleOn, { fontSize: fs(16) }]} numberOfLines={1}>
                        {row.party.name}
                      </Text>
                      {on ? (
                        <View style={[styles.tag, { paddingHorizontal: s(8), paddingVertical: s(2), borderRadius: s(4) }]}>
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
                  </ParchmentPanel>
                </Pressable>
              );
            })}

            <View style={[styles.row, { gap: s(10), marginTop: s(4) }]}>
              <ThemedButton style={styles.flex} label="Create party" onPress={() => onOpen("create")} />
              <ThemedButton style={styles.flex} variant="outline" label="Join party" onPress={() => onOpen("join")} />
            </View>
            <View style={[styles.row, { gap: s(10) }]}>
              <ThemedButton
                style={styles.flex}
                size="small"
                variant="outline"
                label="Reload parties"
                busy={loading}
                onPress={refresh}
              />
              <ThemedButton style={styles.flex} size="small" variant="outline" label="Sign out" onPress={() => signOut()} />
            </View>
          </ParchmentPanel>
        ) : null}

        {open === "guidance" ? (
          <ParchmentPanel
            variant="ledger"
            style={{ marginTop: s(18) }}
            contentStyle={{ paddingHorizontal: s(16), paddingTop: s(14), paddingBottom: s(16), gap: s(10) }}
          >
            <Text style={[styles.heading, { fontSize: fs(18) }]}>How to use the Tome</Text>
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

        <Rule width={s(249)} thickness={2} color={colors.rule} style={{ marginTop: s(24) }} />
        <Text style={[styles.voiceHeading, { fontSize: fs(20), marginTop: s(22), marginBottom: s(8) }]}>
          Voice Personality
        </Text>
        <VoiceCarousel />
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
  boundText: { fontFamily: fonts.stat, color: colors.ink, textAlign: "center", includeFontPadding: false },
  row: { flexDirection: "row", alignItems: "flex-start" },
  flex: { flex: 1 },
  label: { fontFamily: fonts.headingBold, color: colors.wordmark, letterSpacing: 0.4 },
  heading: { fontFamily: fonts.headingBold, color: colors.ink },
  body: { fontFamily: fonts.body, color: colors.ink },
  meta: { fontFamily: fonts.body, color: colors.muted, marginTop: 2 },
  seat: { fontFamily: fonts.body, color: colors.ink },
  hint: { fontFamily: fonts.body, color: colors.placeholder, fontStyle: "italic" },
  error: { fontFamily: fonts.body, color: colors.wordmark },
  cardIdle: { opacity: 0.82 },
  pressed: { opacity: 0.7 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontFamily: fonts.headingBold, color: colors.ink },
  cardTitleOn: { color: colors.activeTab },
  tag: { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.cardStroke },
  tagText: { fontFamily: fonts.headingBold, color: colors.cream, letterSpacing: 0.8 },
  tipNumber: { fontFamily: fonts.stat, color: colors.wordmark, textAlign: "center" },
  tipTitle: { fontFamily: fonts.headingBold, color: colors.ink },
  voiceHeading: { fontFamily: fonts.headingBold, color: colors.ink, textAlign: "center" },
});
