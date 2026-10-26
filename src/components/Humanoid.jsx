import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { ARM, BODY } from '../game/batting.js';
import { limbGeometry, ARM_RADIUS, sleeveFolds, LEG, LEG_RADIUS, trouserFolds, torsoGeometry, shoeGeometry, soleGeometry, hairGeometry } from './characterGeometry.js';
/* Stylised (animated-film look) player. Limbs are smooth skinned surfaces on two bones each (shoulder/elbow,
   hip/knee); the parent animates the joints it finds in rig.current: armL/R, elbowL/R, legL/R, head
   (knees follow the hips automatically). Faces +z. A rigged GLB can replace it, see ModelCharacter.jsx. */

/* fine woven-fabric bump, shared by all clothing */
const weave = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 4) {
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, i, 128, 2);
    g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(i, 0, 2, 128);
  }
  for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},.08)`; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t;
})();

/* materials: soft skin with a warm sheen, fabric with a cloth sheen and weave, clear-coated plastic, metal, rubber */
const Skin = ({ c }) => <meshPhysicalMaterial color={c} roughness={0.5} sheen={0.6} sheenColor="#ff8a70" sheenRoughness={0.5} />;
const Cloth = ({ c, r = 0.78 }) => <meshPhysicalMaterial color={c} roughness={r} sheen={0.8} sheenColor="#ffffff" sheenRoughness={0.7} bumpMap={weave} bumpScale={0.8} />;
const Gloss = ({ c }) => <meshPhysicalMaterial color={c} roughness={0.3} clearcoat={1} clearcoatRoughness={0.06} />;
const Metal = () => <meshStandardMaterial color="#cfd6e2" roughness={0.22} metalness={0.9} />;
const Rubber = ({ c = '#f4f4ee' }) => <meshStandardMaterial color={c} roughness={0.85} />;
const VertexCloth = () => <meshPhysicalMaterial vertexColors roughness={0.7} sheen={0.7} sheenColor="#ffe6dc" sheenRoughness={0.65} bumpMap={weave} bumpScale={0.5} />;

const torsoGeo = torsoGeometry(), shoeGeo = shoeGeometry(), soleGeo = soleGeometry(), hairGeo = hairGeometry();

/* a skinned two-bone limb: `upperRef`/`lowerRef` receive the bones, children hang from the end of the lower bone */
function Limb({ pos, L1, L2, geometry, upperRef, lowerRef, children, extra }) {
  const up = useRef(), lo = useRef(), mesh = useRef();
  useLayoutEffect(() => {                         // bind while the bones are still in their rest pose
    let root = mesh.current; while (root.parent) root = root.parent;
    root.updateMatrixWorld(true);
    mesh.current.bind(new THREE.Skeleton([up.current, lo.current]));
  }, [geometry]);
  return (
    <>
      <bone ref={b => { up.current = b; upperRef(b); }} position={pos}>
        <bone ref={b => { lo.current = b; lowerRef && lowerRef(b); }} position={[0, -L1, 0]}>
          {extra}
          <group position={[0, -L2, 0]}>{children}</group>
        </bone>
      </bone>
      <skinnedMesh ref={mesh} geometry={geometry} position={pos} castShadow receiveShadow frustumCulled={false}><VertexCloth /></skinnedMesh>
    </>
  );
}

/* bare hand: soft palm, four fingers and a thumb, gently curled */
/* bare hand: soft palm, four fingers and a thumb, gently curled; the bowling hand can hold a ball (ballRef) */
function Hand({ side, skin, ballRef }) {
  return (
    <group position={[0, 0.02, 0]}>
      <mesh position={[0, -0.05, 0]} scale={[0.62, 1, 1]} castShadow><sphereGeometry args={[0.1, 28, 20]} /><Skin c={skin} /></mesh>
      {[-0.052, -0.018, 0.018, 0.052].map((z, i) => (
        <mesh key={z} position={[side * -0.012, -0.135 - (i === 1 || i === 2 ? 0.01 : 0), z]} rotation={[0, 0, side * 0.35]} castShadow>
          <capsuleGeometry args={[0.022, i === 0 || i === 3 ? 0.05 : 0.065, 6, 12]} /><Skin c={skin} />
        </mesh>
      ))}
      <mesh position={[side * -0.04, -0.05, 0.085]} rotation={[0.9, 0, side * 0.4]} castShadow><capsuleGeometry args={[0.026, 0.05, 6, 12]} /><Skin c={skin} /></mesh>
      {ballRef && (
        <group ref={ballRef} position={[side * -0.085, -0.12, 0.03]}>
          <mesh castShadow><sphereGeometry args={[0.107, 24, 16]} /><meshPhysicalMaterial color="#c3202e" roughness={0.38} clearcoat={0.8} clearcoatRoughness={0.25} /></mesh>
          <mesh><torusGeometry args={[0.107, 0.008, 8, 32]} /><meshStandardMaterial color="#f4ead6" roughness={0.6} /></mesh>
        </group>
      )}
    </group>
  );
}

/* padded batting glove: palm, sausage finger rolls, thumb roll and a cuff with a team stripe */
function BattingGlove({ side, glove, cuff }) {
  return (
    <group>
      <RoundedBox args={[0.2, 0.22, 0.23]} radius={0.08} smoothness={5} position={[0, -0.03, 0]} castShadow><Cloth c={glove} r={0.55} /></RoundedBox>
      {[-0.072, -0.024, 0.024, 0.072].map(z => <mesh key={z} position={[side * -0.06, -0.06, z]} castShadow><capsuleGeometry args={[0.032, 0.12, 8, 14]} /><Cloth c={glove} r={0.5} /></mesh>)}
      <mesh position={[side * 0.02, -0.02, 0.12]} rotation={[0.6, 0, 0]} castShadow><capsuleGeometry args={[0.035, 0.08, 8, 14]} /><Cloth c={glove} r={0.5} /></mesh>
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.105, 0.115, 0.08, 32]} /><Cloth c={glove} r={0.55} /></mesh>
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.117, 0.117, 0.025, 32]} /><Cloth c={cuff} r={0.5} /></mesh>
    </group>
  );
}

/* sculpted trainer: upper, raised sole, laces, heel tab */
function Shoe({ colour }) {
  return (
    <group>
      <mesh geometry={shoeGeo} castShadow><Gloss c={colour} /></mesh>
      <mesh geometry={soleGeo} position={[0, -0.035, 0]} castShadow receiveShadow><Rubber /></mesh>
      {[0.1, 0.145, 0.19].map(z => <mesh key={z} position={[0, 0.098 - (z - 0.1) * 0.25, z]} rotation={[0.25, 0, Math.PI / 2]}><capsuleGeometry args={[0.01, 0.1, 4, 8]} /><Rubber c="#ffffff" /></mesh>)}
      <mesh position={[0, 0.07, -0.2]} rotation={[0.3, 0, 0]}><capsuleGeometry args={[0.02, 0.06, 6, 10]} /><Rubber c="#ffffff" /></mesh>
    </group>
  );
}

/* batting pad strapped to the shin: knee roll, three vertical bolsters, two straps */
function Pad({ strap }) {
  return (
    <group position={[0, -0.2, 0.11]} scale={[0.82, 1.22, 0.9]}>
      <RoundedBox args={[0.31, 0.6, 0.12]} radius={0.055} smoothness={5} castShadow><Cloth c="#fbfbf7" r={0.55} /></RoundedBox>
      {[-0.085, 0, 0.085].map(x => <mesh key={x} position={[x, -0.03, 0.055]} castShadow><capsuleGeometry args={[0.032, 0.44, 8, 14]} /><Cloth c="#f4f4ee" r={0.55} /></mesh>)}
      <mesh position={[0, 0.27, 0.03]} rotation={[0, 0, Math.PI / 2]} castShadow><capsuleGeometry args={[0.058, 0.2, 10, 16]} /><Cloth c="#f7f7f1" r={0.5} /></mesh>
      {[0.12, -0.16].map(y => <RoundedBox key={y} args={[0.335, 0.045, 0.16]} radius={0.02} smoothness={3} position={[0, y, -0.01]}><Gloss c={strap} /></RoundedBox>)}
    </group>
  );
}

/* glossy cartoon eye: white, iris, pupil, two catch-lights, an upper lid that closes to blink, and a lash line */
function Eye({ side, lidRef, skin }) {
  return (
    <group position={[side * 0.145, 0.0, 0.345]} rotation={[0, side * 0.28, 0]} scale={0.66}>
      <mesh scale={[0.9, 1.12, 0.72]}><sphereGeometry args={[0.1, 32, 24]} /><meshPhysicalMaterial color="#ffffff" roughness={0.15} clearcoat={1} clearcoatRoughness={0.03} /></mesh>
      <mesh position={[0, -0.004, 0.058]} scale={[0.92, 1.12, 0.42]}><sphereGeometry args={[0.07, 32, 20]} /><meshPhysicalMaterial color="#3d200e" roughness={0.3} clearcoat={1} clearcoatRoughness={0.02} /></mesh>
      <mesh position={[0, -0.004, 0.074]} scale={[0.92, 1.12, 0.42]}><sphereGeometry args={[0.04, 24, 16]} /><meshStandardMaterial color="#0d0704" roughness={0.2} /></mesh>
      <mesh position={[0.024, 0.032, 0.09]}><sphereGeometry args={[0.019, 12, 10]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
      <mesh position={[-0.02, -0.03, 0.088]}><sphereGeometry args={[0.009, 10, 8]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
      <group ref={lidRef} rotation={[0.12, 0, 0]}>
        <mesh scale={[0.95, 1.16, 0.78]}><sphereGeometry args={[0.104, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.3]} /><Skin c={skin} /></mesh>
        <mesh rotation={[Math.PI / 2 - Math.PI * 0.3, 0, 0]} scale={[0.95, 0.78, 1.16]}><torusGeometry args={[0.104 * Math.sin(Math.PI * 0.3), 0.009, 8, 32]} /><meshStandardMaterial color="#2a160c" roughness={0.6} /></mesh>
      </group>
    </group>
  );
}

export default function Humanoid({ rig, skin = '#ffd6b0', shirt = '#2a58c8', pants = '#ffffff', shoe = '#2a58c8', helmet, hair, glove = '#ffffff', collar = '#ffffff', brow = '#5b3418', pad = true }) {
  const set = n => el => { rig.current[n] = el; };
  const lids = useRef([]), chest = useRef(), blink = useRef({ next: 1 + Math.random() * 3 });
  const armGeo = useMemo(() => limbGeometry({ L1: ARM.upper, L2: ARM.lower, radius: ARM_RADIUS(ARM.upper, ARM.lower), cover: pad ? 0.74 : 0.27, cloth: shirt, skin, folds: sleeveFolds(ARM.upper) }), [shirt, skin, pad]);
  const legGeo = useMemo(() => limbGeometry({ L1: LEG.upper, L2: LEG.lower, radius: LEG_RADIUS, cover: LEG.upper + LEG.lower, cloth: pants, skin, folds: trouserFolds }), [pants, skin]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime, b = blink.current, R = rig.current;
    if (t > b.next + 0.16) b.next = t + 2 + Math.random() * 3.5;           // blink every few seconds
    const k = t > b.next ? Math.sin(((t - b.next) / 0.16) * Math.PI) : 0;
    lids.current.forEach(l => l && (l.rotation.x = 0.12 + 1.25 * k));
    if (chest.current) chest.current.scale.set(1 + Math.sin(t * 2.2) * 0.01, 1 + Math.sin(t * 2.2) * 0.014, 0.86);   // breathing
    [['legL', 'kneeL'], ['legR', 'kneeR']].forEach(([h, n]) => { if (R[h] && R[n]) R[n].rotation.x = 0.06 + Math.max(0, R[h].rotation.x) * 1.6 + (R.crouch || 0) * 2; });   // knees bend as the leg swings back, and when crouching
  });

  const blush = useMemo(() => <meshBasicMaterial color="#ff7f7f" transparent opacity={0.18} depthWrite={false} />, []);
  const leg = (side, n, kn) => (
    <Limb key={n} pos={[side * BODY.hipX, BODY.hipY, 0]} L1={LEG.upper} L2={LEG.lower} geometry={legGeo} upperRef={set(n)} lowerRef={set(kn)}
      extra={pad ? <Pad strap={shoe} /> : null}>
      <group position={[0, -0.06, 0.03]} scale={0.78}><Shoe colour={shoe} /></group>
    </Limb>
  );
  const arm = (side, n, e) => (
    <Limb key={n} pos={[side * BODY.shoulderX, BODY.shoulderY, 0]} L1={ARM.upper} L2={ARM.lower} geometry={armGeo} upperRef={set(n)} lowerRef={set(e)}>
      {pad ? <BattingGlove side={side} glove={glove} cuff={shirt} /> : <Hand side={side} skin={glove} ballRef={side > 0 ? set('ball') : null} />}
    </Limb>
  );
  return (
    <>
      {leg(-1, 'legL', 'kneeL')}{leg(1, 'legR', 'kneeR')}
      <group ref={set('torso')} position={[0, BODY.torsoY, 0]} scale={[0.7, 1, 0.74]}>
        <mesh ref={chest} geometry={torsoGeo} scale={[1, 1, 0.86]} castShadow receiveShadow><Cloth c={shirt} /></mesh>
        <mesh position={[0, -0.36, 0]}><cylinderGeometry args={[0.345, 0.33, 0.14, 48]} /><Cloth c={pants} /></mesh>
        {/* polo collar: band, two collar points, placket and buttons */}
        <mesh position={[0, 0.49, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.86, 1]}><torusGeometry args={[0.19, 0.05, 16, 48]} /><Cloth c={collar} /></mesh>
        {[-1, 1].map(s => (
          <RoundedBox key={s} args={[0.13, 0.025, 0.11]} radius={0.01} smoothness={3} position={[s * 0.085, 0.47, 0.19]} rotation={[0.5, s * -0.5, s * 0.35]}><Cloth c={collar} /></RoundedBox>
        ))}
        <RoundedBox args={[0.075, 0.17, 0.02]} radius={0.008} smoothness={3} position={[0, 0.34, 0.318]} rotation={[-0.42, 0, 0]}><Cloth c={collar} /></RoundedBox>
        {[0.38, 0.31].map(y => <mesh key={y} position={[0, y, 0.33 + (0.38 - y) * 0.4]}><sphereGeometry args={[0.014, 10, 8]} /><Gloss c="#f3f3f3" /></mesh>)}
        <group position={[-0.17, 0.12, 0.33]} rotation={[-0.15, -0.38, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.07, 0.07, 0.016, 32]} /><Gloss c="#ffc928" /></mesh>
          <mesh position={[0, 0, 0.009]}><circleGeometry args={[0.038, 5]} /><meshStandardMaterial color="#ffffff" /></mesh>
        </group>
      </group>
      {arm(-1, 'armL', 'elbowL')}{arm(1, 'armR', 'elbowR')}
      {/* big round head: cheeks, chin, ears, nose, glossy eyes with lids */}
      <mesh position={[0, BODY.neckY, 0.01]} castShadow><cylinderGeometry args={[0.075, 0.09, 0.26, 24]} /><Skin c={skin} /></mesh>
      <group ref={set('head')} position={[0, BODY.headY, 0]} scale={BODY.head}>
        <mesh castShadow scale={[0.9, 1.08, 0.96]}><sphereGeometry args={[0.43, 64, 48]} /><Skin c={skin} /></mesh>
        <mesh position={[0, -0.22, 0.1]} scale={[0.85, 0.5, 0.75]}><sphereGeometry args={[0.28, 40, 24]} /><Skin c={skin} /></mesh>
        {[-1, 1].map(s => <mesh key={s} position={[s * 0.2, -0.1, 0.27]} scale={[0.8, 0.65, 0.45]}><sphereGeometry args={[0.11, 32, 20]} /><Skin c={skin} /></mesh>)}
        <Eye side={-1} skin={skin} lidRef={el => (lids.current[0] = el)} /><Eye side={1} skin={skin} lidRef={el => (lids.current[1] = el)} />
        {[-1, 1].map(s => (
          <group key={s}>
            <mesh position={[s * 0.15, 0.115, 0.392]} rotation={[-0.4, s * 0.25, s * -0.08]}><capsuleGeometry args={[0.02, 0.085, 6, 12]} /><meshStandardMaterial color={brow} roughness={0.8} /></mesh>
            <mesh position={[s * 0.27, -0.12, 0.345]} rotation={[0, s * 0.6, 0]}><circleGeometry args={[0.065, 24]} />{blush}</mesh>
            <group position={[s * 0.43, -0.02, 0]} rotation={[0, s * 0.3, 0]}>
              <mesh scale={[0.6, 1, 1]}><sphereGeometry args={[0.085, 20, 16]} /><Skin c={skin} /></mesh>
              <mesh position={[s * 0.02, 0, 0.02]} scale={[0.4, 0.7, 0.7]}><sphereGeometry args={[0.07, 16, 12]} /><meshStandardMaterial color="#f0a888" roughness={0.6} /></mesh>
            </group>
          </group>
        ))}
        <mesh position={[0, -0.075, 0.415]} scale={[0.85, 1.25, 1.2]}><sphereGeometry args={[0.055, 20, 14]} /><Skin c={skin} /></mesh>
        <group position={[0, -0.2, 0.375]} rotation={[-0.35, 0, 0]} scale={0.8}>
          <mesh rotation={[0, 0, Math.PI]} scale={[1, 0.85, 1]}><circleGeometry args={[0.075, 32, 0, Math.PI]} /><meshStandardMaterial color="#7a1e1a" roughness={0.6} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, -0.04, 0.002]} scale={[1, 0.45, 1]}><circleGeometry args={[0.04, 24]} /><meshStandardMaterial color="#ff7d7d" roughness={0.5} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, -0.006, 0.003]} scale={[1, 0.2, 1]}><circleGeometry args={[0.06, 24, 0, Math.PI]} /><meshStandardMaterial color="#ffffff" roughness={0.3} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, 0, 0.004]} rotation={[0, 0, Math.PI]}><torusGeometry args={[0.075, 0.008, 6, 24, Math.PI]} /><meshStandardMaterial color="#d97a6a" roughness={0.5} /></mesh>
        </group>
        {helmet && (
          <group>
            <mesh position={[0, 0.14, -0.02]} castShadow><sphereGeometry args={[0.48, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.47]} /><Gloss c={helmet} /></mesh>
            <mesh position={[0, 0.16, -0.02]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.472, 0.02, 10, 64]} /><Gloss c={helmet} /></mesh>
            <mesh position={[0, 0.14, -0.02]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.483, 0.016, 8, 48, Math.PI * 0.94]} /><meshStandardMaterial color="#ffffff" roughness={0.4} /></mesh>
            {/* short curved peak following the helmet rim */}
            <mesh position={[0, 0.19, 0.05]} rotation={[-0.14, 0, 0]} scale={[1, 1, 0.92]} castShadow><cylinderGeometry args={[0.52, 0.52, 0.035, 48, 1, false, -Math.PI * 0.36, Math.PI * 0.72]} /><Gloss c={helmet} /></mesh>
            {[-1, 1].map(s => <mesh key={s} position={[s * 0.385, 0.06, 0.16]} rotation={[0, 0, s * 0.15]} scale={[0.06, 0.13, 0.09]}><sphereGeometry args={[1, 16, 12]} /><meshPhysicalMaterial color={brow} roughness={0.55} sheen={1} sheenColor="#d29a62" /></mesh>)}
            {[-0.13, 0, 0.13].map(x => <mesh key={x} position={[x, -0.19, 0.49]}><cylinderGeometry args={[0.012, 0.012, 0.2, 10]} /><Metal /></mesh>)}
            {[-0.1, -0.27].map(y => <group key={y} position={[0, y, 0]} rotation={[0, -0.3 * Math.PI, 0]}><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.5, 0.013, 10, 40, Math.PI * 0.4]} /><Metal /></mesh></group>)}
            {[-1, 1].map(s => <mesh key={s} position={[s * 0.44, -0.04, 0.04]} scale={[0.45, 0.75, 0.75]}><sphereGeometry args={[0.14, 24, 18]} /><Gloss c={helmet} /></mesh>)}
          </group>
        )}
        {hair && <mesh geometry={hairGeo} position={[0, 0.03, -0.02]} castShadow><meshPhysicalMaterial color={hair} roughness={0.5} sheen={1} sheenColor="#d29a62" sheenRoughness={0.35} clearcoat={0.25} clearcoatRoughness={0.5} /></mesh>}
      </group>
    </>
  );
}
