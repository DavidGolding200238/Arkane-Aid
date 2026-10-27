import { Image, StyleSheet, View } from "react-native";
import { CornerOrnaments, InkOutline, INK_RADIUS } from "./Ink";
import { useScale } from "../theme";

// The Character Sheet sections' light paper (no torn edge: it is clipped off), so each note is its own small sheet.
const notePaper = require("../../assets/images/panels/panel-ledger-cream-fill.jpg");

// One note's sheet: the Character Sheet panel paper, drawn a little oversize and clipped so its baked border
// never shows, edged in a fine hand-inked line with the sheet's corner curls. Fills its parent.
// Used by the Codex note, weapon and spell cards.
export default function NoteSheet({ seed }: { seed: number }) {
  const { s } = useScale();
  const bleed = s(6);
  const clip = s(1.2);
  return (
    <>
      <View pointerEvents="none" style={[styles.sheetClip, { top: clip, left: clip, right: clip, bottom: clip, borderRadius: s(INK_RADIUS) }]}>
        <View style={{ position: "absolute", top: -bleed, left: -bleed, right: -bleed, bottom: -bleed }}>
          <Image source={notePaper} style={styles.sheetPaper} resizeMode="cover" />
        </View>
      </View>
      <InkOutline seed={seed} radius={s(INK_RADIUS)} />
      <CornerOrnaments size={s(12)} inset={s(4)} />
    </>
  );
}

const styles = StyleSheet.create({
  sheetClip: { position: "absolute", overflow: "hidden" },
  sheetPaper: { width: "100%", height: "100%" },
});
