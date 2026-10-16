import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import PageHeader from "../components/PageHeader";
import ParchmentPanel from "../components/ParchmentPanel";
import Rule from "../components/Rule";
import CircleButton from "../components/CircleButton";
import TornButton from "../components/TornButton";
import SageOrb from "../components/SageOrb";
import SageAskSheet from "../components/SageAskSheet";
import MicSvg from "../../assets/images/icons/icon-mic.svg";
import PenSvg from "../../assets/images/icons/icon-hand-quill.svg";
import { useParty } from "../context/PartyContext";
import { useVoice } from "../context/VoiceContext";
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

type Mode = { id: SagePersona; label: string; Icon: typeof MicSvg };
const MODES: [Mode, Mode] = [
  { id: "sage", label: "Sage, ask a ruling", Icon: MicSvg },
  { id: "scribe", label: "Scribe, note the table", Icon: PenSvg },
];

// Cream pill toggle on the leather band (Figma 2541:1133): Microphone = Sage, Hand With Pen = Scribe.
// The red knob slides under the chosen icon. No labels, like the Figma: the icons and the
// action button under the orb already say which side is on.
function ModeToggle({ persona, onChange }: { persona: SagePersona; onChange: (next: SagePersona) => void }) {
  const { s } = useScale();
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
    <View style={{ width: W, height: H }} accessibilityRole="radiogroup">
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
      {MODES.map((item, i) => {
        const active = persona === item.id;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            hitSlop={8}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={item.label}
            style={({ pressed }) => [styles.toggleHit, { width: KNOB, left: i === 0 ? 0 : travel }, pressed && styles.pressed]}
          >
            <item.Icon width={ICON} height={ICON} color={active ? colors.cream : colors.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

// Play triangle for the red circle, drawn with borders so it needs no extra art.
function PlayGlyph({ size }: { size: number }) {
  const h = size * 0.38;
  return (
    <View
      style={{
        width: 0,
        height: 0,
        marginLeft: h * 0.18,
        borderTopWidth: h / 2,
        borderBottomWidth: h / 2,
        borderLeftWidth: h * 0.86,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        borderLeftColor: colors.cream,
      }}
    />
  );
}

function PauseGlyph({ size, bar }: { size: number; bar: number }) {
  return (
    <View style={[styles.pauseBars, { gap: size * 0.2 }]}>
      <View style={[styles.pauseBar, { width: bar, height: size * 0.42 }]} />
      <View style={[styles.pauseBar, { width: bar, height: size * 0.42 }]} />
    </View>
  );
}

function noteTitle(text: string) {
  const line = text.split(/\n|\./)[0]?.trim() || text.trim();
  return line.length > 48 ? `${line.slice(0, 45)}...` : line;
}

export default function SageScreen({ onBack }: Props) {
  const { selected } = useParty();
  const partyId = selected?.party.id ?? null;
  // The voice is picked on the Tome. Wizard = ornate persona and red fire, anything else = plain Sage and blue fire.
  const { voice } = useVoice();
  const fancy = voice === "wizard";
  const { s, fs } = useScale();
  const [persona, setPersona] = useState<SagePersona>("sage");
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [noted, setNoted] = useState("");
  const [sheetLine, setSheetLine] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const fontsLoaded = useAppFonts();
  const scroll = useRef<ScrollView>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadWizardVoice();
    return () => {
      Speech.stop();
    };
  }, []);

  // Gentle fade and lift whenever a new reply lands, then bring it into view.
  useEffect(() => {
    if (!reply) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(id);
  }, [reply, fade]);

  const openSheet = () => {
    setSheetError("");
    setSheetOpen(true);
  };
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const ask = async () => {
    const trimmed = question.trim();
    if (trimmed.length < 3) {
      setSheetError("Three characters at least.");
      return;
    }
    Speech.stop();
    setSpeaking(false);
    setError("");
    setReply("");
    setNoted("");
    setSheetLine("");
    setSheetError("");
    setSheetOpen(false);
    setAsked(trimmed);
    setQuestion("");
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
      const prompt = brief ? `${style}Sheet: ${brief}\nQ: ${trimmed}` : `${style}${trimmed}`;
      let data;
      try {
        data = await askSage(prompt, fancy && persona === "sage" ? "wizard" : persona, brief);
      } catch (err) {
        if (!String(errorText(err)).toLowerCase().includes("unknown persona")) throw err;
        data = await askSage(prompt, persona, brief);
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
      // Keep what they typed so they can try again from the pop-up.
      setQuestion(trimmed);
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

  if (!fontsLoaded) return <View style={styles.root} />;

  const sage = persona === "sage";
  const playSize = s(46);
  const replyLabel = sage ? (fancy ? "Wizard" : "Sage") : "Scribe";
  const footNote = [sheetLine, noted].filter(Boolean).join(" ");

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <PageHeader title="SAGE SCRIBE" onBack={onBack} ruleWidth={s(219)} />

      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={[styles.body, { paddingHorizontal: s(spacing.lg), paddingTop: s(spacing.lg), paddingBottom: s(spacing.xl) }]}
        showsVerticalScrollIndicator={false}
      >
        <SageOrb size={s(250)} flame={fancy ? "red" : "blue"} />

        <View style={[styles.actions, { marginTop: s(spacing.xl), gap: s(spacing.md) }]}>
          <TornButton
            label={sage ? "Ask the Sage" : "Tell the Scribe"}
            onPress={openSheet}
            width={170}
            accessibilityHint={sage ? "Opens a box to type your question" : "Opens a box to write what happened"}
          />
          {reply ? (
            <CircleButton size={playSize} onPress={toggleSpeech} accessibilityLabel={speaking ? "Stop the reply" : "Play the reply"}>
              {speaking ? <PauseGlyph size={playSize} bar={s(3.5)} /> : <PlayGlyph size={playSize} />}
            </CircleButton>
          ) : null}
        </View>

        {busy ? (
          <View style={[styles.busy, { marginTop: s(spacing.lg), gap: s(spacing.sm) }]} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.wordmark} />
            <Text style={[styles.busyText, { fontSize: fs(14) }]}>
              {sage ? "Leafing through the tomes..." : "Writing it down..."}
            </Text>
          </View>
        ) : null}

        {error ? (
          <Text style={[styles.error, { fontSize: fs(14), marginTop: s(spacing.md) }]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        {reply ? (
          <Animated.View
            style={[
              styles.full,
              { marginTop: s(spacing.xl) },
              { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [s(10), 0] }) }] },
            ]}
          >
            <ParchmentPanel variant="card" contentStyle={{ paddingHorizontal: s(20), paddingVertical: s(16), gap: s(spacing.sm) }}>
              <View style={[styles.replyHead, { gap: s(spacing.sm) }]}>
                <Text style={[styles.replyLabel, { fontSize: fs(14) }]}>{replyLabel.toUpperCase()}</Text>
                <Rule color={colors.rule} style={styles.flex} />
              </View>
              {asked ? (
                <Text style={[styles.asked, { fontSize: fs(14), lineHeight: fs(19) }]} numberOfLines={2}>
                  {asked}
                </Text>
              ) : null}
              <Text style={[styles.replyBody, { fontSize: fs(17), lineHeight: fs(25) }]} selectable>
                {reply}
              </Text>
              {footNote ? <Text style={[styles.noted, { fontSize: fs(12) }]}>{footNote}</Text> : null}
            </ParchmentPanel>
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* Full-bleed leather band, edge to edge like the Figma (no radius, no side padding). */}
      <View style={[styles.band, { height: s(60) }]}>
        <Image source={leather} style={styles.bandTexture} resizeMode="cover" />
        <ModeToggle persona={persona} onChange={setPersona} />
      </View>

      <SageAskSheet
        visible={sheetOpen}
        persona={persona}
        value={question}
        onChangeText={setQuestion}
        onSend={ask}
        onClose={closeSheet}
        error={sheetError}
      />
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
  flex: { flex: 1 },
  // flexGrow + center: with no reply the orb and button sit balanced between the title and the band;
  // once a reply lands the content grows past the screen and scrolls normally.
  body: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  full: { width: "100%" },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },

  actions: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  pauseBars: { flexDirection: "row", alignItems: "center" },
  pauseBar: { borderRadius: 2, backgroundColor: colors.cream },

  busy: { flexDirection: "row", alignItems: "center" },
  busyText: { fontFamily: fonts.bodyItalic, color: colors.muted },
  error: { fontFamily: fonts.body, color: colors.wordmark, alignSelf: "stretch", textAlign: "center" },

  band: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#4A3F2E",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(26,24,22,0.55)",
  },
  bandTexture: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  toggleHit: { position: "absolute", top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },

  replyHead: { flexDirection: "row", alignItems: "center" },
  replyLabel: { fontFamily: fonts.headingBold, color: colors.wordmark, letterSpacing: 1.2 },
  asked: { fontFamily: fonts.bodyItalic, color: colors.muted },
  replyBody: { fontFamily: fonts.body, color: colors.ink },
  noted: { fontFamily: fonts.bodyItalic, color: colors.panelStroke, textAlign: "right" },
});
