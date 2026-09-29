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

  const skullW = width * 0.78;
  const skullH = skullW * 0.78;
  const loaderSize = Math.min(width * 0.52, 200);

  if (!fontsLoaded) {
    return <View style={styles.fallback} />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />
      <View style={styles.wash} pointerEvents="none" />

      <View style={[styles.column, { paddingBottom: Math.max(height * 0.08, 56) }]}>
        <Image
          source={skull}
          style={{ width: skullW, height: skullH, marginTop: 8 }}
          resizeMode="contain"
        />
        <Image source={d20} style={styles.d20} resizeMode="contain" />

        <Text style={styles.wordmark}>
          <Text style={styles.drop}>A</Text>
          <Text style={styles.rest}>rkane </Text>
          <Text style={styles.drop}>A</Text>
          <Text style={styles.rest}>id</Text>
        </Text>
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
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(232, 215, 184, 0.25)",
  },
  column: {
    flex: 1,
    alignItems: "center",
    paddingTop: 28,
    paddingHorizontal: 16,
  },
  d20: {
    width: 52,
    height: 42,
    marginTop: -92,
    marginBottom: 48,
  },
  wordmark: {
    textAlign: "center",
    marginTop: 4,
  },
  drop: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#CF0000",
    fontSize: 38,
  },
  rest: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#960000",
    fontSize: 30,
  },
  rule: {
    width: 168,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3A2A1A",
    marginTop: 2,
    marginBottom: 18,
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
    marginTop: 28,
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: "#4D4D4D",
    fontSize: 13,
    letterSpacing: 1.6,
    textAlign: "center",
    lineHeight: 20,
  },
});
