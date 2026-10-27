import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* Sculpted geometry for the stylised players. Everything is built once per colour set and cached by the caller.
   Limbs are single lathed surfaces skinned to two bones (upper + lower), so joints bend smoothly instead of
   showing separate balls and tubes; clothing gets soft folds, seams, hems and cuffs baked into the shape. */

const lerp = THREE.MathUtils.lerp, ss = THREE.MathUtils.smoothstep;
const bump = (d, at, w) => Math.exp(-(((d - at) / w) ** 2));

/* displace a lathed surface radially: folds(d, phi) returns extra radius at distance d along the limb and angle phi */
function displace(geo, P, folds) {
  const pos = geo.attributes.position, n = pos.count;
  for (let v = 0; v < n; v++) {
    const x = pos.getX(v), z = pos.getZ(v), r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const k = (r + folds(-P[v % P.length].y, Math.atan2(x, z), v % P.length)) / r;
    pos.setX(v, x * k); pos.setZ(v, z * k);
  }
  geo.computeVertexNormals();
}

/* Generic limb: shoulder/hip cap -> upper -> joint -> lower -> end cap, skinned to bones 0 and 1.
   cover = how far the clothing reaches (beyond it the surface is skin), ending in a small raised cuff. */
export function limbGeometry({ L1, L2, radius, cover, cloth, skin, folds, segments = 32, rows = 44 }) {
  const total = L1 + L2, P = [], C = [], S = new THREE.Color(cloth), K = new THREE.Color(skin);
  const add = (r, y, col) => { P.push(new THREE.Vector2(Math.max(r, 0.0001), y)); C.push(col); };
  const sleeve = d => (d < cover ? 0.012 : 0);
  const rb = radius(total);
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2); add((rb + sleeve(total)) * Math.sin(a), -total - rb * 0.45 * Math.cos(a), cover >= total ? S : K); }
  let cuffDone = cover >= total;
  for (let i = rows - 1; i >= 0; i--) {
    const d = (i / rows) * total;
    if (!cuffDone && d <= cover) {
      cuffDone = true;
      const rc = radius(cover);
      add(rc, -cover, K); add(rc + 0.024, -cover + 0.0005, S); add(rc + 0.026, -cover + 0.015, S); add(rc + 0.02, -cover + 0.035, S);
      if (d > cover - 0.035) continue;
    }
    add(radius(d) + sleeve(d), -d, d < cover ? S : K);
  }
  const r0 = radius(0) + sleeve(0);
  for (let i = 1; i <= 9; i++) { const a = (i / 9) * (Math.PI / 2); add(r0 * Math.cos(a), r0 * 0.8 * Math.sin(a), cover > 0 ? S : K); }

  const geo = new THREE.LatheGeometry(P, segments), n = geo.attributes.position.count;
  if (folds) displace(geo, P, (d, phi) => (d < cover - 0.03 ? folds(d, phi) : 0));
  const col = new Float32Array(n * 3), idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const j = v % P.length, w = ss(-P[j].y, L1 - 0.08, L1 + 0.08);
    col.set([C[j].r, C[j].g, C[j].b], v * 3);
    idx.set([0, 1, 0, 0], v * 4); wt.set([1 - w, w, 0, 0], v * 4);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(wt, 4));
  return geo;
}

/* arm: rounded deltoid, biceps, soft elbow, forearm; sleeve creases at the elbow */
export const ARM_RADIUS = (L1, L2) => d => (d < L1
  ? lerp(0.112, 0.082, d / L1) + 0.012 * Math.sin((Math.PI * d) / L1)
  : lerp(0.082, 0.058, (d - L1) / L2) + 0.013 * Math.sin((Math.PI * (d - L1)) / L2));
export const sleeveFolds = L1 => (d, phi) => 0.007 * bump(d, L1, 0.07) * Math.sin(phi * 5 + d * 40) + 0.004 * bump(d, L1 * 0.45, 0.06) * Math.sin(phi * 3 - d * 30);

/* leg: hip, thigh, knee, calf, ankle; trousers with creases behind the knee and a gentle pooling at the hem */
export const LEG = { upper: 0.62, lower: 0.56 };
export const LEG_RADIUS = d => (d < LEG.upper
  ? lerp(0.15, 0.108, d / LEG.upper)
  : lerp(0.106, 0.068, (d - LEG.upper) / LEG.lower) + 0.02 * Math.sin((Math.PI * (d - LEG.upper)) / LEG.lower));
export const trouserFolds = (d, phi) => 0.008 * bump(d, LEG.upper, 0.08) * Math.sin(phi * 6 + d * 35) * (Math.cos(phi) < 0 ? 1 : 0.4)
  + 0.012 * bump(d, LEG.upper + LEG.lower - 0.04, 0.05) * (0.5 + 0.5 * Math.sin(phi * 4))
  - 0.004 * bump(Math.abs(Math.sin(phi)), 1, 0.06);                       // side seam

