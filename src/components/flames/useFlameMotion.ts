import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

export type FlameMood = "idle" | "listening" | "thinking" | "speaking";
export type FlameColour = "red" | "blue";

// How each mood moves. frameMs = time per fire frame (each frame crossfades into the next over
// this whole time, so higher = slower and calmer). glow = heat glow strength (0..1), breathing
// between glowLow and glowHigh every pulseMs. The fire itself never scales or fades, so the orb
// edge stays covered exactly as aligned. Ember timings are unchanged from the first version.
export const MOODS: Record<FlameMood, { frameMs: number; glowLow: number; glowHigh: number; pulseMs: number; emberGapMs: [number, number] }> = {
  // Slow and calm, a faint glow breathing slowly, few embers.
  idle: { frameMs: 320, glowLow: 0.3, glowHigh: 0.45, pulseMs: 3000, emberGapMs: [900, 2600] },
  // Ready for the dev build's voice input: a little livelier than idle.
  listening: { frameMs: 260, glowLow: 0.4, glowHigh: 0.55, pulseMs: 2000, emberGapMs: [500, 1600] },
  // Thinking: moderately faster flames, a brighter glow pulsing quicker, more embers.
  thinking: { frameMs: 200, glowLow: 0.5, glowHigh: 0.7, pulseMs: 1400, emberGapMs: [200, 900] },
  // Speaking: a gentle, steady glow pulse (no random flicker).
  speaking: { frameMs: 240, glowLow: 0.45, glowHigh: 0.65, pulseMs: 1100, emberGapMs: [300, 1100] },
};

const FRAMES = 8;
const BLEND_MS = 500; // mood to mood
const COLOUR_MS = 600; // red <-> blue

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
 * All the flame motion as native-driven Animated values, so nothing re-renders per frame.
 * phase: 0..8 frame position for FireStack. blue: 0 = red fire, 1 = blue fire.
 * glow: heat glow strength.
 */
export function useFlameMotion(mood: FlameMood, colour: FlameColour, reduce: boolean) {
  const phase = useRef(new Animated.Value(0)).current;
  const blue = useRef(new Animated.Value(colour === "blue" ? 1 : 0)).current;
  const glow = useRef(new Animated.Value(MOODS.idle.glowLow)).current;

  const settings = reduce ? MOODS.idle : MOODS[mood];

  // Fire frames: one native loop 0 -> 8, repeated on the UI thread with no trip back to JS
  // (the orb's 3D render keeps the JS thread busy, so anything JS-timed would stutter).
  // When the mood changes speed, finish the current pass at the new speed, then loop again.
  useEffect(() => {
    let live = true;
    let loop: Animated.CompositeAnimation | undefined;
    const ms = settings.frameMs;
    const startLoop = () => {
      if (!live) return;
      phase.setValue(0);
      loop = Animated.loop(
        Animated.timing(phase, { toValue: FRAMES, duration: FRAMES * ms, easing: Easing.linear, useNativeDriver: true }),
      );
      loop.start();
    };
    phase.stopAnimation((value) => {
      const from = typeof value === "number" ? value % FRAMES : 0;
      if (from < 0.01) {
        startLoop();
        return;
      }
      Animated.timing(phase, { toValue: FRAMES, duration: (FRAMES - from) * ms, easing: Easing.linear, useNativeDriver: true }).start(
        ({ finished }) => finished && startLoop(),
      );
    });
    return () => {
      live = false;
      loop?.stop();
      phase.stopAnimation();
    };
  }, [phase, settings.frameMs]);

  // Colour fade between the red (Wizard) and blue (Plain) fire, glow and embers.
  useEffect(() => {
    Animated.timing(blue, {
      toValue: colour === "blue" ? 1 : 0,
      duration: reduce ? 0 : COLOUR_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [blue, colour, reduce]);

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

  return { phase, blue, glow, emberGapMs: settings.emberGapMs };
}
