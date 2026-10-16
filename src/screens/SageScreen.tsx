import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import PageHeader from "../components/PageHeader";
import ParchmentPanel from "../components/ParchmentPanel";
import Rule from "../components/Rule";
import CircleButton from "../components/CircleButton";
import ThemedButton from "../components/ThemedButton";
import SageAvatar from "../components/SageAvatar";
import MicSvg from "../../assets/images/icons/sage-mic.svg";
import PenSvg from "../../assets/images/icons/sage-pen.svg";
import { useParty } from "../context/PartyContext";
import { useVoice, VOICES } from "../context/VoiceContext";
import { loadCharacter, loadEquipment, loadTraits, needsSheet, sheetBrief } from "../lib/character";
import { addCodexEntry } from "../lib/codex";
import { askSage, type SagePersona } from "../lib/sage";
import { errorText } from "../lib/parties";
import { colors, fonts, spacing, useAppFonts, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");
// Leather band behind the mode toggle (Figma Rectangle 23, 2541:1127), texture only.
const leather = require("../../assets/images/sage/leather-band.jpg");
// Pill toggle (Figma Component 3, 2201:61). Both PNGs carry a baked soft shadow,
// so the art is a little larger than the shape: track 379 x 140 px inside
// 403 x 170, knob 142 x 139 inside 166 x 169, both offset 12 px from the top-left.
const track = require("../../assets/images/sage/toggle-track.png");
const knob = require("../../assets/images/sage/toggle-knob.png");

// Orb fire (Figma component set 2189:64), 916 x 521 px at 3x with real transparency.
// Red for the Wizard voice, blue (Figma 2320:1208) for Plain.
const FIRE_RED = [
  require("../../assets/images/sage/fire-red-1.png"),
  require("../../assets/images/sage/fire-red-2.png"),
  require("../../assets/images/sage/fire-red-3.png"),
  require("../../assets/images/sage/fire-red-4.png"),
  require("../../assets/images/sage/fire-red-5.png"),
  require("../../assets/images/sage/fire-red-6.png"),
  require("../../assets/images/sage/fire-red-7.png"),
  require("../../assets/images/sage/fire-red-8.png"),
];
const FIRE_BLUE = [
  require("../../assets/images/sage/fire-blue-1.png"),
  require("../../assets/images/sage/fire-blue-2.png"),
  require("../../assets/images/sage/fire-blue-3.png"),
  require("../../assets/images/sage/fire-blue-4.png"),
  require("../../assets/images/sage/fire-blue-5.png"),
  require("../../assets/images/sage/fire-blue-6.png"),
  require("../../assets/images/sage/fire-blue-7.png"),
  require("../../assets/images/sage/fire-blue-8.png"),
];
const FIRE_RATIO = 916 / 521;

// The 3D orb keeps its fixed size; everything around it scales.
const ORB = 260;
const RING = ORB + 14; // padding 6 + 1 dp gold ring on each side
const STAGE_H = ORB + 56;
// Dot colours for the voice indicator, matching the flame of each voice.
const DOT = { red: "#C44536", blue: "#3E8C7E", green: "#5E8C3E" } as const;

type Props = { onBack: () => void; onOpenTome?: () => void };

function cleanReply(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

let wizardVoice = "";

function scoreVoice(voice: { identifier?: string; name?: string; language?: string }) {
  const id = `${voice.identifier ?? ""} ${voice.name ?? ""}`.toLowerCase();
  const lang = (voice.language ?? "").toLowerCase();
  if (!lang.startsWith("en")) return -1;
  if (/female|woman|samantha|victoria|karen|moira|tessa/.test(id)) return 0;
  let score = 1;
  if (/male|man|daniel|fred|rjs|iom|alex|bruce|ralph|gordon|arthur/.test(id)) score += 4;
  if (/en-gb|en_gb|british|uk/.test(id) || lang.startsWith("en-gb")) score += 2;
  if (/old|deep|low/.test(id)) score += 2;
  return score;
}

async function loadWizardVoice() {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const ranked = voices
      .map((voice) => ({ voice, score: scoreVoice(voice) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score);
    wizardVoice = ranked[0]?.voice.identifier ?? "";
  } catch {
    wizardVoice = "";
  }
}

function speakReply(text: string, fancy: boolean, onEnd: () => void) {
  Speech.stop();
  Speech.speak(text, {
    language: "en",
    rate: fancy ? 0.86 : 0.92,
    pitch: 1,
    voice: fancy && wizardVoice ? wizardVoice : undefined,
    onDone: onEnd,
    onStopped: onEnd,
    onError: onEnd,
  });
}

// All frames stay mounted and only the current one is shown, so switching
// frames never waits on an image decode (no flicker on the first loop).
function OrbFire({ frames, width }: { frames: number[]; width: number }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((current) => (current + 1) % frames.length);
    }, 120);
    return () => clearInterval(id);
  }, [frames.length]);

  const height = width / FIRE_RATIO;
  return (
    <View pointerEvents="none" style={[styles.fire, { width, height, marginLeft: -width / 2 }]}>
      {frames.map((source, index) => (
        <Image
          key={index}
          source={source}
          resizeMode="contain"
          style={[styles.fireFrame, { width, height, opacity: index === frame ? 1 : 0 }]}
        />
      ))}
    </View>
  );
}

