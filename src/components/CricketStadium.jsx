import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import AnimatedCrowd from './AnimatedCrowd.jsx';
import { ringA, ringB, ringY } from '../game/constants.js';

/* a ring of boxes following the oval of the stadium (stands, wall and advertising boards) */
function RingBoxes({ n, A, B, h, depth, colors }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const d = new THREE.Object3D(), c = new THREE.Color();
    for (let s = 0; s < n; s++) {
      const th = (s / n) * Math.PI * 2, tx = -Math.sin(th) * A, tz = Math.cos(th) * B;
      d.position.set(Math.cos(th) * A, h / 2, Math.sin(th) * B);
      d.rotation.set(0, Math.atan2(-tz, tx), 0);
      d.scale.set(Math.hypot(tx, tz) * ((Math.PI * 2) / n) * 1.03, h, depth);
      d.updateMatrix(); ref.current.setMatrixAt(s, d.matrix); ref.current.setColorAt(s, c.set(colors[s % colors.length]));
    }
    ref.current.instanceMatrix.needsUpdate = true; ref.current.instanceColor.needsUpdate = true;
  }, [n, A, B, h, depth, colors]);
  return <instancedMesh ref={ref} args={[null, null, n]} receiveShadow><boxGeometry /><meshStandardMaterial roughness={0.9} /></instancedMesh>;
}
const SEAT_A = ['#e9edf7', '#dfe5f2'], SEAT_B = ['#f3f5fb', '#e6ebf6'], WALL = ['#ffffff'];
const ADS = ['#ff5c8a', '#3f8ff0', '#ffc928', '#8b5cf6', '#f0483a', '#22b8e8', '#2fbf5a'];

function Stands() {
  const rows = [];
  for (let r = 0; r < 6; r++) rows.push(<RingBoxes key={r} n={56} A={ringA(r)} B={ringB(r)} h={ringY(r)} depth={1.1} colors={r % 2 ? SEAT_A : SEAT_B} />);
  return <group>{rows}<RingBoxes n={56} A={ringA(6)} B={ringB(6)} h={ringY(5) + 2.4} depth={1.2} colors={WALL} /></group>;
}

function Ground() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#86da55' : '#72cc44'; g.fillRect(i * 32, 0, 32, 512); }
    for (let k = 0; k < 9000; k++) {                 // natural grass: tiny light and dark blades over the mower stripes
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,200,.07)' : 'rgba(20,70,10,.08)';
      g.fillRect(Math.random() * 512, Math.random() * 512, 1, 2 + Math.random() * 2);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow><circleGeometry args={[160, 48]} /><meshStandardMaterial color="#5cb23c" roughness={1} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[75, 60.5, 1]} receiveShadow><circleGeometry args={[1, 96]} /><meshStandardMaterial map={tex} roughness={1} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[73.5, 59, 1]}><torusGeometry args={[1, 0.01, 6, 160]} /><meshBasicMaterial color="#ffffff" /></mesh>
      <RingBoxes n={116} A={74.6} B={60} h={1} depth={0.5} colors={ADS} />
    </group>
  );
}

function Floodlights() {
  const towers = [[-85, -71], [85, -71], [-85, 71], [85, 71]];
  return (
    <group>
      {towers.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 11, 0]}><cylinderGeometry args={[0.3, 0.45, 22, 8]} /><meshStandardMaterial color="#59606e" /></mesh>
          <group position={[0, 23, 0]} rotation={[0, Math.atan2(-x, -z), 0]}>
            <mesh><boxGeometry args={[7, 4, 0.6]} /><meshStandardMaterial color="#6b7280" /></mesh>
            {[0, 1, 2].map(r => [0, 1, 2, 3].map(c => (
              <mesh key={r * 4 + c} position={[-2.4 + c * 1.6, 1.2 - r * 1.2, 0.4]}><sphereGeometry args={[0.42, 8, 8]} /><meshBasicMaterial color="#fff8d6" /></mesh>
            )))}
          </group>
        </group>
      ))}
    </group>
  );
}

