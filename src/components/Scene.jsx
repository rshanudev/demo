import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, N8AO, Bloom, Vignette, ToneMapping, HueSaturation, BrightnessContrast } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import CricketStadium, { NearCut } from './CricketStadium.jsx';
import CricketPitch from './CricketPitch.jsx';
import Batsman from './Batsman.jsx';
import Bowler from './Bowler.jsx';
import CricketBall from './CricketBall.jsx';
import { PZ, T, BAT_X, STUMP_BAT, clamp01, ringB } from '../game/constants.js';
import { pickShot, sixBall, DEFAULT_CONTACT } from '../game/shots.js';
import { play } from '../game/sound.js';

/* Slow motion around the moment of contact / the stumps being hit. */
const slowFor = (six, t) => (six ? (t > 1.8 && t < 2.8 ? 0.35 : 1) : (t > 1.9 && t < 3.1 ? 0.35 : 1));

/* Runs the delivery timeline: picks the shot, fires sounds and tells the game when the bat/stumps are hit and when it is over. */
function Director({ anim, animRef, dispatch }) {
  useFrame((_, dt) => {
    if (!anim) { if (animRef.current) animRef.current = null; return; }
    let r = animRef.current;
    if (!r || r.id !== anim.id) r = animRef.current = { id: anim.id, kind: anim.kind, t: 0, f: {}, shot: pickShot(anim.kind, anim.id) };
    const six = r.kind === 'six';
    r.t += Math.min(dt, 0.05) * slowFor(six, r.t);
    const t = r.t, f = r.f;
    const once = (k, cond, fn) => { if (cond && !f[k]) { f[k] = 1; fn(); } };
    once('run', t > 0.05, () => play('run'));
    once('rel', t >= T.release, () => play('whoosh'));
    if (six) {
      once('hit', t >= T.contact, () => { play('crack'); setTimeout(() => play('cheer'), 120); dispatch({ type: 'CONTACT', id: r.id }); });
      once('done', t >= T.doneSix, () => dispatch({ type: 'ADVANCE', id: r.id }));
    } else {
      once('hit', t >= T.stump, () => { play('clatter'); dispatch({ type: 'CONTACT', id: r.id }); });
      once('groan', t >= T.stump + 0.25, () => play('groan'));
      once('done', t >= T.doneOut, () => dispatch({ type: 'ADVANCE', id: r.id }));
    }
  });
  return null;
}

const VIEWS = {
  ground: { pos: [0, 46, 30], target: [0, 0, 0] },
  batsman: { pos: [-1, 2.8, 9], target: [BAT_X, 1.4, PZ] },
  bowler: { pos: [13.5, 3.2, PZ + 3], target: [-6, 1.2, PZ] }
};
const sm = x => { x = clamp01(x); return x * x * (3 - 2 * x); };

/* Camera positions for the replay-style shots (side view of the hit, then the camera follows the ball; close-up on the stumps for a wicket). */
function cinePose(a, V) {
  const t = a.t, six = a.kind === 'six', sh = a.shot, done = six ? T.doneSix : T.doneOut;
  const alpha = sm((t - 0.6) / 0.7) * (1 - sm((t - (done - 1.2)) / 1.0));
  const pos = V.p, look = V.l;
  if (six) {
    if (t < T.contact + 0.9) { pos.set(BAT_X + 2.4, 2.3, PZ + 8.5); look.set(BAT_X + 0.8, 1.3, PZ); }
    else {
      const c = a.contact || DEFAULT_CONTACT, b = sixBall(t, sh, c), dx = sh.F[0] - c.x, dz = sh.F[1] - c.z, n = Math.hypot(dx, dz) || 1, ux = dx / n, uz = dz / n;
      pos.set(b.x - ux * 11 - uz * 4, Math.max(2.5, b.y * 0.6 + 2.5), b.z - uz * 11 + ux * 4); look.set(b.x, b.y, b.z);
    }
  } else if (t < 2.1) { pos.set(-2.2, 1.6, PZ + 7); look.set(-6.2, 0.9, PZ); }
  else if (t < 3.7) { pos.set(STUMP_BAT + 2.4, 0.8, PZ + 3.2); look.set(STUMP_BAT, 0.6, PZ); }
  else { pos.set(-3, 3, PZ + 11); look.set(-7, 1.2, PZ); }
  return alpha;
}

