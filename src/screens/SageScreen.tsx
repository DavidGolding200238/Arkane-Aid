import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
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
import SageOrb from "../components/SageOrb";
import SageModeButtons from "../components/SageModeButtons";
import { useParty } from "../context/PartyContext";
import { useVoice } from "../context/VoiceContext";
import { loadCharacter, loadEquipment, loadTraits, needsSheet, sheetBrief } from "../lib/character";
import { addCodexEntry } from "../lib/codex";
import { askSage, type SagePersona } from "../lib/sage";
import { errorText } from "../lib/parties";
import { colors, fonts, spacing, useAppFonts, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");

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

// One immersive line under the orb. It never changes height, so nothing below it moves.
function statusLine(persona: SagePersona, busy: boolean, speaking: boolean, fancy: boolean) {
  const sage = persona === "sage";
  if (busy) return sage ? "Leafing through the tomes..." : "The quill scratches across the page...";
  if (speaking) return sage ? (fancy ? "The Wizard speaks..." : "The Sage speaks...") : "The Scribe reads it back...";
  return sage ? "The Sage awaits your question..." : "The Scribe's quill is ready...";
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
  const fontsLoaded = useAppFonts();
  const scroll = useRef<ScrollView>(null);
  const inputY = useRef(0);
  const replyY = useRef(0);
  const fade = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadWizardVoice();
    return () => {
      Speech.stop();
    };
  }, []);

  // Gentle fade and lift whenever a new reply lands, then scroll down to it.
  // The reply sits below everything else, so the orb above never moves.
  useEffect(() => {
    if (!reply) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const id = setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, replyY.current - s(spacing.xl)), animated: true }), 160);
    return () => clearTimeout(id);
  }, [reply, fade, s]);

  // The status line breathes softly while the Sage is thinking or speaking.
  useEffect(() => {
    if (!busy && !speaking) {
      glow.stopAnimation();
      glow.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.45, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [busy, speaking, glow]);

  const changeMode = (next: SagePersona) => {
    setPersona(next);
    setError("");
  };

  const ask = async () => {
    const trimmed = question.trim();
    if (trimmed.length < 3) {
      setError(persona === "sage" ? "Ask a real question. Three characters at least." : "Write a little more. Three characters at least.");
      return;
    }
    Speech.stop();
    setSpeaking(false);
    setError("");
    setReply("");
    setNoted("");
    setSheetLine("");
    Keyboard.dismiss();
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
      // Keep what they typed so they can try again.
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
  const playSize = s(36);
  const replyLabel = sage ? (fancy ? "Wizard" : "Sage") : "Scribe";
  const footNote = [sheetLine, noted].filter(Boolean).join(" ");
  const status = statusLine(persona, busy, speaking, fancy);

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <PageHeader title="Sage Scribe" onBack={onBack} ruleWidth={s(219)} />

      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={[styles.body, { paddingHorizontal: s(spacing.lg), paddingTop: s(spacing.xs), paddingBottom: s(spacing.xxl) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SageOrb size={s(250)} flame={fancy ? "red" : "blue"} />

        <Animated.Text
          style={[styles.status, { fontSize: fs(16), lineHeight: fs(22), marginTop: s(spacing.sm), opacity: glow }]}
          numberOfLines={1}
          accessibilityLiveRegion="polite"
        >
          {status}
        </Animated.Text>

        <View style={{ marginTop: s(spacing.xl) }}>
          <SageModeButtons persona={persona} onChange={changeMode} />
        </View>

        <View
          style={[styles.full, { marginTop: s(spacing.xl) }]}
          onLayout={(event) => {
            inputY.current = event.nativeEvent.layout.y;
          }}
        >
          <ParchmentPanel
            variant="ledger"
            contentStyle={{ paddingHorizontal: s(18), paddingTop: s(14), paddingBottom: s(12), gap: s(spacing.sm) }}
          >
            <TextInput
              style={[styles.input, { fontSize: fs(16), lineHeight: fs(22), minHeight: s(66), maxHeight: s(140) }]}
              multiline
              placeholder={sage ? "Ask a ruling..." : "What just happened at the table?"}
              placeholderTextColor={colors.placeholder}
              value={question}
              onChangeText={(text) => {
                setQuestion(text);
                if (error) setError("");
              }}
              onFocus={() => {
                // Bring the field up to just under the orb's status, so it clears the keyboard.
                setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, inputY.current - s(spacing.xl)), animated: true }), 250);
              }}
              accessibilityLabel={sage ? "Question for the Sage" : "Note for the Scribe"}
            />
            <View style={styles.inputFoot}>
              <ThemedButton label={sage ? "Ask" : "Note"} onPress={ask} busy={busy} size="small" style={{ minWidth: s(84) }} />
            </View>
          </ParchmentPanel>
        </View>

        {error ? (
          <Text style={[styles.error, { fontSize: fs(14), marginTop: s(spacing.sm) }]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        {reply ? (
          <Animated.View
            onLayout={(event) => {
              replyY.current = event.nativeEvent.layout.y;
            }}
            style={[
              styles.full,
              { marginTop: s(spacing.lg) },
              { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [s(10), 0] }) }] },
            ]}
          >
            <ParchmentPanel variant="card" contentStyle={{ paddingHorizontal: s(20), paddingVertical: s(16), gap: s(spacing.sm) }}>
              <View style={[styles.replyHead, { gap: s(spacing.sm) }]}>
                <Text style={[styles.replyLabel, { fontSize: fs(14) }]}>{replyLabel.toUpperCase()}</Text>
                <Rule color={colors.rule} style={styles.flex} />
                <CircleButton size={playSize} onPress={toggleSpeech} accessibilityLabel={speaking ? "Stop the reply" : "Play the reply"}>
                  {speaking ? <PauseGlyph size={playSize} bar={s(3)} /> : <PlayGlyph size={playSize} />}
                </CircleButton>
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
  flex: { flex: 1 },
  // Top-aligned on purpose: the orb stays put when the reply card appears below.
  body: { flexGrow: 1, alignItems: "center" },
  full: { width: "100%" },

  status: { fontFamily: fonts.bodyItalic, color: colors.muted, letterSpacing: 0.4, textAlign: "center", includeFontPadding: false },

  input: { fontFamily: fonts.body, color: colors.ink, textAlignVertical: "top", padding: 0 },
  inputFoot: { flexDirection: "row", justifyContent: "flex-end" },
  error: { fontFamily: fonts.body, color: colors.wordmark, alignSelf: "stretch", textAlign: "center" },

  pauseBars: { flexDirection: "row", alignItems: "center" },
  pauseBar: { borderRadius: 2, backgroundColor: colors.cream },

  replyHead: { flexDirection: "row", alignItems: "center" },
  replyLabel: { fontFamily: fonts.headingBold, color: colors.wordmark, letterSpacing: 1.2 },
  asked: { fontFamily: fonts.bodyItalic, color: colors.muted },
  replyBody: { fontFamily: fonts.body, color: colors.ink },
  noted: { fontFamily: fonts.bodyItalic, color: colors.panelStroke, textAlign: "right" },
});
