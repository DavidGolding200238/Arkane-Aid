import { useId, useState, type ReactNode } from "react";
import Svg, { ClipPath, Defs, G, Image as SvgImage, LinearGradient, Mask, Rect, Stop } from "react-native-svg";
import {
  Image,
  PixelRatio,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

// Torn-paper panels exported from Figma at 3x. Each one is split in two files
// to keep the size down:
//  - frame: PNG with real transparency, holding the torn edge, stroke and a
//    band of texture just inside it (the middle is empty);
//  - fill: JPEG of the same art, drawn underneath and clipped just inside the
//    edge so its cream export background never shows.
// Width/height are the art size in dp (pixels / 3).
type Art = { frame: ImageSourcePropType; fill: ImageSourcePropType; width: number; height: number };

// Panels that sit straight on the screen paper use the cream art (the paper blended toward
// #FFF6E2 by scripts/build-cream-panels.py; outline, torn edge and alpha untouched) so they lift
// off the background. The tan originals stay in assets/images/panels as the script's source.
const LEDGER_CREAM = {
  frame: require("../../assets/images/panels/panel-ledger-cream-frame.png"),
  fill: require("../../assets/images/panels/panel-ledger-cream-fill.jpg"),
  width: 1010 / 3,
  height: 1555 / 3,
};

const ART = {
  // Codex note card, Figma 2242:605. Sits on the book, so it keeps its own paper.
  card: {
    frame: require("../../assets/images/panels/card-codex-frame.png"),
    fill: require("../../assets/images/panels/card-codex-fill.jpg"),
    width: 898 / 3,
    height: 427 / 3,
  },
  // Ledger sheet and section panels, and the Tome sections, Figma 2167:598 (cream)
  ledger: LEDGER_CREAM,
  // Sage typing box: the same cream Ledger art.
  input: LEDGER_CREAM,
} satisfies Record<string, Art>;

// Top and bottom bands (in art dp) drawn at their true proportions. Only the
// middle band stretches vertically, so corners and the top/bottom torn edges
// never distort. Width always scales evenly with the panel width.
const CAP = 14;
// How far inside the outer edge the JPEG fill starts. The frame's opaque band
// covers this seam (the torn edge is at most about 2 dp deep).
const FILL_INSET = 3;

type Size = { w: number; h: number };

// Band edges land on whole device pixels and neighbouring bands overlap by one pixel, so no
// half-covered row of pixels can let a lighter seam through where two slices meet.
const snap = (v: number) => PixelRatio.roundToNearestPixel(v);
const onePx = () => 1 / PixelRatio.get();

function Slices({ source, art, size }: { source: ImageSourcePropType; art: Art; size: Size }) {
  const { w, h } = size;
  const px = onePx();
  const k = w / art.width; // dp on screen per art dp, applied evenly in width
  const cap = snap(Math.min(CAP * k, h / 2)); // on-screen cap height, on the pixel grid
  const capArt = cap / k;
  const midH = Math.max(0, h - cap * 2);
  const midArt = art.height - capArt * 2;
  const sy = midArt > 0 ? midH / midArt : 1; // vertical stretch for the middle band only
  const fullH = art.height * k;

  return (
    <>
      <View style={[styles.slice, { top: 0, height: cap }]}>
        <Image source={source} style={{ position: "absolute", top: 0, left: 0, width: w, height: fullH }} resizeMode="stretch" />
      </View>
      {midH > 0 ? (
        <View style={[styles.slice, { top: cap - px, height: midH + px * 2 }]}>
          <Image
            source={source}
            style={{ position: "absolute", top: px - capArt * sy, left: 0, width: w, height: art.height * sy }}
            resizeMode="stretch"
          />
        </View>
      ) : null}
      <View style={[styles.slice, { top: h - cap, height: cap }]}>
        <Image
          source={source}
          style={{ position: "absolute", top: cap - fullH, left: 0, width: w, height: fullH }}
          resizeMode="stretch"
        />
      </View>
    </>
  );
}

/** A soft fade drawn over the panel's content, made of the panel's own paper (see PanelFade). */
export type PanelFadeSpec = {
  /** Top of the fade in the panel's own coordinates (dp), and its height. */
  top: number;
  height: number;
  /** "down": solid at the top, clear at the bottom. "up": the other way. */
  direction: "down" | "up";
  /** Fraction of the height that stays fully solid before it starts to fade. */
  solid?: number;
};

// The same three-slice placement as <Slices>, as SVG images, in panel coordinates.
function SvgSlices({ id, source, art, size }: { id: string; source: ImageSourcePropType; art: Art; size: Size }) {
  const { w, h } = size;
  const px = onePx();
  const k = w / art.width;
  const cap = snap(Math.min(CAP * k, h / 2));
  const capArt = cap / k;
  const midH = Math.max(0, h - cap * 2);
  const midArt = art.height - capArt * 2;
  const sy = midArt > 0 ? midH / midArt : 1;
  const fullH = art.height * k;
  // Same bands as <Slices>, the middle one overlapping its neighbours by a pixel.
  const bands = [
    { top: 0, height: cap, imgY: 0, imgH: fullH },
    { top: cap - px, height: midH > 0 ? midH + px * 2 : 0, imgY: cap - capArt * sy, imgH: art.height * sy },
    { top: h - cap, height: cap, imgY: h - fullH, imgH: fullH },
  ].filter((b) => b.height > 0);
  return (
    <>
      <Defs>
        {bands.map((b, i) => (
          <ClipPath key={i} id={`${id}-band${i}`}>
            <Rect x={0} y={b.top} width={w} height={b.height} />
          </ClipPath>
        ))}
      </Defs>
      {bands.map((b, i) => (
        <G key={i} clipPath={`url(#${id}-band${i})`}>
          <SvgImage href={source} x={0} y={b.imgY} width={w} height={b.imgH} preserveAspectRatio="none" />
        </G>
      ))}
    </>
  );
}

// Content scrolling inside a panel melts into the paper instead of hard-cutting: the panel's
// fill and frame are drawn again over the content, exactly where they already are, and faded
// out with a gradient mask. Never takes touches.
function PanelFade({ spec, art, size, inset }: { spec: PanelFadeSpec; art: Art; size: Size; inset: number }) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { top, height, direction, solid = 0 } = spec;
  if (height <= 0) return null;
  const id = `pf${raw}`;
  const px = onePx();
  // Box on whole device pixels, pushed one pixel past its solid end so that end overlaps the
  // panel paper it sits on (redrawn paper over identical paper) instead of meeting it on a
  // half-covered row.
  const y0 = snap(top) - (direction === "down" ? px : 0);
  const y1 = snap(top + height) + (direction === "up" ? px : 0);
  const boxH = y1 - y0;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const stops: [number, number][] =
    direction === "down"
      ? [[0, 1], [clamp((snap(top) + solid * height - y0) / boxH), 1], [1, 0]]
      : [[0, 0], [clamp((snap(top + height) - solid * height - y0) / boxH), 1], [1, 1]];
  return (
    <View pointerEvents="none" style={[styles.fade, { top: y0, height: boxH }]}>
      <Svg width={size.w} height={boxH}>
        <Defs>
          <LinearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2={boxH} gradientUnits="userSpaceOnUse">
            {stops.map(([offset, opacity], i) => (
              <Stop key={i} offset={offset} stopColor="#fff" stopOpacity={opacity} />
            ))}
          </LinearGradient>
          {/* The mask reaches a pixel beyond the box on every side so its own edges never soften. */}
          <Mask id={`${id}-m`} x={-px} y={-px} width={size.w + px * 2} height={boxH + px * 2} maskUnits="userSpaceOnUse">
            <Rect x={-px} y={-px} width={size.w + px * 2} height={boxH + px * 2} fill={`url(#${id}-g)`} />
          </Mask>
          <ClipPath id={`${id}-fill`}>
            <Rect x={inset} y={inset} width={size.w - inset * 2} height={size.h - inset * 2} rx={inset * 2} />
          </ClipPath>
        </Defs>
        <G mask={`url(#${id}-m)`}>
          <G transform={`translate(0, ${-y0})`}>
            <G clipPath={`url(#${id}-fill)`}>
              <SvgSlices id={`${id}-f`} source={art.fill} art={art} size={size} />
            </G>
            <SvgSlices id={`${id}-e`} source={art.frame} art={art} size={size} />
          </G>
        </G>
      </Svg>
    </View>
  );
}

