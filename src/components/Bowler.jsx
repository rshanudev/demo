import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Humanoid from './Humanoid.jsx';
import { CharacterBody } from './ModelCharacter.jsx';
import * as THREE from 'three';
import { BOWL_X0, BOWL_X1, PZ, T, clamp01, lerp } from '../game/constants.js';

const _hand = new THREE.Vector3();

export default function Bowler({ animRef, mood }) {
  const rig = useRef({}), root = useRef(), cur = useRef(BOWL_X0), look = useRef(0), turn = useRef(-0.45);
  useFrame(({ clock }, dt) => {
    const R = rig.current, g = root.current, model = R.model;
    if (!g || (!model && !R.armR)) return;
    const now = clock.elapsedTime, a = animRef.current, t = a ? a.t : 0, six = a && a.kind === 'six';
    let x = cur.current, y = 0, yaw = -0.45, lean = 0, legs = 0, head = 0, ar = 0, al = 0, az = 0, elbow = 0, elbowR = null, toss = 0, lookY = -0.2 + Math.sin(now * 0.6) * 0.12, clip = 'idle';
    if (a) {
      x = lerp(BOWL_X0, BOWL_X1, clamp01(t / 1.0)); cur.current = x; yaw = -1.3;
      const run = t < 1.05 ? 1 - clamp01((t - 0.75) / 0.3) : 0;
      legs = Math.sin(now * 16) * 0.8 * (t < 1.05 ? 1 : 0);
      ar = -legs * 0.7 * run; al = legs * 0.7 * run; elbow = -1.2 * run;                     // arms pump against the legs while running in
      y = Math.sin(clamp01((t - 0.78) / 0.27) * Math.PI) * 0.28;                           // gathering jump into the delivery stride
      lean = 0.1 + 0.25 * clamp01((t - 1) / 0.2);
      const bt = clamp01((t - (T.release - 0.175)) / 0.35); if (bt > 0) { ar = bt * Math.PI * 2; al = -bt * 0.9; }   // overarm action: arm straight up at the release
      lookY = 0; clip = t < 0.8 ? 'run' : 'bowl';
      if (!six && t > 2.2) { ar = -2.9; al = -2.9; az = 0.15; y = Math.abs(Math.sin((t - 2.2) * 8)) * 0.3; yaw = -0.2; lean = 0; lookY = 0.4; clip = 'celebrate'; }  // celebrates the wicket
      if (six && t > 2.1) { ar = -2.6; al = -2.6; az = 0.5; elbow = -1.6; head = 0.5; clip = 'sad'; }                                                // hands on head
    } else if (mood === 'win') { ar = -2.6; al = -2.6; az = 0.5; elbow = -1.6; head = 0.5; clip = 'sad'; }
    else if (mood === 'lose') { ar = -2.9; al = -2.9; az = 0.15; y = Math.abs(Math.sin(now * 8)) * 0.3; yaw = -0.2; clip = 'celebrate'; }
    else {
      const dx = BOWL_X0 - cur.current;
      if (Math.abs(dx) > 0.05) { cur.current += dx * Math.min(1, dt * 3.5); yaw = 1.3; legs = Math.sin(now * 12) * 0.5; ar = -legs * 0.5; al = legs * 0.5; elbow = -0.9; clip = 'run'; }
      else {                                          // waiting: tosses the ball up and catches it, eyes on the ball
        cur.current = BOWL_X0;
        toss = Math.max(0, Math.sin(now * 3.2));
        ar = -0.35; elbowR = -1.35; head = -toss * 0.35;
      }
      x = cur.current;
    }
    look.current += (lookY - look.current) * Math.min(1, dt * 5);
    turn.current += (yaw - turn.current) * Math.min(1, dt * 9);       // idle: faces the camera, turns smoothly to run in
    g.position.set(x, y - (R.crouch || 0) * 0.2, PZ); g.rotation.set(lean, turn.current, 0);

    if (model) {                                       // imported character: its own clips when it has them, otherwise the same pose
      if (!model.play(clip, clip === 'bowl')) { model.aim(1, ar, az); model.aim(-1, al, -az); model.leg(-1, legs); model.leg(1, -legs); }
      model.head(head, look.current);
      return;
    }
    R.crouch = a ? 0.22 * Math.sin(Math.PI * clamp01((t - T.release + 0.05) / 0.45)) + (t < 0.8 ? 0.06 : 0) : 0;   // knees flex as he lands in the delivery stride
    R.armR.rotation.set(ar, 0, az); R.armL.rotation.set(al, 0, -az);
    if (R.ball) {                                     // the ball sits in his bowling hand until it is let go at the top of the arc
      R.ball.visible = !a || t < T.release;
      R.ball.position.z = 0.03 + toss * 0.34; if (toss > 0.02) R.ball.rotation.x += 0.25;
      if (a && !a.relPos && t >= T.release) { g.updateMatrixWorld(true); R.ball.getWorldPosition(_hand); a.relPos = { x: _hand.x, y: _hand.y, z: _hand.z }; }
    }
    if (R.elbowR) { R.elbowR.rotation.set(elbowR ?? elbow, 0, 0); R.elbowL.rotation.set(elbow, 0, 0); }
    const c = R.crouch;
    R.head.rotation.set(head, look.current, 0); R.legL.rotation.x = legs - c; R.legR.rotation.x = -legs - c;
  });
  return (
    <group ref={root} position={[BOWL_X0, 0, PZ]} scale={1.4}>
      <CharacterBody role="bowler" rig={rig} fallback={<Humanoid rig={rig} shirt="#f7f7f2" collar="#e2e4ea" pants="#ffffff" shoe="#e0362c" hair="#5b3418" pad={false} skin="#ffd6b0" glove="#ffd6b0" />} />
    </group>
  );
}
