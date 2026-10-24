import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import Rule from "./Rule";
import { colors } from "../theme";

// Hand-inked pieces for the paper sheets: an outline that wobbles like a pen line instead of a
// straight CSS border, and faint ruled writing lines. Pure SVG / the existing Rule art, no new assets.

// Small deterministic noise, so a given box always draws the same wobble (no flicker on re-render).
function wobble(seed: number, t: number) {
  return Math.sin(t * 0.9 + seed * 1.7) * 0.5 + Math.sin(t * 2.3 + seed * 3.1) * 0.3 + Math.sin(t * 5.1 + seed * 0.7) * 0.2;
}

// Points round a rounded rectangle, every `step` dp, pushed in or out along the edge normal.
type Pt = [number, number, number]; // x, y, side (0 top, 1 right, 2 bottom, 3 left)

function inkPoints(w: number, h: number, r: number, inset: number, amp: number, seed: number): Pt[] {
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const rr = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  const pts: Pt[] = [];
  const step = 4;
  let t = 0;
  const push = (x: number, y: number, nx: number, ny: number, side: number) => {
    const d = wobble(seed, t / 5) * amp;
    pts.push([x + nx * d, y + ny * d, side]);
    t += step;
  };
  const edge = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number, side: number) => {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) push(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n, nx, ny, side);
  };
  const arc = (cx: number, cy: number, from: number, side: number) => {
    if (rr < 1) return;
    const n = Math.max(2, Math.round((rr * Math.PI) / 2 / step));
    for (let i = 0; i < n; i++) {
      const a = from + ((Math.PI / 2) * i) / n;
      push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.cos(a), Math.sin(a), side);
    }
  };
  edge(x0 + rr, y0, x1 - rr, y0, 0, -1, 0);
  arc(x1 - rr, y0 + rr, -Math.PI / 2, 1);
  edge(x1, y0 + rr, x1, y1 - rr, 1, 0, 1);
  arc(x1 - rr, y1 - rr, 0, 2);
  edge(x1 - rr, y1, x0 + rr, y1, 0, 1, 2);
  arc(x0 + rr, y1 - rr, Math.PI / 2, 3);
  edge(x0, y1 - rr, x0, y0 + rr, -1, 0, 3);
  arc(x0 + rr, y0 + rr, Math.PI, 0);
  return pts;
}

// Smooth curve through the midpoints of the points; closed for a whole rim.
function curve(pts: Pt[], closed: boolean) {
  const mid = (a: Pt, b: Pt) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (pts.length < 2) return "";
  const first = closed ? mid(pts[pts.length - 1], pts[0]) : pts[0];
  let d = `M${first[0].toFixed(2)} ${first[1].toFixed(2)}`;
  const last = closed ? pts.length : pts.length - 1;
  for (let i = closed ? 0 : 1; i < last; i++) {
    const p = pts[i];
    const m = mid(p, pts[(i + 1) % pts.length]);
    d += `Q${p[0].toFixed(2)} ${p[1].toFixed(2)} ${m[0].toFixed(2)} ${m[1].toFixed(2)}`;
  }
  if (!closed) d += `L${pts[pts.length - 1][0].toFixed(2)} ${pts[pts.length - 1][1].toFixed(2)}`;
  return closed ? `${d}Z` : d;
}

function inkPath(w: number, h: number, r: number, inset: number, amp: number, seed: number) {
  return curve(inkPoints(w, h, r, inset, amp, seed), true);
}

// The heavy part of a quill outline: the down-strokes on the right and bottom, where a pen
// presses harder, from part way down the right side round to part way along the bottom.
function pressPath(w: number, h: number, r: number, inset: number, amp: number, seed: number) {
  const pts = inkPoints(w, h, r, inset, amp, seed);
  const right = pts.filter((p) => p[1] > h * 0.25 && p[2] === 1);
  const bottom = pts.filter((p) => p[0] > w * 0.12 && p[2] === 2);
  return curve([...right, ...bottom], false);
}

type OutlineProps = {
  color?: string;
  /** Paper or wash inside the line; transparent by default. */
  fill?: string;
  radius?: number;
  strokeWidth?: number;
  /** Different seeds give different wobbles, so neighbouring boxes are not identical. */
  seed?: number;
  style?: StyleProp<ViewStyle>;
};

