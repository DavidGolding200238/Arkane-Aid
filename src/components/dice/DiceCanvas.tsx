/* eslint-disable react/no-unknown-property -- three.js props on @react-three/fiber elements (object, dispose) */
import { useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import * as THREE from "three";
import { CAMERA_FOV, CAMERA_Z, type DiceStage } from "../../lib/dice/diceStage";

// Same workaround as the Sage orb (SageAvatar.tsx): expo-gl has no WEBGL_lose_context, and
// expo-gl frees the context itself when its view unmounts, so R3F's forceContextLoss on unmount
// becomes a no-op instead of a warning.
function createRenderer(defaults: THREE.WebGLRendererParameters) {
  const renderer = new THREE.WebGLRenderer(defaults);
  if (!renderer.getContext().getExtension("WEBGL_lose_context")) {
    renderer.forceContextLoss = () => {};
  }
  return renderer;
}

function Scene({ stage }: { stage: DiceStage }) {
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);

  // A roll, a rattle or new dice outside the Canvas ask for frames through the stage.
  useEffect(() => stage.listen({ wake: () => invalidate() }), [stage, invalidate]);

  useEffect(() => {
    if (size.width > 0 && size.height > 0) stage.setView(size.width / size.height);
    invalidate();
  }, [stage, size.width, size.height, invalidate]);

  // (R3F native always draws at the screen's pixel ratio; expo-gl can't do otherwise.)
  // Frames on demand only: while anything moves, update asks for the next one; a still tray
  // costs nothing.
  useFrame((state, delta: number) => {
    if (stage.update(delta)) state.invalidate();
  });
  return <primitive object={stage.root} dispose={null} />;
}

/** The 3D dice tray. The stage (and its GL resources) belong to the caller, who disposes it. */
export default function DiceCanvas({ stage }: { stage: DiceStage }) {
  return (
    <Canvas
      gl={createRenderer}
      flat
      frameloop="demand"
      camera={{ fov: CAMERA_FOV, position: [0, 0, CAMERA_Z], near: 0.1, far: 50 }}
      style={{ flex: 1 }}
    >
      <Scene stage={stage} />
    </Canvas>
  );
}
