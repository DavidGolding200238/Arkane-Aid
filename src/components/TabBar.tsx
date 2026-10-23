import { Image, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeIcon from "../../assets/images/icons/tab-home.svg";
import LogbookIcon from "../../assets/images/icons/tab-logbook.svg";
import HatIcon from "../../assets/images/icons/tab-hat.svg";
import GearIcon from "../../assets/images/icons/tab-gear.svg";
import type { AppScreen } from "../navigation/screens";
import { colors, useScale } from "../theme";

// Tab bar from Figma Group 6086 (2320:2385): #1a1816 bar with a faint texture,
// cream icons, and a textured red rounded square behind the active one
// (Variant2 of each icon component, e.g. 2320:2092). Figma has no labels.
const TEXTURE = require("../../assets/images/tabbar/tab-bar-texture.jpg");
const ACTIVE = require("../../assets/images/tabbar/tab-active.png");

type TabId = "home" | "codex" | "sage" | "settings";

const TABS: { id: TabId; label: string; Icon: typeof HomeIcon }[] = [
  { id: "home", label: "Home", Icon: HomeIcon },
  { id: "codex", label: "Codex", Icon: LogbookIcon },
  { id: "sage", label: "Sage", Icon: HatIcon },
  { id: "settings", label: "Tome", Icon: GearIcon },
];

// Which tab is lit for each screen. Ledger is opened from the Codex (its
// Ledger tab), so it lights Codex; Create and Join party live under the Tome.
export function tabFor(screen: AppScreen): TabId {
  switch (screen) {
    case "ledger":
      return "codex";
    case "create":
    case "join":
      return "settings";
    default:
      return screen;
  }
}

// Design sizes (360-wide Figma frame).
const BAR_H = 52; // Figma 52.3
const ICON = 38; // icons FIT a ~40 dp box in Figma
const ACTIVE_W = 46;
const ACTIVE_H = 44;
const SIDE = 12; // keeps the four icons on Figma's ~84 dp rhythm

export default function TabBar({
  current,
  onOpen,
}: {
  current: AppScreen;
  onOpen: (screen: AppScreen) => void;
}) {
  const { s } = useScale();
  const insets = useSafeAreaInsets();
  const active = tabFor(current);
  // Sit above the system navigation bar (gesture pill or 3-button bar).
  const bottom = Math.max(insets.bottom, s(4));

  return (
    <View style={[styles.bar, { paddingBottom: bottom, paddingHorizontal: s(SIDE) }]} accessibilityRole="tablist">
      <Image source={TEXTURE} style={styles.texture} resizeMode="cover" />
      {TABS.map(({ id, label, Icon }) => {
        const on = id === active;
        return (
          <Pressable
            key={id}
            style={({ pressed }) => [styles.tab, { height: s(BAR_H) }, pressed && styles.pressed]}
            onPress={() => onOpen(id)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: on }}
          >
            {on ? (
              <Image
                source={ACTIVE}
                style={{ position: "absolute", width: s(ACTIVE_W), height: s(ACTIVE_H) }}
                resizeMode="stretch"
              />
            ) : null}
            <Icon width={s(ICON)} height={s(ICON)} color={colors.cream} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: colors.ink, overflow: "hidden" },
  texture: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
});
