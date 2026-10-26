export const PZ = 1;                 // z of the pitch line
export const BAT_X = -6;             // batsman position
export const BOWL_X0 = 9.8;         // bowler run-up mark
export const BOWL_X1 = 7.6;          // bowler release point
export const STUMP_BAT = -7.2, STUMP_BOWL = 7.2;
export const CONTACT = { x: -5.26, y: 0.96, dz: 0.72 };   // middle of the bat at the moment of the hit (see batting.js)
export const RELEASE = { x: 7.0, y: 3.2 };          // the bowler's hand at the top of his action
// seconds on the delivery timeline
export const T = { release: 1.0, contact: 2.0, stump: 2.2, doneSix: 6.7, doneOut: 5.4 };
export const FLIGHT = 4.0;          // seconds of ball flight after a six
export const ringA = r => 76 + r * 1.8;            // a very big ground: stands far back from the pitch
export const ringB = r => 61 + r * 1.55;
export const ringY = r => 0.8 + r * 1.25;
export const clamp01 = x => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => t * t * (3 - 2 * t);
