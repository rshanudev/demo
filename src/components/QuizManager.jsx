import React, { useState } from 'react';
import { MCQ, FILL, TRUE_FALSE } from '../data/questions.js';
import { PER_ROUND } from '../game/gameLogic.js';
import { play, unlock } from '../game/sound.js';
import MCQRound from './MCQRound.jsx';
import FillBlanksRound from './FillBlanksRound.jsx';
import TrueFalseRound from './TrueFalseRound.jsx';
import MatchingRound from './MatchingRound.jsx';
import Scoreboard from './Scoreboard.jsx';

const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/* Shows the active question (banner), scoreboard and the answer controls of the current round. */
export default function QuizManager({ state, dispatch }) {
  const { round, q } = state;
  const busy = state.status !== 'ready';
  const key = `${state.epoch}-${state.lap}-${round}-${q}`;
  const [picked, setPicked] = useState(null);        // { key, value, correct }
  const [typedS, setTypedS] = useState({ key: '', v: '' });
  const done = picked && picked.key === key ? picked : null;
  const typed = typedS.key === key ? typedS.v : '';
  const setTyped = v => setTypedS({ key, v });
  const item = [MCQ, FILL, TRUE_FALSE][round] ? [MCQ, FILL, TRUE_FALSE][round][q] : null;
  const answerText = round === 1 ? (item.word || item.options[item.answer].label) : '';

  const submit = (value, correct) => {
    if (busy || done) return;
    unlock(); play(correct ? 'correct' : 'wrong');
    setPicked({ key, value, correct });
    dispatch({ type: 'ANSWER', correct, key: `${round}-${q}` });
  };
  const submitFill = () => submit(typed, norm(typed) === norm(answerText));
  const attempt = (correct, pairId) => {
    if (busy) return;
    unlock(); play(correct ? 'correct' : 'wrong');
    dispatch({ type: 'ANSWER', correct, key: `3-${pairId}`, pairId });
  };

  let text;
  if (round === 0) text = item.q;
  else if (round === 1) text = <>{item.before} <span className={'blank ' + (done ? (done.correct ? 'ok' : 'bad') : '')}>{typed || (done ? '' : '?')}</span> {item.after}</>;
  else if (round === 2) text = <>True or false? {item.statement}</>;
  else text = <span>Match each item with its partner!<small className="sub">Tap an item on the left, then its partner on the right</small></span>;

  const pill = round < 3 ? `${q + 1} / ${PER_ROUND}` : `${Math.min(state.matched.length + 1, PER_ROUND)} / ${PER_ROUND}`;
  const pickedIdx = done ? done.value : null;
  const rp = { item, picked: pickedIdx, busy };
  return (
    <>
      <div className="pill" aria-label="Question number">{pill}</div>
      <div className="center">
        {round !== 3 && <div className="banner enter" key={key}><span>{text}</span></div>}   {/* the matching round needs no instruction banner */}
        <Scoreboard state={state} />
      </div>
      {state.result ? null : (
        <>
          {round === 0 && <MCQRound {...rp} onPick={k => submit(k, k === item.answer)} />}
          {round === 1 && <FillBlanksRound key={key} answerText={answerText} typed={typed} setTyped={setTyped} done={done} busy={busy} onSubmit={submitFill} />}
          {round === 2 && <TrueFalseRound {...rp} onPick={k => submit(k, (k === 0) === item.answer)} />}
          {round === 3 && <MatchingRound key={`${state.epoch}-${state.lap}`} matched={state.matched} busy={busy} onAttempt={attempt} />}
        </>
      )}
    </>
  );
}
