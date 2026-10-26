import React from 'react';
import { TARGET, MAX_WICKETS } from '../game/gameLogic.js';
import { ROUND_META, BATSMEN } from '../data/questions.js';

export default function Scoreboard({ state }) {
  const { round, score, wickets, bat, lap } = state;
  return (
    <div className="sb" aria-label="Scoreboard">
      <div className="cell"><small>OVER {round + 1}/4{lap ? ` · LAP ${lap + 1}` : ''}</small><b>{ROUND_META[round].name}</b></div>
      <div className={'cell' + (score >= TARGET ? ' hit' : '')}><small>{score >= TARGET ? 'TARGET REACHED ✓' : `RUNS · TARGET ${TARGET}`}</small><b key={score} className="pop">{score}<span> / {TARGET}</span></b></div>
      <div className="cell">
        <small>WICKETS LEFT {MAX_WICKETS - wickets}</small>
        <div className="dots">{Array.from({ length: MAX_WICKETS }, (_, i) => <i key={i} className={i < wickets ? 'lost' : i === bat && !state.result ? 'live' : ''} />)}</div>
      </div>
      <div className="cell"><small>BATTING #{Math.min(bat + 1, 10)} · NEXT {BATSMEN[bat + 1] || '—'}</small><b>{BATSMEN[bat]}</b></div>
    </div>
  );
}