/* Camera: intro dolly, view presets, zoom buttons, cinematic replay shots, and re-framing on resize.
   Dragging with the mouse/finger always works (except during a replay shot). */
function CameraRig({ animRef, cine, cmd, band }) {
  const { camera, size } = useThree();
  const controls = useThree(s => s.controls);
  const goal = useRef(null), saved = useRef(null);
  const cp = useMemo(() => new THREE.Vector3(), []), cl = useMemo(() => new THREE.Vector3(), []);
  const V = useMemo(() => ({ p: new THREE.Vector3(), l: new THREE.Vector3() }), []);
  const frame = useMemo(() => {
    const aspect = size.width / size.height, fov = aspect < 1 ? 62 : 42;
    const tanH = Math.tan((fov * Math.PI) / 360), bandH = band ? Math.max(120, band.bottom - band.top) : size.height;
    const portrait = aspect < 1, width = portrait ? 22 : 27, cx = portrait ? 1.4 : 0;   // portrait: frame just stumps-to-bowler
    let dist = width / (2 * tanH * aspect);
    dist = Math.max(dist, (7 * size.height) / (bandH * 2 * tanH));          // the players must fit in the free band
    dist = Math.min(44, Math.max(17, dist));
    // once the camera is back among (or behind) the stands it must look over them and the back wall,
    // otherwise the picture is filled by their blank backs
    const over = dist > ringB(0) - 2 ? 2.2 + 0.26 * (dist - PZ) : 0;
    return { fov, pos: [cx, Math.max(2.4 + dist * 0.16, over), dist], target: [cx, 2.2, PZ], dist };
  }, [size.width, size.height, band && band.top, band && band.bottom]);   // eslint-disable-line
  useEffect(() => { camera.fov = frame.fov; camera.updateProjectionMatrix(); }, [camera, frame.fov]);
  useEffect(() => {                                   // slide the picture so the cricket sits between the scoreboard and the answer panel
    const H = size.height, shift = band ? (H - band.top - band.bottom) / 2 : 0, sft = Math.max(-H * 0.3, Math.min(H * 0.3, shift));
    if (Math.abs(sft) < 1) camera.clearViewOffset(); else camera.setViewOffset(size.width, H, 0, sft, size.width, H);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, band && band.top, band && band.bottom]);   // eslint-disable-line
  useEffect(() => { if (!saved.current) goal.current = frame; }, [frame]);
  useEffect(() => { camera.position.set(0, 16, frame.dist * 1.7); }, []); // eslint-disable-line  (intro dolly start)
  useEffect(() => {
    if (!controls) return;
    const stop = () => { goal.current = null; };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);
  useEffect(() => {
    if (!cmd || !controls || saved.current) return;
    if (cmd.type === 'view') goal.current = VIEWS[cmd.name] || frame;
    if (cmd.type === 'zoom') {
      const t = controls.target, v = camera.position.clone().sub(t), len = v.length();
      const nl = Math.min(60, Math.max(6, len * (cmd.dir > 0 ? 0.75 : 1.33)));
      v.multiplyScalar(nl / len).add(t);
      goal.current = { pos: [v.x, v.y, v.z], target: [t.x, t.y, t.z] };
    }
  }, [cmd]); // eslint-disable-line

  useFrame((_, dt) => {
    if (!controls) return;
    const a = animRef.current;
    if (cine && a && a.shot) {
      if (!saved.current) {
        saved.current = { pos: camera.position.clone(), tgt: controls.target.clone(), min: controls.minDistance, max: controls.maxDistance, pol: controls.maxPolarAngle };
        controls.enabled = false; controls.minDistance = 0.1; controls.maxDistance = 300; controls.maxPolarAngle = Math.PI;
        cp.copy(camera.position); cl.copy(controls.target); goal.current = null;
      }
      const alpha = cinePose(a, V), k = 1 - Math.exp(-dt * 4);
      cp.lerp(V.p, k); cl.lerp(V.l, k);
      camera.position.copy(saved.current.pos).lerp(cp, alpha);
      controls.target.copy(saved.current.tgt).lerp(cl, alpha);
      controls.update();
      return;
    }
    if (saved.current) {                       // replay is over: back to the view the player had
      const s = saved.current; saved.current = null;
      controls.enabled = true; controls.minDistance = s.min; controls.maxDistance = s.max; controls.maxPolarAngle = s.pol;
      goal.current = { pos: [s.pos.x, s.pos.y, s.pos.z], target: [s.tgt.x, s.tgt.y, s.tgt.z] };
    }
    const g = goal.current; if (!g) return;
    const k = 1 - Math.exp(-dt * 3);
    camera.position.x += (g.pos[0] - camera.position.x) * k; camera.position.y += (g.pos[1] - camera.position.y) * k; camera.position.z += (g.pos[2] - camera.position.z) * k;
    controls.target.x += (g.target[0] - controls.target.x) * k; controls.target.y += (g.target[1] - controls.target.y) * k; controls.target.z += (g.target[2] - controls.target.z) * k;
    controls.update();
    if (Math.abs(camera.position.x - g.pos[0]) + Math.abs(camera.position.y - g.pos[1]) + Math.abs(camera.position.z - g.pos[2]) < 0.05) goal.current = null;
  });
  return null;
}

/* flat cartoon sky: a big inside-out sphere with a vertical blue gradient */
function CartoonSky() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#2f9bf0'); gr.addColorStop(0.42, '#5cb8f7'); gr.addColorStop(0.5, '#a9dcfb'); gr.addColorStop(1, '#d6efff');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return <mesh><sphereGeometry args={[400, 32, 16]} /><meshBasicMaterial map={tex} side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} /></mesh>;
}

