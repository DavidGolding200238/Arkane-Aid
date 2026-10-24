import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  useAnimatedValue,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PageHeader from "../components/PageHeader";
import PageFade from "../components/PageFade";
import ScreenVignette from "../components/ScreenVignette";
import SageInputBar from "../components/SageInputBar";
import SageReplyCard from "../components/SageReplyCard";
import SageOrb from "../components/SageOrb";
import SageModeButtons from "../components/SageModeButtons";
import { useParty } from "../context/PartyContext";
import { useVoice, type VoiceId } from "../context/VoiceContext";
import type { FlameColour } from "../components/flames/useFlameMotion";
import { loadCharacter, loadEquipment, loadTraits, needsSheet, sheetBrief } from "../lib/character";
import { addCodexEntry } from "../lib/codex";
import { askSage, type SageMode, type SagePersona, type SageTurn } from "../lib/sage";
import { prepareDeviceVoices, speak, speechPace, stopSpeaking, type SpeakerVoice } from "../lib/voice";
import { errorText } from "../lib/parties";
import { colors, fonts, spacing, useAppFonts, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");
// The orb's fire for each voice picked on the Tome.
const FLAME: Record<VoiceId, FlameColour> = { wizard: "red", plain: "blue", bard: "green" };

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

// How fast the quill writes, in characters per second, so it roughly keeps pace with the
// speech (see speechPace). Clamped so short replies don't crawl and long ones don't race.
// When the speech finishes, the card completes anyway.
function writingSpeed(text: string, voice: SpeakerVoice) {
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  const seconds = words / speechPace(voice);
  return Math.min(60, Math.max(20, text.length / seconds));
}

// One immersive line under the orb. It never changes height, so nothing below it moves.
function statusLine(mode: SageMode, busy: boolean, speaking: boolean, fancy: boolean) {
  if (mode === "scribe") {
    if (busy) return "The quill scratches across the page...";
    return speaking ? "The Scribe reads it back..." : "The Scribe's quill is ready...";
  }
  if (mode === "bard") {
    if (busy) return "The Bard tunes the lute...";
    return speaking ? "The Bard sings..." : "The Bard awaits your question...";
  }
  if (busy) return "Leafing through the tomes...";
  if (speaking) return fancy ? "The Wizard speaks..." : "The Arbiter speaks...";
  return fancy ? "The Sage awaits your question..." : "The Arbiter awaits your question...";
}

function noteTitle(text: string) {
  const line = text.split(/\n|\./)[0]?.trim() || text.trim();
  return line.length > 48 ? `${line.slice(0, 45)}...` : line;
}

export default function SageScreen({ onBack }: Props) {
  const { selected } = useParty();
  const partyId = selected?.party.id ?? null;
  // The voice is picked on the Tome. Wizard = ornate persona and red fire, Arbiter (id "plain") = short rulings and
  // blue fire, Bard = the Bard persona and green fire, answering through the same Sage button.
  // readAloud off (Tome switch): replies are only written, never spoken.
  const { voice, readAloud } = useVoice();
  const fancy = voice === "wizard";
  const { s, fs } = useScale();
  const [persona, setPersona] = useState<SagePersona>("sage");
  const mode: SageMode = persona === "scribe" ? "scribe" : voice === "bard" ? "bard" : "sage";
  const speaker: SpeakerVoice = mode === "sage" ? (fancy ? "wizard" : "sage") : mode;
  // Short memory so follow-ups work ("how long does it last?"): the last 3 exchanges with this
  // voice. Kept in this screen only, so it is gone when the player leaves the Sage, switches
  // Sage/Scribe or changes voice. Never saved. The Scribe gets none.
  const memoryKey = `${mode}:${voice}`;
  const [memory, setMemory] = useState<{ key: string; turns: SageTurn[] }>({ key: "", turns: [] });
  const history = memory.key === memoryKey ? memory.turns : [];
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [reply, setReply] = useState("");
  const [source, setSource] = useState("");
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
  const glow = useAnimatedValue(1);
  // Layout of the page, for the soft fades: screen size, header height, and the scroll area.
  const [screen, setScreen] = useState({ w: 0, h: 0 });
  const insets = useSafeAreaInsets();
  // Start from PageHeader's own maths (top padding + 44 dp button + 8 dp) so the orb doesn't
  // shift when the real height is measured.
  const [headerH, setHeaderH] = useState(() => Math.max(s(48), insets.top + s(8)) + s(44) + s(8));
  const [scrollBox, setScrollBox] = useState({ y: 0, h: 0 });

  // A reply can arrive after the player has left this screen or switched reading aloud off;
  // ask() checks these refs after its awaits instead of the values it started with.
  const mounted = useRef(true);
  const readAloudNow = useRef(readAloud);

  useEffect(() => {
    mounted.current = true;
    prepareDeviceVoices();
    return () => {
      mounted.current = false;
      stopSpeaking();
    };
  }, []);

  // Switched off on the Tome while something was being read: stop and leave the speaking state.
  useEffect(() => {
    readAloudNow.current = readAloud;
    if (readAloud) return;
    stopSpeaking();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leave the speaking state when reading aloud is switched off
    setSpeaking(false);
  }, [readAloud]);

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
    setMemory({ key: "", turns: [] });
    setError("");
  };

  const ask = async () => {
    const trimmed = question.trim();
    if (trimmed.length < 3) {
      setError(persona === "sage" ? "Ask a real question. Three characters at least." : "Write a little more. Three characters at least.");
      return;
    }
    stopSpeaking();
    setSpeaking(false);
    setError("");
    setReply("");
    setSource("");
    setReplyDone(false);
    setNoted("");
    setSheetLine("");
    Keyboard.dismiss();
    setAsked(trimmed);
    setQuestion("");
    setBusy(true);
    try {
      let brief = "";
      if (mode !== "scribe" && needsSheet(trimmed)) {
        const character = await loadCharacter(partyId);
        const gear = character ? await loadEquipment(character.id) : [];
        const traits = character ? await loadTraits(character.id) : [];
        brief = sheetBrief(character, gear, traits);
        setSheetLine(brief ? "Sheet attached." : "No sheet yet.");
      }
      const data = await askSage({
        question: trimmed,
        mode,
        style: fancy ? "wizard" : "plain",
        sheet: brief,
        partyId,
        history: mode === "scribe" ? [] : history,
      });
      const text = cleanReply(data.reply);
      // Left the Sage while waiting: nothing to show, and no speech on another screen.
      if (!mounted.current) return;
      if (!text) {
        setError("The Sage had nothing to say. Try asking another way.");
        return;
      }
      setReply(text);
      setSource(mode === "scribe" ? "" : data.source);
      if (mode !== "scribe") setMemory({ key: memoryKey, turns: [...history, { q: trimmed, a: text }].slice(-3) });
      if (persona === "scribe") {
        if (!partyId) {
          setError("Join a party first. The note needs a table to land in.");
        } else {
          await addCodexEntry(partyId, "note", noteTitle(trimmed), text, "scribe");
          if (!mounted.current) return;
          setNoted("Written to the Codex.");
        }
      }
      if (readAloudNow.current) {
        setSpeaking(true);
        speak(text, speaker, { onEnd: () => setSpeaking(false), onDone: () => setReplyDone(true) });
      }
    } catch (err) {
      if (!mounted.current) return;
      setError(errorText(err));
      // Keep what they typed so they can try again.
      setQuestion(trimmed);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const toggleSpeech = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (!reply || !readAloud) return;
    setSpeaking(true);
    speak(reply, speaker, { onEnd: () => setSpeaking(false) });
  };

  if (!fontsLoaded) return <View style={styles.root} />;

  const sage = persona === "sage";
  const replyLabel = mode === "bard" ? "Bard" : sage ? (fancy ? "Wizard" : "Arbiter") : "Scribe";
  const footNote = [sheetLine, noted].filter(Boolean).join(" ");
  // Fade sizes. Top: solid paper from the very top of the screen (behind the status bar and the
  // header) down to the header's bottom edge, just below the title underline, then a short fade.
  // The orb starts below that fade. Bottom: about one line of reply text, fading up from the
  // typing box's area; everything from there down (the box, beside it, below it) is solid paper.
  const topFadeTail = s(12);
  const gapUnderHeader = topFadeTail; // the orb itself stays clear of the fade
  const bottomFade = fs(25);
  const dockTop = scrollBox.y + scrollBox.h; // where the scroll area ends and the typing box area begins
  const bottomFadeTop = dockTop - bottomFade;
  const bottomFadeH = scrollBox.h > 0 && screen.h > 0 ? screen.h - bottomFadeTop : 0;
  const status = writing && !speaking ? (sage ? "The quill writes..." : "The Scribe writes it down...") : statusLine(mode, busy, speaking, fancy);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior="padding"
      onLayout={(e) => setScreen({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      {/* The page scrolls from the very top, under a header with no background of its own, so the
          orb's glow is never cut off by a strip; a fade made of the same paper hides what scrolls
          behind the title. */}
      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={[
          styles.body,
          {
            paddingHorizontal: s(spacing.lg),
            paddingTop: headerH + gapUnderHeader,
            // Room for the last reply line to scroll fully clear of the bottom fade.
            paddingBottom: s(spacing.xl) + bottomFade,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setScrollBox({ y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
        onScrollBeginDrag={() => {
          follow.current = false;
        }}
        onContentSizeChange={() => {
          if (follow.current && reply) scroll.current?.scrollToEnd({ animated: true });
        }}
      >
        <SageOrb size={s(250)} flame={FLAME[voice]} mood={busy ? "thinking" : speaking ? "speaking" : "idle"} />

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
              source={source}
              cps={writingSpeed(reply, speaker)}
              finished={replyDone}
              speaking={speaking}
              onToggleSpeech={readAloud ? toggleSpeech : undefined}
              onWritingChange={onWritingChange}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Fade under the title: solid paper from the top of the screen to below the underline,
          then melting away just above the orb. */}
      <PageFade
        direction="down"
        top={0}
        height={headerH + topFadeTail}
        solid={headerH / (headerH + topFadeTail)}
        screenWidth={screen.w}
        screenHeight={screen.h}
      />
      {/* Solid paper behind and around the docked typing box down to the bottom of the screen,
          fading upward over one line above it. */}
      <PageFade
        direction="up"
        top={bottomFadeTop}
        height={bottomFadeH}
        solid={bottomFadeH > 0 ? (bottomFadeH - bottomFade) / bottomFadeH : 0}
        screenWidth={screen.w}
        screenHeight={screen.h}
      />
      <ScreenVignette />
      <PageHeader
        title="Sage Scribe"
        onBack={onBack}
        ruleWidth={s(219)}
        style={styles.header}
        onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
      />

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
  header: { position: "absolute", top: 0, left: 0, right: 0 },
  // Top-aligned on purpose: the orb stays put when the reply card appears below.
  body: { flexGrow: 1, alignItems: "center" },
  full: { width: "100%" },
  status: { fontFamily: fonts.bodyItalic, color: colors.muted, letterSpacing: 0.4, textAlign: "center", includeFontPadding: false },
  error: { fontFamily: fonts.body, color: colors.wordmark, textAlign: "center" },
});
