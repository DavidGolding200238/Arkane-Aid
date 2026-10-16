import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CircleButton from "./CircleButton";
import Rule from "./Rule";
import { ChevronLeftIcon } from "./icons";
import { colors, fonts, useScale } from "../theme";

const LETTER_SPACING = 0.6;

type Props = {
  title: string;
  onBack: () => void;
  subtitle?: string;
  /** Underline width in dp (already scaled). Defaults to the Codex/Ledger 156. */
  ruleWidth?: number;
};

// Back button, Cinzel title with a drawn underline, and an optional caption.
// The title is centred on the screen: the back button on the left is balanced by an
// equal-width spacer on the right.
// Used by Codex, Ledger, Tome and Sage.
export default function PageHeader({ title, onBack, subtitle, ruleWidth }: Props) {
  const { s, fs } = useScale();
  const insets = useSafeAreaInsets();
  const circle = s(44);

  return (
    <View
      style={[
        styles.row,
        {
          // Keep the spacing David's phone already had, but never sit under the status bar or a notch.
          paddingTop: Math.max(s(48), insets.top + s(8)),
          paddingHorizontal: s(16),
          paddingBottom: s(8),
        },
      ]}
    >
      <CircleButton size={circle} onPress={onBack} accessibilityLabel="Back">
        <ChevronLeftIcon circleSize={circle} />
      </CircleButton>
      <View style={styles.titleBox}>
        {/* textAlign center matters: when adjustsFontSizeToFit shrinks a long title, the Text keeps the
            full box width and would otherwise draw the smaller text from the left. paddingLeft cancels the
            trailing letterSpacing after the last letter so the ink itself is centred. */}
        <Text
          style={[styles.title, { fontSize: fs(30), paddingLeft: LETTER_SPACING }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {title}
        </Text>
        <Rule width={ruleWidth ?? s(156)} color={colors.ink} />
        {subtitle ? (
          <Text style={[styles.subtitle, { fontSize: fs(13), marginTop: s(4) }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ width: circle }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  titleBox: { flex: 1, alignItems: "center" },
  title: {
    alignSelf: "stretch",
    textAlign: "center",
    fontFamily: fonts.title,
    color: colors.ink,
    letterSpacing: LETTER_SPACING,
    includeFontPadding: false,
  },
  subtitle: { fontFamily: fonts.body, color: colors.muted },
});
