// Browser preview of the dice tray (same DiceStage as the app). Build and screenshot with
// scripts/dice-preview/shoot.sh. URL params: dice=20:20,6:3 (sides:value list), t=seconds into the
// throw (omit for resting dice), w/h canvas size in px.
import * as THREE from "three";
import { DiceStage, CAMERA_FOV, CAMERA_Z } from "../../src/lib/dice/diceStage";
import type { DieSides } from "../../src/lib/dice/dicePolyhedra";

const q = new URLSearchParams(location.search);
const w = Number(q.get("w") ?? 660);
const h = Number(q.get("h") ?? 560);
const dice = (q.get("dice") ?? "4:4,6:6,8:8,10:10,12:12,20:20")
  .split(",")
  .map((p) => p.split(":").map(Number))
  .map(([sides, value, kept]) => ({ sides: sides as DieSides, value, kept: kept !== 0 }));
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(w, h);
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CAMERA_FOV, w / h, 0.1, 50);
camera.position.set(0, 0, CAMERA_Z);
const stage = new DiceStage();
scene.add(stage.root);
stage.setView(w / h);
const t = q.get("t");
if (t === null) stage.show(dice);
else {
  stage.roll(dice);
  const end = Number(t);
  for (let s = 0; s < end; s += 1 / 60) stage.update(1 / 60);
}
renderer.render(scene, camera);
document.title = "ready";
