/* eslint-disable react/no-unknown-property -- three.js props on @react-three/fiber elements (object, dispose) */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { GLTFLoader } from "three-stdlib";
import * as THREE from "three";
import { colors } from "../theme";
import { createOrbLook, fitSphere, ORB_PALETTES, ORB_VIEW_HALF, type OrbColour } from "./orb/orbLook";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset require
const model = require("../../assets/models/sage-avatar.glb");

// @react-three/fiber 9.8 builds a THREE.Clock inside every Canvas it creates (one per visit to the
// Sage), and three r183+ warns that Clock is deprecated each time. That code is inside R3F, not
// ours (we use useFrame's delta and never construct a Clock), so drop exactly that one message
// through three's own logging hook. Every other three.js log, warning and error is passed on
// unchanged.
const CLOCK_DEPRECATED = "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.";
THREE.setConsoleFunction((type: "log" | "warn" | "error", message: string, ...params: unknown[]) => {
  if (type === "warn" && message === CLOCK_DEPRECATED) return;
  console[type](message, ...params);
});

// R3F calls renderer.forceContextLoss() when the Canvas unmounts. three then asks for the
// WEBGL_lose_context extension, which expo-gl doesn't have, and warns. expo-gl frees the GL
// context itself when its view unmounts, so when the extension is missing we make that call a
// no-op instead of letting three probe for it. (Checked with the raw GL call, which doesn't warn.)
function createRenderer(defaults: THREE.WebGLRendererParameters) {
  const renderer = new THREE.WebGLRenderer(defaults);
  if (!renderer.getContext().getExtension("WEBGL_lose_context")) {
    renderer.forceContextLoss = () => {};
  }
  return renderer;
}

function decodeBase64(input: string) {
  const clean = input.replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function readModel() {
  const asset = await Asset.fromModule(model).downloadAsync();
  let uri = asset.localUri || asset.uri;
  if (!uri) throw new Error("Sage model did not download.");
  if (!uri.includes(":")) {
    const root = FileSystem.cacheDirectory;
    if (!root) throw new Error("Sage model has no cache path.");
    const dest = `${root}sage-orb.glb`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    uri = dest;
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const buffer = decodeBase64(base64);
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  return fitSphere(gltf.scene);
}

// The orb's Sphere is kept for the life of the app: the splash starts loading it (see
// lib/preload), and every later visit to the Sage reuses it instead of reading and parsing
// the 2 MB model again. Each Canvas builds its own materials around this shared geometry and
// disposes only those (createOrbLook never disposes a geometry it was given).
let orbReady: THREE.BufferGeometry | null = null;
let orbLoading: Promise<THREE.BufferGeometry> | null = null;

export function preloadSageOrb() {
  if (orbReady) return Promise.resolve(orbReady);
  if (!orbLoading) {
    orbLoading = readModel()
      .then((orb) => {
        orbReady = orb;
        return orb;
      })
      .catch((err: unknown) => {
        orbLoading = null; // let the screen try again
        throw err;
      });
  }
  return orbLoading;
}

function Orb({
  sphere,
  colour,
  talking,
  listening,
}: {
  sphere: THREE.BufferGeometry;
  colour: OrbColour;
  talking: boolean;
  listening: boolean;
}) {
  const [look] = useState(() => createOrbLook({ colour, sphere }));
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => () => look.dispose(), [look]);
  // A new personality fades in (on the first run this fades from the colour to itself).
  useEffect(() => look.setColour(colour), [look, colour]);
  // The Canvas only draws on demand: ask for a frame when the orb appears, the colour changes or
  // talking or listening starts or stops. useFrame below keeps asking for as long as anything is moving.
  useEffect(() => invalidate(), [invalidate, look, colour, talking, listening]);

  // R3F keeps the latest callback, so this always sees the current talking and listening props. Once update
  // reports everything is still (idle, rings gone, fade done) no more frames are requested, so an
  // idle orb costs nothing; that last frame already shows the still orb.
  useFrame((state, delta: number) => {
    if (look.update(delta, talking, listening)) state.invalidate();
  });
  return <primitive object={look.group} dispose={null} />;
}

type Props = {
  /** Canvas diameter in dp (already scaled). The orb itself is ORB_FILL of it; the rest is backdrop. */
  size?: number;
  /** Personality colour: "red" Wizard, "blue" Arbiter, "green" Bard. */
  colour?: OrbColour;
  /** True while the Sage speaks or writes a reply: white rings pulse out. Still otherwise. */
  talking?: boolean;
  /** True while the orb is held to speak: the rim glow brightens and breathes. */
  listening?: boolean;
};

export default function SageAvatar({ size = 260, colour = "green", talking = false, listening = false }: Props) {
  const [sphere, setSphere] = useState<THREE.BufferGeometry | null>(orbReady);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    if (orbReady) return;
    preloadSageOrb()
      .then((next) => {
        if (live) setSphere(next);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : "Could not load the Sage model.");
      });
    return () => {
      live = false;
    };
  }, []);

  // Orthographic, so the orb is exactly ORB_FILL of the canvas: zoom is dp per orb radius.
  return (
    <View
      style={[
        styles.slot,
        // Until the model is ready, show the backdrop's darkest colour rather than a flash.
        { width: size, height: size, borderRadius: size / 2, backgroundColor: ORB_PALETTES[colour].bgDark },
      ]}
      collapsable={false}
    >
      <Canvas
        gl={createRenderer}
        frameloop="demand"
        style={{ width: size, height: size }}
        orthographic
        camera={{ position: [0, 0, 5], zoom: size / 2 / ORB_VIEW_HALF, near: 0.1, far: 50 }}
      >
        {sphere ? <Orb sphere={sphere} colour={colour} talking={talking} listening={listening} /> : null}
      </Canvas>
      {!sphere ? (
        <Text style={styles.note}>{error || "Loading the orb…"}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    overflow: "hidden",
    backgroundColor: colors.orbBackdrop,
    alignSelf: "center",
  },
  note: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    color: colors.orbGlow,
    fontSize: 12,
    textAlign: "center",
  },
});
