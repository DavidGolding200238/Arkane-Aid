import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useAnimatedValue,
  View,
} from "react-native";
import CircleButton from "./CircleButton";
import ParchmentPanel from "./ParchmentPanel";
import Rule from "./Rule";
import { colors, fonts, inkText, spacing, useScale } from "../theme";

type Props = {
  text: string;
  /** WIZARD / SAGE / SCRIBE */
  label: string;
  /** The question or note it answers, shown small above the reply. */
  asked?: string;
  /** "Sheet attached." / "Written to the Codex." */
  footNote?: string;
  /** Writing speed in characters per second. */
  cps: number;
  /** Set true to finish the writing at once (e.g. the speech has ended). */
  finished?: boolean;
  speaking: boolean;
  onToggleSpeech: () => void;
  /** Told when the quill starts and stops, so the screen can follow it. */
  onWritingChange?: (writing: boolean) => void;
};

const TICK = 40; // ms between writing steps

// Next word end at or after `from`, so the reply appears whole word by whole word.
function wordEnd(text: string, from: number) {
  if (from >= text.length) return text.length;
  const next = text.slice(from).search(/\s/);
  return next === -1 ? text.length : from + next;
}

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

// The Sage's reply on a torn Codex card that lifts off the page with a soft shadow.
// The text writes itself out like a quill, word by word, with a blinking ink caret at
// the end. Tap the card to skip to the full text. Reduce Motion shows it at once.
export default function SageReplyCard({
  text,
  label,
  asked,
  footNote,
  cps,
  finished,
  speaking,
  onToggleSpeech,
  onWritingChange,
}: Props) {
  const { s, fs } = useScale();
  const [shown, setShown] = useState(0);
  const [caretOn, setCaretOn] = useState(true);
  const fade = useAnimatedValue(0);
  const writing = shown < text.length;
  const cpsRef = useRef(cps);
  useEffect(() => {
    cpsRef.current = cps;
  }, [cps]);

  // Fade and lift in when a new reply lands, then start writing.
  useEffect(() => {
    let live = true;
    let id: ReturnType<typeof setInterval> | undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restart the typewriter when a new reply arrives
    setShown(0);
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!live) return;
        if (reduce) {
          setShown(text.length);
          return;
        }
        let progress = 0;
        id = setInterval(() => {
          progress += (cpsRef.current * TICK) / 1000;
          const next = wordEnd(text, Math.floor(progress));
          setShown((current) => Math.max(current, next));
          if (next >= text.length && id) clearInterval(id);
        }, TICK);
      });
    return () => {
      live = false;
      if (id) clearInterval(id);
    };
  }, [text, fade]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- jump to the full text when the parent marks it finished
    if (finished) setShown(text.length);
  }, [finished, text]);

  useEffect(() => {
    onWritingChange?.(writing);
  }, [writing, onWritingChange]);

  // Ink caret blinks while the quill is writing.
  useEffect(() => {
    if (!writing) return;
    const id = setInterval(() => setCaretOn((on) => !on), 420);
    return () => clearInterval(id);
  }, [writing]);

  const playSize = s(36);
  const skip = () => setShown(text.length);

  return (
    <Animated.View
      style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [s(10), 0] }) }] }}
    >
      {/* Shadow plate tucked just inside the torn edge: it casts the soft drop shadow
          (elevation on Android, shadow props on iOS) while the torn art stays on top. */}
      <View pointerEvents="none" style={[styles.plate, { top: s(5), left: s(5), right: s(5), bottom: s(5), borderRadius: s(6) }]} />
      <Pressable
        onPress={writing ? skip : undefined}
        disabled={!writing}
        accessibilityRole={writing ? "button" : undefined}
        accessibilityHint={writing ? "Shows the whole reply" : undefined}
        style={styles.above}
      >
        <ParchmentPanel
          variant="card"
          contentStyle={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(18), gap: s(spacing.sm) }}
        >
          <View style={[styles.head, { gap: s(spacing.sm) }]}>
            <Text style={[styles.label, { fontSize: fs(14) }]}>{label.toUpperCase()}</Text>
            <Rule color={colors.rule} style={styles.flex} />
            <CircleButton size={playSize} onPress={onToggleSpeech} accessibilityLabel={speaking ? "Stop the reply" : "Play the reply"}>
              {speaking ? <PauseGlyph size={playSize} bar={s(3)} /> : <PlayGlyph size={playSize} />}
            </CircleButton>
          </View>
          {asked ? (
            <Text style={[styles.asked, { fontSize: fs(14), lineHeight: fs(19) }]} numberOfLines={2}>
              {asked}
            </Text>
          ) : null}
          <Text
            style={[styles.body, { fontSize: fs(17), lineHeight: fs(25) }]}
            selectable={!writing}
            accessibilityLabel={text}
          >
            {text.slice(0, shown)}
            {writing ? <Text style={[styles.caret, !caretOn && styles.caretOff]}>{" |"}</Text> : null}
          </Text>
          {footNote && !writing ? <Text style={[styles.noted, { fontSize: fs(12) }]}>{footNote}</Text> : null}
        </ParchmentPanel>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  plate: {
    position: "absolute",
    backgroundColor: colors.panel,
    elevation: 6,
    shadowColor: colors.shadowBrown,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  // On Android a higher elevation always draws on top, so the card out-ranks its plate.
  // It has no background of its own, so it casts no second shadow.
  above: { elevation: 7 },
  head: { flexDirection: "row", alignItems: "center" },
  label: { fontFamily: fonts.headingBold, color: colors.wordmark, letterSpacing: 1.2, ...inkText.red },
  asked: { fontFamily: fonts.bodyItalic, color: colors.muted },
  body: { fontFamily: fonts.body, color: colors.ink },
  caret: { color: colors.wordmark, fontFamily: fonts.headingBold },
  caretOff: { color: "transparent" },
  noted: { fontFamily: fonts.bodyItalic, color: colors.panelStroke, textAlign: "right" },
  pauseBars: { flexDirection: "row", alignItems: "center" },
  pauseBar: { borderRadius: 2, backgroundColor: colors.cream },
});
