// The six dice as convex polyhedra, with face numbering and the rotation that lands any face up.
// Plain three.js maths, no React or React Native, so the same code runs in the app, in the browser
// preview and in the Deno test (scripts/dice-faces.test.ts).
//
// World frame used everywhere in the dice code: the table is the plane z = 0, the camera looks
// straight down -z from above, and screen "up" is +y. A die is "showing" a face when that face's
// outward normal points along +z (at the camera); the number is upright when its up direction
// points along +y.
import * as THREE from "three";

export const DIE_SIDES = [4, 6, 8, 10, 12, 20] as const;
export type DieSides = (typeof DIE_SIDES)[number];

export type DieFace = {
  /** The number printed on this face. */
  value: number;
  /** Corner indices into DieShape.vertices, counter-clockwise seen from outside. */
  corners: number[];
  /** Outward unit normal. */
  normal: THREE.Vector3;
  /** Unit vector in the face plane: the direction the top of the number points. */
  up: THREE.Vector3;
  /** Where the number is centred (a point on the face plane). */
  centre: THREE.Vector3;
  /** Radius of the largest circle around `centre` that stays inside the face. */
  room: number;
};

export type DieShape = {
  sides: DieSides;
  /** Corners, scaled so the furthest corner is 1 from the centre. */
  vertices: THREE.Vector3[];
  /** Faces, index = value - 1. */
  faces: DieFace[];
};

const PHI = (1 + Math.sqrt(5)) / 2;

function rawVertices(sides: DieSides): number[][] {
  switch (sides) {
    case 4:
      return [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
      ];
    case 6: {
      const out: number[][] = [];
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) out.push([x, y, z]);
      return out;
    }
    case 8:
      return [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ];
    case 10: {
      // Pentagonal trapezohedron: two poles and a zig-zag ring of ten corners. For the kites to be
      // flat the pole height h and the ring offset a must satisfy h = a (1 + cos 36°) / (1 - cos 36°).
      const a = 0.105;
      const c = Math.cos(Math.PI / 5);
      const h = (a * (1 + c)) / (1 - c);
      const out: number[][] = [
        [0, 0, h],
        [0, 0, -h],
      ];
      for (let k = 0; k < 10; k += 1) {
        const ang = (k * Math.PI) / 5;
        out.push([Math.cos(ang), Math.sin(ang), k % 2 === 0 ? a : -a]);
      }
      return out;
    }
    case 12: {
      const out: number[][] = [];
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) out.push([x, y, z]);
      const p = PHI;
      const q = 1 / PHI;
      for (const s1 of [-1, 1])
        for (const s2 of [-1, 1]) {
          out.push([0, s1 * q, s2 * p]);
          out.push([s1 * q, s2 * p, 0]);
          out.push([s1 * p, 0, s2 * q]);
        }
      return out;
    }
    case 20: {
      const out: number[][] = [];
      for (const s1 of [-1, 1])
        for (const s2 of [-1, 1]) {
          out.push([0, s1, s2 * PHI]);
          out.push([s1, s2 * PHI, 0]);
          out.push([s2 * PHI, 0, s1]);
        }
      return out;
    }
  }
}

/** Faces of a convex point set by brute force (fine for at most 20 corners): every plane through
 *  three corners with all the others behind it is a face; corners on that plane are its polygon. */
function hullFaces(verts: THREE.Vector3[]) {
  const EPS = 1e-6;
  const faces: { corners: number[]; normal: THREE.Vector3; d: number }[] = [];
  const n = verts.length;
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  for (let i = 0; i < n; i += 1)
    for (let j = i + 1; j < n; j += 1)
      for (let k = j + 1; k < n; k += 1) {
        ab.subVectors(verts[j], verts[i]);
        ac.subVectors(verts[k], verts[i]);
        const normal = new THREE.Vector3().crossVectors(ab, ac);
        if (normal.lengthSq() < EPS) continue;
        normal.normalize();
        let d = normal.dot(verts[i]);
        let front = 0;
        let back = 0;
        for (const v of verts) {
          const s = normal.dot(v) - d;
          if (s > EPS) front += 1;
          else if (s < -EPS) back += 1;
        }
        if (front > 0 && back > 0) continue;
        if (front > 0) {
          normal.negate();
          d = -d;
        }
        if (faces.some((f) => f.normal.dot(normal) > 1 - 1e-6)) continue;
        const corners: number[] = [];
        verts.forEach((v, idx) => {
          if (Math.abs(normal.dot(v) - d) < 1e-5) corners.push(idx);
        });
        faces.push({ corners, normal, d });
      }
  // Order each polygon counter-clockwise around its outward normal.
  for (const f of faces) {
    const centre = new THREE.Vector3();
    for (const c of f.corners) centre.add(verts[c]);
    centre.divideScalar(f.corners.length);
    const ax = new THREE.Vector3().subVectors(verts[f.corners[0]], centre).normalize();
    const ay = new THREE.Vector3().crossVectors(f.normal, ax);
    const tmp = new THREE.Vector3();
    f.corners.sort((p, q) => {
      tmp.subVectors(verts[p], centre);
      const ap = Math.atan2(tmp.dot(ay), tmp.dot(ax));
      tmp.subVectors(verts[q], centre);
      const aq = Math.atan2(tmp.dot(ay), tmp.dot(ax));
      return ap - aq;
    });
  }
  return faces;
}

