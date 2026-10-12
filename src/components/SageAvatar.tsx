import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber/native";
import { useGLTF } from "@react-three/drei/native";
import { Asset } from "expo-asset";
import * as THREE from "three";

const model = require("../../assets/Sage/ux_ai_avatar.glb");

function Avatar({ uri }: { uri: string }) {
  const loaded = useGLTF(uri);
  const gltf = Array.isArray(loaded) ? loaded[0] : loaded;
  const spin = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
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

export default function SageAvatar() {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Asset.fromModule(model)
      .downloadAsync()
      .then((asset: { localUri?: string | null; uri: string }) => {
        const next = asset.localUri || asset.uri;
        if (live && next) setUri(next);
      })
      .catch(() => {
        if (live) setUri(null);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <View style={styles.slot}>
      <Canvas camera={{ position: [0, 0.2, 3.2], fov: 38 }}>
        <color attach="background" args={["#F4E6C8"]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 3, 2]} intensity={1.4} />
        {uri ? (
          <Suspense fallback={null}>
            <Avatar uri={uri} />
          </Suspense>
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
});
