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
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { ReactNode } from "react";

import type { AppScreen } from "../navigation/screens";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");
const skull = require("../../assets/Splash Screen/Ark3 3.png");
const underline = require("../../assets/Splash Screen/Rectangle 4901.png");
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
  const angleRef = useRef(0);
  const baseRef = useRef(0);
  const openRef = useRef(onOpen);
  const [titleW, setTitleW] = useState(240);
  openRef.current = onOpen;

  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
  });

  const top = Platform.OS === "android" ? (NativeStatusBar.currentHeight ?? 24) + 2 : 48;
  const tabH = 58 + (Platform.OS === "ios" ? 16 : 8);
  const skullW = width * 1.02;
  const skullH = skullW * (361 / 333);
  const titleSize = Math.min(42, Math.max(34, width * 0.108));
  const titleBlock = titleSize + 18;
  const avail = height - top - skullH * 0.8 - titleBlock - tabH;
  let seal = Math.min(width * 0.325, 150);
  let orbit = seal * 0.8;
  let wheel = (orbit + seal / 2) * 2 + 16;
  if (avail > 180 && wheel > avail) {
    const k = avail / wheel;
    seal *= k;
    orbit *= k;
    wheel = avail;
  }
  const die = seal * 0.78;
  const gem = Math.max(18, seal * 0.16);

  const metrics = useRef({ wheel, orbit, seal });
  metrics.current = { wheel, orbit, seal };

  useEffect(() => {
    const id = rot.addListener(({ value }) => {
      angleRef.current = value;
    });
    return () => rot.removeListener(id);
  }, [rot]);

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
          angleRef.current = snapped;
          rot.setValue(snapped);
        });
        const { wheel: w } = metrics.current;
        const { locationX, locationY } = e.nativeEvent;
        drag.current = {
          x: locationX,
          y: locationY,
          a0: Math.atan2(locationY - w / 2, locationX - w / 2),
          moved: 0,
        };
      },
      onPanResponderMove: (e) => {
        const { wheel: w } = metrics.current;
        const { locationX, locationY } = e.nativeEvent;
        const dx = locationX - drag.current.x;
        const dy = locationY - drag.current.y;
        drag.current.moved = Math.hypot(dx, dy);
        const dist = Math.hypot(locationX - w / 2, locationY - w / 2);
        if (dist < w * 0.12) return;
        const a = Math.atan2(locationY - w / 2, locationX - w / 2);
        const delta = wrapDelta(((a - drag.current.a0) * 180) / Math.PI);
        const preview = Math.max(-22, Math.min(22, delta));
        rot.setValue(baseRef.current + preview);
      },
      onPanResponderRelease: (e) => {
        const { wheel: w, orbit: r, seal: s } = metrics.current;
        const { locationX, locationY } = e.nativeEvent;
        const dist = Math.hypot(locationX - w / 2, locationY - w / 2);
        let delta = 0;
        if (dist >= w * 0.12) {
          const a = Math.atan2(locationY - w / 2, locationX - w / 2);
          delta = wrapDelta(((a - drag.current.a0) * 180) / Math.PI);
        }
        const nudged = drag.current.moved >= 28 && Math.abs(delta) >= 8;
        if (!nudged) {
          if (drag.current.moved < 14) {
            for (const item of SEALS) {
              const a = ((item.deg + baseRef.current) * Math.PI) / 180;
              const cx = w / 2 + Math.cos(a) * r;
              const cy = w / 2 + Math.sin(a) * r;
              const dx = locationX - cx;
              const dy = locationY - cy;
              if (dx * dx + dy * dy <= (s / 2) * (s / 2)) {
                openRef.current(item.screen);
                rot.setValue(baseRef.current);
                return;
              }
            }
          }
          Animated.timing(rot, {
            toValue: baseRef.current,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start();
          return;
        }
        const dir = delta >= 0 ? 1 : -1;
        const next = baseRef.current + dir * STEP;
        baseRef.current = next;
        Animated.timing(rot, {
          toValue: next,
          duration: 340,
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

      <View style={[styles.column, { paddingTop: top, paddingBottom: tabH }]}>
        <Image source={skull} style={{ width: skullW, height: skullH }} resizeMode="contain" />
        <Text
          style={[styles.wordmark, { fontSize: titleSize, lineHeight: titleSize * 1.25, marginTop: -skullH * 0.2 }]}
          onLayout={(e) => setTitleW(e.nativeEvent.layout.width)}
        >
          ARKANE AID
        </Text>
        <Image source={underline} style={{ width: titleW, height: 8, marginTop: 1 }} resizeMode="contain" />

        <View style={styles.wheelSlot}>
          <View pointerEvents="box-only" style={{ width: wheel, height: wheel }} {...pan.panHandlers}>
            <Image
              source={ringArt}
              resizeMode="contain"
              style={{
                position: "absolute",
                width: orbit * 2.08,
                height: orbit * 2.08,
                left: (wheel - orbit * 2.08) / 2,
                top: (wheel - orbit * 2.08) / 2,
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
                      left: wheel / 2 + Math.cos(a) * orbit - gem / 2,
                      top: wheel / 2 + Math.sin(a) * orbit - gem / 2,
                    }}
                  />
                );
              })}
            </Animated.View>

            <Image
              source={dieArt}
              resizeMode="contain"
              pointerEvents="none"
              style={{
                position: "absolute",
                width: die,
                height: die * (134 / 127),
                left: (wheel - die) / 2,
                top: (wheel - die * (134 / 127)) / 2,
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
                      left: wheel / 2 + Math.cos(a) * orbit - seal / 2,
                      top: wheel / 2 + Math.sin(a) * orbit - seal / 2,
                      transform: [{ rotate: unrotate }],
                    }}
                  >
                    <Image source={sealArt} style={styles.sealFill} resizeMode="stretch" />
                    <View style={styles.sealBody}>
                      <SealIcon id={item.id} size={seal * 0.32} />
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={[styles.sealLabel, { fontSize: Math.max(10, seal * 0.1), marginTop: seal * 0.02 }]}
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

      <View style={[styles.tabs, { height: tabH, paddingBottom: Platform.OS === "ios" ? 12 : 4 }]}>
        <Tab onPress={() => onOpen("home")}>
          <House />
        </Tab>
        <Tab onPress={() => onOpen("codex")}>
          <BookIcon size={22} light />
        </Tab>
        <Tab onPress={() => onOpen("sage")}>
          <HatIcon size={26} light />
        </Tab>
        <Tab onPress={() => onOpen("settings")}>
          <GearMark size={22} light />
        </Tab>
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
  if (id === "sage") return <HatIcon size={size * 1.4} />;
  if (id === "tome") return <GearIcon size={size * 1.2} />;
  return <BookIcon size={size * 1.25} />;
}

