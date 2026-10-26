import { CONTACT, PZ, T, FLIGHT, clamp01, lerp } from './constants.js';

/* Every six uses a different shot (F = where the ball lands: x, z; H = height of the arc).
   Every wicket uses a different dismissal (fly = how each stump tumbles, low = height the ball arrives at). */
export const SIX_SHOTS = [
  { name: 'Straight drive', F: [40, 1], H: 15, s0: 1.67, yawEnd: 0.95, armX: -0.15, lean: 0.05 },
  { name: 'Cover drive', F: [20, 20], H: 12, s0: 1.67, yawEnd: 1.3, armX: -0.6, lean: 0.1 },
  { name: 'Pull shot', F: [-8, 26], H: 13, s0: 1.67, yawEnd: -0.2, armX: -1.0, lean: 0.1 },
  { name: 'Helicopter shot', F: [16, -27], H: 18, s0: 1.67, yawEnd: 0.4, armX: -0.4, lean: -0.05 },
  { name: 'Lofted on-drive', F: [34, -12], H: 16, s0: 1.67, yawEnd: 0.8, armX: -0.25, lean: 0 },
  { name: 'Sweep over square leg', F: [-24, 18], H: 11, s0: 1.67, yawEnd: 0.1, armX: -0.9, lean: 0.25 },
  { name: 'Hook behind square', F: [-32, -16], H: 13, s0: 1.67, yawEnd: -0.4, armX: -0.8, lean: -0.1 }
];
export const OUT_SHOTS = [
  { name: 'Bowled middle stump', s0: 1.85, yawEnd: 0.95, armX: -0.15, lean: 0, low: 0.3, fly: [-1, -0.2, 1] },
  { name: 'Yorker! Clean bowled', s0: 2.0, yawEnd: 0.8, armX: -0.3, lean: 0.05, low: 0.2, fly: [-1.4, -0.6, 0.8] },
  { name: 'Missed it completely', s0: 1.6, yawEnd: 1.1, armX: -0.5, lean: 0.1, low: 0.35, fly: [-0.8, 0.3, 1.4] },
  { name: 'Cartwheeling stumps', s0: 1.9, yawEnd: 0.9, armX: -0.2, lean: 0, low: 0.25, fly: [-1.8, -0.3, 1.8] }
];
export const pickShot = (kind, id) => { const L = kind === 'six' ? SIX_SHOTS : OUT_SHOTS; return L[(id - 1) % L.length]; };

/* position of the ball after a six has been hit */
export function sixBall(t, sh) {
  const v = clamp01((t - T.contact) / FLIGHT);
  return { v, x: lerp(CONTACT.x, sh.F[0], v), y: lerp(CONTACT.y, 0.3, v) + 4 * sh.H * v * (1 - v), z: lerp(PZ + CONTACT.dz, sh.F[1], v) };
}
