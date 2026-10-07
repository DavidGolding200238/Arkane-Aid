import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import { AtkinsonHyperlegible_400Regular } from "@expo-google-fonts/atkinson-hyperlegible";
import Svg, { Circle, Path, Polygon } from "react-native-svg";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");
const skull = require("../../assets/Splash Screen/Dragon Logo.png");
const underline = require("../../assets/Splash Screen/Rectangle 4901.png");

const INK = "#1A1816";
const CREAM = "#F3E6CC";

type Props = { onBack: () => void };

export default function HomeScreen({ onBack }: Props) {
  const { width, height } = useWindowDimensions();
  const [titleW, setTitleW] = useState(160);
  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    AtkinsonHyperlegible_400Regular,
  });

  if (!fontsLoaded) return <View style={styles.fallback} />;

  const heroW = width - 36;
  const skullW = Math.min(heroW * 0.62, 210);
  const skullH = skullW * (278 / 333);
  const menu = Math.min(width - 24, 340);
  const orbit = menu * 0.34;
  const bubble = menu * 0.3;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <Pressable onPress={onBack} style={styles.back} hitSlop={10}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={[styles.hero, { width: heroW, marginTop: height * 0.055 }]}>
        <Image
          source={skull}
          style={{ width: skullW, height: skullH }}
          resizeMode="contain"
        />
        <Text style={styles.wordmark} onLayout={(e) => setTitleW(e.nativeEvent.layout.width)}>
          Arkane Aid
        </Text>
        <Image source={underline} style={{ width: titleW, height: 8 }} resizeMode="contain" />
      </View>

      <View style={[styles.menu, { width: menu, height: menu * 0.92 }]}>
        <Svg width={menu} height={menu * 0.92} style={StyleSheet.absoluteFill}>
          <Circle
            cx={menu / 2}
            cy={menu * 0.4}
            r={orbit}
            stroke={INK}
            strokeWidth={1.5}
            fill="none"
          />
          <Circle cx={menu / 2} cy={menu * 0.4 - orbit} r={4} fill={CREAM} stroke={INK} />
          <Circle
            cx={menu / 2 - orbit * 0.78}
            cy={menu * 0.4 + orbit * 0.55}
            r={4}
            fill={CREAM}
            stroke={INK}
          />
          <Circle
            cx={menu / 2 + orbit * 0.78}
            cy={menu * 0.4 + orbit * 0.55}
            r={4}
            fill={CREAM}
            stroke={INK}
          />
        </Svg>

        <View style={[styles.die, { top: menu * 0.4 - 36, left: menu / 2 - 36 }]}>
          <Svg width={72} height={72} viewBox="0 0 72 72">
            <Polygon
              points="36,4 66,20 66,52 36,68 6,52 6,20"
              fill={INK}
              stroke={CREAM}
              strokeWidth={2}
            />
            <Path d="M36 8 L62 22 L36 36 L10 22 Z" fill="#2A2622" />
            <Path d="M36 36 L62 22 L62 50 L36 64 Z" fill="#3A342C" />
          </Svg>
          <Text style={styles.dieNum}>20</Text>
        </View>

        <RoundButton
          label="Sage Scribe"
          size={bubble}
          style={{ top: menu * 0.4 - orbit * 0.15 - bubble / 2, left: menu / 2 - orbit - bubble * 0.35 }}
          icon={<Hat />} 
        />
        <RoundButton
          label="Tome"
          size={bubble}
          style={{ top: menu * 0.4 - orbit * 0.15 - bubble / 2, left: menu / 2 + orbit - bubble * 0.65 }}
          icon={<Gear />} 
        />
        <RoundButton
          label="Codex"
          size={bubble}
          style={{ top: menu * 0.4 + orbit * 0.72 - bubble / 2, left: menu / 2 - bubble / 2 }}
          icon={<Book />} 
        />
      </View>

      <View style={styles.tabs}>
        <Tab icon={<House on />} active />
        <Tab icon={<Book light />} />
        <Tab icon={<Hat light />} />
        <Tab icon={<Gear light />} />
      </View>
    </View>
  );
}

function RoundButton({
  label,
  size,
  icon,
  style,
}: {
  label: string;
  size: number;
  icon: React.ReactNode;
  style: object;
}) {
  return (
    <Pressable style={[styles.bubble, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {icon}
      <Text style={styles.bubbleLabel}>{label}</Text>
    </Pressable>
  );
}

function Tab({ icon, active }: { icon: React.ReactNode; active?: boolean }) {
  return <Pressable style={[styles.tab, active && styles.tabOn]}>{icon}</Pressable>;
}

function Hat({ light }: { light?: boolean }) {
  const c = light ? CREAM : INK;
  return (
    <Svg width={28} height={22} viewBox="0 0 28 22">
      <Path d="M14 1 L22 14 H6 Z" fill={c} />
      <Path d="M8 12 H20" stroke={light ? INK : CREAM} strokeWidth={2} />
      <Path d="M2 16 Q14 21 26 16" stroke={c} strokeWidth={3} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Book({ light }: { light?: boolean }) {
  const c = light ? CREAM : INK;
  return (
    <Svg width={26} height={22} viewBox="0 0 26 22">
      <Path d="M13 3 C9 1 3 2 2 4 V19 C5 17 10 17 13 19 Z" fill={c} />
      <Path d="M13 3 C17 1 23 2 24 4 V19 C21 17 16 17 13 19 Z" fill={c} />
      <Path d="M13 4 V19" stroke={light ? INK : CREAM} strokeWidth={1} />
    </Svg>
  );
}

function Gear({ light }: { light?: boolean }) {
  const c = light ? CREAM : INK;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={4} stroke={c} strokeWidth={2} fill="none" />
      <Circle cx={12} cy={12} r={1.4} fill={c} />
      <Path
        d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M4.5 4.5 L6.6 6.6 M17.4 17.4 L19.5 19.5 M19.5 4.5 L17.4 6.6 M6.6 17.4 L4.5 19.5"
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function House({ on }: { on?: boolean }) {
  return (
    <Svg width={24} height={22} viewBox="0 0 24 22">
      <Path d="M2 10 L12 2 L22 10 V20 H14 V14 H10 V20 H2 Z" fill={on ? "#FEFCEB" : CREAM} />
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
  back: { position: "absolute", top: 14, left: 16, zIndex: 2 },
  backText: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: INK,
    fontSize: 14,
  },
  hero: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(26,24,22,0.35)",
    backgroundColor: "rgba(254,252,235,0.45)",
    paddingTop: 8,
    paddingBottom: 10,
  },
  wordmark: {
    fontFamily: "CinzelDecorative_400Regular",
    color: INK,
    fontSize: 26,
    marginTop: 2,
  },
  menu: { marginTop: 8 },
  die: { position: "absolute", width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  dieNum: {
    position: "absolute",
    color: CREAM,
    fontFamily: "AtkinsonHyperlegible_400Regular",
    fontSize: 16,
    marginTop: 6,
  },
  bubble: {
    position: "absolute",
    backgroundColor: CREAM,
    borderWidth: 1.5,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bubbleLabel: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: INK,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  tabs: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    backgroundColor: INK,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: 8,
  },
  tab: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  tabOn: {},
});