/** Distance from a 2D point to the polygon's nearest edge (polygon convex, CCW). */
function edgeDistance(px: number, py: number, poly: [number, number][]) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i += 1) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const ex = x2 - x1;
    const ey = y2 - y1;
    const len = Math.hypot(ex, ey);
    // Inside a CCW polygon the point is on the left of every edge, so this is positive.
    const dist = (ex * (py - y1) - ey * (px - x1)) / len;
    best = Math.min(best, dist);
  }
  return best;
}

function buildShape(sides: DieSides): DieShape {
  const vertices = rawVertices(sides).map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const far = Math.max(...vertices.map((v) => v.length()));
  for (const v of vertices) v.divideScalar(far);
  const hull = hullFaces(vertices);
  if (hull.length !== sides) throw new Error(`d${sides}: found ${hull.length} faces`);

  // Numbering: opposite faces add up to sides + 1 (d6, d8, d10, d12, d20). Faces are taken in a
  // fixed order so the numbering is the same on every run; the d4 has no opposite faces.
  const order = hull
    .map((f, idx) => ({ f, idx }))
    .sort((p, q) => q.f.normal.z - p.f.normal.z || q.f.normal.y - p.f.normal.y || q.f.normal.x - p.f.normal.x);
  const valueOf = new Map<number, number>();
  if (sides === 4) {
    order.forEach(({ idx }, i) => valueOf.set(idx, i + 1));
  } else {
    let next = 1;
    for (const { f, idx } of order) {
      if (valueOf.has(idx)) continue;
      const opp = hull.findIndex((g) => g.normal.dot(f.normal) < -1 + 1e-6);
      if (opp < 0 || valueOf.has(opp)) throw new Error(`d${sides}: no opposite face`);
      // Alternate which of the pair gets the low number so lows and highs are spread out.
      const low = next;
      const high = sides + 1 - next;
      const flip = next % 2 === 0;
      valueOf.set(idx, flip ? high : low);
      valueOf.set(opp, flip ? low : high);
      next += 1;
    }
  }

  const faces: DieFace[] = hull.map((f, idx) => {
    const pts = f.corners.map((c) => vertices[c]);
    const centroid = new THREE.Vector3();
    for (const p of pts) centroid.add(p);
    centroid.divideScalar(pts.length);
    // The number's top points at the corner furthest from the centroid (the long tip of a d10
    // kite); on regular faces every corner ties and the first one wins.
    let farIdx = 0;
    let farDist = -1;
    pts.forEach((p, i) => {
      const dist = p.distanceTo(centroid);
      if (dist > farDist + 1e-6) {
        farDist = dist;
        farIdx = i;
      }
    });
    const up = new THREE.Vector3().subVectors(pts[farIdx], centroid);
    up.addScaledVector(f.normal, -up.dot(f.normal)).normalize();
    const right = new THREE.Vector3().crossVectors(up, f.normal);
    // Number centre: the point inside the face furthest from every edge (its inscribed circle).
    const poly: [number, number][] = pts.map((p) => {
      const rel = new THREE.Vector3().subVectors(p, centroid);
      return [rel.dot(right), rel.dot(up)];
    });
    // right x up = normal, so a polygon CCW about the normal is CCW in (right, up) as well.
    const polyCCW = poly;
    let bx = 0;
    let by = 0;
    let room = edgeDistance(0, 0, polyCCW);
    const span = farDist;
    const STEPS = 48;
    for (let iy = 0; iy <= STEPS; iy += 1)
      for (let ix = 0; ix <= STEPS; ix += 1) {
        const x = -span + (2 * span * ix) / STEPS;
        const y = -span + (2 * span * iy) / STEPS;
        const dist = edgeDistance(x, y, polyCCW);
        if (dist > room + 1e-9) {
          room = dist;
          bx = x;
          by = y;
        }
      }
    const centre = centroid.clone().addScaledVector(right, bx).addScaledVector(up, by);
    return { value: valueOf.get(idx)!, corners: f.corners, normal: f.normal.clone(), up, centre, room };
  });
  faces.sort((p, q) => p.value - q.value);
  return { sides, vertices, faces };
}

