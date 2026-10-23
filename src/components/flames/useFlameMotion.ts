import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, useAnimatedValue } from "react-native";

export type FlameMood = "idle" | "listening" | "thinking" | "speaking";
export type FlameColour = "red" | "blue" | "green";
export const FLAME_COLOURS: readonly FlameColour[] = ["red", "blue", "green"];

// How each mood shows. The fire loop itself plays at one calm speed (it is a natively decoded
// animated image, see FireLoop); the mood shows in the thin heat glow at the orb's rim (strength
// 0..1, breathing between glowLow and glowHigh every pulseMs) and in how often embers rise.
// The fire never scales or fades, so the orb edge stays covered exactly as aligned.
export const MOODS: Record<FlameMood, { glowLow: number; glowHigh: number; pulseMs: number; emberGapMs: [number, number] }> = {
  // Slow and calm, a faint glow breathing slowly, few embers.
  idle: { glowLow: 0.3, glowHigh: 0.45, pulseMs: 3000, emberGapMs: [900, 2600] },
  // Ready for the dev build's voice input: a little livelier than idle.
  listening: { glowLow: 0.4, glowHigh: 0.55, pulseMs: 2000, emberGapMs: [500, 1600] },
  // Thinking: a brighter glow pulsing quicker, more embers.
  thinking: { glowLow: 0.5, glowHigh: 0.7, pulseMs: 1400, emberGapMs: [200, 900] },
  // Speaking: a gentle, steady glow pulse (no random flicker).
  speaking: { glowLow: 0.45, glowHigh: 0.65, pulseMs: 1100, emberGapMs: [300, 1100] },
};

const BLEND_MS = 500; // mood to mood
const COLOUR_MS = 600; // one fire colour to another

/** Reduce Motion from the system settings, kept up to date. */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => live && setReduce(value))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/**
 * The colour fade between fires, as native-driven Animated values.
 * tint: how much of each colour shows, 0..1 (red = Wizard, blue = Plain, green = Bard).
 * under: while the colour changes, the old colour, drawn solid beneath the new one as it
 *   fades in (null once the fade is done, so only one fire loop plays).
 */
export function useFlameTint(colour: FlameColour, reduce: boolean, fadeMs = COLOUR_MS) {
  const red = useAnimatedValue(colour === "red" ? 1 : 0);
  const blue = useAnimatedValue(colour === "blue" ? 1 : 0);
  const green = useAnimatedValue(colour === "green" ? 1 : 0);
  const [tint] = useState<Record<FlameColour, Animated.Value>>(() => ({ red, blue, green }));
  // The colour the last fade finished on. While it differs from colour, it is the one underneath.
  const [settled, setSettled] = useState(colour);

  useEffect(() => {
    const fade = Animated.parallel(
      FLAME_COLOURS.map((c) =>
        Animated.timing(tint[c], {
          toValue: c === colour ? 1 : 0,
          duration: reduce ? 0 : fadeMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    );
    fade.start(({ finished }) => finished && setSettled(colour));
    return () => fade.stop();
  }, [tint, colour, reduce, fadeMs]);

  return { tint, under: settled === colour ? null : settled };
}

/**
 * All the flame motion as native-driven Animated values, so nothing re-renders per frame.
 * tint / under: the colour fade (see useFlameTint), for the fire, glow and embers.
 * glow: heat glow strength.
 */
export function useFlameMotion(mood: FlameMood, colour: FlameColour, reduce: boolean) {
  const { tint, under } = useFlameTint(colour, reduce);
  const glow = useAnimatedValue(MOODS.idle.glowLow);
  const settings = reduce ? MOODS.idle : MOODS[mood];

  // Mood: blend the glow to the new level, then breathe gently. Native-driven loop, no JS timers.
  useEffect(() => {
    let live = true;
    let loop: Animated.CompositeAnimation | undefined;
    const s = settings;
    const to = (toValue: number, duration: number) =>
      Animated.timing(glow, { toValue, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
    to(s.glowLow, BLEND_MS).start(({ finished }) => {
      if (!finished || !live || reduce) return;
      loop = Animated.loop(Animated.sequence([to(s.glowHigh, s.pulseMs), to(s.glowLow, s.pulseMs)]));
      loop.start();
    });
    return () => {
      live = false;
      loop?.stop();
      glow.stopAnimation();
    };
  }, [reduce, settings, glow]);

  return { tint, under, glow, emberGapMs: settings.emberGapMs };
}
