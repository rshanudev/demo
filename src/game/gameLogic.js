/* Pure game logic (no React, no 3D). Every rule of the match lives here. */
export const TARGET = 60;
export const MAX_WICKETS = 10;
export const RUNS_PER_HIT = 6;
export const PER_ROUND = 5;
export const LAST_ROUND = 3;

export const initialState = {
  round: 0, q: 0, lap: 0,                // lap: how many times the question set has been replayed
  score: 0, wickets: 0, bat: 0,          // bat = index of the batsman at the crease (0..9)
  status: 'ready',                       // ready | animating | ended
  anim: null,                            // { id, kind: 'six' | 'out' }
  pending: null,                         // answer waiting to be applied at the moment of contact
  flash: null,                           // SIX / OUT banner
  result: null,                          // win | lose | notwon
  log: {},                               // "round-q" -> 'six' | 'out'
  matched: [],                           // matched pair ids (round 4)
  animSeq: 0, epoch: 0
};

function commit(s) {
  const p = s.pending;
  return {
    ...s,
    score: s.score + (p.correct ? RUNS_PER_HIT : 0),
    wickets: s.wickets + (p.correct ? 0 : 1),
    log: { ...s.log, [p.key]: p.correct ? 'six' : (s.log[p.key] === 'six' ? 'six' : 'out') },
    matched: p.correct && s.round === LAST_ROUND && !s.matched.includes(p.pairId) ? [...s.matched, p.pairId] : s.matched,
    pending: null,
    flash: { kind: s.anim.kind, id: s.anim.id }
  };
}

function advance(s) {
  const wasOut = s.anim.kind === 'out';
  const base = { ...s, anim: null, flash: null, status: 'ready', bat: wasOut ? Math.min(s.bat + 1, MAX_WICKETS - 1) : s.bat };
  // reaching the target does not stop the match: it plays on until the last wicket or the last question,
  // and only then is the result decided (target reached = win)
  const won = s.score >= TARGET;
  if (s.wickets >= MAX_WICKETS) return { ...base, status: 'ended', result: won ? 'win' : 'lose' };
  if (s.round === LAST_ROUND) {
    if (s.matched.length < PER_ROUND) return base;
    return { ...base, status: 'ended', result: won ? 'win' : 'notwon' };
  }
  const nq = s.q + 1;
  return nq < PER_ROUND ? { ...base, q: nq } : { ...base, round: s.round + 1, q: 0 };
}

export function gameReducer(s, a) {
  switch (a.type) {
    case 'ANSWER': {
      if (s.status !== 'ready' || s.result) return s;                // blocks double submissions
      const id = s.animSeq + 1;
      return { ...s, status: 'animating', animSeq: id, anim: { id, kind: a.correct ? 'six' : 'out' },
        pending: { correct: !!a.correct, key: a.key, pairId: a.pairId } };
    }
    case 'CONTACT':
      return s.anim && s.anim.id === a.id && s.pending ? commit(s) : s;
    case 'ADVANCE':
      if (!s.anim || s.anim.id !== a.id) return s;
      return advance(s.pending ? commit(s) : s);
    case 'RESTART':
      return { ...initialState, animSeq: s.animSeq, epoch: s.epoch + 1 };
    default:
      return s;
  }
}