// Fills its parent (position absolute) and draws a wobbly inked rim with an optional fill.
// Put it as the first child of the box it outlines; the box's own content sits on top.
export function InkOutline({ color = colors.ink, fill = "none", radius = 2, strokeWidth = 1, seed = 1, style }: OutlineProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - size.w) > 0.5 || Math.abs(height - size.h) > 0.5) setSize({ w: width, h: height });
  };
  const inset = strokeWidth * 1.6;
  const amp = 0.8;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} onLayout={onLayout}>
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Path d={inkPath(size.w, size.h, radius, inset, amp, seed)} fill={fill} stroke="none" />
          {/* A second, lighter pass a hair off the first: the doubled edge a dip pen leaves. */}
          <Path
            d={inkPath(size.w, size.h, radius, inset + 0.6, amp * 1.3, seed + 11)}
            fill="none"
            stroke={color}
            strokeOpacity={0.3}
            strokeWidth={strokeWidth * 0.6}
            strokeLinejoin="round"
          />
          <Path
            d={inkPath(size.w, size.h, radius, inset, amp, seed)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
          {/* Quill pressure: the right and bottom strokes are laid on thicker. */}
          <Path
            d={pressPath(size.w, size.h, radius, inset + strokeWidth * 0.35, amp, seed)}
            fill="none"
            stroke={color}
            strokeOpacity={0.9}
            strokeWidth={strokeWidth * 1.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}

// A hand-inked circle, for the second ring round the portrait.
export function InkRing({
  size,
  color = colors.ink,
  strokeWidth = 1,
  seed = 5,
  dots = true,
}: {
  size: number;
  color?: string;
  strokeWidth?: number;
  seed?: number;
  dots?: boolean;
}) {
  const c = size / 2;
  const r = c - strokeWidth * 2 - (dots ? 3 : 0);
  const n = 72;
  let d = "";
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r + wobble(seed, i / 3) * 0.7;
    d += `${i ? "L" : "M"}${(c + Math.cos(a) * rr).toFixed(2)} ${(c + Math.sin(a) * rr).toFixed(2)}`;
  }
  // Four small diamonds at the compass points, like the studs on a sheet's portrait frame.
  const studs = dots
    ? [0, 1, 2, 3].map((k) => {
        const a = (k * Math.PI) / 2 - Math.PI / 2;
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        const q = 3.2;
        return `M${x} ${y - q}L${x + q} ${y}L${x} ${y + q}L${x - q} ${y}Z`;
      })
    : [];
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Path d={`${d}Z`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeOpacity={0.85} />
      {studs.map((p, i) => (
        <Path key={i} d={p} fill={color} />
      ))}
    </Svg>
  );
}

// A small inked flourish: a centre diamond with tapering curls either side. Fills the empty
// middle cell of the vitals grid and sits between headings like a printer's ornament.
export function Flourish({ width, color = colors.ink }: { width: number; color?: string }) {
  const h = width * 0.3;
  return (
    <Svg width={width} height={h} viewBox="0 0 100 30" pointerEvents="none">
      <Path d="M50 9L56 15L50 21L44 15Z M47.5 15L50 12.5L52.5 15L50 17.5Z" fill={color} fillRule="evenodd" />
      <Path
        d="M41 15C34 15 30 9 24 10C19 11 19 18 24 18C27 18 27.5 14 25 14 M59 15C66 15 70 9 76 10C81 11 81 18 76 18C73 18 72.5 14 75 14 M24 10C16 8 10 14 3 15 M76 10C84 8 90 14 97 15"
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Corner ornaments for a panel: a small inked bracket with a curl in each corner, like an
// illuminated page. Fills its parent; put it first inside the panel content.
export function CornerOrnaments({ size, inset, color = colors.cardStroke }: { size: number; inset: number; color?: string }) {
  const corner =
    "M2 22C2 12 4 4 12 2C16 1 22 1 26 2 M2 22C3 25 6 25 6 22C6 19 3 19 3 16 M26 2C25 3 25 6 22 6C19 6 19 3 16 3 M8 8L10 10";
  const pos = [
    { top: inset, left: inset, rotate: "0deg" },
    { top: inset, right: inset, rotate: "90deg" },
    { bottom: inset, right: inset, rotate: "180deg" },
    { bottom: inset, left: inset, rotate: "270deg" },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pos.map(({ rotate, ...at }, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: size,
            height: size,
            ...at,
            transform: [{ rotate }],
          }}
        >
          <Svg width={size} height={size} viewBox="0 0 28 28">
            <Path d={corner} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeOpacity={0.7} />
          </Svg>
        </View>
      ))}
    </View>
  );
}

type LinesProps = {
  /** Distance between writing lines; use the text's lineHeight so words sit on them. */
  lineHeight: number;
  /** Where the line sits inside each text line, as a share of lineHeight (just under the letters). */
  baseline?: number;
  /** Extra offset from the top, e.g. a TextInput's top padding. */
  top?: number;
  color?: string;
  opacity?: number;
};

// Faint ruled writing lines behind a block of text, like the trait and feature boxes on a paper
// character sheet. Fills its parent (position absolute), so put it first, before the text.
export function RuledLines({ lineHeight, baseline = 0.86, top = 0, color = colors.rule, opacity = 0.2 }: LinesProps) {
  const [height, setHeight] = useState(0);
  const count = lineHeight > 0 ? Math.max(0, Math.floor((height - top) / lineHeight + 0.2)) : 0;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity }]}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: count }, (_, i) => (
        <Rule
          key={i}
          color={color}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: top + lineHeight * (i + baseline),
          }}
        />
      ))}
    </View>
  );
}
