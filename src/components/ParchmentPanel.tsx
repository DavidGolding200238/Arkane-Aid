import { useState, type ReactNode } from "react";
import {
  Image,
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

const ART = {
  // Codex book, Figma 2242:596
  codex: {
    frame: require("../../assets/images/panels/panel-codex-frame.png"),
    fill: require("../../assets/images/panels/panel-codex-fill.jpg"),
    width: 963 / 3,
    height: 1818 / 3,
  },
  // Codex note card, Figma 2242:605
  card: {
    frame: require("../../assets/images/panels/card-codex-frame.png"),
    fill: require("../../assets/images/panels/card-codex-fill.jpg"),
    width: 898 / 3,
    height: 427 / 3,
  },
  // Ledger sheet and section panels, Figma 2167:598
  ledger: {
    frame: require("../../assets/images/panels/panel-ledger-frame.png"),
    fill: require("../../assets/images/panels/panel-ledger-fill.jpg"),
    width: 1010 / 3,
    height: 1555 / 3,
  },
  // Sage typing box: the Ledger art with its paper lightened to cream (#FFF6E2 family).
  // The #764f00 outline, torn edge and alpha are pixel-for-pixel the Ledger ones.
  input: {
    frame: require("../../assets/images/sage/panel-input-cream-frame.png"),
    fill: require("../../assets/images/sage/panel-input-cream-fill.jpg"),
    width: 1010 / 3,
    height: 1555 / 3,
  },
} satisfies Record<string, Art>;

// Top and bottom bands (in art dp) drawn at their true proportions. Only the
// middle band stretches vertically, so corners and the top/bottom torn edges
// never distort. Width always scales evenly with the panel width.
const CAP = 14;
// How far inside the outer edge the JPEG fill starts. The frame's opaque band
// covers this seam (the torn edge is at most about 2 dp deep).
const FILL_INSET = 3;

type Size = { w: number; h: number };

function Slices({ source, art, size }: { source: ImageSourcePropType; art: Art; size: Size }) {
  const { w, h } = size;
  const k = w / art.width; // dp on screen per art dp, applied evenly in width
  const cap = Math.min(CAP * k, h / 2); // on-screen cap height
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
        <View style={[styles.slice, { top: cap, height: midH }]}>
          <Image
            source={source}
            style={{ position: "absolute", top: -capArt * sy, left: 0, width: w, height: art.height * sy }}
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

type Props = {
  /** codex = Codex book, card = Codex note card, ledger = Ledger sheet and sections, input = Sage typing box (cream). */
  variant?: keyof typeof ART;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export default function ParchmentPanel({ variant = "codex", children, style, contentStyle }: Props) {
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
    </View>
  );
}

const styles = StyleSheet.create({
  art: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  fillClip: { position: "absolute", overflow: "hidden" },
  slice: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
  content: { flexGrow: 1 },
});
