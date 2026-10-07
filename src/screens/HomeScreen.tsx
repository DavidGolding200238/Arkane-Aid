import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_400Regular_Italic,
} from "@expo-google-fonts/atkinson-hyperlegible";
import Svg, { Circle, Line, Path, Polygon } from "react-native-svg";
import type { ReactNode } from "react";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");
const skull = require("../../assets/Splash Screen/Dragon Logo.png");
const underline = require("../../assets/Splash Screen/Rectangle 4901.png");

const INK = "#1A1816";
const CREAM = "#F4E6C8";
const GOLD = "#BD7F02";
const BLOOD = "#8E2E2A";

type Props = { onBack: () => void };

export default function HomeScreen({ onBack }: Props) {
  const { width, height } = useWindowDimensions();
  const [titleW, setTitleW] = useState(180);
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_400Regular_Italic,
  });

  useEffect(() => {
    const turn = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 56000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    );
    turn.start();
    breathe.start();
    return () => {
      turn.stop();
      breathe.stop();
    };
  }, [pulse, spin]);

  if (!fontsLoaded) return <View style={styles.fallback} />;

  const heroW = Math.min(width * 0.52, 200);
  const heroH = heroW * (361 / 333);
  const stage = Math.min(width - 8, height * 0.46);
  const seal = stage * 0.27;
  const radius = stage * 0.34;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });

  const seat = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return {
      left: stage / 2 + Math.cos(a) * radius - seal / 2,
      top: stage / 2 + Math.sin(a) * radius - seal / 2,
    };
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />
      <View style={styles.wash} pointerEvents="none" />
      <Corner style={{ top: 18, left: 14 }} />
      <Corner style={{ top: 18, right: 14, transform: [{ scaleX: -1 }] }} />
      <Corner style={{ bottom: 76, left: 14, transform: [{ scaleY: -1 }] }} />
      <Corner style={{ bottom: 76, right: 14, transform: [{ scaleX: -1 }, { scaleY: -1 }] }} />

      <Pressable onPress={onBack} style={styles.back} hitSlop={12}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.hero}>
        <Image source={skull} style={{ width: heroW, height: heroH, marginBottom: -heroH * 0.16 }} resizeMode="contain" />
        <Text style={styles.wordmark} onLayout={(e) => setTitleW(e.nativeEvent.layout.width)}>
          Arkane Aid
        </Text>
        <Image source={underline} style={{ width: titleW, height: 7, marginTop: 1 }} resizeMode="contain" />
        <Text style={styles.kicker}>The table is set</Text>
      </View>

      <View style={[styles.stage, { width: stage, height: stage }]}>
        <Animated.View style={[styles.ring, { width: stage, height: stage, transform: [{ rotate }] }]}>
          <TickRing size={stage} />
        </Animated.View>

        <Animated.View
          style={[
            styles.dieWrap,
            { transform: [{ scale }], top: stage / 2 - 46, left: stage / 2 - 46 },
          ]}
        >
          <Die />
        </Animated.View>

        <Seal label="Sage" style={seat(206)} size={seal} icon={<Hat />} />
        <Seal label="Tome" style={seat(334)} size={seal} icon={<Gear />} />
        <Seal label="Codex" style={seat(90)} size={seal} icon={<Book />} />
      </View>

      <View style={styles.tabs}>
        <View style={styles.tabRule} />
        <View style={styles.tabRow}>
          <Tab icon={<House on />} active />
          <Tab icon={<Book light />} />
          <Tab icon={<Hat light />} />
          <Tab icon={<Gear light />} />
        </View>
      </View>
    </View>
  );
}

function TickRing({ size }: { size: number }) {
  const c = size / 2;
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const outer = c - 6;
    const inner = c - (i % 5 === 0 ? 18 : 12);
    return {
      x1: c + Math.cos(a) * inner,
      y1: c + Math.sin(a) * inner,
      x2: c + Math.cos(a) * outer,
      y2: c + Math.sin(a) * outer,
      major: i % 5 === 0,
    };
  });
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={c - 5} stroke={INK} strokeWidth={1.1} fill="none" opacity={0.55} />
      <Circle cx={c} cy={c} r={c - 24} stroke={GOLD} strokeWidth={0.8} fill="none" opacity={0.85} />
      <Circle cx={c} cy={c} r={c * 0.22} stroke={BLOOD} strokeWidth={0.6} fill="none" opacity={0.45} />
      {ticks.map((t, i) => (
        <Line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={t.major ? GOLD : INK}
          strokeWidth={t.major ? 1.3 : 0.55}
          opacity={t.major ? 0.95 : 0.4}
        />
      ))}
    </Svg>
  );
}

function Die() {
  return (
    <View style={styles.die}>
      <Svg width={92} height={92} viewBox="0 0 92 92">
        <Polygon points="46,6 82,26 82,66 46,86 10,66 10,26" fill={INK} />
        <Polygon points="46,12 74,28 46,46 18,28" fill="#2C2622" />
        <Polygon points="46,46 74,28 74,64 46,80" fill="#3C342C" />
        <Polygon points="46,46 18,28 18,64 46,80" fill="#241F1C" />
        <Polygon points="46,8 80,26 80,66 46,84 12,66 12,26" fill="none" stroke={GOLD} strokeWidth={1.4} />
      </Svg>
      <Text style={styles.dieNum}>20</Text>
    </View>
  );
}

