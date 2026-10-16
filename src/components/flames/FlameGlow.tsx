import { memo } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

type Props = {
  /** Centre of the orb inside the stage, in dp. */
  cx: number;
  cy: number;
  /** Radius of the glow in dp (reaches past the flames and fades out). */
  radius: number;
  /** Glow strength 0..1 (native-driven). */
  glow: Animated.Value;
  /** 0 = red (Wizard), 1 = blue (Plain), native-driven. */
  blue: Animated.Value;
};

const RED = "#E4572E";
const BLUE = "#2BA697";

function Halo({ id, colour, size }: { id: string; colour: string; size: number }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="54%" r="50%" fx="50%" fy="58%">
          <Stop offset="0.35" stopColor={colour} stopOpacity={0.75} />
          <Stop offset="0.62" stopColor={colour} stopOpacity={0.32} />
          <Stop offset="1" stopColor={colour} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={size} height={size} fill={`url(#${id})`} />
    </Svg>
  );
}

// Soft heat glow in the voice colour, drawn behind the orb and fire. Two pre-drawn SVG
// gradients (red and blue) whose opacity is glow x colour, so the pulse, the mood changes
// and the red/blue fade all run on the native driver without redrawing the SVG.
function FlameGlow({ cx, cy, radius, glow, blue }: Props) {
  const size = radius * 2;
  const red = Animated.multiply(glow, blue.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }));
  const teal = Animated.multiply(glow, blue);
  const box = { left: cx - radius, top: cy - radius, width: size, height: size };

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
