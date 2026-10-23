import { memo, useEffect, useRef, useState, type RefObject } from "react";
import { Animated, Easing, StyleSheet, useAnimatedValue, View } from "react-native";
import type { FlameColour } from "./useFlameMotion";

type Props = {
  /** Orb centre and radius inside the stage, in dp. Embers rise from the flames on its lower edge. */
  cx: number;
  cy: number;
  radius: number;
  /** The shown colour, and the old one while the colour changes (see useFlameMotion). */
  colour: FlameColour;
  under?: FlameColour | null;
  /** How much of each colour shows, native-driven. */
  tint: Record<FlameColour, Animated.Value>;
  /** Pause between embers [min, max] ms; shorter when the Sage is busy. */
  gapMs: [number, number];
  count?: number;
};

// Two tones per fire: amber for red, pale teal for blue, green-gold for green (Bard).
const TONES: Record<FlameColour, [string, string]> = {
  red: ["#FFB45C", "#FF8A3D"],
  blue: ["#9FF3E3", "#5FD6C6"],
  green: ["#E4F27E", "#8EE07A"],
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

type EmberProps = {
  cx: number;
  cy: number;
  radius: number;
  colours: FlameColour[];
  tint: Record<FlameColour, Animated.Value>;
  gap: RefObject<[number, number]>;
  index: number;
};

function Ember({ cx, cy, radius, colours, tint, gap, index }: EmberProps) {
  const progress = useAnimatedValue(0);
  const x = useAnimatedValue(0);
  const y = useAnimatedValue(0);
  const rise = useAnimatedValue(0);
  const sway = useAnimatedValue(0);
  const [size] = useState(() => rand(2.6, 4.4));

  useEffect(() => {
    let live = true;
    const cycle = (first: boolean) => {
      if (!live) return;
      // A fresh start point on the flames along the orb's lower edge, a new height and drift.
      const angle = (rand(18, 162) * Math.PI) / 180;
      x.setValue(cx + Math.cos(angle) * radius * rand(0.92, 1.04) - size / 2);
      y.setValue(cy + Math.sin(angle) * radius * rand(0.92, 1.02) - size / 2);
      rise.setValue(-rand(radius * 0.35, radius * 0.8));
      sway.setValue(rand(-14, 14));
      progress.setValue(0);
      const [lo, hi] = gap.current;
      Animated.sequence([
        Animated.delay(first ? rand(0, 2400) + index * 120 : rand(lo, hi)),
        Animated.timing(progress, { toValue: 1, duration: rand(1500, 2800), easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start(({ finished }) => finished && cycle(false));
    };
    cycle(true);
    return () => {
      live = false;
      progress.stopAnimation();
    };
  }, [cx, cy, radius, size, index, gap, progress, x, y, rise, sway]);

  const opacity = progress.interpolate({ inputRange: [0, 0.12, 0.6, 1], outputRange: [0, 1, 0.65, 0] });
  const translateY = Animated.add(y, Animated.multiply(progress, rise));
  const translateX = Animated.add(x, Animated.multiply(progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0.4] }), sway));
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });
  const tone = index % 2;

  return (
    <Animated.View style={[styles.ember, { width: size, height: size, opacity, transform: [{ translateX }, { translateY }, { scale }] }]}>
      {/* Each colour is a bright core with a faint soft halo around it. */}
      {colours.map((c) => (
        <Animated.View key={c} style={[styles.fill, { opacity: tint[c] }]}>
          <View style={[styles.halo, { left: -size * 0.9, top: -size * 0.9, width: size * 2.8, height: size * 2.8, borderRadius: size * 1.4, backgroundColor: TONES[c][tone] }]} />
          <View style={[styles.fill, { borderRadius: size / 2, backgroundColor: TONES[c][tone] }]} />
        </Animated.View>
      ))}
    </Animated.View>
  );
}

// A handful of tiny embers drifting up from the flames and fading out. Each one is a pair of
// stacked glowing dots (the shown colour, plus the old one while it fades) so the colour fade
// stays on the native driver. Every rise is a
// single native animation; JS only picks a new random start between rises.
function Embers({ cx, cy, radius, colour, under, tint, gapMs, count = 8 }: Props) {
  const gap = useRef(gapMs);
  useEffect(() => {
    gap.current = gapMs;
  }, [gapMs]);
  const colours = under && under !== colour ? [under, colour] : [colour];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => (
        <Ember key={i} index={i} cx={cx} cy={cy} radius={radius} colours={colours} tint={tint} gap={gap} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ember: { position: "absolute", left: 0, top: 0 },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  halo: { position: "absolute", opacity: 0.28 },
});

export default memo(Embers);
