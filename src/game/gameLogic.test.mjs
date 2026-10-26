import assert from 'node:assert/strict';
import { gameReducer as R, initialState } from './gameLogic.js';

function play(s, correct, key, pairId) {
  s = R(s, { type: 'ANSWER', correct, key, pairId });
  const id = s.anim.id;
  const dup = R(s, { type: 'ANSWER', correct: !correct, key: 'dup' });   // double click must be ignored
  assert.equal(dup, s);
  s = R(s, { type: 'CONTACT', id });
  s = R(s, { type: 'CONTACT', id });                                      // duplicate event must not double count
  return R(s, { type: 'ADVANCE', id });
}
let s = initialState;
for (let i = 0; i < 5; i++) s = play(s, true, 'a' + i);
assert.equal(s.score, 30); assert.equal(s.round, 1); assert.equal(s.q, 0);
s = play(s, false, 'b0'); assert.equal(s.wickets, 1); assert.equal(s.score, 30); assert.equal(s.bat, 1);
for (let i = 1; i < 5; i++) s = play(s, true, 'b' + i);
assert.equal(s.round, 2); assert.equal(s.score, 54);
s = play(s, true, 'c0');
assert.equal(s.score, 60); assert.equal(s.result, null); assert.equal(s.status, 'ready');   // target reached: the match goes on
for (let i = 1; i < 5; i++) s = play(s, true, 'c' + i);
assert.equal(s.round, 3); assert.equal(s.result, null);
for (let id = 0; id < 4; id++) s = play(s, true, '3-' + id, id);
assert.equal(s.result, null);                                              // not before the very last question
s = play(s, true, '3-4', 4);
assert.equal(s.result, 'win'); assert.equal(s.status, 'ended'); assert.equal(s.score, 114);
assert.equal(R(s, { type: 'ANSWER', correct: true, key: 'x' }), s);       // no answers after the end

s = R(s, { type: 'RESTART' });
for (let i = 0; i < 9; i++) s = play(s, false, 'w' + i);
assert.equal(s.result, null); assert.equal(s.wickets, 9);
s = play(s, false, 'w9'); assert.equal(s.result, 'lose'); assert.equal(s.wickets, 10);

// target reached, then the last wicket falls: the match ends and it is a win
s = R(s, { type: 'RESTART' });
for (let i = 0; i < 10; i++) s = play(s, true, 'q' + i);                  // 60 runs
assert.equal(s.score, 60); assert.equal(s.result, null);
s = { ...s, wickets: 9 };
s = play(s, false, 'q10'); assert.equal(s.wickets, 10); assert.equal(s.result, 'win');

// all questions answered without reaching the target
s = R(s, { type: 'RESTART' }); s = { ...s, round: 3, q: 0 };
s = play(s, false, '3-0', 0); assert.equal(s.wickets, 1); assert.equal(s.matched.length, 0); assert.equal(s.round, 3);
for (let id = 0; id < 5; id++) s = play(s, true, '3-' + id, id);
assert.equal(s.score, 30); assert.equal(s.result, 'notwon'); assert.equal(s.status, 'ended');

s = R(s, { type: 'RESTART' });
assert.deepEqual({ ...s, animSeq: 0, epoch: 0 }, { ...initialState, animSeq: 0, epoch: 0 });
console.log('gameLogic tests passed');
