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
import { revealCount } from "../lib/typing";
import { colors, fonts, inkText, spacing, useScale } from "../theme";

type Props = {
  text: string;
  /** WIZARD / SAGE / SCRIBE */
  label: string;
  /** The question or note it answers, shown small above the reply. */
  asked?: string;
  /** "Sheet attached." / "Written to the Codex." */
  footNote?: string;
  /** Where the ruling comes from, e.g. "Alignment, p. 21". Shown small under the reply, never spoken. */
  source?: string;
  speaking: boolean;
  /** Play / stop the spoken reply. Left out when reading aloud is off on the Tome: no button. */
  onToggleSpeech?: () => void;
  /** Told when the quill starts and stops, so the screen can follow it. */
  onWritingChange?: (writing: boolean) => void;
  /** How far the writing has got, 0 to 1, so the screen can scroll along with it. */
  onProgress?: (fraction: number) => void;
};

// Re-render at most about 30 times a second, a couple of letters at a time: smooth to the eye
// and light on a phone. The letters themselves come from the clock (revealCount), not the frames.
const MIN_STEP_MS = 32;

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
// The text writes itself out letter by letter at a steady pace (src/lib/typing.ts), the same
// for every persona and whether or not it is read aloud; it never waits on the speech. The
// rest of the reply is already laid out in transparent ink, so lines never jump or re-wrap
// as letters appear. Tap the card to skip to the full text. Reduce Motion shows it at once.
export default function SageReplyCard({
  text,
  label,
  asked,
  footNote,
  source,
  speaking,
  onToggleSpeech,
  onWritingChange,
  onProgress,
}: Props) {
  const { s, fs } = useScale();
  const [shown, setShown] = useState(0);
  const fade = useAnimatedValue(0);
  const writing = shown < text.length;
  const progressRef = useRef(onProgress);
  useEffect(() => {
    progressRef.current = onProgress;
  }, [onProgress]);

  // Fade and lift in when a new reply lands, then start writing.
  useEffect(() => {
    let live = true;
    let frame: number | undefined;
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
        const start = Date.now();
        let last = 0;
        let lastAt = start;
        const step = () => {
          if (!live) return;
          const now = Date.now();
          const next = revealCount(now - start, text.length, text);
          if (next >= text.length || (next > last && (next - last >= 2 || now - lastAt >= MIN_STEP_MS))) {
            last = next;
            lastAt = now;
            setShown((current) => Math.max(current, next));
            progressRef.current?.(next / text.length);
          }
          if (next < text.length) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      });
    return () => {
      live = false;
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [text, fade]);

  useEffect(() => {
    onWritingChange?.(writing);
  }, [writing, onWritingChange]);

  const playSize = s(36);
  const skip = () => {
    setShown(text.length);
    onProgress?.(1);
  };

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
          <View style={[styles.head, { gap: s(spacing.sm), minHeight: playSize }]}>
            <Text style={[styles.label, { fontSize: fs(14) }]}>{label.toUpperCase()}</Text>
            <Rule color={colors.rule} style={styles.flex} />
            {onToggleSpeech ? (
              <CircleButton size={playSize} onPress={onToggleSpeech} accessibilityLabel={speaking ? "Stop the reply" : "Play the reply"}>
                {speaking ? <PauseGlyph size={playSize} bar={s(3)} /> : <PlayGlyph size={playSize} />}
              </CircleButton>
            ) : null}
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
            {writing ? <Text style={styles.unwritten}>{text.slice(shown)}</Text> : null}
          </Text>
          {source && !writing ? (
            <Text
              style={[styles.source, { fontSize: fs(12), lineHeight: fs(16) }]}
              accessibilityLabel={`Source: ${source.replace(/\bp\. ?/g, "page ")}, SRD 5.2.1`}
            >
              Source: {source.replace(/, p\. ?(\d+)/g, " (SRD p.$1)")}
            </Text>
          ) : null}
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
  // The not-yet-written rest: laid out but invisible, so the card is full size from the start.
  unwritten: { color: "transparent" },
  source: { fontFamily: fonts.bodyItalic, color: colors.muted, opacity: 0.85 },
  noted: { fontFamily: fonts.bodyItalic, color: colors.panelStroke, textAlign: "right" },
  pauseBars: { flexDirection: "row", alignItems: "center" },
  pauseBar: { borderRadius: 2, backgroundColor: colors.cream },
});
