// Checks the dice face numbering and the rotation that lands each face up.
// Run: deno test --allow-read --allow-env scripts/dice-faces.test.ts   (or: npm run test:dice)
import * as THREE from "three";
import { DIE_SIDES, cornerNumbers, dieShape, faceShowing, faceUpRotation, restHeight } from "../src/lib/dice/dicePolyhedra.ts";
import { rollPool, randomInt, formatRoll } from "../src/lib/dice/diceRoll.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

Deno.test("every die has the right number of flat faces numbered 1..n", () => {
  for (const sides of DIE_SIDES) {
    const shape = dieShape(sides);
    assert(shape.faces.length === sides, `d${sides} faces`);
    shape.faces.forEach((f, i) => {
      assert(f.value === i + 1, `d${sides} face ${i} value ${f.value}`);
      const d = f.normal.dot(shape.vertices[f.corners[0]]);
      for (const c of f.corners) {
        assert(Math.abs(f.normal.dot(shape.vertices[c]) - d) < 1e-5, `d${sides} face ${f.value} not flat`);
      }
      assert(Math.abs(f.up.dot(f.normal)) < 1e-9, `d${sides} up not in face`);
      assert(f.room > 0.05, `d${sides} face ${f.value} has no room for a number (${f.room})`);
      assert(Math.abs(f.normal.dot(f.centre) - d) < 1e-6, `d${sides} number centre off the face`);
    });
  }
});

Deno.test("opposite faces add up to n + 1 (not the d4)", () => {
  for (const sides of DIE_SIDES) {
    if (sides === 4) continue;
    for (const f of dieShape(sides).faces) {
      const opp = dieShape(sides).faces.find((g) => g.normal.dot(f.normal) < -0.9999);
      assert(opp && opp.value + f.value === sides + 1, `d${sides} ${f.value} opposite ${opp?.value}`);
    }
  }
});

Deno.test("faceUpRotation points the chosen face at the camera, upright, for any yaw", () => {
  const z = new THREE.Vector3(0, 0, 1);
  for (const sides of DIE_SIDES) {
    for (let value = 1; value <= sides; value += 1) {
      for (const yaw of [0, 0.3, -0.35]) {
        const q = faceUpRotation(sides, value, yaw);
        if (sides === 4) {
          // A d4 shows its top corner: that corner points straight up and the face opposite it
          // lies flat on the table.
          const corner = dieShape(4).vertices[value - 1].clone().normalize().applyQuaternion(q);
          assert(corner.distanceTo(z) < 1e-9, `d4 ${value}: corner ${corner.toArray()}`);
          const bottom = dieShape(4).faces.find((f) => !f.corners.includes(value - 1))!;
          assert(bottom.normal.clone().applyQuaternion(q).z < -1 + 1e-9, `d4 ${value}: not resting on a face`);
          assert(faceShowing(4, q) === value, `d4 ${value}: shows ${faceShowing(4, q)}`);
          // Every visible face has that corner's number printed by the top corner.
          for (const f of dieShape(4).faces) {
            if (f === bottom) continue;
            const top = cornerNumbers(f, dieShape(4)).find((c) => c.value === value);
            assert(top, `d4 ${value}: face ${f.value} lacks the number`);
          }
          continue;
        }
        const face = dieShape(sides).faces[value - 1];
        const n = face.normal.clone().applyQuaternion(q);
        assert(n.distanceTo(z) < 1e-9, `d${sides} ${value}: normal ${n.toArray()}`);
        const u = face.up.clone().applyQuaternion(q);
        const want = new THREE.Vector3(-Math.sin(yaw), Math.cos(yaw), 0);
        assert(u.distanceTo(want) < 1e-9, `d${sides} ${value}: up ${u.toArray()}`);
        assert(faceShowing(sides, q) === value, `d${sides} ${value}: shows ${faceShowing(sides, q)}`);
        // The chosen face is the top of the die: its centre is the highest point of any face centre.
        const top = face.centre.clone().applyQuaternion(q).z;
        for (const g of dieShape(sides).faces) {
          if (g === face) continue;
          assert(g.centre.clone().applyQuaternion(q).z < top - 1e-6, `d${sides} ${value}: face ${g.value} higher`);
        }
        assert(restHeight(sides, q, 1) > 0, "die above the table");
      }
    }
  }
});

Deno.test("rolls stay in range, advantage keeps the higher, disadvantage the lower", () => {
  for (let i = 0; i < 2000; i += 1) {
    const v = randomInt(6);
    assert(v >= 1 && v <= 6 && Number.isInteger(v), `randomInt ${v}`);
  }
  for (let i = 0; i < 300; i += 1) {
    const adv = rollPool({ 20: 1 }, 2, "advantage");
    const d20s = adv.dice.filter((d) => d.sides === 20);
    assert(d20s.length === 2, "two d20s");
    const kept = d20s.find((d) => d.kept)!;
    assert(kept.value === Math.max(...d20s.map((d) => d.value)), "keeps higher");
    assert(adv.total === kept.value + 2, "adv total");
    const dis = rollPool({ 20: 1 }, 0, "disadvantage");
    const k2 = dis.dice.find((d) => d.kept)!;
    assert(k2.value === Math.min(...dis.dice.map((d) => d.value)), "keeps lower");
  }
  const fire = rollPool({ 6: 8 }, 2, "normal");
  assert(fire.dice.length === 8 && fire.total === fire.dice.reduce((s, d) => s + d.value, 0) + 2, "8d6+2");
  assert(formatRoll(fire).expression === "8d6 + 2", formatRoll(fire).expression);
});

Deno.test("rough fairness of randomInt", () => {
  const counts = new Array(20).fill(0);
  const N = 40000;
  for (let i = 0; i < N; i += 1) counts[randomInt(20) - 1] += 1;
  for (const c of counts) assert(Math.abs(c - N / 20) < N / 20 * 0.15, `bucket ${c}`);
});
