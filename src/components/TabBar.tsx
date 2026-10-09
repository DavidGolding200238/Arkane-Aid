import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AppScreen } from "../navigation/screens";

const tabs: { id: AppScreen; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "sage", label: "Sage" },
  { id: "codex", label: "Codex" },
  { id: "ledger", label: "Ledger" },
  { id: "settings", label: "Settings" },
];

export default function TabBar({
  current,
  onOpen,
}: {
  current: AppScreen;
  onOpen: (screen: AppScreen) => void;
}) {
  return (
    <View style={styles.row}>
      {tabs.map((tab) => {
        const on = tab.id === current;
        return (
          <Pressable key={tab.id} style={styles.tab} onPress={() => onOpen(tab.id)}>
            <Text style={[styles.label, on && styles.on]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    backgroundColor: "#1A1816",
    paddingBottom: 10,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", minHeight: 36, justifyContent: "center" },
  label: {
    color: "#F4E6C8",
    fontSize: 12,
    opacity: 0.7,
  },
  on: { color: "#BD7F02", opacity: 1 },
});
