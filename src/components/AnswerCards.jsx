import React from 'react';
import Icon from './Icon.jsx';
/* Four big glossy answer cards (A, B, C, D) used by the multiple choice round. */
export default function AnswerCards({ options, answer, picked, busy, onPick }) {
  return (
    <div className="opts">
      {options.map((o, k) => {
        const cls = ['opt', picked === k ? (k === answer ? 'good' : 'bad') : '', picked !== null && picked !== k && k === answer && picked !== answer ? 'reveal' : ''].join(' ');
        return (
          <button key={k} type="button" className={cls} disabled={busy || picked !== null} aria-label={`${'ABCD'[k]}: ${o.label}`} onClick={() => onPick(k)}>
            <span className="ltr">{'ABCD'[k]}</span>
            <Icon label={o.label} emoji={o.emoji} /><span className="tx">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