type Props = {
  /** ledger = Codex book, Ledger sheet and sections, Tome sections; card = Codex note card; input = Sage typing box (all cream). */
  variant?: keyof typeof ART;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Soft fades over the content (e.g. the ends of a scrolling list), in panel coordinates. */
  fades?: PanelFadeSpec[];
};

export default function ParchmentPanel({ variant = "ledger", children, style, contentStyle, fades }: Props) {
  const art: Art = ART[variant];
  const [size, setSize] = useState<Size | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 0.5 || Math.abs(size.h - height) > 0.5) setSize({ w: width, h: height });
  };

  const inset = size ? FILL_INSET * (size.w / art.width) : 0;

  return (
    <View style={style} onLayout={onLayout}>
      {size ? (
        <View style={styles.art} pointerEvents="none">
          <View style={[styles.fillClip, { top: inset, left: inset, right: inset, bottom: inset, borderRadius: inset * 2 }]}>
            <View style={{ position: "absolute", top: -inset, left: -inset, width: size.w, height: size.h }}>
              <Slices source={art.fill} art={art} size={size} />
            </View>
          </View>
          <Slices source={art.frame} art={art} size={size} />
        </View>
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
      {size && fades
        ? fades.map((spec, i) => <PanelFade key={i} spec={spec} art={art} size={size} inset={inset} />)
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  art: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  fillClip: { position: "absolute", overflow: "hidden" },
  slice: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
  content: { flexGrow: 1 },
  fade: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
});
