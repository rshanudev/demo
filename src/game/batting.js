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

const UP = new THREE.Vector3(0, 1, 0);

/* A bat pose: g = bottom-hand position, a = angle (deg) of the bat in its swing plane (0 = pointing at the bowler,
   90 = straight up), k = how far (radians) that plane is turned from the pitch line towards the off side (+z, where
   the batsman's chest faces), free = how far the top hand has let go of the handle, ft = where the free top hand goes,
   fd/fw = an optional direction for the bat face and how strongly to use it (cross-bat shots). */
const pose = (g, a, k = 0, extra = {}) => ({ g, a, k, free: 0, ft: null, fd: null, fw: 0, ...extra });

/* two pose sets: 'toon' for the big-headed cartoon body (short arms, low shoulders) and 'real' for the
   real-proportioned body; fit() maps the cartoon grip points onto the real one */
const fit = ([x, y, z]) => [x * 0.75, 1.08 + (y - 1.05) * 1.16, z];
function poseSet(f, hang, fist, droop) {
  const P = (g, a, k, extra) => pose(f(g), a, k, { ft: hang, ...extra });
  const LIFT = P([-0.3, 1.5, 0.25], -235, -0.1);
  return {
    STANCE: P([-0.24, 1.4, 0.34], -250),                            // ready stance: bat held up high behind the head
    TAP: P([-0.02, 1.05, 0.42], -76),                               // bat grounded, toe on the crease
    CELEB: P([-0.56, 2.15, 0.2], 90, 0, { free: 1, ft: fist }),
    DROOP: pose(droop, 284, 0.1, { free: 1, ft: hang }),
    /* each shot: backlift -> the bat at the moment it meets the ball -> follow-through */
    SHOTS: {
      drive: {                                                      // straight drive: full face, high straight finish
        lift: LIFT, hit: P([0.1, 1.2, 0.42], -70, 0), follow: P([0.12, 1.78, 0.4], 125, 0.1) },
      cover: {                                                      // cover drive: leans into it, bat angled to cover, high elbow finish
        lift: LIFT, hit: P([0.12, 1.18, 0.5], -64, 0.45), follow: P([0.08, 1.85, 0.45], 140, 0.65) },
      loft: {                                                       // lofted on-drive: plane turned to the leg side, big finish
        lift: LIFT, hit: P([0.08, 1.22, 0.4], -58, -0.35), follow: P([0.1, 1.85, 0.3], 135, -0.55) },
      pull: {                                                       // pull: back foot, horizontal bat at chest height, rolls over to the leg side
        lift: P([-0.28, 1.6, 0.2], -215, 0.4),
        hit: P([0.05, 1.42, 0.22], 0, 0.5, { fd: [1, 0.15, -0.6], fw: 1 }),
        follow: P([0.25, 1.62, -0.05], 170, -0.9, { fd: [-0.3, 0.3, -1], fw: 0.6 }) },
      hook: {                                                       // hook: like the pull but at head height, swinging up behind square
        lift: P([-0.28, 1.65, 0.2], -210, 0.45),
        hit: P([0.0, 1.62, 0.25], 12, 0.5, { fd: [1, 0.3, -0.7], fw: 1 }),
        follow: P([0.15, 1.8, -0.15], 165, -1.2, { fd: [-0.4, 0.5, -1], fw: 0.6 }) },
      sweep: {                                                      // sweep: down on one knee, bat swept low across the line to the leg side
        lift: P([-0.15, 1.42, 0.42], -200, 0.8),
        hit: P([0.0, 1.0, 0.45], -12, 0.35, { fd: [0.5, 0.2, -1], fw: 1 }),
        follow: P([0.12, 1.15, 0.0], 25, -1.7, { fd: [-0.6, 0.3, -1], fw: 0.7 }) },
      heli: {                                                       // helicopter: yorker dug out with a whip of the wrists, bat spins a full circle overhead
        lift: LIFT, hit: P([0.12, 1.08, 0.48], -82, 0.1), follow: P([0.05, 1.95, 0.22], 30, -6.6) }
    }
  };
}
const SETS = {
  real: poseSet(fit, [0.42, 0.95, 0.12], [0.45, 2.72, 0.2], [-0.15, 1.0, 0.3]),
  toon: poseSet(g => g, [0.62, 0.74, 0.12], [0.64, 2.24, 0.26], [-0.2, 0.85, 0.3])
};
let P = SETS.real;
export const setBodyStyle = style => { P = SETS[style] || SETS.real; };
export const celebPose = () => P.CELEB;
export const droopPose = () => P.DROOP;
const moveOf = sh => P.SHOTS[(sh && sh.move) || 'drive'] || P.SHOTS.drive;
export const hitPose = sh => moveOf(sh).hit;

