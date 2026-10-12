import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Cinzel_400Regular, Cinzel_600SemiBold } from "@expo-google-fonts/cinzel";
import * as NavigationBar from "expo-navigation-bar";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { ReactNode } from "react";

import type { AppScreen } from "../navigation/screens";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");
const skull = require("../../assets/Splash Screen/Ark3 3.png");
const sealArt = require("../../assets/DasbBoard/OIP 2.png");
const ringArt = require("../../assets/DasbBoard/Ellipse 21.png");
const dieArt = require("../../assets/DasbBoard/Group 5964.png");
const gemRed = require("../../assets/DasbBoard/Group 5931.png");
const gemGreen = require("../../assets/DasbBoard/Group 5929.png");
const gemBlue = require("../../assets/DasbBoard/Group 5930.png");

const INK = "#1A1816";
const BLOOD = "#A33A3A";
const CREAM = "#FEFCEB";
const STEP = 120;

type SealId = "sage" | "tome" | "codex";

const SEALS: { id: SealId; label: string; deg: number; screen: AppScreen }[] = [
  { id: "sage", label: "SAGE SCRIBE", deg: 210, screen: "sage" },
  { id: "tome", label: "TOME", deg: 330, screen: "ledger" },
  { id: "codex", label: "CODEX", deg: 90, screen: "codex" },
];

const GEMS: { source: number; deg: number }[] = [
  { source: gemRed, deg: 270 },
  { source: gemGreen, deg: 150 },
  { source: gemBlue, deg: 30 },
];

type Props = { onOpen: (screen: AppScreen) => void };

