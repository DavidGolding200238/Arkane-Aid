import { Component, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber/native";
import { useGLTF } from "@react-three/drei/native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import * as THREE from "three";

const model = require("../../assets/Sage/ux_ai_avatar.glb");

function paint(scene: THREE.Object3D) {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.name === "Plane") {
      mesh.visible = false;
      return;
    }
    const color = mesh.name === "Core" ? "#BD7F02" : mesh.name.startsWith("Ellipse") ? "#A33A3A" : "#F4E6C8";
    mesh.material = new THREE.MeshStandardMaterial({
      color,
      roughness: mesh.name === "Core" ? 0.25 : 0.45,
      metalness: 0.12,
      emissive: mesh.name === "Core" ? "#6A4A00" : "#000000",
    });
  });
}

function Avatar({ uri }: { uri: string }) {
  const loaded = useGLTF(uri);
  const gltf = Array.isArray(loaded) ? loaded[0] : loaded;
  const spin = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    paint(gltf.scene);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const max = Math.max(size.x, size.y, size.z) || 1;
    gltf.scene.position.sub(center);
    gltf.scene.scale.setScalar(1.7 / max);
  }, [gltf]);

  useFrame((_state: unknown, delta: number) => {
    if (spin.current) spin.current.rotation.y += delta * 0.35;
  });

  return (
    <group ref={spin}>
      <primitive object={gltf.scene} />
    </group>
  );
}

class ModelError extends Component<{ children: ReactNode }, { message: string }> {
  state = { message: "" };

  static getDerivedStateFromError(err: unknown) {
    const message = err instanceof Error ? err.message : "Could not read the Sage model.";
    return { message };
  }

  render() {
    if (this.state.message) return <Text style={styles.note}>{this.state.message}</Text>;
    return this.props.children;
  }
}

async function localModelUri() {
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
  return uri;
}

export default function SageAvatar() {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    localModelUri()
      .then((next) => {
        if (live) setUri(next);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : "Could not load the Sage model.");
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <View style={styles.slot}>
      {error ? <Text style={styles.note}>{error}</Text> : null}
      <Canvas camera={{ position: [0, 0.15, 3.2], fov: 38 }}>
        <color attach="background" args={["#F4E6C8"]} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[2, 3, 2]} intensity={1.6} />
        {uri ? (
          <ModelError>
            <Suspense fallback={null}>
              <Avatar uri={uri} />
            </Suspense>
          </ModelError>
        ) : null}
      </Canvas>
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
  note: {
    position: "absolute",
    zIndex: 2,
    left: 12,
    right: 12,
    top: 12,
    color: "#A33A3A",
    fontSize: 13,
    textAlign: "center",
  },
});
