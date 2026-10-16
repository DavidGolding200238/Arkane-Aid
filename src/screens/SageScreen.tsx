import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import PageHeader from "../components/PageHeader";
import ScreenVignette from "../components/ScreenVignette";
import SageInputBar from "../components/SageInputBar";
import SageReplyCard from "../components/SageReplyCard";
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

const speechRate = (fancy: boolean) => (fancy ? 0.86 : 0.92);

// onEnd runs however the speech stops; onDone only when it reached the end on its own.
function speakReply(text: string, fancy: boolean, onEnd: () => void, onDone?: () => void) {
  Speech.stop();
  Speech.speak(text, {
    language: "en",
    rate: speechRate(fancy),
    pitch: 1,
    voice: fancy && wizardVoice ? wizardVoice : undefined,
    onDone: () => {
      onEnd();
      onDone?.();
    },
    onStopped: onEnd,
    onError: onEnd,
  });
}

// How fast the quill writes, in characters per second, so it roughly keeps pace with the
// speech: device voices read about 2.9 words a second at rate 1. Clamped so short replies
// don't crawl and long ones don't race. When the speech finishes, the card completes anyway.
function writingSpeed(text: string, fancy: boolean) {
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  const seconds = words / (2.9 * speechRate(fancy));
  return Math.min(60, Math.max(20, text.length / seconds));
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
  const [replyDone, setReplyDone] = useState(false);
  const [writing, setWriting] = useState(false);
  const scroll = useRef<ScrollView>(null);
  // Follow the quill down the page until the user scrolls by hand.
  const follow = useRef(false);
  const glow = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadWizardVoice();
    return () => {
      Speech.stop();
    };
  }, []);

  // A new reply: follow the writing down the page. The card sits below everything else,
  // so the orb above never moves; the page only scrolls.
  useEffect(() => {
    if (reply) follow.current = true;
  }, [reply]);

  const onWritingChange = useCallback((next: boolean) => setWriting(next), []);

  // The status line breathes softly while the Sage is thinking or speaking.
  useEffect(() => {
    if (!busy && !speaking && !writing) {
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
  }, [busy, speaking, writing, glow]);

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
    setReplyDone(false);
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
      speakReply(
        text,
        fancy,
        () => setSpeaking(false),
        () => setReplyDone(true),
      );
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
  const replyLabel = sage ? (fancy ? "Wizard" : "Sage") : "Scribe";
  const footNote = [sheetLine, noted].filter(Boolean).join(" ");
  const status = writing && !speaking ? (sage ? "The quill writes..." : "The Scribe writes it down...") : statusLine(persona, busy, speaking, fancy);

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />
      <ScreenVignette />

      <PageHeader title="Sage Scribe" onBack={onBack} ruleWidth={s(219)} />

      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={[styles.body, { paddingHorizontal: s(spacing.lg), paddingTop: s(spacing.xs), paddingBottom: s(spacing.xl) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => {
          follow.current = false;
        }}
        onContentSizeChange={() => {
          if (follow.current && reply) scroll.current?.scrollToEnd({ animated: true });
        }}
      >
        <SageOrb size={s(250)} flame={fancy ? "red" : "blue"} />

        <Animated.Text
          style={[styles.status, { fontSize: fs(16), lineHeight: fs(22), marginTop: s(spacing.md), opacity: glow }]}
          numberOfLines={1}
          accessibilityLiveRegion="polite"
        >
          {status}
        </Animated.Text>

        <View style={{ marginTop: s(spacing.xxl) }}>
          <SageModeButtons persona={persona} onChange={changeMode} />
        </View>

        {reply ? (
          <View style={[styles.full, { marginTop: s(spacing.xxl) }]}>
            <SageReplyCard
              text={reply}
              label={replyLabel}
              asked={asked}
              footNote={footNote}
              cps={writingSpeed(reply, fancy)}
              finished={replyDone}
              speaking={speaking}
              onToggleSpeech={toggleSpeech}
              onWritingChange={onWritingChange}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Docked typing bar, always just above the keyboard or the tab bar. */}
      <View style={{ paddingHorizontal: s(spacing.lg), paddingTop: s(spacing.sm), paddingBottom: s(spacing.md) }}>
        {error ? (
          <Text style={[styles.error, { fontSize: fs(13), marginBottom: s(spacing.sm) }]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <SageInputBar
          persona={persona}
          value={question}
          onChangeText={(text) => {
            setQuestion(text);
            if (error) setError("");
          }}
          onSend={ask}
          busy={busy}
        />
      </View>
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
  error: { fontFamily: fonts.body, color: colors.wordmark, textAlign: "center" },
});
