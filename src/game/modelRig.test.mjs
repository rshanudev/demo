import assert from 'node:assert/strict';
import * as THREE from 'three';
import { findBones, solveTwoBone, findClip } from './modelRig.js';

/* a small humanoid skeleton with awkward rest rotations, named in a given convention */
function skeleton(names) {
  const B = n => { const b = new THREE.Bone(); b.name = n; return b; };
  const hips = B(names.hips), spine = B('Spine'), head = B(names.head);
  hips.add(spine); spine.position.y = 0.5; spine.add(head); head.position.y = 0.6;
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    const ua = B(names.ua[s]), fa = B(names.fa[s]), hd = B(names.hand[s]);
    spine.add(ua); ua.position.set(sx * 0.3, 0.45, 0); ua.rotation.set(0.4, -1.1, sx * 1.4);        // odd rest orientation
    ua.add(fa); fa.position.set(0, 0.32, 0); fa.rotation.set(-0.3, 0.7, 0.2);
    fa.add(hd); hd.position.set(0, 0.3, 0);
    const ul = B(names.ul[s]), lg = B(names.lg[s]);
    hips.add(ul); ul.position.set(sx * 0.15, -0.05, 0); ul.rotation.set(Math.PI, 0.2, 0);
    ul.add(lg); lg.position.set(0, 0.45, 0);
  }
  const root = new THREE.Group(); root.add(hips); root.position.set(3, 0, -2); root.rotation.y = 0.8; root.scale.setScalar(1.7);
  root.updateMatrixWorld(true);
  return root;
}
const mixamo = {
  hips: 'mixamorig:Hips', head: 'mixamorig:Head',
  ua: { L: 'mixamorig:LeftArm', R: 'mixamorig:RightArm' }, fa: { L: 'mixamorig:LeftForeArm', R: 'mixamorig:RightForeArm' }, hand: { L: 'mixamorig:LeftHand', R: 'mixamorig:RightHand' },
  ul: { L: 'mixamorig:LeftUpLeg', R: 'mixamorig:RightUpLeg' }, lg: { L: 'mixamorig:LeftLeg', R: 'mixamorig:RightLeg' }
};
const blender = {
  hips: 'pelvis', head: 'head',
  ua: { L: 'upper_arm.L', R: 'upper_arm.R' }, fa: { L: 'forearm.L', R: 'forearm.R' }, hand: { L: 'hand.L', R: 'hand.R' },
  ul: { L: 'thigh.L', R: 'thigh.R' }, lg: { L: 'shin.L', R: 'shin.R' }
};

for (const [label, names] of [['mixamo', mixamo], ['blender', blender]]) {
  const root = skeleton(names), b = findBones(root);
  for (const s of ['L', 'R']) {
    assert.equal(b['upperArm' + s]?.name, names.ua[s], `${label} upper arm ${s}`);
    assert.equal(b['foreArm' + s]?.name, names.fa[s], `${label} forearm ${s}`);
    assert.equal(b['hand' + s]?.name, names.hand[s], `${label} hand ${s}`);
    assert.equal(b['upLeg' + s]?.name, names.ul[s], `${label} thigh ${s}`);
    assert.equal(b['leg' + s]?.name, names.lg[s], `${label} shin ${s}`);
  }
  assert.equal(b.head?.name, names.head, `${label} head`);

  // the hand must land on reachable targets, whatever the rest pose
  const sh = new THREE.Vector3(), h = new THREE.Vector3(), pole = new THREE.Vector3(0, -1, -0.3);
  for (let i = 0; i < 40; i++) {
    const s = i % 2 ? 'L' : 'R';
    b['upperArm' + s].getWorldPosition(sh);
    const dir = new THREE.Vector3(Math.sin(i * 1.7), Math.cos(i * 2.3), Math.sin(i * 0.9)).normalize();
    const target = sh.clone().addScaledVector(dir, 0.3 + (i % 5) * 0.12 * 1.7 * 0.5);   // within reach (arm = 0.62 * 1.7)
    solveTwoBone(b['upperArm' + s], b['foreArm' + s], b['hand' + s], target, pole);
    b['hand' + s].getWorldPosition(h);
    assert.ok(h.distanceTo(target) < 1e-3, `${label} ${s} hand reaches target (${h.distanceTo(target).toFixed(4)})`);
  }
}

const clips = ['mixamo.com|Idle', 'Armature|Batting_Swing', 'Bowling', 'Running', 'Victory Cheer'].map(n => new THREE.AnimationClip(n, 1, []));
assert.equal(findClip(clips, 'idle').name, 'mixamo.com|Idle');
assert.equal(findClip(clips, 'swing').name, 'Armature|Batting_Swing');
assert.equal(findClip(clips, 'bowl').name, 'Bowling');
assert.equal(findClip(clips, 'run').name, 'Running');
assert.equal(findClip(clips, 'celebrate').name, 'Victory Cheer');
console.log('modelRig tests passed');
