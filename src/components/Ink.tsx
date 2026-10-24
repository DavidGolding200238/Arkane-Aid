import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import Rule from "./Rule";
import { colors, fonts, useScale } from "../theme";

// Hand-inked pieces for the paper sheets: an outline that wobbles like a pen line instead of a
// straight CSS border, and faint ruled writing lines. Pure SVG / the existing Rule art, no new assets.

// Tuning knobs for every hand-inked line on the sheet: fine pen lines, thinner than Login's
// borders, in a warm brown-black, with a slow drift you feel rather than see as a wave.
/** Ink colour for outlines, underlines and the remove mark: warm brown-black, not pure black. */
export const INK_COLOR = "#443D31";
/** Outline stroke in design dp (360-wide frame), scaled with s(): 0.875 is 1.0 dp at 412 wide. */
export const INK_STROKE = 0.875;
/** Hard cap on any scaled outline stroke, in dp, so big screens stay fine-pen. */
export const INK_STROKE_MAX = 1.2;
/** Opacity of the main stroke; just under 1 so the edge reads soft, like ink in paper. */
export const INK_OPACITY = 0.92;
/** Peak drift in dp of an outline either side of true (0.4 => at most ~0.8 dp peak-to-peak, std ~0.25-0.3). */
export const INK_WOBBLE = 0.4;
/** dp of line per radian of drift: the undulation repeats every ~30-55 dp, so no kinks within ~20 dp. */
export const INK_WOBBLE_LENGTH = 9;
/** Corner radius in design dp for inked boxes (holders, Race/Class, pickers, chips, buttons): nearly square. */
export const INK_RADIUS = 2;
/** Extra weight on the right and bottom strokes (quill pressure), as a share of the stroke. 0 turns it off. */
export const INK_PRESS = 0.12;
/** Opacity of the faint second pen pass beside each outline, which softens the edge. 0 turns it off. */
export const INK_ECHO = 0.12;
/** Peak width of a hand-drawn underline in design dp (add-fields, custom inputs); it tapers at the ends. */
export const INK_LINE = 1.1;
/** Sideways drift in dp of a hand-drawn underline or ×. */
export const INK_LINE_WAVER = 0.25;
/** Stroke width in design dp of the corner ornaments on each section panel. */
export const INK_CORNER = 0.9;
/** Fill of the Race/Class and vitals holders: solid panel cream (David's pick, "variant B"). */
// Opaque, so the boxes paint cream on every platform instead of letting the paper show through.
export const HOLDER_FILL = "#F3E6C8";
// Slightly darker ink for small tap marks (the remove ×).
export const INK_DARK = "#2E2920";

/** The scaled fine-pen width for an outline: s(INK_STROKE), never above INK_STROKE_MAX. */
export function useInkWidth() {
  const { s } = useScale();
  return Math.min(INK_STROKE_MAX, s(INK_STROKE));
}

