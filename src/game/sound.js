/* Tiny synthesised sound kit (no audio files). The AudioContext is only created after a user gesture. */
let ac = null, muted = false;
const make = () => { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} return ac; };
const ctx = () => (muted ? null : make());
export const unlock = () => { make(); };
export const setMuted = m => { muted = m; };

function tone(f, start, dur, type = 'triangle', vol = 0.16, slide = null) {
  const c = ctx(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + start;
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur);
}
function noise(dur, type, f0, f1, vol, start = 0, attack = 0.01) {
  const c = ctx(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + start;
  s.buffer = buf; f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(c.destination); s.start(t);
}
const kit = {
  click: () => tone(560, 0, 0.1, 'sine', 0.14),
  run: () => { for (let k = 0; k < 5; k++) noise(0.1, 'lowpass', 500, 300, 0.12, k * 0.15); },
  whoosh: () => noise(0.45, 'bandpass', 500, 2200, 0.16, 0, 0.2),
  crack: () => { noise(0.12, 'highpass', 2500, 1200, 0.5); tone(180, 0, 0.15, 'square', 0.15, 90); },
  cheer: () => { noise(1.8, 'bandpass', 900, 1500, 0.22, 0, 0.5); noise(1.5, 'bandpass', 1800, 1100, 0.08, 0.1, 0.4); },
  groan: () => noise(1.0, 'lowpass', 500, 200, 0.2, 0, 0.3),
  clatter: () => { [0, 0.05, 0.11, 0.17, 0.26].forEach(d => noise(0.12, 'highpass', 1800, 900, 0.3, d)); },
  correct: () => [659, 784, 988].forEach((f, i) => tone(f, i * 0.1, 0.25)),
  wrong: () => tone(190, 0, 0.45, 'sawtooth', 0.07, 120),
  victory: () => { [523, 659, 784, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.13, 0.3, 'triangle', 0.2)); noise(2.2, 'bandpass', 1000, 1600, 0.2, 0, 0.6); },
  lose: () => [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.25, 0.4, 'triangle', 0.18))
};
export const play = name => { try { kit[name] && kit[name](); } catch (e) {} };
