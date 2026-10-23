import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import ScreenFrame, { FrameInput } from "../components/ScreenFrame";
import ThemedButton from "../components/ThemedButton";
import { useParty } from "../context/PartyContext";
import { colors, fonts, useScale } from "../theme";
import { errorText, joinParty } from "../lib/parties";

type Props = { onBack: () => void; onDone: () => void };

export default function JoinPartyScreen({ onBack, onDone }: Props) {
  const { refresh, select } = useParty();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { fs } = useScale();

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const party = await joinParty(code);
      await refresh();
      select(party.id);
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenFrame title="Join Party" onBack={onBack}>
      <Text style={[styles.copy, { fontSize: fs(15), lineHeight: fs(22) }]}>Enter the code from the DM. You join as a player.</Text>
      <FrameInput
        label="Party code"
        autoCapitalize="characters"
        placeholder="Party code"
        value={code}
        onChangeText={setCode}
      />
      {error ? <Text style={[styles.error, { fontSize: fs(14) }]}>{error}</Text> : null}
      <ThemedButton label="Join party" onPress={submit} busy={busy} />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  copy: { fontFamily: fonts.body, color: colors.ink },
  error: { fontFamily: fonts.body, color: colors.wordmark },
});