// Small deterministic noise in -1..1, so a given box always draws the same drift (no flicker on
// re-render). Only slow terms: a long swell plus a gentler one, no high-frequency jitter.
function wobble(seed: number, t: number) {
  return Math.sin(t + seed * 1.7) * 0.8 + Math.sin(t * 1.9 + seed * 3.1) * 0.2;
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
    const d = wobble(seed, t / INK_WOBBLE_LENGTH) * amp;
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
export function InkOutline({ color = INK_COLOR, fill = "none", radius = 2, strokeWidth: sw, seed = 1, style }: OutlineProps) {
  const fine = useInkWidth();
  const strokeWidth = sw ?? fine;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - size.w) > 0.5 || Math.abs(height - size.h) > 0.5) setSize({ w: width, h: height });
  };
  const inset = strokeWidth / 2 + INK_WOBBLE + 0.5;
  const amp = INK_WOBBLE;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} onLayout={onLayout}>
      {/* A plain View under the ink paints the fill too, so it shows even where the SVG fill does not (Android). */}
      {fill !== "none" ? (
        <View style={[StyleSheet.absoluteFill, { margin: inset + amp, borderRadius: radius, backgroundColor: fill }]} />
      ) : null}
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Path d={inkPath(size.w, size.h, radius, inset, amp, seed)} fill={fill} fillOpacity={1} stroke="none" />
          {/* A second, lighter pass a hair off the first: the doubled edge a dip pen leaves. */}
          {INK_ECHO > 0 ? (
            <Path
              d={inkPath(size.w, size.h, radius, inset + 0.4, amp, seed + 11)}
              fill="none"
              stroke={color}
              strokeOpacity={INK_ECHO}
              strokeWidth={strokeWidth * 0.6}
              strokeLinejoin="round"
            />
          ) : null}
          <Path
            d={inkPath(size.w, size.h, radius, inset, amp, seed)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeOpacity={INK_OPACITY}
            strokeLinejoin="round"
          />
          {/* Quill pressure: the right and bottom strokes are laid on a touch heavier. */}
          {INK_PRESS > 0 ? (
            <Path
              d={pressPath(size.w, size.h, radius, inset + (strokeWidth * INK_PRESS) / 2, amp, seed)}
              fill="none"
              stroke={color}
              strokeOpacity={INK_OPACITY}
              strokeWidth={strokeWidth * INK_PRESS * 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

// A hand-inked circle, for the second ring round the portrait.
export function InkRing({
  size,
  color = INK_COLOR,
  strokeWidth: sw,
  seed = 5,
  dots = true,
}: {
  size: number;
  color?: string;
  strokeWidth?: number;
  seed?: number;
  dots?: boolean;
}) {
  const fine = useInkWidth();
  const strokeWidth = sw ?? fine;
  const c = size / 2;
  const r = c - strokeWidth * 2 - (dots ? 3 : 0);
  const n = 72;
  let d = "";
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r + wobble(seed, (a * r) / INK_WOBBLE_LENGTH) * INK_WOBBLE;
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
  const { s } = useScale();
  // The art is drawn in a 28-unit box; convert the dp stroke into those units.
  const stroke = (s(INK_CORNER) * 28) / size;
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
            <Path d={corner} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeOpacity={0.7} />
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

// One tapered pen stroke from (ax, ay) to (bx, by): thin at the ends, full in the middle, with a
// slight waver, built as a filled outline so the weight really changes along the line.
function taperedStroke(ax: number, ay: number, bx: number, by: number, weight: number, seed: number, waver: number) {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 1) return "";
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const nx = -uy;
  const ny = ux;
  const n = Math.max(6, Math.round(len / 4));
  const top: string[] = [];
  const bot: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = wobble(seed, (t * len) / INK_WOBBLE_LENGTH) * waver;
    // Pressure: quick swell from the entry, long body, lifted tail.
    const press =
      Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.45) * (0.9 + 0.1 * wobble(seed + 3, (t * len) / INK_WOBBLE_LENGTH));
    const half = Math.max(0.15, (weight * press) / 2);
    const cx = ax + ux * len * t + nx * off;
    const cy = ay + uy * len * t + ny * off;
    top.push(`${(cx + nx * half).toFixed(2)} ${(cy + ny * half).toFixed(2)}`);
    bot.push(`${(cx - nx * half).toFixed(2)} ${(cy - ny * half).toFixed(2)}`);
  }
  return `M${top.join("L")}L${bot.reverse().join("L")}Z`;
}

// A hand-drawn underline for a writing field: one pressure-tapered pen stroke with a faint
// second pass, instead of a flat rule. Stretches to its parent's width.
export function InkStroke({ color = INK_COLOR, weight: wt, seed = 2 }: { color?: string; weight?: number; seed?: number }) {
  const { s } = useScale();
  const weight = wt ?? s(INK_LINE);
  const [w, setW] = useState(0);
  const h = weight * 3 + 2;
  return (
    <View pointerEvents="none" style={{ height: h, alignSelf: "stretch" }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={h}>
          <Path
            d={taperedStroke(1, h / 2 + 0.6, w - 1, h / 2 - 0.4, weight * 0.6, seed + 7, INK_LINE_WAVER * 1.3)}
            fill={color}
            fillOpacity={INK_ECHO}
          />
          <Path d={taperedStroke(0, h / 2, w - 2, h / 2, weight, seed, INK_LINE_WAVER)} fill={color} />
        </Svg>
      ) : null}
    </View>
  );
}

// The remove mark for list rows: an × made of two tapered quill strokes rather than a type glyph.
export function InkCross({ size, color = INK_COLOR, seed = 4 }: { size: number; color?: string; seed?: number }) {
  const p = size * 0.18;
  const q = size - p;
  const weight = Math.max(1.1, size * 0.1);
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Path d={taperedStroke(p, p, q, q, weight, seed, INK_LINE_WAVER)} fill={color} />
      <Path d={taperedStroke(q, p + 0.5, p + 0.5, q, weight * 0.9, seed + 5, INK_LINE_WAVER)} fill={color} />
    </Svg>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** `red` = brick-red paper for the main action, `parchment` = cream paper. */
  variant?: "red" | "parchment";
  /** On-screen width and height in dp (already scaled). */
  width: number;
  height: number;
  labelColor?: string;
  busy?: boolean;
  disabled?: boolean;
  seed?: number;
};

// A paper button edged in fine ink: the Login buttons' red / parchment look and caps label,
// with a thin hand-drawn rim instead of their heavy torn border, and nearly square corners.
export function InkButton({
  label,
  onPress,
  variant = "parchment",
  width,
  height,
  labelColor,
  busy,
  disabled,
  seed = 31,
}: ButtonProps) {
  const { s, fs } = useScale();
  const onRed = variant === "red";
  const size = fs(height < s(40) ? 13 : 14);
  const slop = Math.max(4, Math.ceil((s(44) - height) / 2));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: slop, bottom: slop, left: 4, right: 4 }}
      style={({ pressed }) => [
        { width, height, alignItems: "center", justifyContent: "center" },
        (disabled || busy) && buttonStyles.dim,
        pressed && buttonStyles.pressed,
      ]}
    >
      <InkOutline seed={seed} radius={s(INK_RADIUS)} fill={onRed ? colors.primary : HOLDER_FILL} />
      {busy ? (
        <ActivityIndicator color={onRed ? colors.cream : INK_COLOR} />
      ) : (
        <Text
          numberOfLines={1}
          style={[
            buttonStyles.label,
            { fontSize: size, lineHeight: Math.round(size * 1.2), color: labelColor ?? (onRed ? colors.cream : colors.ink) },
          ]}
        >
          {label.toUpperCase()}
        </Text>
      )}
    </Pressable>
  );
}

const buttonStyles = StyleSheet.create({
  // Same caps label as Login's TornButton (Asul bold), optically centred on Android.
  label: {
    fontFamily: fonts.headingBold,
    letterSpacing: 0.6,
    includeFontPadding: false,
    textAlignVertical: "center",
    textAlign: "center",
  },
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
