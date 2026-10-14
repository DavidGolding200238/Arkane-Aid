import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import House from "../../assets/Icons/icons8-house.svg";
import Book from "../../assets/Icons/icons8-book.svg";
import Hat from "../../assets/Icons/icons8-witch-hat.svg";
import Settings from "../../assets/Icons/icons8-settings.svg";
import type { AppScreen } from "../navigation/screens";

const TABS: { id: AppScreen; Icon: typeof House }[] = [
  { id: "home", Icon: House },
  { id: "codex", Icon: Book },
  { id: "sage", Icon: Hat },
  { id: "settings", Icon: Settings },
];

export default function TabBar({
  current,
  onOpen,
}: {
  current: AppScreen;
  onOpen: (screen: AppScreen) => void;
}) {
  const insets = useSafeAreaInsets();
  const lift = Math.max(insets.bottom, 0);

  return (
    <View style={[styles.row, { paddingBottom: lift }]}>
      {TABS.map(({ id, Icon }) => {
        const on =
          id === current ||
          (id === "codex" && current === "ledger") ||
          (id === "settings" && (current === "create" || current === "join"));
        const colour = on ? "#FFFFFF" : "rgba(255,255,255,0.62)";
        return (
          <Pressable key={id} style={styles.tab} onPress={() => onOpen(id)} hitSlop={8}>
            <Icon width={26} height={26} color={colour} fill={colour} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    backgroundColor: "#111111",
    paddingTop: 12,
    paddingBottom: 0,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", height: 44 },
});
