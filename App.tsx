import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>Arkane Aid</Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEFCEB",
  },
  label: {
    fontSize: 20,
    color: "#1A1816",
  },
});
