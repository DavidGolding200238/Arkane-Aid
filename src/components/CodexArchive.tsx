import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import NoteSheet from "./NoteSheet";
import { loadMySheets, type ArchiveSheet, type Character } from "../lib/character";
import { errorText } from "../lib/parties";
import { colors, fonts, inkText, useScale } from "../theme";

// The Codex's Archive tab: every sheet the player has. Active ones are in a party (or the no-party
// sheet); retired ones were in a party they left or that was deleted, and open read-only.

const classLine = (c: Character) => [c.class?.trim() || "No class", `Level ${c.level}`].join(" \u00b7 ");

function SheetCard({ sheet, seed, onPress }: { sheet: ArchiveSheet; seed: number; onPress?: () => void }) {
  const { s, fs } = useScale();
  const { character, retired, partyName } = sheet;
  const where = retired ? `Was in ${partyName || "a party"}` : partyName || "No party";
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityHint={onPress ? "Opens the sheet to read" : undefined}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View style={{ paddingHorizontal: s(14), paddingVertical: s(12) }}>
        <NoteSheet seed={seed} />
        <Text style={[styles.name, { fontSize: fs(16), lineHeight: fs(21) }]} numberOfLines={1}>
          {character.name.trim() || "Unnamed"}
        </Text>
        <Text style={[styles.meta, { fontSize: fs(14), lineHeight: fs(19) }]} numberOfLines={1}>
          {classLine(character)}
        </Text>
        <Text style={[styles.party, { fontSize: fs(13), lineHeight: fs(18) }]} numberOfLines={1}>
          {where}
        </Text>
      </View>
    </Pressable>
  );
}

export function ArchiveList({ onView }: { onView: (character: Character) => void }) {
  const { s, fs } = useScale();
  const [sheets, setSheets] = useState<ArchiveSheet[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    loadMySheets()
      .then((rows) => live && setSheets(rows))
      .catch((err) => live && setError(errorText(err)));
    return () => {
      live = false;
    };
  }, []);

  if (error) return <Text style={[styles.error, { fontSize: fs(14) }]}>{error}</Text>;
  if (!sheets) return null;
  const active = sheets.filter((row) => !row.retired);
  const retired = sheets.filter((row) => row.retired);

  return (
    <View style={{ gap: s(10) }}>
      <Text style={[styles.label, { fontSize: fs(13) }]}>Active</Text>
      {active.length ? (
        active.map((row, i) => <SheetCard key={row.character.id} sheet={row} seed={120 + i} />)
      ) : (
        <Text style={[styles.empty, { fontSize: fs(14) }]}>No sheet in a party.</Text>
      )}
      <Text style={[styles.label, { fontSize: fs(13), marginTop: s(8) }]}>Retired</Text>
      {retired.length ? (
        retired.map((row, i) => (
          <SheetCard key={row.character.id} sheet={row} seed={160 + i} onPress={() => onView(row.character)} />
        ))
      ) : (
        <Text style={[styles.empty, { fontSize: fs(14) }]}>
          None yet. A sheet retires here when you leave its party, or the party is deleted.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.headingBold, color: colors.wordmark, letterSpacing: 0.4, ...inkText.red },
  name: { fontFamily: fonts.headingBold, ...inkText.heading },
  meta: { fontFamily: fonts.heading, color: colors.ink },
  party: { fontFamily: fonts.heading, fontStyle: "italic", color: colors.muted },
  empty: { fontFamily: fonts.heading, fontStyle: "italic", color: colors.muted },
  error: { fontFamily: fonts.body, color: colors.wordmark },
  pressed: { opacity: 0.85 },
});
