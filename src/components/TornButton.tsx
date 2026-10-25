import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { tapHaptic } from "../lib/haptics";
import { colors, fonts, useScale } from "../theme";
import { INK_RADIUS, InkOutline } from "./Ink";

// Torn parchment buttons from the Tome (Figma 2543:1170): textured paper, inked edge.
// `parchment` = cream paper (secondary / social). `red` = brick-red paper (primary actions).
const ART = {
  parchment: require("../../assets/images/buttons/btn-torn-parchment.png"),
  red: require("../../assets/images/buttons/btn-torn-red.png"),
} as const;
const ART_W = 546 / 3;
const ART_H = 106 / 3;

type Props = {
  label: string;
  onPress: () => void;
  variant?: keyof typeof ART;
  /** Highlights the label, e.g. while the section it opens is showing. */
  active?: boolean;
  /** Width in design dp (360-wide Figma frame). Height keeps the art's ratio unless `height` is set. */
  width?: number;
  /** When set, stretches to this on-screen width (already scaled) instead of `width`. */
  fullWidth?: number;
  /**
   * On-screen height in dp (already scaled). Defaults to the art's ratio.
   * Use ~44–48 for compact auth buttons; keep at least ~44 for touch targets.
   */
  height?: number;
  busy?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  /** Optional leading icon (e.g. Google / Facebook mark). */
  icon?: number;
  /** Slightly smaller label for compact auth rows. */
  compact?: boolean;
  /** Override the label colour (e.g. red text on parchment for Sign out). */
  labelColor?: string;
  /**
   * Keep the paper art but trade its heavy torn border for one fine hand-inked line (Login).
   * The art is drawn a little oversize and clipped, so only its paper shows; the rim is InkOutline.
   */
  fineEdge?: boolean;
};

export default function TornButton({
  label,
  onPress,
  variant = "parchment",
  active,
  width = 181,
  fullWidth,
  height: heightProp,
  busy,
  disabled,
  accessibilityHint,
  style,
  icon,
  compact,
  labelColor,
  fineEdge,
}: Props) {
  const { s, fs } = useScale();
  const w = fullWidth ?? s(width);
  const naturalH = (w * ART_H) / ART_W;
  const h = heightProp ?? naturalH;
  const onRed = variant === "red";
  const iconSize = s(21);
  // Touch target: keep the visible art its own height (so the label stays centred on it)
  // and extend the hit area with hitSlop up to ~44 dp instead of stretching the box.
  const slop = Math.max(4, Math.ceil((s(44) - h) / 2));
  const labelSize = fs(compact ? 13 : 14);

  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={active === undefined ? undefined : { expanded: active }}
      hitSlop={{ top: slop, bottom: slop, left: 4, right: 4 }}
      style={({ pressed }) => [
        { width: w, height: h },
        (disabled || busy) && styles.dim,
        pressed && styles.pressed,
        style,
      ]}
    >
      {fineEdge ? (
        <FineEdgeArt source={ART[variant]} w={w} h={h} seed={label.length + (onRed ? 50 : 60)} />
      ) : (
        <Image source={ART[variant]} style={{ position: "absolute", width: w, height: h }} resizeMode="stretch" />
      )}
      {/* Icon pinned at the input text's inset (s(14)); the label stays centred on the button. */}
      {icon && !busy ? (
        <Image
          source={icon}
          style={{ position: "absolute", left: s(14), top: (h - iconSize) / 2, width: iconSize, height: iconSize }}
          resizeMode="contain"
        />
      ) : null}
      <View style={[styles.center, icon ? { paddingHorizontal: s(14) + iconSize + s(8) } : null]}>
        {busy ? (
          <ActivityIndicator color={onRed ? colors.cream : colors.ink} />
        ) : (
          <>
            <Text
              style={[
                styles.label,
                {
                  fontSize: labelSize,
                  lineHeight: Math.round(labelSize * 1.2),
                  color: labelColor ?? (onRed ? colors.cream : active ? colors.activeTab : colors.ink),
                },
              ]}
              numberOfLines={1}
            >
              {label.toUpperCase()}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

/** The art's paper without its torn border, edged in a fine ink line instead. */
export function FineEdgeArt({ source, w, h, seed }: { source: number; w: number; h: number; seed: number }) {
  const { s } = useScale();
  const bleed = s(5); // pushes the art's baked border outside the clip
  const clip = s(1.2); // the paper stops just inside the pen line
  return (
    <>
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: clip, left: clip, width: w - clip * 2, height: h - clip * 2, overflow: "hidden", borderRadius: s(INK_RADIUS) }}
      >
        <Image
          source={source}
          style={{ position: "absolute", top: -bleed - clip, left: -bleed - clip, width: w + bleed * 2, height: h + bleed * 2 }}
          resizeMode="stretch"
        />
      </View>
      <InkOutline seed={seed} radius={s(INK_RADIUS)} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  // textAlignVertical + no font padding keep Asul's caps optically centred on Android.
  label: { fontFamily: fonts.headingBold, letterSpacing: 0.6, includeFontPadding: false, textAlignVertical: "center", textAlign: "center" },
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
