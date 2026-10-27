// The dice tray in plain three.js (no React), so the same code draws in the app through
// @react-three/fiber and in the browser preview (scripts/dice-preview).
//
// No physics engine: each roll's numbers are decided first (diceRoll.ts), then every die follows a
// scripted throw. It flies in from the bottom edge, drops, bounces three times with less height
// each time, and rolls along its path while the spin winds down to exactly the rotation that puts
// the rolled face up (faceUpRotation). The spin is "offset from the final rotation", so whatever
// happens on the way, the last frame always shows the right number, upright and readable.
import * as THREE from "three";
import { cornerNumbers, dieShape, faceUpRotation, restHeight, type DieSides } from "./dicePolyhedra";
import { GLYPHS } from "./glyphs";

export type StageDie = { sides: DieSides; value: number; kept?: boolean };

/** Most dice drawn in 3D at once; any more are only listed in the result text. */
export const MAX_SHOWN = 10;

export type StageListener = { wake?: () => void; impact?: () => void; settled?: () => void };

const CREAM = "#F5EBD2";
const CREAM_DIM = "#9C927F";
const INK = "#1A1816";
const GOLD = "#E0A31A";
const RED = "#A33A3A";
const TRAY_CENTRE = "#4A3523";
const TRAY_EDGE = "#1C130B";

export const CAMERA_FOV = 32;
export const CAMERA_Z = 12;

// The rest of the die looks smaller than its corners suggest, so the cube and d4 are scaled to match.
const SIZE_BY_SIDES: Record<DieSides, number> = { 4: 1.12, 6: 1.15, 8: 1, 10: 1, 12: 0.98, 20: 1 };

type Kit = { body: THREE.BufferGeometry; numbers: THREE.BufferGeometry; edges: THREE.BufferGeometry };

function glyphShapes(ch: string) {
  const glyph = GLYPHS[ch];
  const path = new THREE.ShapePath();
  const t = glyph.path.split(" ");
  let i = 0;
  const num = () => Number(t[i++]);
  while (i < t.length) {
    const op = t[i++];
    if (op === "M") path.moveTo(num(), num());
    else if (op === "L") path.lineTo(num(), num());
    else if (op === "Q") path.quadraticCurveTo(num(), num(), num(), num());
  }
  return { shapes: path.toShapes(), advance: glyph.advance };
}

/** Flat number geometry in the xy plane, centred on the origin, plus its width and height. */
function labelGeometry(text: string, underline: boolean) {
  const parts: THREE.BufferGeometry[] = [];
  let x = 0;
  for (const ch of text) {
    const { shapes, advance } = glyphShapes(ch);
    const g = new THREE.ShapeGeometry(shapes, 3);
    g.translate(x, 0, 0);
    parts.push(g);
    x += advance * 0.92; // dice numbers sit a little tighter than text
  }
  const merged = mergeGeometries(parts);
  merged.computeBoundingBox();
  const box = merged.boundingBox!;
  if (underline) {
    // A bar under 6 and 9 so they can't be mistaken for each other.
    const w = (box.max.x - box.min.x) * 0.9;
    const cx = (box.max.x + box.min.x) / 2;
    const y0 = box.min.y - 0.13;
    const bar = new THREE.ShapeGeometry(
      new THREE.Shape([
        new THREE.Vector2(cx - w / 2, y0),
        new THREE.Vector2(cx + w / 2, y0),
        new THREE.Vector2(cx + w / 2, y0 + 0.07),
        new THREE.Vector2(cx - w / 2, y0 + 0.07),
      ]),
    );
    const both = mergeGeometries([merged, bar]);
    both.computeBoundingBox();
    const b = both.boundingBox!;
    both.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, 0);
    return { geometry: both, width: b.max.x - b.min.x, height: b.max.y - b.min.y };
  }
  merged.translate(-(box.max.x + box.min.x) / 2, -(box.max.y + box.min.y) / 2, 0);
  return { geometry: merged, width: box.max.x - box.min.x, height: box.max.y - box.min.y };
}

