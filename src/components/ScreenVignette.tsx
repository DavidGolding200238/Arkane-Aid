import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

type Props = {
  /** Darkness at the very edge, 0..1. Keep it faint so it reads as aged paper, not a frame. */
  strength?: number;
};

// Faint warm darkening towards the screen edges, like the burnt rim of old parchment.
// Drawn as an SVG radial gradient (react-native-svg is already in the app), so there is
// no extra image and it stays smooth at any size. The gradient uses the box's own
// proportions, so on a tall phone it becomes an ellipse that hugs every edge.
export default function ScreenVignette({ strength = 0.26 }: Props) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="45%" rx="75%" ry="68%" fx="50%" fy="45%" gradientUnits="objectBoundingBox">
            <Stop offset="0.55" stopColor="#3A2A12" stopOpacity={0} />
            <Stop offset="0.82" stopColor="#3A2A12" stopOpacity={strength * 0.45} />
            <Stop offset="1" stopColor="#2A1C0A" stopOpacity={strength} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
      </Svg>
    </View>
  );
}
