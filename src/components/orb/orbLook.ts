// The Sage orb's look, rebuilt in plain three.js from David's Spline clip (green) and the Figma
// Tome orbs (hues for red and blue). No React or React Native in here, so the very same code
// renders in the app (through @react-three/fiber) and in a desktop browser for previews.
//
// Units: the orb has radius 1 and sits at the origin. The camera is orthographic and looks down
// -z, so a point on screen at (x, y) orb radii from the centre is just (x, y) in world space.
//
// What it draws, back to front:
//  1. Backdrop: one full-canvas quad with the dark spotlit background, a faint rim glow just
//     outside the sphere, and the talking pulse rings (no bloom, no extra passes).
//  2. Sphere: the glb's Sphere mesh with a fresnel shader: dim soft centre, deep band, neon rim.
// Idle is completely still. While talking, bursts of rings run out from the rim and the light
// inside the sphere drifts and breathes; when talking stops, the last rings finish and it settles.
import * as THREE from "three";

export type OrbColour = "red" | "blue" | "green";

type Palette = {
  /** Sphere centre at low / high energy. */
  centreLo: string;
  centreHi: string;
  /** The darker saturated band about 3/4 of the way out. */
  deep: string;
  /** The neon rim. */
  rim: string;
  /** Background: darkest corners, the main spotlight, the softer upper-left wash. */
  bgDark: string;
  bgSpot: string;
  bgLobe: string;
};

// Green: measured pixel by pixel from the Spline clip (sRGB). Red and blue: the same saturation
// and brightness per element, with each element's hue taken from the Figma Tome orbs
// (voice-orb-wizard / -plain @3x, Figma nodes 2231:52 and 2320:1208).
export const ORB_PALETTES: Record<OrbColour, Palette> = {
  green: {
    centreLo: "#28661F",
    centreHi: "#46883A",
    deep: "#0C960C",
    rim: "#0FFF05",
    bgDark: "#070E03",
    bgSpot: "#192F0D",
    bgLobe: "#0B1403",
  },
  red: {
    centreLo: "#66271F",
    centreHi: "#88433A",
    deep: "#961B0C",
    rim: "#FF1D05",
    bgDark: "#0E0403",
    bgSpot: "#2F110D",
    bgLobe: "#140503",
  },
  blue: {
    centreLo: "#1F6166",
    centreHi: "#3A8288",
    deep: "#0C8B96",
    rim: "#05E3FF",
    bgDark: "#030D0E",
    bgSpot: "#0D2C2F",
    bgLobe: "#031314",
  },
};

/** Orb radius as a fraction of half the canvas: the rest is backdrop and room for the rings. */
export const ORB_FILL = 0.4;

/** World half-height the orthographic camera must show for the orb to fill ORB_FILL. */
export const ORB_VIEW_HALF = 1 / ORB_FILL;

// Pulse shape, measured on the clip (orb radius R = 137 px at 30 fps):
// ring A leaves the rim and runs out to about 1.9R in ~0.95 s, bright at first and fading linearly;
// ring B follows 0.4 s later, dimmer and shorter (to ~1.3R in 0.6 s).
const RING_A = { life: 0.95, spread: 0.95, width0: 0.2, width1: 0.2, alpha: 0.09 };
const RING_B = { life: 0.6, spread: 0.3, width0: 0.15, width1: 0.1, alpha: 0.06 };
const ECHO_DELAY = 0.4;
/** Seconds between bursts while talking (the clip runs a steady 2 s; a little play reads as speech). */
const GAP_MIN = 1.4;
const GAP_MAX = 2.4;
const MAX_RINGS = 6;
/** Colour change between personalities, seconds. */
const COLOUR_FADE = 0.6;
/** How fast the inside eases between still and talking, seconds. */
const SETTLE = 0.8;
/** Resting sphere energy (0 = dimmest seen in the clip, 1 = brightest). */
const IDLE_ENERGY = 0.45;