/** Joins position (and index) only geometries into one non-indexed geometry. */
function mergeGeometries(list: THREE.BufferGeometry[]) {
  const out: number[] = [];
  for (const g of list) {
    const flat = g.index ? g.toNonIndexed() : g;
    const pos = flat.getAttribute("position");
    for (let i = 0; i < pos.count; i += 1) out.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (flat !== g) flat.dispose();
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  return merged;
}

function buildKit(sides: DieSides): Kit {
  const shape = dieShape(sides);
  const pos: number[] = [];
  for (const f of shape.faces) {
    const c = f.corners.map((i) => shape.vertices[i]);
    for (let k = 1; k < c.length - 1; k += 1) {
      for (const v of [c[0], c[k], c[k + 1]]) pos.push(v.x, v.y, v.z);
    }
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  body.computeVertexNormals(); // non-indexed, so every face gets its own flat normal
  const edges = new THREE.EdgesGeometry(body, 10);

  if (sides === 4) return { body, numbers: d4Numbers(), edges };
  // One text size for every face of a die, chosen so its widest number fits its smallest face.
  const labels = shape.faces.map((f) => labelGeometry(String(f.value), sides >= 8 && (f.value === 6 || f.value === 9)));
  let scale = Infinity;
  shape.faces.forEach((f, i) => {
    const { width, height } = labels[i];
    const halfDiagonal = Math.hypot(width, height) / 2;
    scale = Math.min(scale, (f.room * 0.9) / halfDiagonal, (f.room * 1.15) / height);
  });
  const placed: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  const right = new THREE.Vector3();
  shape.faces.forEach((f, i) => {
    right.crossVectors(f.up, f.normal);
    const origin = f.centre.clone().addScaledVector(f.normal, 0.006);
    m.makeBasis(right, f.up, f.normal).scale(new THREE.Vector3(scale, scale, scale)).setPosition(origin);
    const g = labels[i].geometry;
    g.applyMatrix4(m);
    placed.push(g);
  });
  const numbers = mergeGeometries(placed);
  return { body, numbers, edges };
}

/** A d4 reads by its top corner: each face carries three numbers, one by each corner. */
function d4Numbers() {
  const shape = dieShape(4);
  const placed: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  const right = new THREE.Vector3();
  for (const f of shape.faces) {
    for (const n of cornerNumbers(f, shape)) {
      const { geometry, height } = labelGeometry(String(n.value), false);
      const scale = (n.reach * 0.4) / height;
      right.crossVectors(n.up, f.normal);
      const origin = n.centre.clone().addScaledVector(f.normal, 0.006);
      m.makeBasis(right, n.up, f.normal).scale(new THREE.Vector3(scale, scale, scale)).setPosition(origin);
      geometry.applyMatrix4(m);
      placed.push(geometry);
    }
  }
  return mergeGeometries(placed);
}

function radialDisc(inner: THREE.Color, innerAlpha: number, outer: THREE.Color, outerAlpha: number, segments = 28) {
  const pos: number[] = [0, 0, 0];
  const col: number[] = [inner.r, inner.g, inner.b, innerAlpha];
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    pos.push(Math.cos(a), Math.sin(a), 0);
    col.push(outer.r, outer.g, outer.b, outerAlpha);
  }
  const idx: number[] = [];
  for (let i = 1; i <= segments; i += 1) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}

type Live = {
  die: StageDie;
  group: THREE.Group;
  body: THREE.Mesh;
  numbers: THREE.Mesh;
  shadow: THREE.Mesh;
  glow: THREE.Mesh | null;
  scale: number;
  target: THREE.Vector2;
  start: THREE.Vector2;
  final: THREE.Quaternion;
  axis: THREE.Vector3;
  spin: number;
  delay: number;
  duration: number;
  t: number;
  rolling: boolean;
  jiggle: number;
  jiggleAxis: THREE.Vector3;
  seed: number;
};

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// Height of the throw over its progress p (0..1), as a fraction of the die size: a drop onto the
// table, then three bounces, each lower, then still.
const BOUNCES: [number, number, number][] = [
  [0.3, 0.52, 0.42],
  [0.52, 0.68, 0.15],
  [0.68, 0.78, 0.05],
];
function hop(p: number) {
  if (p < 0.3) return 1.6 * (1 - (p / 0.3) ** 2);
  for (const [a, b, h] of BOUNCES) {
    if (p < b) {
      const x = (p - a) / (b - a);
      return 4 * h * x * (1 - x);
    }
  }
  return 0;
}

export class DiceStage {
  readonly root = new THREE.Group();
  private kits = new Map<DieSides, Kit>();
  private live: Live[] = [];
  private shadowGeo: THREE.BufferGeometry;
  private glowGeo: THREE.BufferGeometry;
  private trayGeo: THREE.BufferGeometry;
  private mats: {
    body: THREE.MeshLambertMaterial;
    bodyDim: THREE.MeshLambertMaterial;
    ink: THREE.MeshBasicMaterial;
    gold: THREE.MeshBasicMaterial;
    red: THREE.MeshBasicMaterial;
    edge: THREE.LineBasicMaterial;
    shadow: THREE.MeshBasicMaterial;
    glow: THREE.MeshBasicMaterial;
    tray: THREE.MeshBasicMaterial;
  };
  private halfW = 3;
  private halfH = 3;
  private glowTime = 0;
  private landed = false;
  private settledNotified = true;
  /** Called once per roll when the first die hits the table, and when every die has stopped. */
  private listeners = new Set<StageListener>();

  /** Hear about the dice: wake (something started moving, draw a frame), impact (a throw hit
   *  the table) and settled (a throw finished). Returns the unsubscribe. */
  listen(listener: StageListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: keyof StageListener) {
    for (const l of this.listeners) l[event]?.();
  }

  constructor() {
    this.mats = {
      body: new THREE.MeshLambertMaterial({ color: CREAM, flatShading: true }),
      bodyDim: new THREE.MeshLambertMaterial({ color: CREAM_DIM, flatShading: true }),
      ink: new THREE.MeshBasicMaterial({ color: INK, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      gold: new THREE.MeshBasicMaterial({ color: GOLD, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      red: new THREE.MeshBasicMaterial({ color: RED, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      edge: new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.55 }),
      shadow: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
      glow: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      tray: new THREE.MeshBasicMaterial({ vertexColors: true }),
    };
    const black = new THREE.Color("#000000");
    this.shadowGeo = radialDisc(black, 0.55, black, 0);
    const gold = new THREE.Color(GOLD);
    this.glowGeo = radialDisc(gold, 0.9, gold, 0);
    this.trayGeo = radialDisc(new THREE.Color(TRAY_CENTRE), 1, new THREE.Color(TRAY_EDGE), 1, 48);
    const tray = new THREE.Mesh(this.trayGeo, this.mats.tray);
    tray.renderOrder = -2;
    tray.position.z = -0.01;
    tray.name = "tray";
    this.root.add(tray);

    const ambient = new THREE.AmbientLight("#FFF4E0", 1.5);
    const sun = new THREE.DirectionalLight("#FFFFFF", 2.1);
    sun.position.set(-3, 4, 10);
    this.root.add(ambient, sun, sun.target);
  }

  private kit(sides: DieSides) {
    let kit = this.kits.get(sides);
    if (!kit) {
      kit = buildKit(sides);
      this.kits.set(sides, kit);
    }
    return kit;
  }

  /** Fit the tray to a canvas of this aspect (width / height). */
  setView(aspect: number) {
    this.halfH = CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360);
    this.halfW = this.halfH * aspect;
    const tray = this.root.getObjectByName("tray");
    if (tray) tray.scale.set(this.halfW * 1.6, this.halfH * 1.6, 1);
    // A resize mid-throw lets the throw finish (re-laying out would land the dice at once and
    // skip the animation); resting dice are laid out again to fit the new tray.
    if (this.live.length && !this.busy) this.layout(this.live.map((l) => l.die), false);
    this.emit("wake");
  }

  get busy() {
    return this.live.some((l) => l.rolling);
  }

  /** Dice resting in the tray without a throw (e.g. the pool changed). Shows each die's `value`. */
  show(dice: StageDie[]) {
    this.layout(dice, false);
    this.emit("wake");
  }

  /** Throw the dice so they land on these values. */
  roll(dice: StageDie[]) {
    this.layout(dice, true);
    this.emit("wake");
  }

  /** Shake the dice where they lie (the phone is being shaken). strength 0..1. */
  rattle(strength = 1) {
    for (const l of this.live) {
      if (l.rolling) continue;
      l.jiggle = Math.min(1, l.jiggle + 0.55 * strength);
      l.jiggleAxis.set(rand(-1, 1), rand(-1, 1), rand(-0.3, 0.3)).normalize();
    }
    this.emit("wake");
  }

  private clear() {
    for (const l of this.live) this.root.remove(l.group);
    this.live = [];
  }

  private layout(dice: StageDie[], throwThem: boolean) {
    this.clear();
    const shown = dice.slice(0, MAX_SHOWN);
    const n = shown.length;
    if (!n) return;
    const W = this.halfW * 2 * 0.94;
    const H = this.halfH * 2 * 0.86;
    let best = { cols: 1, rows: n, cell: 0 };
    for (let cols = 1; cols <= n; cols += 1) {
      const rows = Math.ceil(n / cols);
      const cell = Math.min(W / cols, H / rows);
      if (cell > best.cell) best = { cols, rows, cell };
    }
    const { cols, rows, cell } = best;
    const size = Math.min(cell * 0.36, 1.45);
    const jitter = cell * 0.07;
    this.glowTime = 0;
    this.landed = !throwThem;
    this.settledNotified = !throwThem;
    shown.forEach((die, i) => {
      const row = Math.floor(i / cols);
      const inRow = row === rows - 1 ? n - row * cols : cols;
      const col = i - row * cols;
      const x = (col - (inRow - 1) / 2) * cell + rand(-jitter, jitter);
      const y = ((rows - 1) / 2 - row) * cell + rand(-jitter, jitter);
      const scale = size * SIZE_BY_SIDES[die.sides];
      const kit = this.kit(die.sides);
      const group = new THREE.Group();
      const body = new THREE.Mesh(kit.body, die.kept === false && !throwThem ? this.mats.bodyDim : this.mats.body);
      const numbers = new THREE.Mesh(kit.numbers, this.mats.ink);
      const lines = new THREE.LineSegments(kit.edges, this.mats.edge);
      const spinner = new THREE.Group();
      spinner.name = "spinner";
      spinner.add(body, numbers, lines);
      spinner.scale.setScalar(scale);
      const shadow = new THREE.Mesh(this.shadowGeo, this.mats.shadow);
      shadow.renderOrder = -1;
      group.add(shadow, spinner);
      let glow: THREE.Mesh | null = null;
      if (die.sides === 20 && die.kept !== false && (die.value === 20 || die.value === 1) && shown.every((d) => d.sides === 20) && shown.filter((d) => d.kept !== false).length === 1) {
        numbers.material = die.value === 20 ? this.mats.gold : this.mats.red;
        if (die.value === 20) {
          glow = new THREE.Mesh(this.glowGeo, this.mats.glow);
          glow.renderOrder = -1;
          glow.visible = false;
          group.add(glow);
        }
      }
      if (!throwThem) numbers.material = this.mats.ink;
      const final = faceUpRotation(die.sides, die.value, rand(-0.3, 0.3));
      const target = new THREE.Vector2(x, y);
      // Thrown in from below the bottom edge, roughly straight up the screen.
      const start = new THREE.Vector2(x * 0.8 + rand(-0.4, 0.4), -this.halfH - scale * 1.6 - rand(0, 0.8));
      const dir = new THREE.Vector3(target.x - start.x, target.y - start.y, 0);
      const dist = dir.length();
      dir.normalize();
      // Rolling along the path: the axis is table-normal x direction, with a little wobble.
      const axis = new THREE.Vector3(0, 0, 1).cross(dir).add(new THREE.Vector3(rand(-0.35, 0.35), rand(-0.35, 0.35), rand(-0.35, 0.35))).normalize();
      const live: Live = {
        die,
        group,
        body,
        numbers,
        shadow,
        glow,
        scale,
        target,
        start,
        final,
        axis,
        spin: dist / scale + rand(Math.PI, 2 * Math.PI),
        delay: throwThem ? row * 0.05 + rand(0, 0.08) : 0,
        duration: rand(1.1, 1.35),
        t: 0,
        rolling: throwThem,
        jiggle: 0,
        jiggleAxis: new THREE.Vector3(1, 0, 0),
        seed: rand(0, 100),
      };
      this.live.push(live);
      this.root.add(group);
      this.place(live, throwThem ? 0 : 1, 0);
    });
  }

  private q = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();

  /** Pose a die at throw progress p (0..1). */
  private place(l: Live, p: number, elapsed: number) {
    const spinner = l.group.children[1] as THREE.Group;
    const e = easeOutCubic(p);
    const spinLeft = 1 - easeOutCubic(clamp01(p / 0.86));
    this.q.setFromAxisAngle(l.axis, l.spin * spinLeft).multiply(l.final);
    if (p > 0.86 && p < 1) {
      // A last small rock as it settles.
      const k = (p - 0.86) / 0.14;
      this.q2.setFromAxisAngle(l.axis, 0.09 * Math.sin(k * Math.PI * 2.2) * (1 - k));
      this.q.premultiply(this.q2);
    }
    let x = l.start.x + (l.target.x - l.start.x) * e;
    let y = l.start.y + (l.target.y - l.start.y) * e;
    let lift = hop(p) * l.scale;
    if (l.jiggle > 0.002) {
      const s = l.seed + elapsed;
      x += Math.sin(s * 37) * l.jiggle * l.scale * 0.12;
      y += Math.sin(s * 29 + 1.3) * l.jiggle * l.scale * 0.12;
      lift += Math.abs(Math.sin(s * 23)) * l.jiggle * l.scale * 0.35;
      this.q2.setFromAxisAngle(l.jiggleAxis, Math.sin(s * 31) * l.jiggle * 0.45);
      this.q.premultiply(this.q2);
    }
    const z = restHeight(l.die.sides, this.q, l.scale) + lift;
    spinner.quaternion.copy(this.q);
    spinner.position.set(x, y, z);
    // The shadow stays on the table, drifts away from the light and fades as the die rises.
    const h = z / l.scale;
    l.shadow.position.set(x + 0.12 * z, y - 0.16 * z, 0.002);
    l.shadow.scale.setScalar(l.scale * (1.05 + 0.15 * h));
    if (l.glow) l.glow.position.set(x, y, 0.003);
  }

  private elapsed = 0;

  /** Advance the animation. Returns true while anything is still moving (ask for another frame). */
  update(dt: number) {
    const step = Math.min(dt, 1 / 20); // a dropped frame shouldn't teleport the dice
    this.elapsed += step;
    let moving = false;
    for (const l of this.live) {
      if (l.rolling) {
        l.t += step;
        const p = clamp01((l.t - l.delay) / l.duration);
        if (!this.landed && p >= 0.3) {
          this.landed = true;
          this.emit("impact");
        }
        this.place(l, p, this.elapsed);
        if (p >= 1) {
          l.rolling = false;
          if (l.die.kept === false) l.body.material = this.mats.bodyDim;
        } else moving = true;
      } else if (l.jiggle > 0.002) {
        l.jiggle *= Math.exp(-5 * step);
        this.place(l, 1, this.elapsed);
        moving = true;
      } else if (l.jiggle > 0) {
        l.jiggle = 0;
        this.place(l, 1, this.elapsed);
      }
    }
    if (!moving && !this.settledNotified) {
      this.settledNotified = true;
      this.emit("settled");
    }
    // A nat 20 glows gold under the die for a couple of seconds after it lands.
    for (const l of this.live) {
      if (!l.glow) continue;
      if (l.rolling) continue;
      this.glowTime += step;
      const t = this.glowTime;
      if (t < 2.6) {
        l.glow.visible = true;
        const pulse = 1 + 0.12 * Math.sin(t * 7);
        const fade = Math.min(1, t / 0.25) * (t > 1.8 ? 1 - (t - 1.8) / 0.8 : 1);
        l.glow.scale.setScalar(l.scale * 2.1 * pulse);
        (l.glow.material as THREE.MeshBasicMaterial).opacity = Math.max(0, fade);
        moving = true;
      } else if (l.glow.visible) {
        l.glow.visible = false;
      }
    }
    return moving;
  }

  /** Free every geometry and material this stage made. */
  dispose() {
    this.listeners.clear();
    this.clear();
    for (const kit of this.kits.values()) {
      kit.body.dispose();
      kit.numbers.dispose();
      kit.edges.dispose();
    }
    this.kits.clear();
    this.shadowGeo.dispose();
    this.glowGeo.dispose();
    this.trayGeo.dispose();
    for (const m of Object.values(this.mats)) m.dispose();
    this.root.clear();
  }
}
