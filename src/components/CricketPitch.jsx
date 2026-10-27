import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PZ, STUMP_BAT, STUMP_BOWL, T, clamp01 } from '../game/constants.js';

const STUMP_SCALE = 1.45;                         // stumps kept in proportion with the players
const ZS = [-0.115, 0, 0.115];                  // three stumps standing in a line across the crease, like real ones
const BZ = [-0.0575, 0.0575];                   // two bails resting across their tops
const wood = <meshStandardMaterial color="#f0cf8c" roughness={0.6} />;

/* sun-baked clay pitch: fine grain, a slightly lighter centre strip and worn, scuffed patches at both creases */
const pitchTex = (() => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#e6b976'; g.fillRect(0, 0, 1024, 192);
  const gr = g.createLinearGradient(0, 0, 0, 192);
  gr.addColorStop(0, 'rgba(160,110,50,.18)'); gr.addColorStop(0.5, 'rgba(255,240,200,.12)'); gr.addColorStop(1, 'rgba(160,110,50,.18)');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 192);
  for (const u of [0.184, 0.816]) {                         // footmarks around each crease
    for (let k = 0; k < 140; k++) {
      g.fillStyle = `rgba(150,95,45,${0.04 + Math.random() * 0.08})`;
      g.beginPath(); g.ellipse(u * 1024 + (Math.random() - 0.5) * 120, 96 + (Math.random() - 0.5) * 110, 4 + Math.random() * 10, 2 + Math.random() * 5, Math.random() * 3, 0, 7); g.fill();
    }
  }
  for (let k = 0; k < 14000; k++) {                          // grain
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,245,215,.12)' : 'rgba(120,80,35,.1)';
    g.fillRect(Math.random() * 1024, Math.random() * 192, 1 + Math.random(), 1);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
})();

function StaticStumps({ x }) {
  return (
    <group position={[x, 0, PZ]} scale={STUMP_SCALE}>
      {ZS.map(sz => <mesh key={sz} position={[0, 0.45, sz]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.9, 12]} />{wood}</mesh>)}
      {BZ.map(bz => <mesh key={bz} position={[0, 0.93, bz]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.018, 0.018, 0.115, 8]} /><meshStandardMaterial color="#d94a3a" /></mesh>)}
    </group>
  );
}

/* The batting-end stumps get knocked over when the answer is wrong, and spring back afterwards. */
function BreakableStumps({ animRef }) {
  const st = useRef([]), bl = useRef([]);
  const cur = useRef(Array.from({ length: 5 }, () => ({ x: 0, y: 0, z: 0, r: 0 })));
  useFrame((_, dt) => {
    const a = animRef.current, k = a && a.kind === 'out' && a.t >= T.stump ? a.t - T.stump : -1;
    const dirs = (a && a.shot && a.shot.fly) || [-1, -0.2, 1], k2 = Math.max(k, 0);
    for (let i = 0; i < 5; i++) {
      const isStump = i < 3, dir = isStump ? dirs[i] : (i === 3 ? -1 : 1);
      const baseY = isStump ? 0.45 : 0.93, z0 = isStump ? ZS[i] : BZ[i - 3];
      let tx = 0, ty = baseY, tz = 0, tr = 0;
      if (k >= 0) {                                   // knocked back towards the keeper, splaying sideways; bails fly off
        if (isStump) { tx = -Math.abs(dir) * k2 * 1.8; tz = z0 * k2 * 3 + dir * k2 * 0.4; ty = Math.max(0.06, baseY + k2 * 2.4 - 5.5 * k2 * k2); tr = clamp01(k2 * 4) * 1.4; }
        else { tx = -k2 * 2.2; tz = dir * k2 * 1.6; ty = Math.max(0.04, baseY + k2 * 4 - 6 * k2 * k2); tr = dir * k2 * 9; }
      }
      const c = cur.current[i], f = Math.min(1, dt * 14);
      c.x += (tx - c.x) * f; c.y += (ty - c.y) * f; c.z += (tz - c.z) * f; c.r += (tr - c.r) * f;
      const m = isStump ? st.current[i] : bl.current[i - 3];
      if (m) { m.position.set(c.x, c.y, z0 + c.z); if (isStump) m.rotation.set(0, 0, c.r); else m.rotation.set(Math.PI / 2, 0, c.r); }
    }
  });
  return (
    <group position={[STUMP_BAT, 0, PZ]} scale={STUMP_SCALE}>
      {ZS.map((sz, i) => <mesh key={sz} ref={el => (st.current[i] = el)} position={[0, 0.45, sz]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.9, 12]} />{wood}</mesh>)}
      {BZ.map((bz, i) => <mesh key={bz} ref={el => (bl.current[i] = el)} position={[0, 0.93, bz]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.018, 0.018, 0.115, 8]} /><meshStandardMaterial color="#d94a3a" /></mesh>)}
    </group>
  );
}

/* painted crease lines, laid just on top of the clay (the pitch surface is at y = 0.022) */
const LINE_Y = 0.025, LW = 0.06;
const paint = <meshStandardMaterial color="#ffffff" roughness={0.75} emissive="#ffffff" emissiveIntensity={0.25} />;
const line = (key, pos, size) => <mesh key={key} position={[pos[0], LINE_Y, pos[1]]} receiveShadow><boxGeometry args={[size[0], 0.004, size[1]]} />{paint}</mesh>;

/* Markings at each end, as on a real pitch:
   bowling crease through the stumps, as wide as the return creases;
   popping crease in front of it, running right across the pitch and out onto the grass;
   return creases at right angles from the popping crease, back past the stumps;
   short wide-guide marks on the popping crease. */
const POP = 6.0, BOWL = 7.2, RET_Z = 1.3, RET_BACK = 8.2, POP_HALF = 2.2, WIDE_Z = 0.86;
export default function CricketPitch({ animRef }) {
  const L = [];
  [-1, 1].forEach(s => {
    L.push(line('pop' + s, [s * POP, PZ], [LW, POP_HALF * 2]));                                    // popping crease
    L.push(line('bow' + s, [s * BOWL, PZ], [LW, RET_Z * 2 + LW]));                               // bowling crease
    [-1, 1].forEach(z => {
      L.push(line(`ret${s}${z}`, [s * (POP + RET_BACK) / 2, PZ + z * RET_Z], [RET_BACK - POP, LW]));   // return crease
      L.push(line(`wide${s}${z}`, [s * (POP - 0.25), PZ + z * WIDE_Z], [0.5, LW]));                     // wide guide
    });
  });
  return (
    <group>
      <mesh position={[0, 0.012, PZ]} receiveShadow><boxGeometry args={[19, 0.02, 3.2]} /><meshStandardMaterial map={pitchTex} roughness={0.95} /></mesh>
      {L}
      <BreakableStumps animRef={animRef} />
      <StaticStumps x={STUMP_BOWL} />
    </group>
  );
}