function wrapDelta(delta: number) {
  let d = delta;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

export default function HomeScreen({ onOpen }: Props) {
  const { width, height } = useWindowDimensions();
  const rot = useRef(new Animated.Value(0)).current;
  const baseRef = useRef(0);
  const openRef = useRef(onOpen);
  const [titleW, setTitleW] = useState(220);
  openRef.current = onOpen;

  const [fontsLoaded] = useFonts({
    Cinzel_400Regular,
    Cinzel_600SemiBold,
  });

  useEffect(() => {
    if (Platform.OS !== "android") return;
    NavigationBar.setPositionAsync("relative").catch(() => undefined);
    NavigationBar.setBackgroundColorAsync("#111111").catch(() => undefined);
    NavigationBar.setButtonStyleAsync("light").catch(() => undefined);
  }, []);

  const top = Platform.OS === "android" ? (NativeStatusBar.currentHeight ?? 24) + 6 : 52;
  const tabH = 62;
  const skullW = width * 0.86;
  const skullH = skullW * (361 / 333);
  const titleSize = Math.min(32, Math.max(26, width * 0.078));

  let seal = Math.min(width * 0.3, 136);
  let orbit = seal * 0.78;
  let reach = orbit + seal / 2 + 8;
  let wheel = reach * 2;
  const room = height - top - skullH * 0.8 - (titleSize + 22) - tabH - 8;
  if (room > 180 && wheel > room) {
    const k = room / wheel;
    seal *= k;
    orbit *= k;
    reach = orbit + seal / 2 + 8;
    wheel = reach * 2;
  }
  const cx = wheel / 2;
  const cy = wheel / 2;
  const die = seal * 0.7;
  const gem = Math.max(16, seal * 0.15);

  const metrics = useRef({ cx, cy, orbit, seal });
  metrics.current = { cx, cy, orbit, seal };

  const rotate = rot.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-1deg", "1deg"],
  });
  const unrotate = rot.interpolate({
    inputRange: [-1, 1],
    outputRange: ["1deg", "-1deg"],
  });

  const drag = useRef({ x: 0, y: 0, a0: 0, moved: 0 });
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        rot.stopAnimation((value) => {
          const snapped = Math.round(value / STEP) * STEP;
          baseRef.current = snapped;
          rot.setValue(snapped);
        });
        const { cx: x0, cy: y0 } = metrics.current;
        const { locationX, locationY } = e.nativeEvent;
        drag.current = {
          x: locationX,
          y: locationY,
          a0: Math.atan2(locationY - y0, locationX - x0),
          moved: 0,
        };
      },
      onPanResponderMove: (e) => {
        const { cx: x0, cy: y0 } = metrics.current;
        const { locationX, locationY } = e.nativeEvent;
        drag.current.moved = Math.hypot(locationX - drag.current.x, locationY - drag.current.y);
        if (Math.hypot(locationX - x0, locationY - y0) < 36) return;
        const a = Math.atan2(locationY - y0, locationX - x0);
        const delta = wrapDelta(((a - drag.current.a0) * 180) / Math.PI);
        rot.setValue(baseRef.current + Math.max(-18, Math.min(18, delta)));
      },
      onPanResponderRelease: (e) => {
        const { cx: x0, cy: y0, orbit: r, seal: s } = metrics.current;
        const { locationX, locationY } = e.nativeEvent;
        let delta = 0;
        if (Math.hypot(locationX - x0, locationY - y0) >= 36) {
          const a = Math.atan2(locationY - y0, locationX - x0);
          delta = wrapDelta(((a - drag.current.a0) * 180) / Math.PI);
        }
        const nudged = drag.current.moved >= 36 && Math.abs(delta) >= 8;
        if (!nudged) {
          if (drag.current.moved < 16) {
            for (const item of SEALS) {
              const a = ((item.deg + baseRef.current) * Math.PI) / 180;
              const sx = x0 + Math.cos(a) * r;
              const sy = y0 + Math.sin(a) * r;
              const dx = locationX - sx;
              const dy = locationY - sy;
              if (dx * dx + dy * dy <= (s / 2) * (s / 2)) {
                openRef.current(item.screen);
                rot.setValue(baseRef.current);
                return;
              }
            }
          }
          Animated.timing(rot, {
            toValue: baseRef.current,
            duration: 160,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start();
          return;
        }
        const next = baseRef.current + (delta >= 0 ? STEP : -STEP);
        baseRef.current = next;
        Animated.timing(rot, {
          toValue: next,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  if (!fontsLoaded) return <View style={styles.fallback} />;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <View style={[styles.column, { paddingTop: top }]}>
        <Image source={skull} style={{ width: skullW, height: skullH }} resizeMode="contain" />
        <Text
          onLayout={(e) => setTitleW(e.nativeEvent.layout.width)}
          style={[
            styles.wordmark,
            { fontSize: titleSize, lineHeight: titleSize + 4, marginTop: -skullH * 0.17 },
          ]}
        >
          ARKANE AID
        </Text>
        <View style={[styles.rule, { width: Math.max(titleW * 0.72, 120) }]} />

        <View style={styles.wheelSlot}>
          <View pointerEvents="box-only" style={{ width: wheel, height: wheel }} {...pan.panHandlers}>
            <Image
              source={ringArt}
              resizeMode="contain"
              style={{
                position: "absolute",
                width: orbit * 2.06,
                height: orbit * 2.06,
                left: cx - orbit * 1.03,
                top: cy - orbit * 1.03,
              }}
            />

            <Animated.View pointerEvents="none" style={[styles.layer, { transform: [{ rotate }] }]}>
              {GEMS.map((item) => {
                const a = (item.deg * Math.PI) / 180;
                return (
                  <Image
                    key={item.deg}
                    source={item.source}
                    resizeMode="contain"
                    style={{
                      position: "absolute",
                      width: gem,
                      height: gem,
                      left: cx + Math.cos(a) * orbit - gem / 2,
                      top: cy + Math.sin(a) * orbit - gem / 2,
                    }}
                  />
                );
              })}
            </Animated.View>

            <Image
              source={dieArt}
              pointerEvents="none"
              resizeMode="contain"
              style={{
                position: "absolute",
                width: die,
                height: die * (134 / 127),
                left: cx - die / 2,
                top: cy - (die * (134 / 127)) / 2,
                zIndex: 2,
              }}
            />

            <Animated.View pointerEvents="none" style={[styles.layer, { zIndex: 3, transform: [{ rotate }] }]}>
              {SEALS.map((item) => {
                const a = (item.deg * Math.PI) / 180;
                return (
                  <Animated.View
                    key={item.id}
                    style={{
                      position: "absolute",
                      width: seal,
                      height: seal,
                      left: cx + Math.cos(a) * orbit - seal / 2,
                      top: cy + Math.sin(a) * orbit - seal / 2,
                      transform: [{ rotate: unrotate }],
                    }}
                  >
                    <Image source={sealArt} style={styles.sealFill} resizeMode="stretch" />
                    <View style={styles.sealBody}>
                      <SealIcon id={item.id} size={seal * 0.34} />
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.65}
                        style={[styles.sealLabel, { fontSize: Math.max(9, seal * 0.095), marginTop: seal * 0.04 }]}
                      >
                        {item.label}
                      </Text>
                    </View>
                  </Animated.View>
                );
              })}
            </Animated.View>
          </View>
        </View>

        <View style={[styles.tabs, { height: tabH }]}>
          <Tab onPress={() => onOpen("home")}>
            <House />
          </Tab>
          <Tab onPress={() => onOpen("codex")}>
            <BookIcon size={24} light />
          </Tab>
          <Tab onPress={() => onOpen("sage")}>
            <HatIcon size={28} light />
          </Tab>
          <Tab onPress={() => onOpen("settings")}>
            <GearIcon size={22} light />
          </Tab>
        </View>
      </View>
    </View>
  );
}

function Tab({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <Pressable style={styles.tab} onPress={onPress} hitSlop={8}>
      {children}
    </Pressable>
  );
}

function SealIcon({ id, size }: { id: SealId; size: number }) {
  if (id === "sage") return <HatIcon size={size * 1.45} />;
  if (id === "tome") return <GearIcon size={size * 1.15} />;
  return <BookIcon size={size * 1.25} />;
}

function HatIcon({ size, light }: { size: number; light?: boolean }) {
  const c = light ? CREAM : INK;
  const band = light ? INK : "#F3E6C4";
  return (
    <Svg width={size} height={size * 0.7} viewBox="0 0 70 48">
      <Path d="M36 2 C30 12 26 20 20 30 H48 C44 20 42 10 36 2 Z" fill={c} />
      <Path d="M24 26.5 H46" stroke={band} strokeWidth={2.4} />
      <Path d="M4 34 Q35 50 66 33" stroke={c} strokeWidth={5.2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function BookIcon({ size, light }: { size: number; light?: boolean }) {
  const c = light ? CREAM : INK;
  const page = light ? INK : "#F3E6C4";
  return (
    <Svg width={size} height={size * 0.72} viewBox="0 0 68 48">
      <Path d="M34 12 C26 8 12 9 6 14 V40 C16 35 26 35 34 42 Z" fill={c} />
      <Path d="M34 12 C42 8 56 9 62 14 V40 C52 35 42 35 34 42 Z" fill={c} />
      <Path d="M34 13.5 V40" stroke={page} strokeWidth={1.6} />
      <Path d="M14 20 H26 M14 25 H26 M42 20 H54 M42 25 H54" stroke={page} strokeWidth={1.4} />
    </Svg>
  );
}

function GearIcon({ size, light }: { size: number; light?: boolean }) {
  const c = light ? CREAM : INK;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x={7} y={7} width={50} height={50} rx={11} fill="none" stroke={c} strokeWidth={3.2} />
      <Circle cx={32} cy={32} r={6} fill="none" stroke={c} strokeWidth={2.8} />
      <Rect x={29.2} y={15} width={5.6} height={7} rx={1} fill={c} />
      <Rect x={29.2} y={42} width={5.6} height={7} rx={1} fill={c} />
      <Rect x={15} y={29.2} width={7} height={5.6} rx={1} fill={c} />
      <Rect x={42} y={29.2} width={7} height={5.6} rx={1} fill={c} />
      <Rect x={18.2} y={18.2} width={5.2} height={6.2} rx={1} fill={c} transform="rotate(-45 20.8 21.3)" />
      <Rect x={40.6} y={18.2} width={5.2} height={6.2} rx={1} fill={c} transform="rotate(45 43.2 21.3)" />
      <Rect x={18.2} y={39.6} width={5.2} height={6.2} rx={1} fill={c} transform="rotate(45 20.8 42.7)" />
      <Rect x={40.6} y={39.6} width={5.2} height={6.2} rx={1} fill={c} transform="rotate(-45 43.2 42.7)" />
    </Svg>
  );
}

function House() {
  return (
    <Svg width={22} height={20} viewBox="0 0 22 20">
      <Path d="M1 9.2 L11 1.4 L21 9.2 V19 H14 V12.2 H8 V19 H1 Z" fill={CREAM} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, backgroundColor: "#E8D7B8" },
  root: { flex: 1, backgroundColor: "#E8D7B8" },
  parchment: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0.28,
  },
  column: { flex: 1, alignItems: "center" },
  wordmark: {
    fontFamily: "Cinzel_600SemiBold",
    color: BLOOD,
    textAlign: "center",
    letterSpacing: 1.6,
  },
  rule: {
    height: 1.5,
    backgroundColor: BLOOD,
    marginTop: 4,
    opacity: 0.9,
  },
  wheelSlot: { flex: 1, alignItems: "center", justifyContent: "center" },
  layer: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  sealFill: { position: "absolute", width: "100%", height: "100%" },
  sealBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  sealLabel: {
    fontFamily: "Cinzel_400Regular",
    color: INK,
    letterSpacing: 0.4,
    textAlign: "center",
    width: "94%",
  },
  tabs: {
    alignSelf: "stretch",
    backgroundColor: "#111111",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", height: "100%" },
});