const backdropVertex = /* glsl */ `
  varying vec2 vP;
  void main() {
    // Full-canvas quad. Undo the (orthographic, unrotated) camera to get world xy in orb radii.
    vP = (position.xy - vec2(projectionMatrix[3][0], projectionMatrix[3][1]))
      / vec2(projectionMatrix[0][0], projectionMatrix[1][1]) + cameraPosition.xy;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const backdropFragment = /* glsl */ `
  precision highp float;
  varying vec2 vP;
  uniform vec3 uDark;
  uniform vec3 uSpot;
  uniform vec3 uLobe;
  uniform vec3 uRim;
  uniform float uGlow;
  // x: kind (0 = off, 1 = A, 2 = B), y: progress 0..1
  uniform vec2 uRings[${MAX_RINGS}];

  float ring(float r, float t, float spread, float w0, float w1, float a) {
    float outer = 1.0 + spread * (1.0 - pow(1.0 - t, 1.5));
    float w = w0 + w1 * t;
    float body = smoothstep(outer - w, outer - 0.02, r) * (1.0 - smoothstep(outer - 0.02, outer + 0.05, r));
    return body * a * (1.0 - t);
  }

  void main() {
    vec2 p = vP;
    float r = length(p);
    vec2 ds = p - vec2(0.8, -0.7);
    vec2 dl = p - vec2(-2.6, 2.2);
    vec3 col = uDark + uSpot * exp(-dot(ds, ds) / 6.2) + uLobe * exp(-dot(dl, dl) / 5.5);
    col += uRim * uGlow * exp(-max(r - 1.0, 0.0) / 0.06);
    float a = 0.0;
    for (int i = 0; i < ${MAX_RINGS}; i++) {
      vec2 g = uRings[i];
      if (g.x > 1.5) a += ring(r, g.y, ${RING_B.spread.toFixed(3)}, ${RING_B.width0.toFixed(3)}, ${RING_B.width1.toFixed(3)}, ${RING_B.alpha.toFixed(3)});
      else if (g.x > 0.5) a += ring(r, g.y, ${RING_A.spread.toFixed(3)}, ${RING_A.width0.toFixed(3)}, ${RING_A.width1.toFixed(3)}, ${RING_A.alpha.toFixed(3)});
    }
    col = mix(col, vec3(1.0), clamp(a, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const sphereVertex = /* glsl */ `
  varying vec3 vN;
  void main() {
    // A centred sphere's normal is its position; this avoids seams in the exported normals.
    vN = normalize(normalMatrix * position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sphereFragment = /* glsl */ `
  precision highp float;
  varying vec3 vN;
  uniform vec3 uCentreLo;
  uniform vec3 uCentreHi;
  uniform vec3 uDeep;
  uniform vec3 uRim;
  uniform float uEnergy;
  uniform vec2 uLight;
  void main() {
    vec2 p = vN.xy;               // screen position inside the disc, in orb radii
    float x = clamp(length(p), 0.0, 1.0);
    vec2 d = p - uLight;
    vec3 c = mix(uCentreLo, uCentreHi, uEnergy) * mix(0.84, 1.0, exp(-dot(d, d) / 0.5));
    c = mix(c, uDeep, smoothstep(0.60, 0.84, x));
    c = mix(c, uRim, smoothstep(mix(0.86, 0.74, uEnergy), 0.97, x));
    c *= 1.0 + 0.05 * p.x;        // the clip is lit a touch from the right
    gl_FragColor = vec4(c, 1.0);
  }
`;

// Colours go straight to the screen: these ShaderMaterials skip three's colour-space output step,
// so the sRGB hex values above are written as they are. Read them raw, without conversion.
function raw(hex: string) {
  const c = new THREE.Color();
  c.setHex(parseInt(hex.slice(1), 16), THREE.NoColorSpace);
  return new THREE.Vector3(c.r, c.g, c.b);
}

type PaletteVecs = Record<keyof Palette, THREE.Vector3>;

function vecs(colour: OrbColour): PaletteVecs {
  const p = ORB_PALETTES[colour];
  return {
    centreLo: raw(p.centreLo),
    centreHi: raw(p.centreHi),
    deep: raw(p.deep),
    rim: raw(p.rim),
    bgDark: raw(p.bgDark),
    bgSpot: raw(p.bgSpot),
    bgLobe: raw(p.bgLobe),
  };
}

const KEYS: (keyof Palette)[] = ["centreLo", "centreHi", "deep", "rim", "bgDark", "bgSpot", "bgLobe"];

type Ring = { kind: 1 | 2; age: number; life: number };

/** Deterministic little random source, so previews can be replayed exactly. */
function makeRandom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type OrbLook = {
  /** Add this to the scene. */
  group: THREE.Group;
  /** Change personality colour (fades over COLOUR_FADE unless instant). */
  setColour: (colour: OrbColour, instant?: boolean) => void;
  /**
   * Advance by dt seconds. talking: Sage is speaking or writing a reply. Returns true while
   * anything is still moving (talking, rings fading, the inside settling, a colour fade), so the
   * caller can stop drawing frames once it returns false: the orb is then completely still.
   */
  update: (dt: number, talking: boolean) => boolean;
  dispose: () => void;
};

/**
 * Builds the orb. sphere: the glb's Sphere geometry, centred and scaled to radius 1 (see
 * fitSphere); a plain sphere is used when none is given.
 */
export function createOrbLook(opts: { colour: OrbColour; sphere?: THREE.BufferGeometry; seed?: number }): OrbLook {
  const random = makeRandom(opts.seed ?? Date.now());
  const ownGeometry = !opts.sphere;
  const sphereGeo = opts.sphere ?? new THREE.SphereGeometry(1, 96, 64);
  const quadGeo = new THREE.PlaneGeometry(2, 2);

  const from = vecs(opts.colour);
  const to = vecs(opts.colour);
  const now = vecs(opts.colour);
  let fade = 1;

  const ringSlots = Array.from({ length: MAX_RINGS }, () => new THREE.Vector2());
  const backdropMat = new THREE.ShaderMaterial({
    vertexShader: backdropVertex,
    fragmentShader: backdropFragment,
    uniforms: {
      uDark: { value: now.bgDark },
      uSpot: { value: now.bgSpot },
      uLobe: { value: now.bgLobe },
      uRim: { value: now.rim },
      uGlow: { value: 0.04 },
      uRings: { value: ringSlots },
    },
    depthTest: false,
    depthWrite: false,
  });
  const sphereMat = new THREE.ShaderMaterial({
    vertexShader: sphereVertex,
    fragmentShader: sphereFragment,
    uniforms: {
      uCentreLo: { value: now.centreLo },
      uCentreHi: { value: now.centreHi },
      uDeep: { value: now.deep },
      uRim: { value: now.rim },
      uEnergy: { value: IDLE_ENERGY },
      uLight: { value: new THREE.Vector2() },
    },
  });

  const backdrop = new THREE.Mesh(quadGeo, backdropMat);
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -1;
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.renderOrder = 1;
  const group = new THREE.Group();
  group.add(backdrop, sphere);

  const rings: Ring[] = [];
  let wasTalking = false;
  let untilBurst = 0;
  let untilEcho = -1;
  let talk = 0; // 0 still .. 1 fully talking
  let clock = 0; // runs only while talking, so idle never moves

  function spawn(kind: 1 | 2) {
    if (rings.length >= MAX_RINGS) rings.shift();
    rings.push({ kind, age: 0, life: kind === 1 ? RING_A.life : RING_B.life });
  }

  function update(dt: number, talking: boolean) {
    const step = Math.min(Math.max(dt, 0), 0.1);

    if (fade < 1) {
      fade = Math.min(1, fade + step / COLOUR_FADE);
      const k = fade * fade * (3 - 2 * fade);
      for (const key of KEYS) now[key].lerpVectors(from[key], to[key], k);
    }

    if (talking && !wasTalking) untilBurst = 0.12; // start promptly
    wasTalking = talking;
    if (talking) {
      untilBurst -= step;
      if (untilBurst <= 0) {
        spawn(1);
        untilEcho = ECHO_DELAY;
        untilBurst += GAP_MIN + random() * (GAP_MAX - GAP_MIN);
      }
    }
    if (untilEcho >= 0) {
      untilEcho -= step;
      if (untilEcho < 0) spawn(2);
    }
    for (const ring of rings) ring.age += step;
    while (rings.length && rings[0].age >= rings[0].life) rings.shift();
    for (let i = 0; i < MAX_RINGS; i += 1) {
      const ring = rings[i];
      if (ring) ringSlots[i].set(ring.kind, ring.age / ring.life);
      else ringSlots[i].set(0, 0);
    }

    // The light inside drifts round (about a 5 s loop in the clip) and breathes while talking.
    talk += ((talking ? 1 : 0) - talk) * Math.min(1, step / (SETTLE / 3));
    if (talk < 1e-3 && !talking) talk = 0;
    if (talk > 0) clock += step;
    const energy = IDLE_ENERGY + 0.4 * Math.sin(clock * 1.3) * 0.6 + 0.4 * Math.sin(clock * 0.53 + 1.1) * 0.4;
    sphereMat.uniforms.uEnergy.value = IDLE_ENERGY + (Math.min(1, Math.max(0, energy)) - IDLE_ENERGY) * talk;
    (sphereMat.uniforms.uLight.value as THREE.Vector2).set(
      0.18 * Math.sin(clock * 1.25) * talk,
      -0.16 * Math.cos(clock * 1.25) * talk,
    );
    return talking || rings.length > 0 || untilEcho >= 0 || talk > 0 || fade < 1;
  }

  function setColour(colour: OrbColour, instant = false) {
    const next = vecs(colour);
    for (const key of KEYS) {
      from[key].copy(now[key]);
      to[key].copy(next[key]);
      if (instant) now[key].copy(next[key]);
    }
    fade = instant ? 1 : 0;
  }

  function dispose() {
    backdropMat.dispose();
    sphereMat.dispose();
    quadGeo.dispose();
    if (ownGeometry) sphereGeo.dispose();
  }

  return { group, setColour, update, dispose };
}

/**
 * Pulls the Sphere out of the parsed glb, bakes its transform and fits it to radius 1 at the
 * origin. Core, Ellipse and Ellipse 2 (the eyes) are left out: they never show in the Spline clip.
 */
export function fitSphere(root: THREE.Object3D): THREE.BufferGeometry {
  root.updateMatrixWorld(true);
  let found: THREE.Mesh | null = null;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!found && mesh.isMesh && mesh.name === "Sphere") found = mesh;
  });
  if (!found) throw new Error("The model opened, but the orb's Sphere was not in it.");
  const mesh = found as THREE.Mesh;
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox();
  const box = geo.boundingBox as THREE.Box3;
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  geo.translate(-centre.x, -centre.y, -centre.z);
  const scale = 2 / (Math.max(size.x, size.y, size.z) || 1);
  geo.scale(scale, scale, scale);
  return geo;
}
