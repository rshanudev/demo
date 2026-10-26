import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import Humanoid from './Humanoid.jsx';
import { CharacterBody } from './ModelCharacter.jsx';
import { BAT_X, PZ, clamp01, lerp, ease } from '../game/constants.js';
import { swingPose, idlePose, batAxes, reach, CELEB, DROOP, TOP_HAND, STANCE_YAW, BAT_SCALE } from '../game/batting.js';

export const SHIRTS = ['#e0362c', '#2a58c8', '#1a9a6a', '#f08a1e', '#7b3cee', '#d9a81c', '#0aa6c8', '#c43aa0', '#5a8a1a', '#ee5a3a'];
const M = (c, r = 0.55, m = 0) => <meshStandardMaterial color={c} roughness={r} metalness={m} />;
const POLE_TOP = new THREE.Vector3(0.7, -1, -0.5), POLE_BOTTOM = new THREE.Vector3(-0.7, -1, -0.5);   // elbows point down and out

/* varnished willow: pale wood with fine, slightly wavy grain running down the blade */
const willow = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#f2d39c'; g.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 46; i++) {
    const x0 = Math.random() * 128, w = 0.6 + Math.random() * 1.6, a = 0.08 + Math.random() * 0.16;
    g.strokeStyle = `rgba(150,96,40,${a})`; g.lineWidth = w; g.beginPath();
    for (let y = 0; y <= 512; y += 16) g.lineTo(x0 + Math.sin(y / 70 + i) * 2.5, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
})();
const Willow = ({ tint = '#ffffff' }) => <meshPhysicalMaterial map={willow} color={tint} roughness={0.45} clearcoat={0.35} clearcoatRoughness={0.3} />;

/* Willow bat built along +y from the bottom hand (handle up to -0.24, blade down to the toe at 1.06); the face looks along +z. */
function Bat({ batRef, sticker }) {
  return (
    <group ref={batRef}>
      <mesh position={[0, -0.27, 0]} castShadow><sphereGeometry args={[0.048, 10, 8]} />{M('#1b2440', 0.5)}</mesh>
      <mesh position={[0, -0.01, 0]} castShadow><cylinderGeometry args={[0.042, 0.038, 0.5, 14]} />{M('#1b2440', 0.85)}</mesh>
      {[-0.2, -0.1, 0, 0.1, 0.2].map(y => <mesh key={y} position={[0, y, 0]}><torusGeometry args={[0.043, 0.006, 6, 16]} />{M('#33416b', 0.8)}</mesh>)}
      <mesh position={[0, 0.29, 0]} scale={[1, 1, 0.42]} castShadow><cylinderGeometry args={[0.11, 0.045, 0.14, 24, 1]} /><Willow tint="#f4e2c0" /></mesh>
      <RoundedBox args={[0.22, 0.74, 0.075]} radius={0.03} smoothness={5} position={[0, 0.69, 0]} castShadow><Willow /></RoundedBox>
      <RoundedBox args={[0.1, 0.62, 0.06]} radius={0.028} smoothness={5} position={[0, 0.72, -0.04]} castShadow><Willow tint="#eed7b0" /></RoundedBox>
      <mesh position={[0, 0.46, 0.039]}><boxGeometry args={[0.2, 0.12, 0.004]} />{M(sticker, 0.35)}</mesh>
      <mesh position={[0, 0.46, 0.042]}><boxGeometry args={[0.13, 0.03, 0.002]} />{M('#ffffff', 0.35)}</mesh>
      <mesh position={[0, 0.98, 0.039]}><boxGeometry args={[0.2, 0.06, 0.004]} />{M(sticker, 0.35)}</mesh>
    </group>
  );
}