function HatIcon({ size, light }: { size: number; light?: boolean }) {
  const c = light ? CREAM : INK;
  return (
    <Svg width={size} height={size * 0.72} viewBox="0 0 64 46">
      <Path d="M32 1.5 L48 28 H16 Z" fill={c} />
      <Path d="M20 24.5 H44" stroke={light ? INK : "#F3E6C4"} strokeWidth={2.4} />
      <Path d="M2 33 Q32 48 62 33" stroke={c} strokeWidth={5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function BookIcon({ size, light }: { size: number; light?: boolean }) {
  const c = light ? CREAM : INK;
  return (
    <Svg width={size} height={size * 0.78} viewBox="0 0 64 50">
      <Path d="M32 10 C22 6 8 8 4 12 V42 C14 36 24 36 32 44 Z" fill={c} />
      <Path d="M32 10 C42 6 56 8 60 12 V42 C50 36 40 36 32 44 Z" fill={c} />
      <Path d="M32 12 V42" stroke={light ? INK : "#F3E6C4"} strokeWidth={1.6} />
      <Path d="M14 18 H26 M14 24 H26 M38 18 H50 M38 24 H50" stroke={light ? INK : "#F3E6C4"} strokeWidth={1.3} />
    </Svg>
  );
}

function GearIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x={5} y={5} width={54} height={54} rx={12} fill="none" stroke={INK} strokeWidth={3.4} />
      <Circle cx={32} cy={32} r={6.2} fill="none" stroke={INK} strokeWidth={2.8} />
      <Path
        d="M32 14.5 L34.2 19.2 L32 21.2 L29.8 19.2 Z M32 49.5 L29.8 44.8 L32 42.8 L34.2 44.8 Z M14.5 32 L19.2 29.8 L21.2 32 L19.2 34.2 Z M49.5 32 L44.8 34.2 L42.8 32 L44.8 29.8 Z M19.2 19.2 L23.2 21.4 L22.2 24 L18.8 22.2 Z M44.8 44.8 L40.8 42.6 L41.8 40 L45.2 41.8 Z M44.8 19.2 L40.8 21.4 L41.8 24 L45.2 22.2 Z M19.2 44.8 L23.2 42.6 L22.2 40 L18.8 41.8 Z"
        fill={INK}
      />
    </Svg>
  );
}

function GearMark({ size, light }: { size: number; light?: boolean }) {
  const c = light ? CREAM : INK;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={3} fill="none" stroke={c} strokeWidth={1.7} />
      <Path
        d="M12 2.4 L13.1 5.2 L12 6.2 L10.9 5.2 Z M12 21.6 L10.9 18.8 L12 17.8 L13.1 18.8 Z M2.4 12 L5.2 10.9 L6.2 12 L5.2 13.1 Z M21.6 12 L18.8 13.1 L17.8 12 L18.8 10.9 Z M5.1 5.1 L7.4 6.6 L6.8 7.8 L4.8 6.6 Z M18.9 18.9 L16.6 17.4 L17.2 16.2 L19.2 17.4 Z M18.9 5.1 L16.6 6.6 L17.2 7.8 L19.2 6.6 Z M5.1 18.9 L7.4 17.4 L6.8 16.2 L4.8 17.4 Z"
        fill={c}
      />
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
    fontFamily: "CinzelDecorative_400Regular",
    color: BLOOD,
    textAlign: "center",
  },
  wheelSlot: { flex: 1, alignItems: "center", justifyContent: "center" },
  layer: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  sealFill: { position: "absolute", width: "100%", height: "100%" },
  sealBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  sealLabel: {
    fontFamily: "CinzelDecorative_400Regular",
    color: INK,
    textAlign: "center",
    width: "96%",
  },
  tabs: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#111111",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", height: "100%" },
});
