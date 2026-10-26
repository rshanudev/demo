import * as THREE from 'three';
import { clamp01, lerp, ease } from './constants.js';

/* Two-handed batting. The bat is posed by its grip (bottom hand) and an angle in the swing plane,
   then both arms reach for the handle with a two-bone IK, so the gloves always stay on the bat.
   Everything here is in the batsman's own space (before his yaw/scale are applied). */
export const ARM = { upper: 0.5, lower: 0.5 };
/* real human proportions (player space, before scaling): hips just over half the height, head about a sixth */
export const BODY = { hipX: 0.13, hipY: 1.3, shoulderX: 0.34, shoulderY: 1.9, torsoY: 1.58, neckY: 2.04, headY: 2.24, head: 0.48 };
export const STANCE_YAW = 0.15, BAT_SCALE = 1.4;      // side-on: front shoulder points down the pitch
export const TOP_HAND = 0.16;                 // top hand sits this far up the handle from the bottom hand
export const SWEET = 0.74;                    // distance from the bottom hand to the middle of the blade
const DOWNSWING = 0.33;                       // seconds from the top of the backlift to the hit

const B = new THREE.Vector3(Math.cos(STANCE_YAW), 0, Math.sin(STANCE_YAW));   // towards the bowler
const UP = new THREE.Vector3(0, 1, 0);
const N = new THREE.Vector3().crossVectors(B, UP);                             // out of the swing plane

/* g = bottom-hand position, a = angle (deg) of the bat in the swing plane, k = tilt out of the plane,
   free = how far the top hand has let go of the handle, ft = where the free top hand goes */
/* the swing was authored for the old compact cartoon body; fit() maps those grip points onto the real-proportioned one */
const fit = ([x, y, z]) => [x * 0.75, 1.08 + (y - 1.05) * 1.16, z];
const HANG = [0.42, 0.95, 0.12], FIST = [0.45, 2.72, 0.2];
const STANCE = { g: fit([-0.02, 1.05, 0.42]), a: -76, k: 0, free: 0, ft: HANG };
const LIFT = { g: fit([-0.3, 1.5, 0.25]), a: -235, k: -0.1, free: 0, ft: HANG };
const HIT = { g: fit([0.05, 1.25, 0.45]), a: -55, k: 0.1, free: 0, ft: HANG };
const FOLLOW_DRIVE = { g: fit([0.12, 1.6, 0.48]), a: 150, k: 0.35, free: 0, ft: HANG };
const FOLLOW_PULL = { g: fit([0.18, 1.38, 0.4]), a: 168, k: 0.25, free: 0, ft: HANG };
export const CELEB = { g: fit([-0.56, 2.15, 0.2]), a: 90, k: 0, free: 1, ft: FIST };
export const DROOP = { g: [-0.15, 1.0, 0.3], a: 284, k: 0.1, free: 1, ft: HANG };
export const idlePose = now => ({ ...STANCE, a: STANCE.a + Math.sin(now * 2.2) * 4 });

const mix3 = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k), lerp(p[2], q[2], k)];
const mixP = (p, q, k) => ({ g: mix3(p.g, q.g, k), a: lerp(p.a, q.a, k), k: lerp(p.k, q.k, k), free: lerp(p.free, q.free, k), ft: mix3(p.ft, q.ft, k) });

/* Bat pose along the delivery timeline. f = how far into the follow-through (drives the body turn). */
export function swingPose(t, sh, six) {
  const hit = sh.s0 + DOWNSWING, flat = clamp01((-sh.armX - 0.15) / 0.85);
  let p = mixP(STANCE, LIFT, ease(clamp01((t - 0.85) / 0.6)));               // backlift as the bowler delivers
  const d = clamp01((t - sh.s0) / DOWNSWING);
  if (d > 0) p = mixP(LIFT, HIT, d * d);                                        // accelerating downswing
  const f = clamp01((t - hit) / 0.4);
  if (f > 0) p = mixP(HIT, mixP(FOLLOW_DRIVE, FOLLOW_PULL, flat), 1 - (1 - f) * (1 - f));
  if (six) { const c = ease(clamp01((t - 2.55) / 0.35)); if (c > 0) p = mixP(p, CELEB, c); }
  else { const c = ease(clamp01((t - 2.35) / 0.45)); if (c > 0) p = mixP(p, DROOP, c); }
  p.f = f;
  return p;
}

/* bat direction (handle -> toe) and face normal for a pose */
export function batAxes(p, dir, face) {
  const a = (p.a * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  dir.copy(B).multiplyScalar(c).addScaledVector(UP, s).addScaledVector(N, p.k).normalize();
  face.copy(B).multiplyScalar(-s).addScaledVector(UP, c);                      // the face looks where the bat is swinging
  face.addScaledVector(dir, -face.dot(dir)).normalize();
}

/* two-bone IK: rotates the shoulder and elbow groups so the hand (at -lower in elbow space) reaches target */
const DOWN = new THREE.Vector3(0, -1, 0);
const _d = new THREE.Vector3(), _n = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _q = new THREE.Quaternion();
export function reach(shoulder, elbow, target, pole) {
  const L1 = ARM.upper, L2 = ARM.lower;
  _d.subVectors(target, shoulder.position);
  const D = Math.min(Math.max(_d.length(), 0.05), L1 + L2 - 0.001);
  _d.normalize();
  const A = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D))));
  _n.crossVectors(_d, pole);
  if (_n.lengthSq() < 1e-6) _n.set(0, 0, 1);
  _n.normalize();
  _u.crossVectors(_n, _d).multiplyScalar(Math.sin(A)).addScaledVector(_d, Math.cos(A));   // upper arm, bent towards the pole
  _f.copy(_d).multiplyScalar(D).addScaledVector(_u, -L1).normalize();                     // forearm
  shoulder.quaternion.setFromUnitVectors(DOWN, _u);
  _q.setFromUnitVectors(DOWN, _f);
  elbow.quaternion.copy(shoulder.quaternion).invert().multiply(_q);
}