/* white pavilion with a band of blue glass, sitting above the back stand */
function Pavilion() {
  const glass = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#7cc4ff'); gr.addColorStop(1, '#2f7fe0'); g.fillStyle = gr; g.fillRect(0, 0, 256, 64);
    g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(i * 46 + 10, 64); g.lineTo(i * 46 + 30, 0); g.lineTo(i * 46 + 42, 0); g.lineTo(i * 46 + 22, 64); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  const z = -ringB(6) - 3.2;
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 5, -1]} castShadow><boxGeometry args={[30, 10, 6]} /><meshStandardMaterial color="#eef1f6" roughness={0.7} /></mesh>
      <mesh position={[0, 11.5, 0]} castShadow><boxGeometry args={[27, 4.2, 5]} /><meshStandardMaterial color="#ffffff" roughness={0.6} /></mesh>
      <mesh position={[0, 11.4, 2.52]}><planeGeometry args={[22, 2.8]} /><meshBasicMaterial map={glass} /></mesh>
      {[-5.5, 0, 5.5].map(x => <mesh key={x} position={[x, 11.4, 2.55]}><boxGeometry args={[0.18, 2.8, 0.05]} /><meshStandardMaterial color="#dfe6f0" /></mesh>)}
      <mesh position={[0, 13.85, 0.6]} castShadow><boxGeometry args={[29, 0.5, 6.4]} /><meshStandardMaterial color="#d9dee8" roughness={0.6} /></mesh>
    </group>
  );
}

const LEAVES = ['#4fb83f', '#63c94c', '#3ea635'];
function Scenery() {
  const trees = useMemo(() => Array.from({ length: 64 }, (_, i) => { const th = (i / 34) * Math.PI * 2; return { x: Math.cos(th) * 106, z: Math.sin(th) * 91, s: 1.5 + ((i * 37) % 10) / 9 }; }), []);
  const clouds = useRef();
  useFrame((_, dt) => { if (clouds.current) clouds.current.position.x = ((clouds.current.position.x + dt * 0.8 + 120) % 240) - 120; });
  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.35, 0.5, 3, 8]} /><meshStandardMaterial color="#8a5a32" /></mesh>
          {[[0, 4.8, 0, 2.5], [-1.9, 3.9, 0.5, 1.8], [1.9, 4.0, 0.3, 1.9], [0.6, 6.4, 0.2, 1.7], [-0.9, 5.9, 0.9, 1.5]].map(([x, y, z, r], k) =>
            <mesh key={k} position={[x, y, z]}><sphereGeometry args={[r, 14, 10]} /><meshStandardMaterial color={LEAVES[(i + k) % 3]} roughness={0.9} /></mesh>)}
        </group>
      ))}
      <group ref={clouds}>
        {[[-60, 38, -100], [-10, 46, -120], [50, 36, -95], [-90, 52, -130], [95, 44, -115]].map(([x, y, z], i) => (
          <group key={i} position={[x, y, z]} scale={2.2}>
            {[[0, 0.6, 4.2], [-4.2, -0.6, 3], [4.6, -0.4, 3.3], [1.4, 2.6, 3.2], [-2, 2, 2.6], [0, -1.6, 3.4]].map(([cx, cy, r], k) => <mesh key={k} position={[cx, cy, 0]} scale={[1.25, 0.85, 0.7]}><sphereGeometry args={[r, 16, 10]} /><meshBasicMaterial color="#ffffff" fog={false} /></mesh>)}
          </group>
        ))}
      </group>
    </group>
  );
}

/* When the camera pulls back behind the stands (narrow portrait screens), everything on its side of the ground
   (stands, crowd, lights, trees) is clipped away so the view is the field, not the blank backs of the stands. */
export const nearCut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e6);
const CUT_R = ringB(0) - 1.5;
const _fw = new THREE.Vector3();
export function NearCut() {
  useFrame(({ camera }) => {
    const r = Math.hypot(camera.position.x, camera.position.z);
    camera.getWorldDirection(_fw);                         // only while looking in at the field (not when a replay follows a six outwards)
    const inward = -(_fw.x * camera.position.x + _fw.z * camera.position.z) / (r * (Math.hypot(_fw.x, _fw.z) || 1));
    if (r > CUT_R && inward > 0.6) { nearCut.normal.set(-camera.position.x / r, 0, -camera.position.z / r); nearCut.constant = CUT_R; }
    else nearCut.constant = 1e6;
  });
  return null;
}

export default function CricketStadium({ animRef, mood, quality }) {
  const cut = useRef();
  useLayoutEffect(() => {
    cut.current.traverse(o => { if (o.material) o.material.clippingPlanes = [nearCut]; });
  });
  return (
    <group>
      <Ground />
      <group ref={cut}>
        <Stands /><Floodlights /><Pavilion /><Scenery />
        <AnimatedCrowd animRef={animRef} mood={mood} quality={quality} />
      </group>
    </group>
  );
}
