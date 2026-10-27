import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, useAnimatedValue, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ThemedButton from "../ThemedButton";
import DiceCanvas from "./DiceCanvas";
import { tapHaptic } from "../../lib/haptics";
import { DIE_SIDES, type DieSides } from "../../lib/dice/dicePolyhedra";
import { canUseAdvantage, formatRoll, MAX_PER_DIE, rollPool, type RollMode, type RollResult } from "../../lib/dice/diceRoll";
import { DiceStage, MAX_SHOWN, type StageDie } from "../../lib/dice/diceStage";
import { landHaptic, nat1Haptic, nat20Haptic, rattleHaptic } from "../../lib/dice/diceHaptics";
import { useShake } from "../../lib/dice/useShake";
import { colors, fonts, radius, useScale } from "../../theme";

const MIN_BONUS = -20;
const MAX_BONUS_UI = 30;
const TRAY_BG = "#1C130B";

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
  const { s, fs } = useScale();
  const insets = useSafeAreaInsets();
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
      <View style={[styles.sheet, { borderRadius: s(radius.panel * 2), padding: s(12) }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: fs(22) }]} accessibilityRole="header">
            Dice
          </Text>
          <Pressable
            onPress={() => {
              tapHaptic();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close dice"
            hitSlop={12}
            style={({ pressed }) => [styles.close, { width: s(34), height: s(34), borderRadius: s(17), opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.closeText, { fontSize: fs(18) }]}>✕</Text>
          </Pressable>
        </View>

        <View
          style={[styles.tray, { borderRadius: s(radius.panel * 2), marginTop: s(8), borderColor: nat === 20 ? colors.gold : colors.panelStroke, borderWidth: nat === 20 ? 3 : 1.5, padding: nat === 20 ? 0 : 1.5 }]}
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

        <View style={[styles.result, { height: s(122), marginTop: s(8) }]} accessibilityLiveRegion="polite">
          {text && result ? (
            <>
              <Text style={[styles.total, { fontSize: fs(40), color: nat === 20 ? colors.gold : nat === 1 ? colors.wordmark : colors.ink }]}>
                {result.total}
                {nat === 20 ? "  Natural 20!" : nat === 1 ? "  Natural 1" : ""}
              </Text>
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
          {DIE_SIDES.map((sides) => {
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
                style={[styles.chip, { height: s(38), borderRadius: s(radius.button) }, on && styles.chipOn]}
              >
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

        <View style={[styles.segment, { marginTop: s(10), borderRadius: s(radius.button), opacity: advantageAllowed ? 1 : 0.45 }]}>
          {(["disadvantage", "normal", "advantage"] as const).map((m) => {
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
                style={[styles.segmentItem, { height: s(34) }, on && styles.segmentOn]}
              >
                <Text style={[styles.segmentText, { fontSize: fs(13) }, on && styles.chipTextOn]} numberOfLines={1} adjustsFontSizeToFit>
                  {m === "disadvantage" ? "Disadvantage" : m === "normal" ? "Normal" : "Advantage"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ThemedButton label={rolling ? "Rolling…" : "Roll"} onPress={roll} disabled={rolling} style={{ marginTop: s(12) }} />
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
        styles.stepButton,
        { width: s(36), height: s(36), borderRadius: s(radius.button), opacity: disabled || !action ? 0.35 : pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[styles.stepSign, { fontSize: fs(20) }]}>{sign}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.stepper, { borderRadius: s(radius.button), paddingHorizontal: s(6), paddingVertical: s(4) }]}>
      {button("−", onMinus)}
      <View style={styles.stepMiddle} accessible accessibilityLabel={`${label} ${value}`}>
        <Text style={[styles.stepLabel, { fontSize: fs(11) }]}>{label.toUpperCase()}</Text>
        <Text style={[styles.stepValue, { fontSize: fs(20) }]}>{value}</Text>
      </View>
      {button("+", onPlus)}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(26,24,22,0.72)" },
  sheet: { flex: 1, backgroundColor: colors.wash, borderWidth: 1.5, borderColor: colors.panelStroke },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.title, color: colors.ink },
  close: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.panelStroke, backgroundColor: colors.panel },
  closeText: { color: colors.ink, fontFamily: fonts.headingBold },
  tray: { flex: 1, minHeight: 160, overflow: "hidden", backgroundColor: TRAY_BG },
  trayNote: { position: "absolute", left: 0, right: 0, textAlign: "center", color: colors.panel, fontFamily: fonts.body, opacity: 0.8 },
  result: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  total: { fontFamily: fonts.stat, textAlign: "center" },
  expression: { fontFamily: fonts.headingBold, color: colors.ink, textAlign: "center" },
  breakdown: { fontFamily: fonts.body, color: colors.muted, textAlign: "center" },
  chips: { flexDirection: "row" },
  chip: { flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.panelStroke, backgroundColor: colors.panel },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.headingBold, color: colors.ink },
  chipTextOn: { color: colors.cream },
  steppers: { flexDirection: "row" },
  stepper: { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.panelStroke, backgroundColor: colors.panel },
  stepButton: { alignItems: "center", justifyContent: "center", backgroundColor: colors.wash },
  stepSign: { fontFamily: fonts.headingBold, color: colors.ink },
  stepMiddle: { flex: 1, alignItems: "center" },
  stepLabel: { fontFamily: fonts.headingBold, color: colors.muted, letterSpacing: 1 },
  stepValue: { fontFamily: fonts.stat, color: colors.ink },
  segment: { flexDirection: "row", overflow: "hidden", borderWidth: 1, borderColor: colors.panelStroke, backgroundColor: colors.panel },
  segmentItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  segmentOn: { backgroundColor: colors.ink },
  segmentText: { fontFamily: fonts.headingBold, color: colors.ink },
});
