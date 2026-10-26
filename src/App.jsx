import React, { useEffect, useReducer, useState } from 'react';
import Scene from './components/Scene.jsx';
import QuizManager from './components/QuizManager.jsx';
import GameControls from './components/GameControls.jsx';
import ReviewPanel from './components/ReviewPanel.jsx';
import MatchResult from './components/MatchResult.jsx';
import { gameReducer, initialState } from './game/gameLogic.js';
import { pickShot } from './game/shots.js';
import { ROUND_META } from './data/questions.js';
import { play, setMuted, unlock } from './game/sound.js';

const hasGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
const weakDevice = () => /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent) || (navigator.deviceMemory || 8) <= 2 || (navigator.hardwareConcurrency || 8) <= 2;

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [muted, setMute] = useState(false);
  const quality = weakDevice() ? 'low' : 'high';       // automatic: phones get no shadows and a smaller crowd
  const [cmd, setCmd] = useState(null);
  const [band, setBand] = useState(null);              // free strip of screen between the scoreboard and the answer panel
  const [review, setReview] = useState(false);

  useEffect(() => { setMuted(muted); }, [muted]);
  useEffect(() => { if (state.result === 'win') play('victory'); else if (state.result) play('lose'); }, [state.result]);

  const measure = () => {
    const sb = document.querySelector('.sb'), panel = document.querySelector('.opts, .fill, .match');
    const top = sb ? Math.round(sb.getBoundingClientRect().bottom) : 0, bottom = panel ? Math.round(panel.getBoundingClientRect().top) : innerHeight;
    setBand(p => (p && p.top === top && p.bottom === bottom ? p : { top, bottom }));
  };
  useEffect(measure);                                  // after every render (cheap, only updates when something moved)
  useEffect(() => {
    addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    const t = setTimeout(measure, 400);
    return () => { removeEventListener('resize', measure); clearTimeout(t); };
  }, []);   // eslint-disable-line

  const resetCam = () => setCmd(p => ({ type: 'view', name: 'default', n: (p ? p.n : 0) + 1 }));
  const restart = () => { dispatch({ type: 'RESTART' }); setReview(false); resetCam(); };
  const solved = Math.round(state.score / 6);

  if (!hasGL) return <div className="nogl">Sorry, this game needs WebGL. Please try another browser or device.</div>;
  return (
    <div className="app" onPointerDown={unlock} onDoubleClick={e => { if (e.target.tagName === 'CANVAS') resetCam(); }}>
      <Scene state={state} dispatch={dispatch} quality={quality} cine cmd={cmd} band={band} />
      <div className="hud">
        <QuizManager state={state} dispatch={dispatch} />
        <button type="button" className="rvbtn" onClick={() => { play('click'); setReview(true); }} aria-label="Review questions" title="Review questions">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 3h6v3H9zM8.5 11h7M8.5 15h4.5" /></svg>
          <span className="badge">{solved}</span>
        </button>
        <GameControls muted={muted} onMute={() => setMute(m => !m)} onRestart={() => { play('click'); restart(); }} />
        <div className="hint" key={state.epoch}>Drag to look around · scroll or pinch to zoom · double-click to reset the view</div>
        {!state.result && <div className="rintro" key={`${state.epoch}-${state.lap}-${state.round}`}>OVER {state.round + 1}<small>{ROUND_META[state.round].name}{state.lap ? ` · lap ${state.lap + 1}` : ''}</small></div>}
        {state.flash && (
          <div className={'big show ' + (state.flash.kind === 'out' ? 'out' : '')} key={state.flash.id}>
            {state.flash.kind === 'six' ? 'SIX!' : 'OUT!'}
            <small>{pickShot(state.flash.kind, state.flash.id).name} · {state.flash.kind === 'six' ? '+6 runs' : 'Wicket lost'}</small>
          </div>
        )}
        {state.result && <MatchResult state={state} onAgain={() => { play('click'); restart(); }} />}
        {review && <ReviewPanel log={state.log} onClose={() => setReview(false)} />}
      </div>
    </div>
  );
}
