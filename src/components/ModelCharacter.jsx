import React, { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { findBones, solveTwoBone, applyWorldRotation, findClip } from '../game/modelRig.js';

/* Imported character workflow.
   public/models/characters.json names the GLB for each role, e.g. { "batsman": "batsman.glb", "bowler": "bowler.glb" }.
   When a role has no file (or it fails to load) the built-in stylised player is used instead. */
let manifest = null;
const loadManifest = () => (manifest ||= fetch(`${import.meta.env.BASE_URL}models/characters.json`, { cache: 'no-cache' })
  .then(r => (r.ok ? r.json() : {})).catch(() => ({})));
function useModelUrl(role) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let on = true;
    loadManifest().then(m => { if (on && m && typeof m[role] === 'string' && m[role]) setUrl(`${import.meta.env.BASE_URL}models/${m[role]}`); });
    return () => { on = false; };
  }, [role]);
  return url;
}

class Fallback extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) { console.warn('Character model failed to load, using the built-in player instead.', e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/* role = 'batsman' | 'bowler'; `fallback` is the built-in player */
export function CharacterBody({ role, rig, fallback, height }) {
  const url = useModelUrl(role);
  if (!url) return fallback;
  return <Fallback fallback={fallback}><Suspense fallback={fallback}><ModelCharacter url={url} rig={rig} height={height} /></Suspense></Fallback>;
}

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);

/* Loads, fits (height, standing on the ground, centred, facing +z) and exposes rig.current.model:
   reach(side, pointInPlayerSpace, poleDir) · aim(side, rotX, rotZ) · leg(side, angle) · head(x, y) · play(key) · has(key)
   side +1 is the player's +x side (the character's left hand when facing +z). */
function ModelCharacter({ url, rig, height = 2.46 }) {
  const gltf = useGLTF(url);
  const holder = useRef(), st = useRef({ action: null, key: null });
  const { scene, bones, rest } = useMemo(() => {
    const scene = cloneSkinned(gltf.scene);
    scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3()), s = height / (size.y || 1);
    scene.scale.multiplyScalar(s);
    scene.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
    const rest = new Map();
    scene.traverse(o => { if (o.isBone) rest.set(o, o.quaternion.clone()); });
    return { scene, bones: findBones(scene), rest };
  }, [gltf, height]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);

  useEffect(() => {
    const space = () => holder.current.parent;
    const tmp = { t: new THREE.Vector3(), p: new THREE.Vector3(), s: new THREE.Vector3(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), ax: new THREE.Vector3() };
    const side = n => (n > 0 ? 'L' : 'R');
    const chain = sd => [bones['upperArm' + sd], bones['foreArm' + sd], bones['hand' + sd]];
    const api = {
      reach(n, local, pole) {
        const [u, f, h] = chain(side(n)); if (!u || !f || !h) return;
        const m = space().matrixWorld;
        solveTwoBone(u, f, h, tmp.t.copy(local).applyMatrix4(m), tmp.p.copy(pole).transformDirection(m));
      },
      aim(n, rx, rz) {                                    // straight arm pointing where a rest-down arm rotated by (rx, 0, rz) would point
        const [u, f, h] = chain(side(n)); if (!u || !f || !h) return;
        const m = space().matrixWorld;
        u.updateWorldMatrix(true, true);
        const a = u.getWorldPosition(new THREE.Vector3()), len = a.distanceTo(f.getWorldPosition(new THREE.Vector3())) + f.getWorldPosition(new THREE.Vector3()).distanceTo(h.getWorldPosition(new THREE.Vector3()));
        const dir = DOWN.clone().applyEuler(new THREE.Euler(rx, 0, rz)).transformDirection(m);
        solveTwoBone(u, f, h, a.addScaledVector(dir, len * 0.97), tmp.p.set(0, 0, -1).transformDirection(m));
      },
      leg(n, angle) {
        const sd = side(n), up = bones['upLeg' + sd], lo = bones['leg' + sd]; if (!up) return;
        tmp.ax.copy(X).transformDirection(space().matrixWorld);
        applyWorldRotation(up, tmp.q.setFromAxisAngle(tmp.ax, angle));
        if (lo) applyWorldRotation(lo, tmp.q.setFromAxisAngle(tmp.ax, Math.max(0, angle) * 1.6));
      },
      head(x, y) {
        if (!bones.head) return;
        const m = space().matrixWorld;
        tmp.q.setFromAxisAngle(tmp.ax.copy(Y).transformDirection(m), y);
        tmp.q2.setFromAxisAngle(tmp.ax.copy(X).transformDirection(m), x);
        applyWorldRotation(bones.head, tmp.q.multiply(tmp.q2));
      },
      has: key => !!findClip(gltf.animations, key),
      play(key, once = false) {
        const S = st.current; if (S.key === key) return !!S.action;
        const clip = key && findClip(gltf.animations, key), next = clip ? mixer.clipAction(clip) : null;
        if (next) { next.reset(); next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); next.clampWhenFinished = once; next.fadeIn(0.25).play(); }
        if (S.action && S.action !== next) S.action.fadeOut(0.25);
        S.action = next; S.key = key;
        return !!next;
      }
    };
    rig.current.model = api;
    return () => { if (rig.current.model === api) delete rig.current.model; mixer.stopAllAction(); };
  }, [scene, bones, mixer, gltf, rig]);

  useFrame((_, dt) => {                                  // runs before the parent's pose code: clip (or rest pose) first, IK on top
    if (st.current.action) mixer.update(Math.min(dt, 0.05));
    else rest.forEach((q, b) => b.quaternion.copy(q));
  });

  return <group ref={holder}><primitive object={scene} /></group>;
}
