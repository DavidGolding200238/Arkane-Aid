import { memo } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

type Props = {
  /** Centre of the orb inside the stage, in dp. */
  cx: number;
  cy: number;
  /** Radius of the visible glow in dp (reaches past the flames and fades out). */
  radius: number;
  /** Glow strength 0..1 (native-driven). */
  glow: Animated.Value;
  /** 0 = red (Wizard), 1 = blue (Plain), native-driven. */
  blue: Animated.Value;
};

const RED = "#E4572E";
const BLUE = "#2BA697";

// The glow is a circle filled with a radial gradient in absolute (user space) units, ending at
// exactly 0 opacity on the circle's own edge, and the circle sits well inside the canvas
// (radius 48% of it). Nothing is drawn outside the circle, so there is no square edge to clip.
function Halo({ id, colour, size }: { id: string; colour: string; size: number }) {
  const c = size / 2;
  const r = size * 0.48;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx={c} cy={c} r={r} fx={c} fy={c + r * 0.06} gradientUnits="userSpaceOnUse">
          {/* The orb covers the middle; the colour is strongest at the orb's rim and fades out. */}
          <Stop offset="0" stopColor={colour} stopOpacity={0.7} />
          <Stop offset="0.65" stopColor={colour} stopOpacity={0.7} />
          <Stop offset="0.8" stopColor={colour} stopOpacity={0.34} />
          <Stop offset="0.92" stopColor={colour} stopOpacity={0.08} />
          <Stop offset="0.98" stopColor={colour} stopOpacity={0} />
          <Stop offset="1" stopColor={colour} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={r} fill={`url(#${id})`} />
    </Svg>
  );
}

// Soft heat glow in the voice colour, drawn behind the orb and fire. Two pre-drawn SVG
// gradients (red and blue) whose opacity is glow x colour, so the pulse, the mood changes
// and the red/blue fade all run on the native driver without redrawing the SVG.
function FlameGlow({ cx, cy, radius, glow, blue }: Props) {
  // Canvas comfortably larger than the glow, so the circle never touches its edges.
  const size = Math.ceil((radius / 0.48) * 2);
  const half = size / 2;
  const red = Animated.multiply(glow, blue.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }));
  const teal = Animated.multiply(glow, blue);
  const box = { left: cx - half, top: cy - half, width: size, height: size };

  return (
    <View pointerEvents="none" style={[styles.box, box]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: red }]}>
        <Halo id="glowRed" colour={RED} size={size} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: teal }]}>
        <Halo id="glowBlue" colour={BLUE} size={size} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute" },
});

export default memo(FlameGlow);
