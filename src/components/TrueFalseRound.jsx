import React from 'react';
export default function TrueFalseRound({ item, picked, busy, onPick }) {
  const right = picked === null ? null : (picked === 0) === item.answer;
  const card = (k, label, emoji) => {
    const isAns = (k === 0) === item.answer;
    const cls = ['opt', 'tf', k === 0 ? 'tf-true' : 'tf-false', picked === k ? (right ? 'good' : 'bad') : '', picked !== null && picked !== k && isAns && !right ? 'reveal' : ''].join(' ');
    return <button type="button" className={cls} disabled={busy || picked !== null} onClick={() => onPick(k)}><span className="pic"><span className="emo">{emoji}</span></span><span className="tx">{label}</span></button>;
  };
  return <div className="opts two">{card(0, 'TRUE', '✅')}{card(1, 'FALSE', '❌')}</div>;
}
