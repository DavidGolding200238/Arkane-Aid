import { memo } from "react";
import { Animated, StyleSheet, type ImageSourcePropType } from "react-native";

type Props = {
  /** The 8 aligned fire frames of one colour. */
  frames: ImageSourcePropType[];
  /** Runs 0 -> frames.length and wraps (see useFlameMotion). Native-driven. */
  phase: Animated.Value;
  width: number;
  height: number;
};

// Smooth fire: instead of stepping from frame to frame, each frame fades in on top of the
// one before it while that one stays fully opaque underneath, then the old one drops out
// once it is completely covered. So the flames always stay solid (the orb edge never shows
// through a half-faded frame) and the motion flows. A copy of frame 1 sits on top as the
// ninth layer so the loop from frame 8 back to frame 1 crossfades too.
//
// Everything is driven by one native Animated value, so no React re-render happens per frame,
// and layers at opacity 0 are skipped by the renderer.
function FireStack({ frames, phase, width, height }: Props) {
  const n = frames.length;
  const layers = [...frames, frames[0]];

  return (
    <>
      {layers.map((source, i) => {
        let opacity: Animated.AnimatedInterpolation<number>;
        if (i === 0) {
          // First frame: fully shown at the start, covered by frame 2 by phase 1.
          opacity = phase.interpolate({ inputRange: [1, 1.001], outputRange: [1, 0], extrapolate: "clamp" });
        } else if (i === n) {
          // Copy of the first frame fading in over the last frame, to close the loop.
          opacity = phase.interpolate({ inputRange: [n - 1, n], outputRange: [0, 1], extrapolate: "clamp" });
        } else {
          // Fades in over the frame before it, holds while the next one fades in on top, then drops out.
          opacity = phase.interpolate({
            inputRange: [i - 1, i, i + 1, i + 1.001],
            outputRange: [0, 1, 1, 0],
            extrapolate: "clamp",
          });
        }
        return (
          <Animated.Image
            key={i}
            source={source}
            resizeMode="stretch"
            fadeDuration={0}
            style={[styles.frame, { width, height, opacity }]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  frame: { position: "absolute", top: 0, left: 0 },
});

export default memo(FireStack);