const mix3 = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k), lerp(p[2], q[2], k)];
const mixP = (p, q, k) => ({
  g: mix3(p.g, q.g, k), a: lerp(p.a, q.a, k), k: lerp(p.k, q.k, k), free: lerp(p.free, q.free, k), ft: mix3(p.ft, q.ft, k),
  fd: p.fw && q.fw ? mix3(p.fd, q.fd, k) : (p.fw ? p.fd : q.fd), fw: lerp(p.fw, q.fw, k)
});
export const blendPose = mixP;

/* Waiting at the crease like a real batter: hold the bat up, bring it down and tap it on the crease
   a couple of times, then lift it back up into the ready stance. One routine every 4 seconds. */
const IDLE_CYCLE = 4;
export function idlePose(now) {
  const u = (now % IDLE_CYCLE) / IDLE_CYCLE;
  const down = u < 0.4 ? 0 : u < 0.55 ? ease((u - 0.4) / 0.15) : u < 0.75 ? 1 : u < 0.9 ? 1 - ease((u - 0.75) / 0.15) : 0;
  const p = mixP(P.STANCE, P.TAP, down);
  if (u >= 0.55 && u < 0.75) {                     // two taps: the toe lifts a little and comes back down
    const tap = Math.abs(Math.sin(((u - 0.55) / 0.2) * Math.PI * 2));
    p.a += tap * 9; p.g = [p.g[0], p.g[1] + tap * 0.04, p.g[2]];
  }
  if (down < 0.01) p.a += Math.sin(now * 2.2) * 4;  // small waggle while the bat is up
  return p;
}

/* Bat pose along the delivery timeline. f = how far into the follow-through (drives the body turn). */
export function swingPose(t, sh, six) {
  const M = moveOf(sh), hit = sh.s0 + DOWNSWING;
  let p = mixP(P.STANCE, M.lift, ease(clamp01((t - 0.85) / 0.6)));               // backlift as the bowler delivers
  const d = clamp01((t - sh.s0) / DOWNSWING);
  if (d > 0) p = mixP(M.lift, M.hit, d * d);                                        // accelerating downswing
  const f = clamp01((t - hit) / 0.4);
  if (f > 0) p = mixP(M.hit, M.follow, 1 - (1 - f) * (1 - f));
  if (six) { const c = ease(clamp01((t - 2.55) / 0.35)); if (c > 0) p = mixP(p, P.CELEB, c); }
  else { const c = ease(clamp01((t - 2.35) / 0.45)); if (c > 0) p = mixP(p, P.DROOP, c); }
  p.f = f;
  return p;
}

/* bat direction (handle -> toe) and face normal for a pose */
const _pl = new THREE.Vector3(), _fd = new THREE.Vector3(), _fc = new THREE.Vector3();
export function batAxes(p, dir, face) {
  const a = (p.a * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), y = STANCE_YAW + p.k;
  _pl.set(Math.cos(y), 0, Math.sin(y));                                           // the swing plane's forward direction
  dir.copy(_pl).multiplyScalar(c).addScaledVector(UP, s);
  face.copy(_pl).multiplyScalar(-s).addScaledVector(UP, c);                      // the face looks where the bat is swinging
  if (p.fw > 0 && p.fd) face.lerp(_fd.fromArray(p.fd).normalize(), p.fw);       // cross-bat shots: face turned towards the ball
  face.addScaledVector(dir, -face.dot(dir)).normalize();
}

/* the middle of the blade for a pose, in the batsman's space */
export function sweetSpot(p, out) {
  batAxes(p, out, _fc);
  return out.multiplyScalar(SWEET).add(_pl.fromArray(p.g));
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
