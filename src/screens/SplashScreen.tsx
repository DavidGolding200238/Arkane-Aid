import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import { AtkinsonHyperlegible_400Regular_Italic } from "@expo-google-fonts/atkinson-hyperlegible";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");
const skull = require("../../assets/Splash Screen/Ark3 3.png");
const d20 = require("../../assets/Splash Screen/Group 5947.png");
const loader = require("../../assets/Splash Screen/Loader.png");

const DESIGN_W = 360;
const DESIGN_H = 780;

export default function SplashScreen() {
  const { width, height } = Dimensions.get("window");
  const sx = width / DESIGN_W;
  const sy = height / DESIGN_H;
  const s = Math.min(sx, sy);

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
    }, 40);
    return () => clearInterval(id);
  }, []);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  if (!fontsLoaded) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <View style={[styles.stage, { width: DESIGN_W * s, height: DESIGN_H * s }]}>
        <Image
          source={skull}
          style={{
            position: "absolute",
            left: 14 * s,
            top: 50 * s,
            width: 332 * s,
            height: 360 * s,
          }}
          resizeMode="contain"
        />
        <Image
          source={d20}
          style={{
            position: "absolute",
            left: 151 * s,
            top: 218 * s,
            width: 59.45 * s,
            height: 47.5 * s,
          }}
          resizeMode="contain"
        />

        <View
          style={{
            position: "absolute",
            top: 358 * s,
            left: 0,
            width: DESIGN_W * s,
            alignItems: "center",
          }}
        >
          <Text style={styles.wordmark}>
            <Text style={[styles.drop, { fontSize: 40 * s }]}>A</Text>
            <Text style={[styles.rest, { fontSize: 32 * s }]}>rkane </Text>
            <Text style={[styles.drop, { fontSize: 40 * s }]}>A</Text>
            <Text style={[styles.rest, { fontSize: 32 * s }]}>id</Text>
          </Text>
          <View style={[styles.rule, { width: 219 * s, marginTop: 6 * s }]} />
        </View>

        <Animated.Image
          source={loader}
          style={{
            position: "absolute",
            left: 64 * s,
            top: 400 * s,
            width: 231 * s,
            height: 231 * s,
            transform: [{ rotate }],
          }}
          resizeMode="contain"
        />

        <Text
          style={[
            styles.percent,
            {
              top: 494 * s,
              fontSize: 36 * s,
              letterSpacing: 3.6 * s,
              width: DESIGN_W * s,
            },
          ]}
        >
          {percent}%
        </Text>

        <Text
          style={[
            styles.caption,
            {
              top: 629 * s,
              fontSize: 14 * s,
              letterSpacing: 2.1 * s,
              width: 338 * s,
              left: 11 * s,
            },
          ]}
        >
          {"Just a moment\u2026\nthe barbarian is stuck in a doorway."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FEFCE8",
    alignItems: "center",
    justifyContent: "center",
  },
  parchment: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.28,
  },
  stage: {
    position: "relative",
  },
  wordmark: {
    fontFamily: "CinzelDecorative_400Regular",
    textAlign: "center",
  },
  drop: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#CF0000",
  },
  rest: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#960000",
  },
  rule: {
    height: 1,
    backgroundColor: "#2E2E2E",
    borderRadius: 10,
  },
  percent: {
    position: "absolute",
    fontFamily: "CinzelDecorative_400Regular",
    color: "#141414",
    textAlign: "center",
  },
  caption: {
    position: "absolute",
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: "#4D4D4D",
    textAlign: "center",
    fontStyle: "italic",
  },
});
