import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber/native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { GLTFLoader } from "three-stdlib";
import * as THREE from "three";

const model = require("../../assets/Sage/ux_ai_avatar.glb");

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

const kept = new Set(["Sphere", "Core", "Ellipse", "Ellipse 2"]);

function materialFor(name: string) {
  if (name === "Core") {
    return new THREE.MeshStandardMaterial({
      color: "#F6D77A",
      emissive: "#BD7F02",
      emissiveIntensity: 0.85,
      roughness: 0.22,
      metalness: 0.18,
    });
  }
  if (name.startsWith("Ellipse")) {
    return new THREE.MeshStandardMaterial({
      color: "#A33A3A",
      roughness: 0.4,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: "#F7F1DE",
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function fitOrb(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const group = new THREE.Group();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !kept.has(mesh.name)) return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    geo.computeVertexNormals();
    const next = new THREE.Mesh(geo, materialFor(mesh.name));
    next.name = mesh.name;
    next.renderOrder = mesh.name === "Sphere" ? 2 : 1;
    group.add(next);
  });
  if (group.children.length === 0) {
    throw new Error("The model opened, but the orb meshes were not in it.");
  }
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  group.position.sub(center);
  const fitted = new THREE.Group();
  fitted.add(group);
  const max = Math.max(size.x, size.y, size.z) || 1;
  fitted.scale.setScalar(1.85 / max);
  return fitted;
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
  return fitOrb(gltf.scene);
}

// The parsed orb is kept for the life of the app: the splash starts loading it (see
// lib/preload), and every later visit to the Sage reuses it instead of reading and parsing
// the 2 MB model again. R3F never disposes <primitive> objects, so sharing it is safe.
let orbReady: THREE.Group | null = null;
let orbLoading: Promise<THREE.Group> | null = null;

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

function Spinning({ object }: { object: THREE.Group }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_state: unknown, delta: number) => {
    if (ref.current) ref.current.rotation.y += delta * 0.35;
  });
  return (
    <group ref={ref}>
      <primitive object={object} dispose={null} />
    </group>
  );
}

/** size is the orb diameter in dp (already scaled). Defaults to the old fixed 260. */
export default function SageAvatar({ size = 260 }: { size?: number }) {
  const [orb, setOrb] = useState<THREE.Group | null>(orbReady);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    if (orbReady) return;
    preloadSageOrb()
      .then((next) => {
        if (live) setOrb(next);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : "Could not load the Sage model.");
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <View style={[styles.slot, { width: size, height: size, borderRadius: size / 2 }]} collapsable={false}>
      <Canvas gl={createRenderer} style={{ width: size, height: size }} camera={{ position: [0, 0.1, 3.2], fov: 32, near: 0.01, far: 50 }}>
        <color attach="background" args={["#1A0A0A"]} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[2.2, 3, 2.4]} intensity={1.6} />
        <pointLight position={[0, 0, 0.4]} intensity={1.3} color="#F6D77A" />
        {orb ? <Spinning object={orb} /> : null}
      </Canvas>
      {!orb ? (
        <Text style={styles.note}>{error || "Loading the orb…"}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    overflow: "hidden",
    backgroundColor: "#1A0A0A",
    alignSelf: "center",
  },
  note: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    color: "#F6D77A",
    fontSize: 12,
    textAlign: "center",
  },
});