type Mode = { id: SagePersona; label: string; Icon: typeof MicSvg; hint: string };
const MODES: [Mode, Mode] = [
  { id: "sage", label: "Sage", Icon: MicSvg, hint: "Ask a ruling" },
  { id: "scribe", label: "Scribe", Icon: PenSvg, hint: "Note the table" },
];

// Cream pill toggle on the leather band (Figma 2541:1133): Microphone = Sage, Hand With Pen = Scribe.
// The red knob slides under the chosen icon.
function ModeToggle({ persona, onChange }: { persona: SagePersona; onChange: (next: SagePersona) => void }) {
  const { s, fs } = useScale();
  const W = s(126);
  const H = s(46);
  const KNOB = s(47);
  const ICON = s(30);
  const travel = W - KNOB;
  const pos = useRef(new Animated.Value(persona === "sage" ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(pos, {
      toValue: persona === "sage" ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [persona, pos]);

  const trackK = W / (379 / 3);
  const knobK = KNOB / (142 / 3);

  return (
    <View style={styles.bandRow}>
      {MODES.map((mode, index) => {
        const on = persona === mode.id;
        const label = (
          <Pressable
            key={mode.id}
            onPress={() => onChange(mode.id)}
            hitSlop={8}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${mode.label}: ${mode.hint}`}
            style={({ pressed }) => [styles.bandLabel, index === 0 ? styles.bandLabelLeft : styles.bandLabelRight, pressed && styles.pressed]}
          >
            <Text style={[styles.bandTitle, { fontSize: fs(15) }, on ? null : styles.bandIdle]}>{mode.label.toUpperCase()}</Text>
            <Text style={[styles.bandHint, { fontSize: fs(11) }, on ? null : styles.bandIdle]}>{mode.hint}</Text>
          </Pressable>
        );
        if (index === 0) return label;
        return [
          <View key="toggle" style={{ width: W, height: H }}>
            <Image
              source={track}
              style={{ position: "absolute", left: -4 * trackK, top: -4 * trackK, width: (403 / 3) * trackK, height: (170 / 3) * trackK }}
              resizeMode="stretch"
            />
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: KNOB,
                height: H,
                transform: [{ translateX: pos.interpolate({ inputRange: [0, 1], outputRange: [0, travel] }) }],
              }}
            >
              <Image
                source={knob}
                style={{ position: "absolute", left: -4 * knobK, top: -4 * knobK, width: (166 / 3) * knobK, height: (169 / 3) * knobK }}
                resizeMode="stretch"
              />
            </Animated.View>
            <View style={StyleSheet.absoluteFill}>
              {MODES.map((item, i) => {
                const active = persona === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => onChange(item.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={item.label}
                    style={({ pressed }) => [
                      styles.toggleHit,
                      { width: KNOB, left: i === 0 ? 0 : travel },
                      pressed && styles.pressed,
                    ]}
                  >
                    <item.Icon width={ICON} height={ICON} color={active ? colors.cream : colors.muted} />
                  </Pressable>
                );
              })}
            </View>
          </View>,
          label,
        ];
      })}
    </View>
  );
}

function noteTitle(text: string) {
  const line = text.split(/\n|\./)[0]?.trim() || text.trim();
  return line.length > 48 ? `${line.slice(0, 45)}...` : line;
}

export default function SageScreen({ onBack, onOpenTome }: Props) {
  const { selected } = useParty();
  const partyId = selected?.party.id ?? null;
  const { voice } = useVoice();
  const { s, fs, width } = useScale();
  const [persona, setPersona] = useState<SagePersona>("sage");
  // The voice is picked on the Tome. Wizard = the ornate "wizard" persona, anything else = plain Sage.
  const fancy = voice === "wizard";
  const voiceOption = VOICES.find((option) => option.id === voice) ?? VOICES[0];
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [noted, setNoted] = useState("");
  const [sheetLine, setSheetLine] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const fontsLoaded = useAppFonts();
  const scroll = useRef<ScrollView>(null);
  const workY = useRef(0);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadWizardVoice();
    return () => {
      Speech.stop();
    };
  }, []);

  // Gentle fade and lift whenever a new reply lands.
  useEffect(() => {
    if (!reply) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reply, fade]);

  const ask = async () => {
    const trimmed = question.trim();
    Speech.stop();
    setSpeaking(false);
    setError("");
    setReply("");
    setNoted("");
    setSheetLine("");
    if (trimmed.length < 3) {
      setError("Ask a real question. Three characters at least.");
      return;
    }
    setBusy(true);
    try {
      let brief = "";
      if (persona === "sage" && needsSheet(trimmed)) {
        const character = await loadCharacter(partyId);
        const gear = character ? await loadEquipment(character.id) : [];
        const traits = character ? await loadTraits(character.id) : [];
        brief = sheetBrief(character, gear, traits);
        setSheetLine(brief ? "Sheet attached." : "No sheet yet.");
      }
      const style = fancy
        ? "Speak as an old court mage. Warm, ornate, short enough to read aloud. Plain text, no markdown.\n\n"
        : "";
      const asked = brief ? `${style}Sheet: ${brief}\nQ: ${trimmed}` : `${style}${trimmed}`;
      let data;
      try {
        data = await askSage(asked, fancy && persona === "sage" ? "wizard" : persona, brief);
      } catch (err) {
        if (!String(errorText(err)).toLowerCase().includes("unknown persona")) throw err;
        data = await askSage(asked, persona, brief);
      }
      const text = cleanReply(String(data?.reply ?? ""));
      if (!text) {
        setError("Sage returned an empty reply. Try again, or check the Edge Function logs.");
        return;
      }
      setReply(text);
      if (persona === "scribe") {
        if (!partyId) {
          setError("Join a party first. The note needs a table to land in.");
        } else {
          await addCodexEntry(partyId, "note", noteTitle(trimmed), text, "scribe");
          setNoted("Written to the Codex.");
        }
      }
      setSpeaking(true);
      speakReply(text, fancy, () => setSpeaking(false));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleSpeech = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    if (!reply) return;
    setSpeaking(true);
    speakReply(reply, fancy, () => setSpeaking(false));
  };

  const status = speaking ? "Speaking..." : busy ? "Thinking..." : reply ? "Reply ready" : "Ready";
  const canPlay = !!reply || speaking;

  if (!fontsLoaded) return <View style={styles.root} />;

  const fireW = s(262);
  const stageW = Math.max(fireW, RING);
  const pauseSize = s(48);
  const statusSize = fs(21);
  const replyLabel = persona === "sage" ? (fancy ? "Wizard" : "Sage") : "Scribe";

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <PageHeader title="SAGE SCRIBE" onBack={onBack} ruleWidth={s(219)} />

      <ScrollView
        ref={scroll}
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingHorizontal: s(spacing.lg), paddingBottom: s(spacing.xxl) }]}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
      >
        <Pressable
          onPress={onOpenTome}
          disabled={!onOpenTome}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Voice: ${voiceOption.label}`}
          accessibilityHint="Opens the Tome to change the Sage's voice"
          style={({ pressed }) => [styles.voiceRow, { gap: s(6), marginTop: s(2) }, pressed && styles.pressed]}
        >
          <View style={[styles.dot, { width: s(8), height: s(8), borderRadius: s(4), backgroundColor: DOT[voiceOption.colour] }]} />
          <Text style={[styles.voiceText, { fontSize: fs(13) }]}>Voice: {voiceOption.label}</Text>
        </Pressable>

        <View style={[styles.orbStage, { width: stageW, height: STAGE_H }]}>
          <View style={styles.orbRing}>
            <SageAvatar />
          </View>
          <OrbFire key={fancy ? "red" : "blue"} frames={fancy ? FIRE_RED : FIRE_BLUE} width={fireW} />
        </View>

        <Text
          style={[styles.status, { fontSize: statusSize, letterSpacing: statusSize * 0.15, marginTop: s(spacing.xs) }]}
          accessibilityLiveRegion="polite"
        >
          {status}
        </Text>

        <View style={[styles.pauseRow, { marginTop: s(spacing.sm), gap: s(spacing.xs) }]}>
          <CircleButton
            size={pauseSize}
            onPress={toggleSpeech}
            disabled={!canPlay}
            accessibilityLabel={speaking ? "Stop the reply" : "Play the reply"}
            style={!canPlay && styles.dim}
          >
            <View style={[styles.pauseBars, { gap: pauseSize * 0.2 }]}>
              <View style={[styles.pauseBar, { width: s(3.5), height: pauseSize * 0.46 }]} />
              <View style={[styles.pauseBar, { width: s(3.5), height: pauseSize * 0.46 }]} />
            </View>
          </CircleButton>
          <Text style={[styles.hint, { fontSize: fs(13) }]}>
            {speaking ? "Tap to stop the reply" : reply ? "Tap to hear the reply" : "The reply plays here"}
          </Text>
        </View>

        <View
          style={[
            styles.band,
            { width, height: s(58), marginTop: s(spacing.lg), borderRadius: s(5), paddingHorizontal: s(spacing.md) },
          ]}
        >
          <Image source={leather} style={styles.bandTexture} resizeMode="cover" />
          <ModeToggle persona={persona} onChange={setPersona} />
        </View>

        <View
          style={[styles.full, { marginTop: s(spacing.lg) }]}
          onLayout={(event) => {
            workY.current = event.nativeEvent.layout.y;
          }}
        >
          <ParchmentPanel
            variant="ledger"
            contentStyle={{ paddingHorizontal: s(18), paddingTop: s(14), paddingBottom: s(14), gap: s(spacing.sm) }}
          >
            <Text style={[styles.workLabel, { fontSize: fs(14) }]}>
              {persona === "sage" ? "QUESTION" : "WHAT JUST HAPPENED"}
            </Text>
            <Rule color={colors.rule} style={styles.ruleLeft} width="100%" />
            <TextInput
              style={[styles.input, { fontSize: fs(16), lineHeight: fs(22), minHeight: s(92) }]}
              multiline
              placeholder={persona === "sage" ? "Ask a ruling." : "Say what just happened at the table."}
              placeholderTextColor={colors.placeholder}
              value={question}
              onChangeText={setQuestion}
              onFocus={() => {
                setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, workY.current - s(spacing.md)), animated: true }), 250);
              }}
              accessibilityLabel={persona === "sage" ? "Question for the Sage" : "Note for the Scribe"}
            />
            <View style={[styles.workFoot, { gap: s(spacing.sm) }]}>
              <View style={styles.flex}>
                {sheetLine ? <Text style={[styles.noted, { fontSize: fs(13) }]}>{sheetLine}</Text> : null}
                {noted ? <Text style={[styles.noted, { fontSize: fs(13) }]}>{noted}</Text> : null}
              </View>
              <ThemedButton
                label={persona === "sage" ? "Ask" : "Note"}
                onPress={ask}
                busy={busy}
                style={{ minWidth: s(104) }}
              />
            </View>
          </ParchmentPanel>
        </View>

        {error ? (
          <Text style={[styles.error, { fontSize: fs(15), marginTop: s(spacing.sm) }]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        {busy ? (
          <ParchmentPanel
            variant="card"
            style={[styles.full, { marginTop: s(spacing.md) }]}
            contentStyle={[styles.loading, { padding: s(18), gap: s(spacing.sm) }]}
          >
            <ActivityIndicator color={colors.wordmark} />
            <Text style={[styles.loadingText, { fontSize: fs(15) }]}>
              {persona === "sage" ? "The Sage is leafing through the tomes..." : "The Scribe is writing it down..."}
            </Text>
          </ParchmentPanel>
        ) : null}

        {reply ? (
          <Animated.View
            style={[
              styles.full,
              { marginTop: s(spacing.md) },
              { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [s(10), 0] }) }] },
            ]}
          >
            <ParchmentPanel variant="card" contentStyle={{ paddingHorizontal: s(20), paddingVertical: s(16), gap: s(spacing.sm) }}>
              <View style={[styles.replyHead, { gap: s(spacing.sm) }]}>
                <Text style={[styles.replyLabel, { fontSize: fs(14) }]}>{replyLabel.toUpperCase()}</Text>
                <Rule color={colors.rule} style={styles.flex} />
              </View>
              <Text style={[styles.replyBody, { fontSize: fs(17), lineHeight: fs(25) }]} selectable>
                {reply}
              </Text>
            </ParchmentPanel>
          </Animated.View>
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
  scroll: { flex: 1 },
  body: { alignItems: "center" },
  full: { width: "100%" },
  flex: { flex: 1 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  dim: { opacity: 0.4 },

  voiceRow: { flexDirection: "row", alignItems: "center", alignSelf: "center" },
  dot: { borderWidth: 1, borderColor: colors.cardStroke },
  voiceText: { fontFamily: fonts.heading, color: colors.muted, letterSpacing: 0.4 },

  orbStage: { alignItems: "center", overflow: "visible" },
  orbRing: {
    marginTop: 8,
    padding: 6,
    borderRadius: RING / 2,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  fire: { position: "absolute", left: "50%", bottom: 22, zIndex: 2 },
  fireFrame: { position: "absolute", top: 0, left: 0 },

  status: { fontFamily: fonts.bodyItalic, color: colors.muted, includeFontPadding: false },
  pauseRow: { alignItems: "center" },
  pauseBars: { flexDirection: "row", alignItems: "center" },
  pauseBar: { borderRadius: 2, backgroundColor: colors.cream },
  hint: { fontFamily: fonts.body, color: colors.muted },

  band: {
    overflow: "hidden",
    justifyContent: "center",
    backgroundColor: colors.ink,
    elevation: 4,
    shadowColor: colors.ink,
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 4 },
  },
  bandTexture: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.92 },
  bandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  bandLabel: { flex: 1, justifyContent: "center", minHeight: 44 },
  bandLabelLeft: { alignItems: "flex-end", paddingRight: 14 },
  bandLabelRight: { alignItems: "flex-start", paddingLeft: 14 },
  bandTitle: { fontFamily: fonts.headingBold, color: colors.cream, letterSpacing: 1.2, includeFontPadding: false },
  bandHint: { fontFamily: fonts.body, color: colors.cream, marginTop: 1, includeFontPadding: false },
  bandIdle: { opacity: 0.55 },
  toggleHit: { position: "absolute", top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },

  workLabel: { fontFamily: fonts.headingBold, color: colors.ink, letterSpacing: 1 },
  ruleLeft: { alignSelf: "stretch", opacity: 0.6 },
  input: {
    fontFamily: fonts.body,
    color: colors.ink,
    textAlignVertical: "top",
    padding: 0,
  },
  workFoot: { flexDirection: "row", alignItems: "center" },
  noted: { fontFamily: fonts.bodyItalic, color: colors.panelStroke },
  error: { fontFamily: fonts.body, color: colors.wordmark, alignSelf: "stretch", textAlign: "center" },

  loading: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  loadingText: { fontFamily: fonts.bodyItalic, color: colors.muted },

  replyHead: { flexDirection: "row", alignItems: "center" },
  replyLabel: { fontFamily: fonts.headingBold, color: colors.wordmark, letterSpacing: 1.2 },
  replyBody: { fontFamily: fonts.body, color: colors.ink },
});
