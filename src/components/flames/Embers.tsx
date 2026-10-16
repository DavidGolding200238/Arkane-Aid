import { memo, useEffect, useRef, type MutableRefObject } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

type Props = {
  /** Orb centre and radius inside the stage, in dp. Embers rise from the flames on its lower edge. */
  cx: number;
  cy: number;
  radius: number;
  /** 0 = red (Wizard), 1 = blue (Plain), native-driven. */
  blue: Animated.Value;
  /** Pause between embers [min, max] ms; shorter when the Sage is busy. */
  gapMs: [number, number];
  count?: number;
};

const RED = ["#FFB45C", "#FF8A3D"];
const BLUE = ["#9FF3E3", "#5FD6C6"];

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function Ember({ cx, cy, radius, blue, gap, index }: { cx: number; cy: number; radius: number; blue: Animated.Value; gap: MutableRefObject<[number, number]>; index: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const size = useRef(rand(2.6, 4.4)).current;

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
      <Animated.View style={[styles.fill, { opacity: blue.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
        <View style={[styles.halo, { left: -size * 0.9, top: -size * 0.9, width: size * 2.8, height: size * 2.8, borderRadius: size * 1.4, backgroundColor: RED[tone] }]} />
        <View style={[styles.fill, { borderRadius: size / 2, backgroundColor: RED[tone] }]} />
      </Animated.View>
      <Animated.View style={[styles.fill, { opacity: blue }]}>
        <View style={[styles.halo, { left: -size * 0.9, top: -size * 0.9, width: size * 2.8, height: size * 2.8, borderRadius: size * 1.4, backgroundColor: BLUE[tone] }]} />
        <View style={[styles.fill, { borderRadius: size / 2, backgroundColor: BLUE[tone] }]} />
      </Animated.View>
    </Animated.View>
  );
}

// A handful of tiny embers drifting up from the flames and fading out. Each one is a pair of
// stacked glowing dots (red and blue) so the colour fade stays on the native driver. Every rise is a
// single native animation; JS only picks a new random start between rises.
function Embers({ cx, cy, radius, blue, gapMs, count = 8 }: Props) {
  const gap = useRef(gapMs);
  gap.current = gapMs;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => (
        <Ember key={i} index={i} cx={cx} cy={cy} radius={radius} blue={blue} gap={gap} />
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
