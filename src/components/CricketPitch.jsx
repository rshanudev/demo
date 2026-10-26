import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PZ, STUMP_BAT, STUMP_BOWL, T, clamp01 } from '../game/constants.js';

const XS = [-0.17, 0, 0.17];                    // stumps are spread along x so the camera sees all three (cartoon look)
const wood = <meshStandardMaterial color="#f0cf8c" roughness={0.6} />;

function StaticStumps({ x }) {
  return (
    <group position={[x, 0, PZ]}>
      {XS.map(sx => <mesh key={sx} position={[sx, 0.45, 0]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.9, 10]} />{wood}</mesh>)}
      {[-0.085, 0.085].map(bx => <mesh key={bx} position={[bx, 0.93, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.018, 0.018, 0.16, 6]} /><meshStandardMaterial color="#d94a3a" /></mesh>)}
    </group>
  );
}

/* The batting-end stumps get knocked over when the answer is wrong, and spring back afterwards. */
function BreakableStumps({ animRef }) {
  const st = useRef([]), bl = useRef([]);
  const cur = useRef(Array.from({ length: 5 }, () => ({ x: 0, y: 0, r: 0 })));
  useFrame((_, dt) => {
    const a = animRef.current, k = a && a.kind === 'out' && a.t >= T.stump ? a.t - T.stump : -1;
    const dirs = (a && a.shot && a.shot.fly) || [-1, -0.2, 1], k2 = Math.max(k, 0);
    for (let i = 0; i < 5; i++) {
      const isStump = i < 3, dir = isStump ? dirs[i] : (i === 3 ? -1 : 1);
      const baseY = isStump ? 0.45 : 0.93;
      let tx = 0, ty = baseY, tr = 0;
      if (k >= 0) {
        if (isStump) { tx = dir * k2 * 1.8; ty = Math.max(0.06, baseY + k2 * 2.4 - 5.5 * k2 * k2); tr = -dir * clamp01(k2 * 4) * 1.4; }
        else { tx = dir * k2 * 2.6; ty = Math.max(0.04, baseY + k2 * 4 - 6 * k2 * k2); tr = dir * k2 * 9; }
      }
      const c = cur.current[i], f = Math.min(1, dt * 14);
      c.x += (tx - c.x) * f; c.y += (ty - c.y) * f; c.r += (tr - c.r) * f;
      const m = isStump ? st.current[i] : bl.current[i - 3];
      if (m) { m.position.set((isStump ? XS[i] : (i === 3 ? -0.085 : 0.085)) + c.x, c.y, 0); m.rotation.z = (isStump ? 0 : Math.PI / 2) + c.r; }
    }
  });
  return (
    <group position={[STUMP_BAT, 0, PZ]}>
      {XS.map((sx, i) => <mesh key={sx} ref={el => (st.current[i] = el)} position={[sx, 0.45, 0]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.9, 10]} />{wood}</mesh>)}
      {[0, 1].map(i => <mesh key={i} ref={el => (bl.current[i] = el)} position={[i ? 0.085 : -0.085, 0.93, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.018, 0.018, 0.16, 6]} /><meshStandardMaterial color="#d94a3a" /></mesh>)}
    </group>
  );
}

const line = (key, pos, size) => <mesh key={key} position={pos}><boxGeometry args={size} /><meshBasicMaterial color="#ffffff" /></mesh>;

export default function CricketPitch({ animRef }) {
  const L = [];
  [-1, 1].forEach(s => {
    L.push(line('pop' + s, [s * 6.0, 0.016, PZ], [0.07, 0.004, 3.4]));          // popping crease
    L.push(line('bow' + s, [s * 7.2, 0.016, PZ], [0.07, 0.004, 2.6]));          // bowling crease
    [-1, 1].forEach(z => L.push(line(`ret${s}${z}`, [s * 6.6, 0.016, PZ + z * 1.3], [1.9, 0.004, 0.06])));   // return creases
  });
  return (
    <group>
      <mesh position={[0, 0.012, PZ]} receiveShadow><boxGeometry args={[19, 0.02, 3.2]} /><meshStandardMaterial color="#e8bb78" roughness={0.95} /></mesh>
      {L}
      <BreakableStumps animRef={animRef} />
      <StaticStumps x={STUMP_BOWL} />
    </group>
  );
}
