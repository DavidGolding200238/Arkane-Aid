import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber/native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { GLTFLoader } from "three-stdlib";
import * as THREE from "three";

const model = require("../../assets/Sage/ux_ai_avatar.glb");

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
  fitted.scale.setScalar(2.15 / max);
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

function Spinning({ object }: { object: THREE.Group }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_state: unknown, delta: number) => {
    if (ref.current) ref.current.rotation.y += delta * 0.35;
  });
  return (
    <group ref={ref}>
      <primitive object={object} />
    </group>
  );
}

export default function SageAvatar() {
  const [orb, setOrb] = useState<THREE.Group | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    readModel()
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
    <View style={styles.slot} collapsable={false}>
      <Canvas style={styles.canvas} camera={{ position: [0, 0.15, 3.5], fov: 35, near: 0.01, far: 50 }}>
        <color attach="background" args={["#F4E6C8"]} />
        <ambientLight intensity={1.15} />
        <directionalLight position={[2.2, 3, 2.4]} intensity={1.7} />
        <pointLight position={[0, 0, 0.4]} intensity={1.4} color="#F6D77A" />
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
    height: 220,
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F4E6C8",
  },
  canvas: { width: "100%", height: 220 },
  note: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    color: "#A33A3A",
    fontSize: 13,
    textAlign: "center",
  },
});
