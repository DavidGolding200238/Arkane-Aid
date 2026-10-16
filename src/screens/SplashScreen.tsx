import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import { AtkinsonHyperlegible_400Regular_Italic } from "@expo-google-fonts/atkinson-hyperlegible";
import Rule from "../components/Rule";
import { inkText, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");
// 3x art from Figma (Splash 2312:378). The dragon skull is the same Figma bitmap as the Dashboard's.
const skull = require("../../assets/images/dashboard/skull-dragon.png"); // Ark3 3, 2124:39
const d20 = require("../../assets/images/splash/die-d20-glow.png"); // Group 5948, 2132:28
const loaderArt = require("../../assets/images/splash/loader-ring.png"); // Loader, 2314:645

export default function SplashScreen() {
  // Same Figma-unit scaling as every other screen (360 wide design, see theme/scale).
  const { s, fs, height } = useScale();
  const spin = useRef(new Animated.Value(0)).current;
  const [percent, setPercent] = useState(0);
  const [titleW, setTitleW] = useState(220);

  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    AtkinsonHyperlegible_400Regular_Italic,
  });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  useEffect(() => {
    let value = 0;
    const id = setInterval(() => {
      value += 1;
      if (value >= 100) {
        value = 100;
        clearInterval(id);
      }
      setPercent(value);
    }, 35);
    return () => clearInterval(id);
  }, []);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const skullW = s(338);
  const skullH = skullW;
  const loaderSize = s(223);
  const dieW = skullW * 0.4;
  const dieH = dieW * 0.9;

  if (!fontsLoaded) {
    return <View style={styles.fallback} />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <View style={[styles.column, { paddingBottom: Math.max(height * 0.06, s(44)) }]}>
        <View style={{ width: skullW, height: skullH, marginTop: s(60) }}>
          <Image
            source={skull}
            style={{ width: skullW, height: skullH }}
            resizeMode="contain"
          />
          <Image
            source={d20}
            style={{
              position: "absolute",
              width: dieW,
              height: dieH,
              left: (skullW - dieW) / 2,
              top: skullH * 0.35,
            }}
            resizeMode="contain"
          />
        </View>

        <Text
          style={[styles.wordmark, { fontSize: fs(42), marginTop: -s(40) }]}
          onLayout={(e) => setTitleW(e.nativeEvent.layout.width)}
        >
          Arkane Aid
        </Text>
        {/* The inked underline (Figma Rectangle 4901), centred in the old 10 dp slot. */}
        <Rule width={titleW} color="#2E2E2E" style={{ marginTop: s(4) + s(4.5), marginBottom: s(8) + s(4.5) }} />

        <View style={[styles.loaderWrap, { width: loaderSize, height: loaderSize }]}>
          <Animated.Image
            source={loaderArt}
            style={[styles.loader, { transform: [{ rotate }] }]}
            resizeMode="contain"
          />
          <Text style={[styles.percent, { fontSize: fs(30) }]}>{percent}%</Text>
        </View>

        <Text style={[styles.caption, { fontSize: fs(15), lineHeight: fs(22), marginTop: s(14) }]}>
          Just a moment{"\u2026"}
          {"\n"}
          the barbarian is stuck in a doorway.
        </Text>
      </View>
    </View>
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
  column: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  wordmark: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#A33A3A",
    textAlign: "center",
    opacity: 0.82,
    ...inkText.red,
  },
  loaderWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  loader: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  percent: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#2A2218",
    letterSpacing: 1.5,
    textAlign: "center",
    opacity: 0.72,
  },
  caption: {
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: "#5A5348",
    letterSpacing: 1.4,
    textAlign: "center",
    opacity: 0.78,
  },
});
