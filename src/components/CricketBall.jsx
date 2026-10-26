import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PZ, RELEASE, CONTACT, STUMP_BAT, T, clamp01, lerp } from '../game/constants.js';
import { sixBall } from '../game/shots.js';

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
    let x, y, z;
    if (t <= T.contact) {                                   // delivery: release -> bounce -> bat
      const u = (t - T.release) / (T.contact - T.release), endY = six ? CONTACT.y : sh.low;
      x = lerp(RELEASE.x, CONTACT.x, u);
      y = u < 0.55 ? RELEASE.y - (RELEASE.y - 0.15) * Math.pow(u / 0.55, 1.6) : 0.15 + (endY - 0.15) * (1 - Math.pow(1 - (u - 0.55) / 0.45, 2));
      z = PZ + (six ? CONTACT.dz : 0.1) * u;
    } else if (six) {                                       // SIX: a different shot every time
      const b = sixBall(t, sh); x = b.x; y = b.y; z = b.z; m.visible = b.v < 1;
    } else {                                                // wrong answer: under the bat into the stumps, then bounces away
      const v = clamp01((t - T.contact) / (T.stump - T.contact));
      if (t < T.stump) { x = lerp(CONTACT.x, STUMP_BAT + 0.3, v); y = sh.low; z = PZ + 0.1; }
      else { const w = clamp01((t - T.stump) / 0.8); x = STUMP_BAT + 0.3 - w * 1.8; y = 0.13 + Math.abs(Math.sin(w * Math.PI * 2)) * 0.5 * (1 - w); z = PZ + 0.1 + w * 2; }
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
