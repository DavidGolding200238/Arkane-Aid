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

export default function SplashScreen() {
  const { width, height } = useWindowDimensions();
  const spin = useRef(new Animated.Value(0)).current;
  const [percent, setPercent] = useState(0);
  const [titleW, setTitleW] = useState(0);

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

  const skullW = width * 0.88;
  const skullH = skullW * 0.86;
  const loaderSize = Math.min(width * 0.46, 176);
  const dieW = skullW * 0.175;
  const dieH = dieW * 0.8;

  if (!fontsLoaded) {
    return <View style={styles.fallback} />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <View style={[styles.column, { paddingBottom: Math.max(height * 0.06, 44) }]}>
        <View style={{ width: skullW, height: skullH, marginTop: 36 }}>
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
              left: (skullW - dieW) / 2 + 1,
              top: skullH * 0.575,
            }}
            resizeMode="contain"
          />
        </View>

        <Text
          style={styles.wordmark}
          onLayout={(e) => setTitleW(e.nativeEvent.layout.width)}
        >
          Arkane Aid
        </Text>
        <View style={[styles.rule, titleW > 0 ? { width: titleW } : null]} />

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
    paddingHorizontal: 8,
  },
  wordmark: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#A33A3A",
    fontSize: 40,
    textAlign: "center",
    marginTop: -36,
    opacity: 0.82,
  },
  rule: {
    width: 220,
    height: 1,
    backgroundColor: "#2A2218",
    opacity: 0.55,
    marginTop: 6,
    marginBottom: 10,
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
    fontSize: 28,
    letterSpacing: 1.5,
    textAlign: "center",
    opacity: 0.72,
  },
  caption: {
    marginTop: 12,
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: "#5A5348",
    fontSize: 15,
    letterSpacing: 1.4,
    textAlign: "center",
    lineHeight: 22,
    opacity: 0.78,
  },
});