export default function Batsman({ index, animRef, enter, mood }) {
  const rig = useRef({}), root = useRef(), bat = useRef(), born = useRef(null), look = useRef({ x: 0, y: 0.5 });
  const colour = SHIRTS[index % SHIRTS.length];
  const tmp = useMemo(() => ({ grip: new THREE.Vector3(), top: new THREE.Vector3(), free: new THREE.Vector3(), dir: new THREE.Vector3(), face: new THREE.Vector3(), side: new THREE.Vector3(), m: new THREE.Matrix4() }), []);

  useFrame(({ clock }, dt) => {
    const R = rig.current, g = root.current, b = bat.current;
    const model = R.model;                          // imported GLB character, when one is configured
    if (!g || !b || (!model && (!R.armR || !R.elbowR))) return;
    const now = clock.elapsedTime;
    if (born.current === null) born.current = now;
    const age = now - born.current, a = animRef.current, t = a ? a.t : 0, six = a && a.kind === 'six';
    let x = BAT_X, y = Math.sin(now * 3) * 0.015, yaw = STANCE_YAW, lean = 0, head = 0, legs = 0, pose = idlePose(now);

    if (enter && age < 0.9) {                       // new batsman jogs in
      const e = ease(clamp01(age / 0.9));
      x = lerp(BAT_X - 4.5, BAT_X, e); yaw = lerp(1.5, STANCE_YAW, e); legs = Math.sin(now * 14) * 0.6 * (1 - e);
    }
    if (a) {
      const sh = a.shot || { s0: 1.67, yawEnd: 0.95, armX: -0.15, lean: 0 };
      pose = swingPose(t, sh, six);                  // stance -> backlift -> downswing -> follow-through
      const turn = 1 - (1 - pose.f) * (1 - pose.f);
      yaw = lerp(STANCE_YAW, sh.yawEnd, turn); lean = sh.lean * turn;
      if (six) {
        const c = clamp01((t - 2.55) / 0.3);
        if (c > 0) { y += Math.abs(Math.sin((t - 2.55) * 7)) * 0.25 * c; yaw = lerp(yaw, 0.2, c); }
      } else {
        const d = clamp01((t - 2.35) / 0.45);
        if (d > 0) { head = 0.5 * d; lean += -0.2 * d; }
        const wk = clamp01((t - 3.6) / 1.2);        // walk off
        if (wk > 0) { x = lerp(BAT_X, BAT_X - 7.5, wk); yaw = lerp(yaw, -1.5, clamp01((t - 3.5) / 0.2)); legs = Math.sin(now * 12) * 0.5; head = 0.3; }
      }
    } else if (mood === 'win') { pose = CELEB; y += Math.abs(Math.sin(now * 7)) * 0.3; yaw = 0.2; }
    else if (mood === 'lose') { pose = DROOP; head = 0.5; }

    // head: watches the bowler and the ball, follows a six into the sky, eases between targets
    let lookY = 0.2 + Math.sin(now * 0.7) * 0.1, lookX = head + Math.sin(now * 1.1) * 0.03;
    if (a) { if (t < 2.3) lookY = 0.9; else if (six) { lookY = 0.45; lookX = -0.45; } else lookY = 0.1; }
    if (mood) lookY = 0;
    const L = look.current, k = 1 - Math.exp(-Math.min(dt, 0.05) * 7);
    L.x += (lookX - L.x) * k; L.y += (lookY - L.y) * k;
    const sway = a || mood ? 0 : Math.sin(now * 0.9) * 0.03;   // idle weight shift from foot to foot
    g.position.set(x, y, PZ); g.rotation.set(lean, yaw, sway);
    if (model) { model.play('idle'); model.head(L.x, L.y); model.leg(-1, legs); model.leg(1, -legs); }
    else { R.head.rotation.set(L.x, L.y, 0); R.legL.rotation.x = legs; R.legR.rotation.x = -legs; }

    // bat: grip is the bottom hand, the top hand holds the handle just above it (or lets go to celebrate / trudge off)
    const { grip, top, free, dir, face, side, m } = tmp;
    batAxes(pose, dir, face);
    grip.fromArray(pose.g);
    side.crossVectors(dir, face);
    m.makeBasis(side, dir, face);
    b.position.copy(grip); b.quaternion.setFromRotationMatrix(m);
    top.copy(grip).addScaledVector(dir, -TOP_HAND).lerp(free.fromArray(pose.ft), pose.free);
    if (model) { model.reach(-1, grip, POLE_BOTTOM); model.reach(1, top, POLE_TOP); return; }
    reach(R.armL, R.elbowL, grip, POLE_BOTTOM);
    reach(R.armR, R.elbowR, top, POLE_TOP);
  });

  return (
    <group ref={root} position={[BAT_X, 0, PZ]} scale={BAT_SCALE}>
      <CharacterBody role="batsman" rig={rig} fallback={<Humanoid rig={rig} shirt={colour} shoe={colour} helmet={colour} glove="#ffffff" pants="#ffffff" />} />
      <Bat batRef={bat} sticker={colour} />
    </group>
  );
}
