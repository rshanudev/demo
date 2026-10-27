import { CONTACT, PZ, T, FLIGHT, clamp01, lerp } from './constants.js';

/* Every six uses a different, properly played shot (move = the bat motion in batting.js; F = where the ball lands: x, z,
   +z being the off side the batsman faces; H = height of the arc; crouch/stride = how low he gets and how far the front
   foot goes down the pitch; yawEnd/lean = how his body turns and leans through the follow-through).
   Every wicket uses a different dismissal (fly = how each stump tumbles, low = height the ball hits the stumps at,
   pitch = how far down the pitch it bounces, as a share of the release-to-stumps time; a yorker pitches right at the feet). */
export const SIX_SHOTS = [
  { name: 'Straight drive', move: 'drive', F: [82, 1], H: 29, s0: 1.67, yawEnd: 0.6, lean: 0.12, crouch: 0.22, stride: 0.3 },
  { name: 'Cover drive', move: 'cover', F: [51.5, 51.5], H: 23, s0: 1.67, yawEnd: 1.0, lean: 0.2, crouch: 0.26, stride: 0.38 },
  { name: 'Pull shot', move: 'pull', F: [22, -60], H: 24, s0: 1.67, yawEnd: -0.45, lean: -0.05, crouch: 0.1, stride: 0 },
  { name: 'Helicopter shot', move: 'heli', F: [62, -42], H: 32, s0: 1.67, yawEnd: 0.2, lean: 0.05, crouch: 0.24, stride: 0.15 },
  { name: 'Lofted on-drive', move: 'loft', F: [75, -26], H: 30, s0: 1.67, yawEnd: 0.35, lean: 0.1, crouch: 0.2, stride: 0.3 },
  { name: 'Sweep over square leg', move: 'sweep', F: [-8, -62], H: 22, s0: 1.67, yawEnd: -0.1, lean: 0.3, crouch: 0.45, stride: 0.45 },
  { name: 'Hook behind square', move: 'hook', F: [-55, -45], H: 24, s0: 1.67, yawEnd: -0.6, lean: -0.15, crouch: 0.08, stride: 0 }
];
export const OUT_SHOTS = [
  { name: 'Bowled middle stump', move: 'drive', s0: 1.85, yawEnd: 0.6, lean: 0, low: 0.6, pitch: 0.58, fly: [-1, -0.2, 1] },
  { name: 'Yorker! Clean bowled', move: 'heli', s0: 2.0, yawEnd: 0.5, lean: 0.05, low: 0.3, pitch: 0.84, fly: [-1.4, -0.6, 0.8] },
  { name: 'Missed it completely', move: 'cover', s0: 1.6, yawEnd: 0.9, lean: 0.1, low: 0.78, pitch: 0.5, fly: [-0.8, 0.3, 1.4] },
  { name: 'Cartwheeling stumps', move: 'pull', s0: 1.9, yawEnd: -0.3, lean: 0, low: 0.5, pitch: 0.62, fly: [-1.8, -0.3, 1.8] }
];
export const pickShot = (kind, id) => { const L = kind === 'six' ? SIX_SHOTS : OUT_SHOTS; return L[(id - 1) % L.length]; };

/* where the bat meets the ball when the batsman has not worked it out for this shot yet */
export const DEFAULT_CONTACT = { x: CONTACT.x, y: CONTACT.y, z: PZ + CONTACT.dz };

/* position of the ball after a six has been hit from contact point c */
export function sixBall(t, sh, c = DEFAULT_CONTACT) {
  const v = clamp01((t - T.contact) / FLIGHT);
  return { v, x: lerp(c.x, sh.F[0], v), y: lerp(c.y, 0.3, v) + 4 * sh.H * v * (1 - v), z: lerp(c.z, sh.F[1], v) };
}
