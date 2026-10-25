import { StyleSheet, View } from "react-native";
import Svg, { Defs, G, Image as SvgImage, LinearGradient, Mask, Rect, Stop } from "react-native-svg";
import { colors, useScale } from "../theme";

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

/**
 * The Sage page's fade sizes, so every scrolling page uses exactly the same ones: a short tail
 * under a fixed top edge (header, tabs), and about one line of text above a fixed bottom edge
 * (the Sage typing box, the tab bar, the Codex arrow). Pages add them to their scroll padding so
 * the first and last content can scroll clear of the fade.
 */
export function useFadeSizes() {
  const { s, fs } = useScale();
  return { tail: s(12), line: fs(25) };
}

type Box = { y: number; h: number };

/**
 * The Sage fades for a scroll area that is clipped at its own edges (its top just under the
 * page's header or tabs, its bottom on the tab bar or a docked control). The scroll area already
 * hides what is outside it, so only the fading part is drawn: Sage's tail fading down from the
 * top edge, and Sage's one-line fade rising to the bottom edge. Same paper, same sizes.
 * `screen` is the page's own size and `box` the scroll area's place in it (dp).
 */
export function ScrollFades({
  screen,
  box,
  top = true,
  bottom = true,
}: {
  screen: { w: number; h: number };
  box: Box;
  top?: boolean;
  bottom?: boolean;
}) {
  const { tail, line } = useFadeSizes();
  if (box.h <= 0 || screen.w <= 0) return null;
  return (
    <>
      {top ? (
        <PageFade direction="down" top={box.y} height={tail} screenWidth={screen.w} screenHeight={screen.h} />
      ) : null}
      {bottom ? (
        <PageFade direction="up" top={box.y + box.h - line} height={line} screenWidth={screen.w} screenHeight={screen.h} />
      ) : null}
    </>
  );
}