/* jersey torso: chest, waist and a hem that sits over the trousers, with waist folds and side seams */
export function torsoGeometry() {
  const prof = [[0, -0.46], [0.29, -0.455], [0.31, -0.38], [0.32, -0.31], [0.395, -0.29], [0.39, -0.22], [0.385, -0.08], [0.395, 0.12], [0.375, 0.3], [0.315, 0.44], [0.2, 0.53], [0.12, 0.56], [0, 0.565]];
  const P = new THREE.SplineCurve(prof.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(64);
  const geo = new THREE.LatheGeometry(P, 64);
  displace(geo, P, (d, phi, j) => {
    const y = P[j].y;
    return 0.009 * bump(y, -0.16, 0.08) * Math.sin(phi * 7 + y * 25)        // soft folds where the shirt is tucked/bunched
      + 0.005 * bump(y, 0.2, 0.12) * Math.sin(phi * 3 + 1)
      - 0.006 * bump(Math.abs(Math.sin(phi)), 1, 0.035) * (y > -0.29 ? 1 : 0); // side seams
  });
  return geo;
}

/* trainer-style cricket shoe: a sculpted upper with a raised toe box, separate rubber sole and heel */
export function shoeGeometry() {
  const up = new THREE.SphereGeometry(1, 48, 28), p = up.attributes.position;
  for (let v = 0; v < p.count; v++) {
    let x = p.getX(v), y = p.getY(v), z = p.getZ(v);
    x *= 0.14 * (z > 0 ? 1 - z * 0.12 : 1); z = z * 0.27 + 0.05; y *= 0.11;
    if (y < -0.03) y = -0.03 + (y + 0.03) * 0.2;                   // flat underside
    if (z > 0.12) y += (z - 0.12) * 0.12 * (y < 0 ? 1 : -0.6);       // toe spring, lower toe box
    p.setXYZ(v, x, y, z);
  }
  up.computeVertexNormals();
  return up;
}
export function soleGeometry() {
  const g = new THREE.SphereGeometry(1, 48, 16), p = g.attributes.position;
  for (let v = 0; v < p.count; v++) {
    let x = p.getX(v), y = p.getY(v), z = p.getZ(v);
    p.setXYZ(v, x * 0.152 * (z > 0 ? 1 - z * 0.1 : 1), Math.max(-0.4, Math.min(0.4, y)) * 0.06, z * 0.285 + 0.05);
  }
  g.computeVertexNormals();
  return g;
}

/* stylised hair: chunky tapered locks swept from the crown, curling at the tips, merged into one mesh */
function lock(points, r0) {
  const curve = new THREE.CatmullRomCurve3(points), T = 18, R = 10;
  const g = new THREE.TubeGeometry(curve, T, r0, R, false), p = g.attributes.position, c = new THREE.Vector3(), v3 = new THREE.Vector3();
  for (let i = 0; i <= T; i++) {
    curve.getPointAt(i / T, c);
    const s = 1 - 0.9 * Math.pow(i / T, 1.3);
    for (let j = 0; j <= R; j++) { const k = i * (R + 1) + j; v3.fromBufferAttribute(p, k).sub(c).multiplyScalar(s).add(c); p.setXYZ(k, v3.x, v3.y, v3.z); }
  }
  g.computeVertexNormals();
  return g;
}
/* smooth cartoon hair (animated-film kid style): a full rounded mass over the top and back, a soft side-swept fringe
   over the forehead, rounded sideburns and one curl standing up on the crown */
export function hairGeometry() {
  const ell = (sx, sy, sz, rx, rz, x, y, z) => new THREE.SphereGeometry(1, 40, 24).scale(sx, sy, sz).rotateX(rx).rotateZ(rz).translate(x, y, z);
  const parts = [
    new THREE.SphereGeometry(0.478, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.44),                                  // top
    new THREE.SphereGeometry(0.472, 64, 32, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.63),           // back and sides
    ell(0.31, 0.12, 0.18, -0.3, -0.32, 0.09, 0.27, 0.33),                                                        // main fringe swoop
    ell(0.2, 0.1, 0.15, -0.3, 0.38, -0.18, 0.27, 0.31),                                                          // smaller fringe on the other side
    ell(0.09, 0.15, 0.12, 0, 0.1, 0.4, 0.02, 0.1), ell(0.09, 0.15, 0.12, 0, -0.1, -0.4, 0.02, 0.1),              // sideburns
    lock([new THREE.Vector3(0.02, 0.43, -0.06), new THREE.Vector3(0.06, 0.56, -0.03), new THREE.Vector3(0.13, 0.58, 0.04), new THREE.Vector3(0.14, 0.51, 0.08)], 0.065)
  ];
  parts.forEach(g => g.attributes.uv && g.deleteAttribute('uv'));
  return mergeGeometries(parts);
}

/* realistic head: an egg-shaped skull with a tapering jaw and chin, cheekbones, a brow ridge and eye sockets
   (radius ~0.43, face looking along +z) */
export function headGeometry() {
  const g = new THREE.SphereGeometry(0.43, 96, 72), p = g.attributes.position, n = new THREE.Vector3();
  const F = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
  const feats = [
    [F(-0.34, 0.04, 0.94), -0.03, 0.2], [F(0.34, 0.04, 0.94), -0.03, 0.2],      // eye sockets
    [F(-0.3, 0.24, 0.92), 0.018, 0.2], [F(0.3, 0.24, 0.92), 0.018, 0.2],          // brow ridge
    [F(-0.55, -0.18, 0.8), 0.02, 0.24], [F(0.55, -0.18, 0.8), 0.02, 0.24],        // cheekbones
    [F(0, -0.82, 0.57), 0.015, 0.2],                                               // chin
    [F(-0.95, 0.05, -0.1), -0.03, 0.45], [F(0.95, 0.05, -0.1), -0.03, 0.45]       // flatter temples
  ];
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i).normalize();
    let r = 0.43;
    for (const [f, amp, w] of feats) { const a = Math.acos(Math.min(1, n.dot(f))); r += amp * Math.exp(-(a * a) / (w * w)); }
    let x = n.x * r, y = n.y * r, z = n.z * r;
    const jaw = 1 - 0.17 * ss(-n.y, 0.1, 0.95);                                  // jaw narrows softly towards the chin
    x *= 0.88 * jaw; y *= 1.1; z *= 0.98 + 0.06 * ss(-n.z, -0.3, 0.3);           // smooth: a little fuller at the back
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