const shapes = new Map<DieSides, DieShape>();

/** The die's shape, built once and shared. */
export function dieShape(sides: DieSides): DieShape {
  let shape = shapes.get(sides);
  if (!shape) {
    shape = buildShape(sides);
    shapes.set(sides, shape);
  }
  return shape;
}

/** The die-frame direction that ends up pointing at the camera when `value` is rolled, and the
 *  die-frame direction that ends up pointing up the screen. For most dice that is the face's
 *  normal and its number's up. A d4 lands on a face with a corner on top, and reads by that
 *  corner: every corner carries its own number (see cornerNumbers), so the "showing" direction
 *  is the corner, and the face without corner `value + 1` sits at the bottom of the screen,
 *  upright. */
export function landing(sides: DieSides, value: number) {
  const shape = dieShape(sides);
  if (sides === 4) {
    const v = shape.vertices[value - 1];
    if (!v) throw new Error(`d4 has no corner ${value}`);
    const toCamera = v.clone().normalize();
    const w = shape.vertices[value % 4];
    const up = w.clone().addScaledVector(toCamera, -w.dot(toCamera)).normalize();
    return { toCamera, up };
  }
  const face = shape.faces[value - 1];
  if (!face) throw new Error(`d${sides} has no face ${value}`);
  return { toCamera: face.normal, up: face.up };
}

/** The rotation that turns `value` to the camera (+z) with its number upright (+y), then turned
 *  by `yaw` radians about +z so the dice don't all line up like soldiers. */
export function faceUpRotation(sides: DieSides, value: number, yaw = 0, out = new THREE.Quaternion()) {
  const { toCamera: n, up: u } = landing(sides, value);
  const r = new THREE.Vector3().crossVectors(u, n); // with u and n, a right-handed frame
  // Rows r, u, n map those three directions onto x, y, z.
  const m = new THREE.Matrix4().set(r.x, r.y, r.z, 0, u.x, u.y, u.z, 0, n.x, n.y, n.z, 0, 0, 0, 0, 1);
  out.setFromRotationMatrix(m);
  if (yaw) out.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), yaw));
  return out;
}

/** d4 only: for each face, its three corner numbers, each placed near its corner with its top
 *  pointing at that corner (the corner's number is its index + 1). */
export function cornerNumbers(face: DieFace, shape: DieShape) {
  const centroid = new THREE.Vector3();
  for (const c of face.corners) centroid.add(shape.vertices[c]);
  centroid.divideScalar(face.corners.length);
  return face.corners.map((c) => {
    const corner = shape.vertices[c];
    const up = new THREE.Vector3().subVectors(corner, centroid);
    const reach = up.length();
    up.normalize();
    return { value: c + 1, up, centre: centroid.clone().addScaledVector(up, reach * 0.5), reach };
  });
}

/** Which number a die turned by `q` is showing: the face (or, on a d4, the corner) pointing most
 *  toward the camera. */
export function faceShowing(sides: DieSides, q: THREE.Quaternion) {
  const shape = dieShape(sides);
  if (sides === 4) {
    let bestCorner = 0;
    let top = -Infinity;
    shape.vertices.forEach((v, i) => {
      const z = v.clone().applyQuaternion(q).z;
      if (z > top) {
        top = z;
        bestCorner = i;
      }
    });
    return bestCorner + 1;
  }
  let best = shape.faces[0];
  let bestZ = -Infinity;
  const tmp = new THREE.Vector3();
  for (const f of shape.faces) {
    const z = tmp.copy(f.normal).applyQuaternion(q).z;
    if (z > bestZ) {
      bestZ = z;
      best = f;
    }
  }
  return best.value;
}

/** Height of the die's centre above the table when turned by `q` (lowest corner touching z = 0). */
export function restHeight(sides: DieSides, q: THREE.Quaternion, scale: number) {
  const tmp = new THREE.Vector3();
  let low = Infinity;
  for (const v of dieShape(sides).vertices) low = Math.min(low, tmp.copy(v).applyQuaternion(q).z);
  return -low * scale;
}
