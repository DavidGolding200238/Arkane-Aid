import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
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
  const { width } = useWindowDimensions();
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

  const skullW = width * 0.82;
  const skullH = skullW * (360 / 332);
  const loaderSize = Math.min(width * 0.58, 220);

  if (!fontsLoaded) {
    return <View style={styles.fallback} />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image
        source={parchment}
        style={styles.parchment}
        resizeMode="cover"
      />
      <View style={styles.parchmentWash} pointerEvents="none" />

      <View style={styles.column}>
        <View style={[styles.logoWrap, { width: skullW, height: skullH * 0.72 }]}>
          <Image
            source={skull}
            style={[styles.skull, { width: skullW, height: skullH }]}
            resizeMode="contain"
          />
          <Image
            source={d20}
            style={styles.d20}
            resizeMode="contain"
          />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.wordmark}>
            <Text style={styles.drop}>A</Text>
            <Text style={styles.rest}>rkane </Text>
            <Text style={styles.drop}>A</Text>
            <Text style={styles.rest}>id</Text>
          </Text>
          <View style={styles.rule} />
        </View>

        <View style={[styles.loaderWrap, { width: loaderSize, height: loaderSize }]}>
          <Animated.Image
            source={loaderArt}
            style={[styles.loader, { transform: [{ rotate }] }]}
            resizeMode="contain"
          />
          <Text style={styles.percent}>{percent}%</Text>
        </View>

        <Text style={styles.caption}>
          {"Just a moment\u2026\nthe barbarian is stuck in a doorway."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: "#F3E6D0",
  },
  root: {
    flex: 1,
    backgroundColor: "#E8D7B8",
  },
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
  parchmentWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(243, 230, 208, 0.35)",
  },
  column: {
    flex: 1,
    alignItems: "center",
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  skull: {
    position: "absolute",
    top: -8,
  },
  d20: {
    position: "absolute",
    width: 56,
    height: 46,
    top: "52%",
  },
  titleBlock: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  wordmark: {
    textAlign: "center",
  },
  drop: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#CF0000",
    fontSize: 40,
  },
  rest: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#960000",
    fontSize: 32,
  },
  rule: {
    width: 220,
    height: 1,
    backgroundColor: "#2E2E2E",
    marginTop: 4,
  },
  loaderWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  loader: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  percent: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#141414",
    fontSize: 36,
    letterSpacing: 3.6,
    textAlign: "center",
  },
  caption: {
    marginTop: "auto",
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: "#4D4D4D",
    fontSize: 14,
    letterSpacing: 2.1,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
});
