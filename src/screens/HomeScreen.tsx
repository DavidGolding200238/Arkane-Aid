import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import { Asul_400Regular } from "@expo-google-fonts/asul";
import * as NavigationBar from "expo-navigation-bar";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import type { AppScreen } from "../navigation/screens";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");
const skull = require("../../assets/Splash Screen/Ark3 3.png");
const underline = require("../../assets/Splash Screen/Rectangle 4901.png");
const sealArt = require("../../assets/DasbBoard/OIP 2.png");
const ring1 = require("../../assets/DasbBoard/ring1.png");
const ring2 = require("../../assets/DasbBoard/ring2.png");
const dieArt = require("../../assets/DasbBoard/Group 5964.png");
const gemRed = require("../../assets/DasbBoard/Group 5931.png");
const gemGreen = require("../../assets/DasbBoard/Group 5929.png");
const gemBlue = require("../../assets/DasbBoard/Group 5930.png");

const INK = "#1A1816";
const CREAM = "#FEFCEB";
const SPLASH = "#A33A3A";
const STEP = 120;

const DW = 360;
const DH = 780;
const CX = 180;
const CY = 538;
const SEAL = 115;
const SEAL_R = 111.9;
const GEM = 23;

type SealId = "sage" | "tome" | "codex";

const SEALS: { id: SealId; label: string; deg: number; screen: AppScreen }[] = [
  { id: "sage", label: "Sage Scribe", deg: 210, screen: "sage" },
  { id: "tome", label: "Tome", deg: 330, screen: "ledger" },
  { id: "codex", label: "CODEX", deg: 90, screen: "codex" },
];

const GEMS: { source: number; deg: number; r: number }[] = [
  { source: gemRed, deg: 270, r: 72 },
  { source: gemGreen, deg: 150, r: 72 },
  { source: gemBlue, deg: 30, r: 72 },
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
  openRef.current = onOpen;

  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    Asul_400Regular,
  });

  useEffect(() => {
    if (Platform.OS !== "android") return;
    NavigationBar.setPositionAsync("relative").catch(() => undefined);
  }, []);

  const s = Math.min(width / DW, height / DH);
  const stageW = DW * s;
  const stageH = DH * s;
  const seal = SEAL * s;
  const orbit = SEAL_R * s;
  const gem = GEM * s;
  const wheel = 340 * s;
  const wx = (CX - 170) * s;
  const wy = (CY - 170 + 32) * s;
  const lx = wheel / 2;
  const ly = wheel / 2;

  const metrics = useRef({ lx, ly, orbit, seal });
  metrics.current = { lx, ly, orbit, seal };

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
        const { lx: x0, ly: y0 } = metrics.current;
        const { locationX, locationY } = e.nativeEvent;
        drag.current = {
          x: locationX,
          y: locationY,
          a0: Math.atan2(locationY - y0, locationX - x0),
          moved: 0,
        };
      },
      onPanResponderMove: (e) => {
        const { lx: x0, ly: y0 } = metrics.current;
        const { locationX, locationY } = e.nativeEvent;
        drag.current.moved = Math.hypot(locationX - drag.current.x, locationY - drag.current.y);
        if (Math.hypot(locationX - x0, locationY - y0) < 28) return;
        const a = Math.atan2(locationY - y0, locationX - x0);
        const delta = wrapDelta(((a - drag.current.a0) * 180) / Math.PI);
        rot.setValue(baseRef.current + Math.max(-18, Math.min(18, delta)));
      },
      onPanResponderRelease: (e) => {
        const { lx: x0, ly: y0, orbit: r, seal: sz } = metrics.current;
        const { locationX, locationY } = e.nativeEvent;
        let delta = 0;
        if (Math.hypot(locationX - x0, locationY - y0) >= 28) {
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
              if (dx * dx + dy * dy <= (sz / 2) * (sz / 2)) {
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

      <View style={[styles.stage, { width: stageW, height: stageH }]}>
        <Image
          source={skull}
          resizeMode="contain"
          style={{ position: "absolute", left: 14.3 * s, top: 50 * s, width: 331.4 * s, height: 360 * s }}
        />

        <Text style={[styles.wordmark, { left: 20 * s, top: 348 * s, width: 320 * s, fontSize: 36 * s, color: SPLASH, opacity: 0.82 }]}>
          Arkane Aid
        </Text>
        <Image
          source={underline}
          resizeMode="contain"
          style={{ position: "absolute", left: 71 * s, top: 385 * s, width: 219 * s, height: 8 * s }}
        />

        <Image
          source={ring1}
          resizeMode="contain"
          style={{ position: "absolute", left: 72 * s, top: 462 * s, width: 216 * s, height: 216 * s }}
        />
        <Image
          source={ring2}
          resizeMode="contain"
          style={{ position: "absolute", left: 80 * s, top: 470 * s, width: 200 * s, height: 200 * s }}
        />
        <Image
          source={dieArt}
          resizeMode="contain"
          style={{ position: "absolute", left: 116 * s, top: 519 * s, width: 128 * s, height: 102 * s, zIndex: 2 }}
        />

        <View
          pointerEvents="box-only"
          style={{ position: "absolute", left: wx, top: wy, width: wheel, height: wheel }}
          {...pan.panHandlers}
        >
          <Animated.View pointerEvents="none" style={[styles.layer, { transform: [{ rotate }] }]}>
            {GEMS.map((item) => {
              const a = (item.deg * Math.PI) / 180;
              const gr = item.r * s;
              return (
                <Image
                  key={item.deg}
                  source={item.source}
                  resizeMode="contain"
                  style={{
                    position: "absolute",
                    width: gem,
                    height: gem,
                    left: lx + Math.cos(a) * gr - gem / 2,
                    top: ly + Math.sin(a) * gr - gem / 2,
                  }}
                />
              );
            })}
          </Animated.View>

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
                    left: lx + Math.cos(a) * orbit - seal / 2,
                    top: ly + Math.sin(a) * orbit - seal / 2,
                    transform: [{ rotate: unrotate }],
                  }}
                >
                  <Image source={sealArt} style={styles.sealFill} resizeMode="stretch" />
                  <View style={styles.sealBody}>
                    <SealIcon id={item.id} size={seal * 0.42} />
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                      style={[styles.sealLabel, { fontSize: 14 * s, marginTop: 2 * s }]}
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
    </View>
  );
}

function SealIcon({ id, size }: { id: SealId; size: number }) {
  if (id === "sage") return <HatIcon size={size * 1.35} />;
  if (id === "tome") return <GearIcon size={size * 1.1} />;
  return <BookIcon size={size * 1.2} />;
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

const styles = StyleSheet.create({
  fallback: { flex: 1, backgroundColor: "#E8D7B8" },
  root: { flex: 1, backgroundColor: "#E8D7B8", alignItems: "center" },
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
  stage: { position: "relative" },
  wordmark: {
    position: "absolute",
    fontFamily: "CinzelDecorative_400Regular",
    textAlign: "center",
  },
  layer: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  sealFill: { position: "absolute", width: "100%", height: "100%" },
  sealBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  sealLabel: {
    fontFamily: "Asul_400Regular",
    color: INK,
    textAlign: "center",
    width: "94%",
  },
});
