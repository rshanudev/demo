import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PZ, RELEASE, STUMP_BAT, T, clamp01, lerp } from '../game/constants.js';
import { sixBall, DEFAULT_CONTACT } from '../game/shots.js';

/* polished red leather with faint scuffs; a raised seam with two rows of stitches */
const leather = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#c3202e'; g.fillRect(0, 0, 256, 128);
  for (let k = 0; k < 1400; k++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,220,220' : '60,0,0'},.06)`; g.fillRect(Math.random() * 256, Math.random() * 128, 2, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const STITCH = Array.from({ length: 28 }, (_, i) => (i / 28) * Math.PI * 2);

export default function CricketBall({ animRef }) {
  const ref = useRef();
  useFrame(() => {
    const m = ref.current, a = animRef.current;
    if (!m) return;
    if (!a || !a.shot || a.t < T.release) { m.visible = false; return; }
    m.visible = true;
    const t = a.t, six = a.kind === 'six', sh = a.shot;
    const r0 = a.relPos || { x: RELEASE.x, y: RELEASE.y, z: PZ };   // released from the bowler's hand
    let x, y, z;
    const c = a.contact || DEFAULT_CONTACT;                 // the middle of the bat for this shot (set by the batsman)
    if (six && t <= T.contact) {                            // delivery: release -> bounce -> bat
      const u = (t - T.release) / (T.contact - T.release);
      x = lerp(r0.x, c.x, u);
      y = u < 0.55 ? r0.y - (r0.y - 0.15) * Math.pow(u / 0.55, 1.6) : 0.15 + (c.y - 0.15) * (1 - Math.pow(1 - (u - 0.55) / 0.45, 2));
      z = lerp(r0.z, c.z, u);
    } else if (six) {                                       // SIX: a different shot every time
      const b = sixBall(t, sh, c); x = b.x; y = b.y; z = b.z; m.visible = b.v < 1;
    } else if (t <= T.stump) {                              // wrong answer: pitches once, kicks up past the bat and flies into the stumps
      const p = (t - T.release) / (T.stump - T.release), tB = T.release + sh.pitch * (T.stump - T.release);
      x = lerp(r0.x, STUMP_BAT + 0.1, p);
      z = lerp(r0.z, PZ, p) + 0.12 * Math.sin(Math.PI * p);
      if (t < tB) y = r0.y - (r0.y - 0.15) * Math.pow((t - T.release) / (tB - T.release), 1.6);
      else { const s = (t - tB) / (T.stump - tB); y = 0.15 + (sh.low - 0.15) * (1 - (1 - s) * (1 - s)); }
    } else {                                                // ...then deflects off the stumps and bobbles away
      const w = clamp01((t - T.stump) / 0.8);
      x = STUMP_BAT + 0.1 - w * 1.8;
      y = 0.13 + (sh.low - 0.13) * Math.max(0, 1 - w * 3) + Math.abs(Math.sin(w * Math.PI * 2)) * 0.45 * (1 - w);
      z = PZ + w * 2;
    }
    m.position.set(x, y, z); m.rotation.x += 0.4; m.rotation.z += 0.2;
  });
  return (
    <mesh ref={ref} visible={false} castShadow>
      <sphereGeometry args={[0.15, 32, 24]} /><meshPhysicalMaterial map={leather} roughness={0.38} clearcoat={0.8} clearcoatRoughness={0.25} />
      <mesh><torusGeometry args={[0.15, 0.011, 8, 48]} /><meshStandardMaterial color="#a8121e" roughness={0.5} /></mesh>
      {STITCH.map(a => [-1, 1].map(s => <mesh key={a + '' + s} position={[Math.cos(a) * 0.151, Math.sin(a) * 0.151, s * 0.016]} rotation={[0, 0, a]}><boxGeometry args={[0.006, 0.014, 0.008]} /><meshStandardMaterial color="#f4ead6" roughness={0.6} /></mesh>))}
    </mesh>
  );
}
