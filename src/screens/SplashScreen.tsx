import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import { AtkinsonHyperlegible_400Regular_Italic } from "@expo-google-fonts/atkinson-hyperlegible";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");
const skull = require("../../assets/Splash Screen/Ark3 3.png");
const d20 = require("../../assets/Splash Screen/Group 5947.png");
const loaderArt = require("../../assets/Splash Screen/Loader.png");

const RED = "#C43A3A";

export default function SplashScreen() {
  const { width, height } = useWindowDimensions();
  const spin = useRef(new Animated.Value(0)).current;
  const [percent, setPercent] = useState(0);

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

  const skullW = width * 0.84;
  const skullH = skullW * 0.92;
  const loaderSize = Math.min(width * 0.55, 210);
  const dieW = skullW * 0.16;

  if (!fontsLoaded) {
    return <View style={styles.fallback} />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <View style={[styles.column, { paddingBottom: Math.max(height * 0.07, 48) }]}>
        <View style={{ width: skullW, height: skullH }}>
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
              height: dieW * 0.8,
              left: (skullW - dieW) / 2,
              top: skullH * 0.52,
            }}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.wordmark}>Arkane Aid</Text>
        <View style={styles.rule} />

        <View style={[styles.loaderWrap, { width: loaderSize, height: loaderSize }]}>
          <Animated.Image
            source={loaderArt}
            style={[styles.loader, { transform: [{ rotate }] }]}
            resizeMode="contain"
          />
          <Text style={styles.percent}>{percent}%</Text>
        </View>

        <Text style={styles.caption}>
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
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  wordmark: {
    fontFamily: "CinzelDecorative_400Regular",
    color: RED,
    fontSize: 34,
    textAlign: "center",
    marginTop: -6,
  },
  rule: {
    width: 200,
    height: 1,
    backgroundColor: RED,
    opacity: 0.55,
    marginTop: 4,
    marginBottom: 16,
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
    color: "#1A1816",
    fontSize: 34,
    letterSpacing: 2,
    textAlign: "center",
  },
  caption: {
    marginTop: 24,
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: "#4D4D4D",
    fontSize: 13,
    letterSpacing: 1.6,
    textAlign: "center",
    lineHeight: 20,
  },
});