/* film-style look: studio reflections from soft light panels, ambient occlusion in the creases, a little bloom, ACES tone mapping */
function Look({ high }) {
  return (
    <>
      <Environment resolution={256} frames={1} environmentIntensity={0.55}>
        <Lightformer form="rect" intensity={2.2} color="#fff4e2" position={[-6, 10, 8]} scale={[12, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#bfe2ff" position={[10, 5, -6]} scale={[10, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.6} color="#ffffff" position={[0, 12, -12]} scale={6} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.3} color="#b8d68a" position={[0, -6, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
      </Environment>
      {high && (
        <EffectComposer multisampling={4} disableNormalPass>
          <N8AO aoRadius={0.8} distanceFalloff={0.6} intensity={2.2} color="#26324a" halfRes />
          <Bloom mipmapBlur luminanceThreshold={0.92} intensity={0.35} />
          {/* colour grading must run after tone mapping: on raw HDR values (>1) the saturation/contrast maths
              goes negative or NaN on some GPUs and bright colours render as black patches */}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <HueSaturation saturation={0.22} />
          <BrightnessContrast contrast={0.1} />
          <Vignette offset={0.3} darkness={0.35} />
        </EffectComposer>
      )}
    </>
  );
}

export default function Scene({ state, dispatch, quality, cine, cmd, band }) {
  const animRef = useRef(null);
  const high = quality === 'high';
  const mood = state.result === 'win' ? 'win' : state.result === 'lose' ? 'lose' : null;
  return (
    <Canvas
      className="canvas" shadows={high ? 'soft' : false} dpr={high ? [1, 1.75] : 1}
      gl={{ antialias: !high, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      camera={{ position: [0, 16, 45], fov: 42, near: 0.1, far: 1000 }}
      onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
    >
      <CartoonSky />
      <Look high={high} />
      <ambientLight intensity={0.1} />
      <hemisphereLight args={['#cfeaff', '#a89c78', 0.35]} />
      <directionalLight
        position={[-10, 22, 16]} intensity={2.6} color="#fff1dc" castShadow={high} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={6}
        shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={12} shadow-camera-bottom={-8} shadow-camera-near={1} shadow-camera-far={70}
      />
      <directionalLight position={[12, 6, -10]} intensity={0.9} color="#cfe6ff" />
      <Director anim={state.anim} animRef={animRef} dispatch={dispatch} />
      <CameraRig animRef={animRef} cine={cine} cmd={cmd} band={band} />
      <NearCut />
      <CricketStadium animRef={animRef} mood={mood} quality={quality} />
      <CricketPitch animRef={animRef} />
      {state.result !== 'lose' && <Batsman key={`${state.epoch}-${state.bat}`} index={state.bat} enter={state.bat > 0} animRef={animRef} mood={mood} />}
      <Bowler animRef={animRef} mood={mood} />
      <CricketBall animRef={animRef} />
      <OrbitControls makeDefault enablePan={false} enableDamping minDistance={6} maxDistance={60} maxPolarAngle={Math.PI / 2 - 0.04} target={[0, 2.2, PZ]} autoRotate={mood === 'win'} autoRotateSpeed={1.4} />
    </Canvas>
  );
}
