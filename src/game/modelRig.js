import * as THREE from 'three';

/* Helpers to drive an imported, rigged character (GLB/GLTF) with the same poses as the built-in players.
   Works with Mixamo skeletons ("mixamorig:LeftArm") and the usual Blender/Unity/Unreal names ("upperarm_l",
   "UpperArm.L", "LeftUpperArm", ...). All solving is done in world space, so the bones' rest orientation does not matter. */

const SIDES = { L: ['left', 'l'], R: ['right', 'r'] };
const PARTS = {
  upperArm: ['upper_?arm', 'arm'],
  foreArm: ['fore_?arm', 'lower_?arm', 'elbow'],
  hand: ['hand', 'wrist'],
  upLeg: ['up_?leg', 'upper_?leg', 'thigh'],
  leg: ['leg', 'calf', 'shin', 'lower_?leg', 'knee'],
  head: ['head']
};
const clean = n => n.toLowerCase().replace(/^mixamorig\d*[:_]?/, '').replace(/[\s.\-:]/g, '_');

/* does a cleaned bone name match <side><part> or <part><side>? */
function matches(name, part, side) {
  const s = side ? SIDES[side] : null;
  return PARTS[part].some(p => {
    const core = `(${p})`;
    if (!s) return new RegExp(`(^|_)${core}($|_|\\d)`).test(name) && !/(left|right|_l$|_r$)/.test(name) && !/end|top/.test(name);
    return new RegExp(`^(${s[0]})_?${core}$`).test(name) || new RegExp(`^${core}_?(${s.join('|')})$`).test(name) || new RegExp(`^${core}_(${s.join('|')})_?\\d*$`).test(name);
  });
}

/* finds the bones the game needs; missing ones are left undefined */
export function findBones(root) {
  const bones = [];
  root.traverse(o => { if (o.isBone) bones.push(o); });
  const pick = (part, side) => bones.find(b => matches(clean(b.name), part, side));
  const out = { head: pick('head') };
  for (const side of ['L', 'R']) {
    out['upperArm' + side] = pick('upperArm', side);
    out['foreArm' + side] = pick('foreArm', side);
    out['hand' + side] = pick('hand', side);
    out['upLeg' + side] = pick('upLeg', side);
    out['leg' + side] = pick('leg', side);
  }
  // "arm" also matches "forearm"/"upperarm" spellings, and "leg" matches "upleg": keep the chain consistent
  for (const side of ['L', 'R']) {
    if (out['upperArm' + side] === out['foreArm' + side]) out['foreArm' + side] = out['upperArm' + side]?.children.find(c => c.isBone);
    if (out['upLeg' + side] === out['leg' + side]) out['leg' + side] = out['upLeg' + side]?.children.find(c => c.isBone);
    if (!out['hand' + side] && out['foreArm' + side]) out['hand' + side] = out['foreArm' + side].children.find(c => c.isBone);
  }
  return out;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3(), _u = new THREE.Vector3(), _e = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qb = new THREE.Quaternion();

/* rotate `bone` (in world space) so that the world point `from` (something it carries) moves towards `to` */
export function rotateBoneToward(bone, from, to) {
  bone.getWorldPosition(_e);
  const f = _b.subVectors(from, _e), t = _c.subVectors(to, _e);
  if (f.lengthSq() < 1e-10 || t.lengthSq() < 1e-10) return;
  _q.setFromUnitVectors(f.normalize(), t.normalize());
  applyWorldRotation(bone, _q);
}

/* bone.worldQuat <- q * bone.worldQuat, written back as a local rotation */
export function applyWorldRotation(bone, q) {
  bone.getWorldQuaternion(_qb);
  if (bone.parent) bone.parent.getWorldQuaternion(_qp); else _qp.identity();
  bone.quaternion.copy(_qp.invert().multiply(q.clone().multiply(_qb)));
  bone.updateWorldMatrix(false, true);
}

/* analytic two-bone IK in world space: upper -> lower -> end reaches `target`, elbow/knee bends towards `pole` (a direction) */
export function solveTwoBone(upper, lower, end, target, pole) {
  upper.updateWorldMatrix(true, true);
  const A = upper.getWorldPosition(new THREE.Vector3()), B = lower.getWorldPosition(new THREE.Vector3()), C = end.getWorldPosition(new THREE.Vector3());
  const L1 = A.distanceTo(B), L2 = B.distanceTo(C);
  _d.subVectors(target, A);
  const D = Math.min(Math.max(_d.length(), Math.abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4);
  _d.normalize();
  const ang = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D))));
  _n.crossVectors(_d, pole); if (_n.lengthSq() < 1e-8) _n.set(0, 0, 1); _n.normalize();
  _u.crossVectors(_n, _d).multiplyScalar(Math.sin(ang)).addScaledVector(_d, Math.cos(ang));
  const elbow = _a.copy(A).addScaledVector(_u, L1);
  rotateBoneToward(upper, B, elbow);
  const reach = new THREE.Vector3().copy(A).addScaledVector(_d, D);
  rotateBoneToward(lower, end.getWorldPosition(C), reach);
}

/* animation clip lookup by meaning, tolerant of naming ("mixamo.com|Idle", "Armature|Batting_Swing", ...) */
export const CLIP_HINTS = {
  idle: /idle|stand|breath/i,
  run: /run|jog|sprint/i,
  bowl: /bowl|throw|pitch/i,
  swing: /bat|swing|hit|strike|shot/i,
  celebrate: /celebrat|cheer|victory|\bwin|jump|happy/i,
  sad: /sad|defeat|lose|disappoint|walk/i
};
export const findClip = (clips, key) => clips.find(c => CLIP_HINTS[key].test(c.name));
