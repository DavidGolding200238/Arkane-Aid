import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type HostInstance,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Defs, G, Image as SvgImage, LinearGradient, Mask, Rect, Stop } from "react-native-svg";
import { notePaper, useSheetPaper } from "./NoteSheet";
import { colors, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");

/**
 * The paper a FadeRow sits on. With no provider it is the screen page (the wash plus parchment at
 * 28%, cover-fitted to the window). A Codex card provides its own sheet, so a row inside a card
 * fades into the card's paper instead.
 */
export type FadePaper = { kind: "sheet"; ref: RefObject<HostInstance | null>; w: number; h: number };
export const FadePaperContext = createContext<FadePaper | null>(null);

type Props = {
  children: ReactNode;
  /** Space between the tabs (dp). */
  gap: number;
  /** Space before the first tab and after the last (dp). */
  inset?: number;
  /**
   * How far the row reaches past its parent's padding on each side (dp), so the tabs scroll right
   * to the screen edge and the fades sit in the page margin.
   */
  bleed?: number;
  /** The open tab's index, kept in view when it changes. */
  active?: number;
  style?: StyleProp<ViewStyle>;
};

// A sideways-scrolling row of tabs with a soft fade on the edge that has more to see: the right
// edge while there are tabs past it, the left edge once scrolled away from the start, none when
// everything fits. The fades are the paper itself (as in PageFade), so tabs melt into the page
// instead of being cut off, and they never take touches.
export default function FadeRow({ children, gap, inset = 0, bleed = 0, active, style }: Props) {
  const { s } = useScale();
  const fadeW = s(30);
  const scroll = useRef<ScrollViewInstance>(null);
  const box = useRef<HostInstance>(null);
  const items = useRef<{ x: number; w: number }[]>([]);
  const pos = useRef({ x: 0, view: 0, content: 0 });
  const [view, setView] = useState({ w: 0, h: 0 });
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const { x, view: vw, content } = pos.current;
    const left = x > 1;
    const right = vw > 0 && x + vw < content - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  // Scroll just far enough that the open tab clears the fades.
  const reveal = useCallback(
    (animated: boolean) => {
      const item = active === undefined ? undefined : items.current[active];
      const { x, view: vw, content } = pos.current;
      if (!item || vw <= 0) return;
      let to: number | null = null;
      if (item.x - fadeW < x) to = item.x - fadeW;
      else if (item.x + item.w + fadeW > x + vw) to = item.x + item.w + fadeW - vw;
      if (to === null) return;
      to = Math.max(0, Math.min(to, content - vw));
      scroll.current?.scrollTo({ x: to, animated });
    },
    [active, fadeW]
  );

  useEffect(() => {
    reveal(true);
  }, [reveal]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    pos.current.view = width;
    setView((v) => (v.w === width && v.h === height ? v : { w: width, h: height }));
    update();
    reveal(false);
  };

  return (
    <View ref={box} style={[style, bleed ? { marginHorizontal: -bleed } : null]}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap, paddingHorizontal: bleed + inset }}
        scrollEventThrottle={16}
        onLayout={onLayout}
        onContentSizeChange={(w) => {
          pos.current.content = w;
          update();
        }}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          pos.current.x = e.nativeEvent.contentOffset.x;
          update();
        }}
      >
        {Children.map(children, (child, i) => (
          <View
            onLayout={(e) => {
              items.current[i] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width };
              // The row opens with the open tab in view (it may start past the right edge).
              if (i === active) reveal(false);
            }}
          >
            {child}
          </View>
        ))}
      </ScrollView>
      {view.w > fadeW * 2 ? (
        <>
          <EdgeFade side="left" show={edges.left} width={fadeW} row={view} owner={box} />
          <EdgeFade side="right" show={edges.right} width={fadeW} row={view} owner={box} />
        </>
      ) : null}
    </View>
  );
}

// One edge's fade: the paper under the row, drawn in the same place as the real paper so its
// texture lines up, faded out towards the tabs with a gradient mask.
function EdgeFade({
  side,
  show,
  width,
  row,
  owner,
}: {
  side: "left" | "right";
  show: boolean;
  width: number;
  row: { w: number; h: number };
  owner: RefObject<HostInstance | null>;
}) {
  const sheet = useContext(FadePaperContext);
  const win = useWindowDimensions();
  const { bleed, clip } = useSheetPaper();
  const id = `edge${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // The row's top-left corner on its paper (the window for the page, the card for a sheet).
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const node = owner.current;
    if (!node) return;
    if (sheet) {
      if (!sheet.ref.current) return;
      node.measureLayout(sheet.ref.current, (x, y) => setAt({ x, y }), () => undefined);
    } else {
      node.measureInWindow((x, y) => setAt({ x, y }));
    }
  }, [owner, sheet, row.w, row.h, win.width, win.height]);

  if (!at) return null;
  const left = side === "left" ? 0 : row.w - width;
  const h = row.h;
  // Mask stops: white = paper fully drawn (at the row's edge), clear = tabs show through.
  const stops: [number, number][] =
    side === "left" ? [[0, 1], [0.2, 1], [1, 0]] : [[0, 0], [0.8, 1], [1, 1]];
  return (
    <View pointerEvents="none" style={[styles.fade, { left, width, height: h, opacity: show ? 1 : 0 }]}>
      <Svg width={width} height={h}>
        <Defs>
          <LinearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="0">
            {stops.map(([offset, opacity], i) => (
              <Stop key={i} offset={offset} stopColor="#fff" stopOpacity={opacity} />
            ))}
          </LinearGradient>
          <Mask id={`${id}m`} x="0" y="0" width={width} height={h} maskUnits="userSpaceOnUse">
            <Rect x="0" y="0" width={width} height={h} fill={`url(#${id}g)`} />
          </Mask>
        </Defs>
        <G mask={`url(#${id}m)`}>
          {sheet ? (
            // Same placement as NoteSheet's cover-fitted paper: inset by `clip`, drawn `bleed` oversize.
            <SvgImage
              href={notePaper}
              x={clip - bleed - at.x - left}
              y={clip - bleed - at.y}
              width={sheet.w - clip * 2 + bleed * 2}
              height={sheet.h - clip * 2 + bleed * 2}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <>
              <Rect x="0" y="0" width={width} height={h} fill={colors.wash} />
              {/* Same placement as the screen's cover-fitted background image. */}
              <SvgImage
                href={parchment}
                x={-at.x - left}
                y={-at.y}
                width={win.width}
                height={win.height}
                preserveAspectRatio="xMidYMid slice"
                opacity={0.28}
              />
            </>
          )}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: "absolute", top: 0, overflow: "hidden" },
});
