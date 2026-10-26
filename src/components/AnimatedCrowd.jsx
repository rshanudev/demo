import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ringA, ringB, ringY } from '../game/constants.js';

/* Cartoon kid spectators: big round heads with painted faces, hair under a coloured cap, small t-shirt bodies and both
   hands up, waving. Six instanced meshes (body, head, hair, cap, arms, hands) draw the whole crowd. */
const SHIRTS = ['#ff7b8a', '#ffd25a', '#6cbcff', '#ffffff', '#8fdc78', '#b993ff'];
const CAPS = ['#ff5a68', '#4a90f0', '#ffc93a', '#9b6cf6', '#36c46a', '#ff8a2a'];
const SKINS = ['#ffdcbf', '#f6c9a2', '#e9b48a', '#d29a70', '#b07a52'];
const HAIRS = ['#4a2c1a', '#6b3f22', '#2e1d14', '#8a5a32', '#3a2416'];
const ROWS = 6, HEAD = 0.4, ARM = 0.34;

/* face painted where the sphere looks along +z (u = 0.25 -> x = 128); white skin areas take the instance skin colour */
function faceTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d'), cx = 128, cy = 132;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 256);
  [-1, 1].forEach(s => {
    g.fillStyle = 'rgba(255,120,120,.45)'; g.beginPath(); g.ellipse(cx + s * 38, cy + 22, 13, 8, 0, 0, 7); g.fill();     // cheeks
    g.fillStyle = '#24140c'; g.beginPath(); g.ellipse(cx + s * 22, cy + 2, 12, 16, 0, 0, 7); g.fill();                  // eyes
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx + s * 22 + 4, cy - 4, 5, 0, 7); g.fill();
    g.beginPath(); g.arc(cx + s * 22 - 4, cy + 8, 2.2, 0, 7); g.fill();
    g.strokeStyle = '#3a2416'; g.lineWidth = 4.5; g.lineCap = 'round';                                                    // brows
    g.beginPath(); g.moveTo(cx + s * 12, cy - 22); g.quadraticCurveTo(cx + s * 22, cy - 27, cx + s * 32, cy - 22); g.stroke();
  });
  g.fillStyle = '#e8a080'; g.beginPath(); g.ellipse(cx, cy + 14, 3.5, 2.5, 0, 0, 7); g.fill();                          // nose
  g.fillStyle = '#9c2a22'; g.beginPath(); g.moveTo(cx - 17, cy + 25); g.quadraticCurveTo(cx, cy + 50, cx + 17, cy + 25); g.closePath(); g.fill();   // open smile
  g.fillStyle = '#ff7f7f'; g.beginPath(); g.ellipse(cx, cy + 36, 8, 4.5, 0, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export default function AnimatedCrowd({ animRef, mood, quality }) {
  const N = quality === 'low' ? 320 : 900;              // fewer, evenly spaced kids: a cleaner, less busy crowd
  const bodies = useRef(), heads = useRef(), hairs = useRef(), caps = useRef(), arms = useRef(), hands = useRef(), ex = useRef(0.3);
  const people = useMemo(() => {
    const per = Math.floor(N / ROWS), out = [], pick = L => L[(Math.random() * L.length) | 0];
    for (let r = 0; r < ROWS; r++) for (let k = 0; k < per; k++) {
      const th = ((k + (r % 2) * 0.5) / per) * Math.PI * 2;
      const px = Math.cos(th) * ringA(r), pz = Math.sin(th) * ringB(r);
      out.push({ px, pz, py: ringY(r), face: Math.atan2(-px, -pz), ph: Math.random() * 6.28, sc: 1.72,
        sh: pick(SHIRTS), sk: pick(SKINS), hr: pick(HAIRS), cap: Math.random() < 0.85 ? pick(CAPS) : null });
    }
    return out;
  }, [N]);
  const face = useMemo(faceTexture, []);
  const geo = useMemo(() => {
    const capG = mergeGeometries([
      new THREE.SphereGeometry(HEAD * 1.05, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
      new THREE.CylinderGeometry(HEAD * 0.8, HEAD * 0.8, 0.035, 20, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 0.75).translate(0, HEAD * 0.3, HEAD * 0.7)
    ].map(g => { g.deleteAttribute('uv'); return g; }));
    // hair: covers the back and sides of the head, leaves the face open, shows a little below the cap
    const hairG = new THREE.SphereGeometry(HEAD * 1.04, 20, 12, Math.PI / 2 + 1.35, Math.PI * 2 - 2.7, 0, Math.PI * 0.55);
    const bodyG = new THREE.SphereGeometry(1, 18, 12).scale(0.34, 0.4, 0.28);
    const armG = new THREE.CapsuleGeometry(0.075, ARM - 0.1, 4, 8).translate(0, ARM / 2, 0);
    return { capG, hairG, bodyG, armG, handG: new THREE.SphereGeometry(0.095, 10, 8) };
  }, []);

  useLayoutEffect(() => {
    const c = new THREE.Color();
    people.forEach((p, i) => {
      bodies.current.setColorAt(i, c.set(p.sh)); heads.current.setColorAt(i, c.set(p.sk)); hairs.current.setColorAt(i, c.set(p.hr));
      caps.current.setColorAt(i, c.set(p.cap || '#000000'));
      for (let s = 0; s < 2; s++) { arms.current.setColorAt(i * 2 + s, c.set(p.sh)); hands.current.setColorAt(i * 2 + s, c.set(p.sk)); }
    });
    [bodies, heads, hairs, caps, arms, hands].forEach(m => { m.current.instanceColor.needsUpdate = true; });
  }, [people]);

  const d = useMemo(() => ({ o: new THREE.Object3D(), tip: new THREE.Vector3() }), []);
  useFrame(({ clock }, dt) => {
    const a = animRef.current, t = clock.elapsedTime, { o, tip } = d;
    const target = mood === 'win' ? 1 : mood === 'lose' ? 0.05 : a ? (a.kind === 'six' && a.t > 1.95 ? 1 : a.kind === 'out' && a.t > 2.2 ? 0.08 : 0.4) : 0.3;
    ex.current += (target - ex.current) * Math.min(1, dt * 3);
    const e = ex.current;
    for (let i = 0; i < people.length; i++) {
      const p = people[i], hop = e * Math.max(0, Math.sin(t * 7 + p.ph)) * 0.35 + 0.025 * Math.sin(t * 2 + p.ph), y0 = p.py + hop;
      o.rotation.set(0, p.face + Math.sin(t * 0.8 + p.ph) * 0.05, 0); o.scale.setScalar(p.sc);
      o.position.set(p.px, y0 + 0.38 * p.sc, p.pz); o.updateMatrix(); bodies.current.setMatrixAt(i, o.matrix);
      o.position.y = y0 + (0.78 + HEAD * 0.9) * p.sc; o.rotation.z = Math.sin(t * 1.6 + p.ph) * 0.08; o.updateMatrix();
      heads.current.setMatrixAt(i, o.matrix); hairs.current.setMatrixAt(i, o.matrix);
      if (!p.cap) o.scale.setScalar(0);
      o.updateMatrix(); caps.current.setMatrixAt(i, o.matrix);
      for (let s = -1; s <= 1; s += 2) {               // both hands up beside the head, waving (faster and higher when excited)
        const wave = Math.sin(t * (4 + e * 6) + p.ph + s) * (0.18 + e * 0.35);
        o.scale.setScalar(p.sc);
        o.rotation.set(0, p.face, 0);
        o.position.set(p.px, y0 + 0.62 * p.sc, p.pz);
        o.translateX(s * 0.3 * p.sc);
        o.rotateZ(-s * (0.75 - e * 0.35 + wave)); o.updateMatrix();
        const k = i * 2 + (s > 0 ? 1 : 0);
        arms.current.setMatrixAt(k, o.matrix);
        tip.set(0, ARM, 0).applyMatrix4(o.matrix);
        o.position.copy(tip); o.updateMatrix(); hands.current.setMatrixAt(k, o.matrix);
      }
    }
    [bodies, heads, hairs, caps, arms, hands].forEach(m => { m.current.instanceMatrix.needsUpdate = true; });
  });

  const n = people.length;
  return (
    <group>
      <instancedMesh ref={bodies} args={[geo.bodyG, null, n]}><meshStandardMaterial roughness={0.75} /></instancedMesh>
      <instancedMesh ref={heads} args={[null, null, n]}><sphereGeometry args={[HEAD, 24, 16]} /><meshStandardMaterial map={face} roughness={0.6} /></instancedMesh>
      <instancedMesh ref={hairs} args={[geo.hairG, null, n]}><meshStandardMaterial roughness={0.7} side={THREE.DoubleSide} /></instancedMesh>
      <instancedMesh ref={caps} args={[geo.capG, null, n]}><meshStandardMaterial roughness={0.45} /></instancedMesh>
      <instancedMesh ref={arms} args={[geo.armG, null, n * 2]}><meshStandardMaterial roughness={0.75} /></instancedMesh>
      <instancedMesh ref={hands} args={[geo.handG, null, n * 2]}><meshStandardMaterial roughness={0.6} /></instancedMesh>
    </group>
  );
}
