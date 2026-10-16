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

import type { AppScreen } from "../navigation/screens";
import Rule from "../components/Rule";
import Witch from "../../assets/Icons/icons8-witch-hat.svg";
import Book from "../../assets/Icons/icons8-book.svg";
import Settings from "../../assets/Icons/icons8-settings.svg";

const parchment = require("../../assets/images/backgrounds/parchment.png");
// 3x transparent exports from the Figma dashboard frame 2320:2434.
const skull = require("../../assets/images/dashboard/skull-dragon.png"); // Ark3 3, 2132:51
const sealArt = require("../../assets/images/dashboard/seal-parchment.png"); // OIP 2, 2072:543
const ring1 = require("../../assets/images/dashboard/ring-outer.png"); // Ellipse 21, 2069:522
const ring2 = require("../../assets/images/dashboard/ring-inner.png"); // Ellipse 31, 2072:571
const dieArt = require("../../assets/images/dashboard/die-d20.png"); // Group 5964, 2201:181
const gemRed = require("../../assets/images/dashboard/gem-red.png"); // Group 5931
const gemGreen = require("../../assets/images/dashboard/gem-green.png"); // Group 5929
const gemBlue = require("../../assets/images/dashboard/gem-blue.png"); // Group 5930

const INK = "#1A1816";
const SPLASH = "#A33A3A";
// The old 221 x 3 underline PNG (#2E2E2E, soft edges) is now a crisp 1 dp rule.
const UNDERLINE = "rgba(46,46,46,0.8)";
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
  { id: "tome", label: "Tome", deg: 330, screen: "settings" },
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
        <Rule
          width={219 * s}
          color={UNDERLINE}
          style={{ position: "absolute", left: 71 * s, top: 388.5 * s - 0.5 }}
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
                    <SealIcon id={item.id} size={seal * 0.38} />
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

const SEAL_ICONS = {
  sage: Witch,
  tome: Settings,
  codex: Book,
} as const;

function SealIcon({ id, size }: { id: SealId; size: number }) {
  const Icon = SEAL_ICONS[id];
  return <Icon width={size} height={size} color={INK} />;
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
