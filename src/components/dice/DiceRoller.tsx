import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, useAnimatedValue, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import NoteSheet from "../NoteSheet";
import { Flourish, HOLDER_FILL, INK_DARK, INK_RADIUS, InkButton, InkCross, InkOutline, InkRing } from "../Ink";
import DiceCanvas from "./DiceCanvas";
import { tapHaptic } from "../../lib/haptics";
import { DIE_SIDES, type DieSides } from "../../lib/dice/dicePolyhedra";
import { canUseAdvantage, formatRoll, MAX_PER_DIE, rollPool, type RollMode, type RollResult } from "../../lib/dice/diceRoll";
import { DiceStage, MAX_SHOWN, type StageDie } from "../../lib/dice/diceStage";
import { landHaptic, nat1Haptic, nat20Haptic, rattleHaptic } from "../../lib/dice/diceHaptics";
import { useShake } from "../../lib/dice/useShake";
import { colors, fonts, inkText, radius, useScale } from "../../theme";

const MIN_BONUS = -20;
const MAX_BONUS_UI = 30;
const TRAY_BG = "#1C130B";
/** Gap between the tray and the inked line drawn round it on the paper, in design dp. */
const TRAY_FRAME = 4;
/** The tray's own minimum height in dp. */
const TRAY_MIN = 160;

type Setup = { sides: DieSides; count: number; bonus: number; mode: RollMode };

// The last setup, so reopening the roller keeps your 8d6 + 2 (until the app restarts).
let lastSetup: Setup = { sides: 20, count: 1, bonus: 0, mode: "normal" };

type Props = { visible: boolean; onClose: () => void };

/** The dice pop-up. Its contents (and the GL context) only exist while it is open. */
export default function DiceRoller({ visible, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {visible ? <RollerSheet onClose={onClose} /> : null}
    </Modal>
  );
}

