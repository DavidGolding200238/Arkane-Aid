import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import ScreenFrame from "../components/ScreenFrame";
import { useParty } from "../context/PartyContext";
import { addLedgerEntry, errorText, partyLedger, type LedgerEntry } from "../lib/parties";
import type { AppScreen } from "../navigation/screens";

type Props = { onBack: () => void; onOpen: (screen: AppScreen) => void };

export default function LedgerScreen({ onBack, onOpen }: Props) {
  const { selected, error: partyError } = useParty();
  const [rows, setRows] = useState<LedgerEntry[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    try {
      setRows(await partyLedger(selected.party.id));
      setError("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }, [selected]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await addLedgerEntry(selected.party.id, body);
      setBody("");
      await load();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <ScreenFrame title="Ledger" onBack={onBack}>
      {partyError ? <Text style={styles.error}>{partyError}</Text> : null}
      {!selected ? (
        <View style={styles.card}>
          <Text style={styles.body}>No party yet. Create one or join with a code. Both write to Supabase.</Text>
          <Pressable style={styles.button} onPress={() => onOpen("create")}>
            <Text style={styles.buttonText}>Create party</Text>
          </Pressable>
          <Pressable style={styles.ghost} onPress={() => onOpen("join")}>
            <Text style={styles.ghostText}>Join party</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.meta}>
            {selected.party.name} · {selected.party.code} · {selected.role}
          </Text>
          <TextInput
            style={styles.input}
            multiline
            placeholder="One line for the table."
            placeholderTextColor="#8A8175"
            value={body}
            onChangeText={setBody}
          />
          <Pressable style={styles.button} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color="#FEFCEB" /> : <Text style={styles.buttonText}>Save line</Text>}
          </Pressable>
          <Pressable onPress={load}>
            <Text style={styles.link}>Reload</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {rows.map((row) => (
            <View key={row.id} style={styles.card}>
              <Text style={styles.body}>{row.body}</Text>
              <Text style={styles.meta}>{new Date(row.created_at).toLocaleString()}</Text>
            </View>
          ))}
          {rows.length === 0 && !busy ? <Text style={styles.meta}>No lines yet.</Text> : null}
        </>
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(254,252,235,0.75)",
    gap: 8,
  },
  body: { color: "#1A1816", fontSize: 16, lineHeight: 22 },
  meta: { color: "#5A5348", fontSize: 13 },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 8,
    padding: 12,
    color: "#1A1816",
    fontSize: 16,
    backgroundColor: "rgba(254,252,235,0.7)",
    textAlignVertical: "top",
  },
  button: {
    height: 44,
    borderRadius: 8,
    backgroundColor: "#C44536",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#FEFCEB", fontSize: 16 },
  ghost: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1A1816",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { color: "#1A1816", fontSize: 16 },
  link: { color: "#A33A3A", fontSize: 15 },
  error: { color: "#A33A3A", fontSize: 15 },
});