function Seal({
  label,
  icon,
  size,
  style,
}: {
  label: string;
  icon: ReactNode;
  size: number;
  style: { left: number; top: number };
}) {
  return (
    <Pressable style={[styles.seal, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <View style={[styles.sealInner, { borderRadius: size / 2 }]}>{icon}</View>
      <Text style={styles.sealLabel}>{label}</Text>
    </Pressable>
  );
}

function Tab({ icon, active }: { icon: ReactNode; active?: boolean }) {
  return (
    <View style={styles.tab}>
      {icon}
      {active ? <View style={styles.tabMark} /> : <View style={styles.tabGap} />}
    </View>
  );
}

function Corner({ style }: { style: object }) {
  return (
    <Svg width={28} height={28} style={[styles.corner, style]}>
      <Path d="M2 22 V4 H20" stroke={INK} strokeWidth={1.2} fill="none" />
      <Path d="M6 22 V8 H20" stroke={GOLD} strokeWidth={0.8} fill="none" />
      <Circle cx={3} cy={3} r={1.3} fill={BLOOD} />
    </Svg>
  );
}

function Hat({ light }: { light?: boolean }) {
  const c = light ? CREAM : INK;
  return (
    <Svg width={30} height={24} viewBox="0 0 30 24">
      <Path d="M15 1 L24 14 H6 Z" fill={c} />
      <Path d="M9 12.5 H21" stroke={light ? INK : GOLD} strokeWidth={1.6} />
      <Path d="M1 17 Q15 23 29 17" stroke={c} strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Book({ light }: { light?: boolean }) {
  const c = light ? CREAM : INK;
  return (
    <Svg width={28} height={22} viewBox="0 0 28 22">
      <Path d="M14 4 C10 2 4 2.5 2 4.5 V19 C6 17 10 17 14 19 Z" fill={c} />
      <Path d="M14 4 C18 2 24 2.5 26 4.5 V19 C22 17 18 17 14 19 Z" fill={c} />
      <Path d="M14 4.5 V19" stroke={light ? INK : GOLD} strokeWidth={1} />
    </Svg>
  );
}

function Gear({ light }: { light?: boolean }) {
  const c = light ? CREAM : INK;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={3.2} stroke={c} strokeWidth={1.6} fill="none" />
      <Path
        d="M12 2.2 L13.2 5.2 L12 6.4 L10.8 5.2 Z M12 21.8 L10.8 18.8 L12 17.6 L13.2 18.8 Z M2.2 12 L5.2 10.8 L6.4 12 L5.2 13.2 Z M21.8 12 L18.8 13.2 L17.6 12 L18.8 10.8 Z M4.6 4.6 L7.2 6.2 L6.6 7.6 L4.8 6.6 Z M19.4 19.4 L16.8 17.8 L17.4 16.4 L19.2 17.4 Z M19.4 4.6 L16.8 6.2 L17.4 7.6 L19.2 6.6 Z M4.6 19.4 L7.2 17.8 L6.6 16.4 L4.8 17.4 Z"
        fill={c}
      />
    </Svg>
  );
}

function House({ on }: { on?: boolean }) {
  return (
    <Svg width={22} height={20} viewBox="0 0 22 20">
      <Path d="M1 9 L11 1.5 L21 9 V19 H13.5 V12 H8.5 V19 H1 Z" fill={on ? "#FEFCEB" : CREAM} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, backgroundColor: "#E8D7B8" },
  root: { flex: 1, backgroundColor: "#CDB892", alignItems: "center" },
  parchment: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0.42,
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,24,22,0.18)",
  },
  corner: { position: "absolute" },
  back: { position: "absolute", top: 22, left: 46, zIndex: 4 },
  backText: {
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: INK,
    fontSize: 13,
  },
  hero: { alignItems: "center", marginTop: 28 },
  wordmark: {
    fontFamily: "CinzelDecorative_400Regular",
    color: INK,
    fontSize: 28,
    opacity: 0.9,
  },
  kicker: {
    marginTop: 4,
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: BLOOD,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  stage: { marginTop: 4 },
  ring: { position: "absolute" },
  dieWrap: { position: "absolute", zIndex: 2 },
  die: { width: 92, height: 92, alignItems: "center", justifyContent: "center" },
  dieNum: {
    position: "absolute",
    marginTop: 8,
    color: CREAM,
    fontFamily: "CinzelDecorative_400Regular",
    fontSize: 16,
  },
  seal: {
    position: "absolute",
    zIndex: 3,
    backgroundColor: "rgba(244,230,200,0.92)",
    borderWidth: 1.25,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  sealInner: {
    ...StyleSheet.absoluteFillObject,
    margin: 5,
    borderWidth: 0.8,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  sealLabel: {
    position: "absolute",
    bottom: 8,
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: INK,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  tabs: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: INK,
  },
  tabRule: { height: 1, backgroundColor: GOLD, opacity: 0.7 },
  tabRow: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: 6,
  },
  tab: { width: 48, alignItems: "center", gap: 5 },
  tabMark: { width: 5, height: 5, backgroundColor: GOLD, transform: [{ rotate: "45deg" }] },
  tabGap: { width: 5, height: 5 },
});
