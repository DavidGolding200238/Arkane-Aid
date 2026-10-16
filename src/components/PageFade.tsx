import { StyleSheet, View } from "react-native";
import Svg, { Defs, G, Image as SvgImage, LinearGradient, Mask, Rect, Stop } from "react-native-svg";
import { colors } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");

type Props = {
  /** Where the fade sits, in the screen's own coordinates (dp). */
  top: number;
  height: number;
  /** Size of the screen background it continues (the wash plus parchment at 28%). */
  screenWidth: number;
  screenHeight: number;
  /** "down": solid at the top, clear at the bottom (under a header). "up": the other way (above a docked box). */
  direction: "down" | "up";
  /** Fraction of the height that stays fully solid before it starts to fade. */
  solid?: number;
};

// A soft fade made of the page itself: the same wash and parchment texture as the screen
// background, drawn in the same place, faded out with a gradient mask. Content scrolling under
// it melts into the paper instead of hitting a hard edge, and the paper texture lines up with
// the background, so there is no visible strip. Never takes touches.
export default function PageFade({ top, height, screenWidth, screenHeight, direction, solid = 0 }: Props) {
  if (height <= 0 || screenWidth <= 0) return null;
  const down = direction === "down";
  const id = `fade-${direction}`;
  // Mask stops: white = page fully drawn, clear = content shows through.
  const stops: [number, number][] = down
    ? [[0, 1], [solid, 1], [1, 0]]
    : [[0, 0], [1 - solid, 1], [1, 1]];
  return (
    <View pointerEvents="none" style={[styles.box, { top, height }]}>
      <Svg width={screenWidth} height={height}>
        <Defs>
          <LinearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
            {stops.map(([offset, opacity], i) => (
              <Stop key={i} offset={offset} stopColor="#fff" stopOpacity={opacity} />
            ))}
          </LinearGradient>
          <Mask id={`${id}-m`} x="0" y="0" width={screenWidth} height={height} maskUnits="userSpaceOnUse">
            <Rect x="0" y="0" width={screenWidth} height={height} fill={`url(#${id}-g)`} />
          </Mask>
        </Defs>
        <G mask={`url(#${id}-m)`}>
          <Rect x="0" y="0" width={screenWidth} height={height} fill={colors.wash} />
          {/* Same placement as the screen's cover-fitted background image, shifted up by `top`. */}
          <SvgImage
            href={parchment}
            x={0}
            y={-top}
            width={screenWidth}
            height={screenHeight}
            preserveAspectRatio="xMidYMid slice"
            opacity={0.28}
          />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
});
