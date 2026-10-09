import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import ScreenFrame from "../components/ScreenFrame";
import rules from "../data/rules.json";

type Props = { onBack: () => void };

export default function CodexScreen({ onBack }: Props) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rules;
    return rules.filter(
      (rule) =>
        rule.title.toLowerCase().includes(needle) || rule.body.toLowerCase().includes(needle)
    );
  }, [query]);

  return (
    <ScreenFrame title="Codex" onBack={onBack}>
      <Text style={styles.note}>Local rules extract. Not a Groq call. Sage should refuse anything that is not in here.</Text>
      <TextInput
        style={styles.input}
        placeholder="Search the extract"
        placeholderTextColor="#8A8175"
        value={query}
        onChangeText={setQuery}
      />
      {shown.length === 0 ? <Text style={styles.empty}>Nothing in the extract matches that.</Text> : null}
      {shown.map((rule) => (
        <View key={rule.id} style={styles.card}>
          <Text style={styles.title}>{rule.title}</Text>
          <Text style={styles.body}>{rule.body}</Text>
        </View>
      ))}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  note: { color: "#5A5348", fontSize: 14, lineHeight: 20 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#1A1816",
    fontSize: 16,
    backgroundColor: "rgba(254,252,235,0.7)",
  },
  empty: { color: "#A33A3A", fontSize: 15 },
  card: {
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(254,252,235,0.75)",
  },
  title: { color: "#1A1816", fontSize: 16, marginBottom: 4 },
  body: { color: "#1A1816", fontSize: 16, lineHeight: 22 },
});