function RollerSheet({ onClose }: { onClose: () => void }) {
  const { s, fs, width } = useScale();
  const insets = useSafeAreaInsets();
  const sheetPad = s(12);
  // The Roll button spans the sheet's inner width (backdrop and sheet padding taken off).
  const rollW = width - insets.left - insets.right - s(20) - sheetPad * 2;
  const trayRadius = s(radius.panel * 2);
  const [setup, setSetupState] = useState<Setup>(lastSetup);
  const [result, setResult] = useState<RollResult | null>(null);
  const [rolling, setRolling] = useState(false);
  const [trayReady, setTrayReady] = useState(false);
  const [stage] = useState(() => new DiceStage());
  const pending = useRef<RollResult | null>(null);
  const flash = useAnimatedValue(0);

  const setSetup = (next: Partial<Setup>) => {
    // A new setup clears the old result (the tray shows the new dice).
    pending.current = null;
    setResult(null);
    setSetupState((prev) => {
      const merged = { ...prev, ...next };
      lastSetup = merged;
      return merged;
    });
  };

  const advantageAllowed = setup.sides === 20 && setup.count === 1;
  const mode: RollMode = advantageAllowed ? setup.mode : "normal";

  // Free every geometry and material when the pop-up closes.
  useEffect(() => () => stage.dispose(), [stage]);

  // Between rolls the tray shows the dice you're about to throw, highest face up.
  useEffect(() => {
    if (stage.busy) return;
    const shown = Math.min(MAX_SHOWN, setup.count + (mode === "normal" ? 0 : 1));
    const dice: StageDie[] = Array.from({ length: shown }, () => ({ sides: setup.sides, value: setup.sides }));
    stage.show(dice);
  }, [stage, setup.sides, setup.count, mode]);

  // A throw takes about 1.5 s (longer on a slow phone, as frames are capped at 1/20 s). If no frames run (the GL view isn't up yet, or the app went to
  // the background), the result still arrives after a short wait.
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const landRef = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      if (fallback.current) clearTimeout(fallback.current);
    },
    [],
  );

  useEffect(() => {
    const land = () => {
      if (fallback.current) clearTimeout(fallback.current);
      fallback.current = null;
      const done = pending.current;
      pending.current = null;
      setRolling(false);
      if (!done) return;
      setResult(done);
      if (done.natural === 20) nat20Haptic();
      if (done.natural === 1) {
        nat1Haptic();
        flash.setValue(0.6);
        Animated.timing(flash, { toValue: 0, duration: 700, useNativeDriver: true }).start();
      }
    };
    const unlisten = stage.listen({ impact: () => landHaptic(), settled: land });
    landRef.current = land;
    return () => {
      unlisten();
      landRef.current = null;
    };
  }, [stage, flash]);

  const roll = useCallback(() => {
    if (stage.busy || pending.current) return;
    const pool = { [setup.sides]: setup.count };
    const r = rollPool(pool, setup.bonus, canUseAdvantage(pool) ? mode : "normal");
    const shown = r.dice.slice(0, MAX_SHOWN).map((d) => ({ sides: d.sides, value: d.value, kept: d.kept }));
    pending.current = r;
    setResult(null);
    setRolling(true);
    stage.roll(shown);
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = setTimeout(() => {
      fallback.current = null;
      if (pending.current !== r) return;
      stage.show(shown);
      landRef.current?.();
    }, 6000);
  }, [stage, setup.sides, setup.count, setup.bonus, mode]);

  useShake(true, {
    onJolt: () => {
      if (stage.busy) return;
      stage.rattle();
      rattleHaptic();
    },
    onShakeEnd: roll,
  });

  const text = result ? formatRoll(result) : null;
  const nat = result?.natural ?? null;
  const total = result ? result.dice.length : setup.count + (mode === "normal" ? 0 : 1);

  return (
    <View style={[styles.backdrop, { paddingTop: insets.top + s(10), paddingBottom: insets.bottom + s(10), paddingLeft: insets.left + s(10), paddingRight: insets.right + s(10) }]}>
      <View style={[styles.sheet, { padding: sheetPad }]}>
        <NoteSheet seed={71} />
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              tapHaptic();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close dice"
            hitSlop={12}
            style={({ pressed }) => [styles.round, { width: s(34), height: s(34), opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={styles.ring} pointerEvents="none">
              <InkRing size={s(34)} seed={17} dots={false} />
            </View>
            <InkCross size={s(14)} color={INK_DARK} seed={7} />
          </Pressable>
        </View>

        {/* The dark tray sits inside a hand-inked line on the paper; the line never takes touches or changes the tray's size. */}
        <View style={[styles.trayFrame, { marginTop: s(8), padding: s(TRAY_FRAME), minHeight: TRAY_MIN + s(TRAY_FRAME) * 2 }]}>
          <InkOutline seed={73} radius={trayRadius + s(TRAY_FRAME)} />
          <View
            style={[styles.tray, { borderRadius: trayRadius, borderColor: nat === 20 ? colors.gold : colors.panelStroke, borderWidth: nat === 20 ? 3 : 1.5, padding: nat === 20 ? 0 : 1.5 }]}
            onLayout={(e) => {
              if (e.nativeEvent.layout.width > 0 && e.nativeEvent.layout.height > 0) setTrayReady(true);
            }}
          >
            {trayReady ? <DiceCanvas stage={stage} /> : null}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary, opacity: flash }]} />
            {total > MAX_SHOWN ? (
              <Text pointerEvents="none" style={[styles.trayNote, { top: s(8), fontSize: fs(12) }]}>
                Showing {MAX_SHOWN} of {total} dice · all are counted
              </Text>
            ) : null}
            {!rolling && !result ? (
              <Text pointerEvents="none" style={[styles.trayNote, { bottom: s(8), fontSize: fs(12) }]}>
                Shake your phone or tap Roll
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.result, { height: s(122), marginTop: s(8) }]} accessibilityLiveRegion="polite">
          {text && result ? (
            <>
              <Text
                style={[styles.total, { fontSize: fs(30), lineHeight: fs(36), color: nat === 20 ? colors.gold : nat === 1 ? colors.wordmark : colors.ink }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {result.total}
                {nat === 20 ? "  Natural 20!" : nat === 1 ? "  Natural 1" : ""}
              </Text>
              <Flourish width={s(40)} color={colors.cardStroke} />
              <Text style={[styles.expression, { fontSize: fs(15) }]} numberOfLines={1} adjustsFontSizeToFit>
                {text.expression} = {result.total}
              </Text>
              <Text style={[styles.breakdown, { fontSize: fs(13) }]} numberOfLines={3}>
                {text.breakdown}
              </Text>
            </>
          ) : (
            <Text style={[styles.expression, { fontSize: fs(16), color: colors.muted }]}>
              {rolling ? "Rolling…" : `${setup.count}d${setup.sides}${setup.bonus > 0 ? ` + ${setup.bonus}` : setup.bonus < 0 ? ` − ${-setup.bonus}` : ""}`}
            </Text>
          )}
        </View>

        <View style={[styles.chips, { marginTop: s(6), gap: s(6) }]}>
          {DIE_SIDES.map((sides, i) => {
            const on = sides === setup.sides;
            return (
              <Pressable
                key={sides}
                onPress={() => {
                  tapHaptic();
                  setSetup({ sides });
                }}
                disabled={rolling}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: rolling }}
                accessibilityLabel={`d${sides}`}
                style={[styles.chip, { height: s(38) }]}
              >
                <InkOutline seed={80 + i} radius={s(INK_RADIUS)} fill={on ? INK_DARK : HOLDER_FILL} />
                <Text style={[styles.chipText, { fontSize: fs(15) }, on && styles.chipTextOn]}>d{sides}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.steppers, { marginTop: s(10), gap: s(10) }]}>
          <Stepper
            label="Dice"
            value={String(setup.count)}
            disabled={rolling}
            onMinus={setup.count > 1 ? () => setSetup({ count: setup.count - 1 }) : undefined}
            onPlus={setup.count < MAX_PER_DIE ? () => setSetup({ count: setup.count + 1 }) : undefined}
          />
          <Stepper
            label="Bonus"
            value={setup.bonus > 0 ? `+${setup.bonus}` : setup.bonus < 0 ? `−${-setup.bonus}` : "0"}
            disabled={rolling}
            onMinus={setup.bonus > MIN_BONUS ? () => setSetup({ bonus: setup.bonus - 1 }) : undefined}
            onPlus={setup.bonus < MAX_BONUS_UI ? () => setSetup({ bonus: setup.bonus + 1 }) : undefined}
          />
        </View>

        <View style={[styles.segment, { marginTop: s(10), gap: s(6), opacity: advantageAllowed ? 1 : 0.45 }]}>
          {(["disadvantage", "normal", "advantage"] as const).map((m, i) => {
            const on = mode === m;
            return (
              <Pressable
                key={m}
                disabled={!advantageAllowed || rolling}
                onPress={() => {
                  tapHaptic();
                  setSetup({ mode: m });
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: !advantageAllowed || rolling }}
                accessibilityHint={advantageAllowed ? undefined : "Only for a single d20"}
                style={[styles.segmentItem, { height: s(34), paddingHorizontal: s(4) }]}
              >
                <InkOutline seed={90 + i} radius={s(INK_RADIUS)} fill={on ? INK_DARK : HOLDER_FILL} />
                <Text style={[styles.segmentText, { fontSize: fs(13) }, on && styles.chipTextOn]} numberOfLines={1} adjustsFontSizeToFit>
                  {m === "disadvantage" ? "Disadvantage" : m === "normal" ? "Normal" : "Advantage"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: s(12) }}>
          <InkButton label={rolling ? "Rolling…" : "Roll"} variant="red" width={rollW} height={s(44)} seed={77} onPress={roll} disabled={rolling} />
        </View>
      </View>
    </View>
  );
}

function Stepper({
  label,
  value,
  disabled,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onMinus?: () => void;
  onPlus?: () => void;
}) {
  const { s, fs } = useScale();
  const ring = s(36);
  const button = (sign: "−" | "+", action?: () => void) => (
    <Pressable
      onPress={() => {
        if (!action) return;
        tapHaptic();
        action();
      }}
      disabled={disabled || !action}
      accessibilityRole="button"
      accessibilityLabel={`${sign === "+" ? "More" : "Less"} ${label.toLowerCase()}`}
      hitSlop={6}
      style={({ pressed }) => [
        styles.round,
        { width: ring, height: ring, opacity: disabled || !action ? 0.35 : pressed ? 0.6 : 1 },
      ]}
    >
      <View style={styles.ring} pointerEvents="none">
        <InkRing size={ring} seed={sign === "+" ? 19 : 23} dots={false} />
      </View>
      <Text style={[styles.stepSign, { fontSize: fs(20) }]}>{sign}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.stepper, { gap: s(4) }]}>
      {button("−", onMinus)}
      <View style={[styles.stepMiddle, { height: s(44) }]} accessible accessibilityLabel={`${label} ${value}`}>
        <InkOutline seed={label.length + 50} radius={s(INK_RADIUS)} fill={HOLDER_FILL} />
        <Text style={[styles.stepLabel, { fontSize: fs(11) }]}>{label.toUpperCase()}</Text>
        <Text style={[styles.stepValue, { fontSize: fs(20) }]}>{value}</Text>
      </View>
      {button("+", onPlus)}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(26,24,22,0.72)" },
  sheet: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  // Close and stepper buttons: a hand-inked ring with the mark centred in it.
  round: { alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", top: 0, left: 0 },
  trayFrame: { flex: 1 },
  tray: { flex: 1, minHeight: TRAY_MIN, overflow: "hidden", backgroundColor: TRAY_BG },
  trayNote: { position: "absolute", left: 0, right: 0, textAlign: "center", color: colors.panel, fontFamily: fonts.body, opacity: 0.8 },
  result: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  total: { fontFamily: fonts.title, textAlign: "center", ...inkText.heading },
  expression: { fontFamily: fonts.headingBold, color: colors.ink, textAlign: "center" },
  breakdown: { fontFamily: fonts.body, color: colors.muted, textAlign: "center" },
  chips: { flexDirection: "row" },
  chip: { flex: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.headingBold, color: colors.ink },
  chipTextOn: { color: colors.cream },
  steppers: { flexDirection: "row" },
  stepper: { flex: 1, flexDirection: "row", alignItems: "center" },
  stepSign: { fontFamily: fonts.headingBold, color: colors.ink },
  stepMiddle: { flex: 1, alignItems: "center", justifyContent: "center" },
  stepLabel: { fontFamily: fonts.headingBold, color: colors.muted, letterSpacing: 1 },
  stepValue: { fontFamily: fonts.stat, color: colors.ink },
  segment: { flexDirection: "row" },
  segmentItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  segmentText: { fontFamily: fonts.headingBold, color: colors.ink },
});
