import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

export type FlameMood = "idle" | "listening" | "thinking" | "speaking";
export type FlameColour = "red" | "blue";

// How each mood moves. frameMs = time per fire frame (lower = faster flames).
// flare = opacity of the larger flare copy of the fire drawn over the base fire, flareScale its
// size from the orb centre. The base fire never scales, so the orb edge stays covered exactly as
// before; the flare only adds flame on the outside. glow = strength of the heat glow (0..1).
export const MOODS: Record<FlameMood, { frameMs: number; flare: number; flareScale: number; glowLow: number; glowHigh: number; pulseMs: number; emberGapMs: [number, number] }> = {
  // Slow, calm and low: no flare, a faint glow breathing slowly, few embers.
  idle: { frameMs: 165, flare: 0, flareScale: 1.0, glowLow: 0.28, glowHigh: 0.42, pulseMs: 2600, emberGapMs: [900, 2600] },
  // Ready for the dev build's voice input: a little livelier than idle.
  listening: { frameMs: 120, flare: 0.35, flareScale: 1.03, glowLow: 0.45, glowHigh: 0.6, pulseMs: 1600, emberGapMs: [500, 1600] },
  // Thinking: faster flames and a steady flare, glow pulsing quicker, more embers.
  thinking: { frameMs: 85, flare: 0.75, flareScale: 1.05, glowLow: 0.6, glowHigh: 0.88, pulseMs: 900, emberGapMs: [200, 900] },
  // Speaking: the flare and glow flicker at random (no audio level in Expo Go, so it's a pseudo flicker).
  speaking: { frameMs: 105, flare: 0.55, flareScale: 1.04, glowLow: 0.5, glowHigh: 0.9, pulseMs: 0, emberGapMs: [300, 1100] },
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

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * All the flame motion as native-driven Animated values, so nothing re-renders per frame.
 * phase: 0..8 frame position for FireStack. blue: 0 = red fire, 1 = blue fire.
 * flare / flareScale: the flare copy. glow: heat glow strength.
 */
export function useFlameMotion(mood: FlameMood, colour: FlameColour, reduce: boolean) {
  const phase = useRef(new Animated.Value(0)).current;
  const blue = useRef(new Animated.Value(colour === "blue" ? 1 : 0)).current;
  const flare = useRef(new Animated.Value(0)).current;
  const flareScale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(MOODS.idle.glowLow)).current;
  const frameMs = useRef(MOODS.idle.frameMs);
  const alive = useRef(true);

  const settings = reduce ? MOODS.idle : MOODS[mood];

  // Fire frames: one long linear run from the current position to the end, then wrap to 0.
  // Changing speed restarts the run from wherever it is, so the flames never jump.
  useEffect(() => {
    alive.current = true;
    frameMs.current = settings.frameMs;
    const run = (from: number) => {
      if (!alive.current) return;
      Animated.timing(phase, {
        toValue: FRAMES,
        duration: Math.max(1, (FRAMES - from) * frameMs.current),
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || !alive.current) return;
        phase.setValue(0);
        run(0);
      });
    };
    phase.stopAnimation((value) => run(typeof value === "number" ? value % FRAMES : 0));
    return () => {
      alive.current = false;
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

  // Mood: blend flare and glow to the new level, then breathe (idle/thinking) or flicker (speaking).
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let loop: Animated.CompositeAnimation | undefined;
    const s = settings;
    const to = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, { toValue, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true });

    Animated.parallel([to(flare, s.flare, BLEND_MS), to(flareScale, s.flareScale, BLEND_MS), to(glow, s.glowLow, BLEND_MS)]).start(
      ({ finished }) => {
        if (!finished || !live || reduce) return;
        if (mood === "speaking") {
          // Pseudo-random flicker: a new brightness and flare size every 90-220 ms.
          const flicker = () => {
            if (!live) return;
            const ms = rand(90, 220);
            Animated.parallel([
              to(glow, rand(s.glowLow, s.glowHigh), ms),
              to(flare, rand(s.flare * 0.5, Math.min(1, s.flare * 1.4)), ms),
              to(flareScale, rand(1.02, s.flareScale + 0.01), ms),
            ]).start();
            timer = setTimeout(flicker, ms);
          };
          flicker();
        } else {
          loop = Animated.loop(Animated.sequence([to(glow, s.glowHigh, s.pulseMs), to(glow, s.glowLow, s.pulseMs)]));
          loop.start();
        }
      },
    );
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
      loop?.stop();
      flare.stopAnimation();
      flareScale.stopAnimation();
      glow.stopAnimation();
    };
  }, [mood, reduce, settings, flare, flareScale, glow]);

  return { phase, blue, flare, flareScale, glow, emberGapMs: settings.emberGapMs };
}
