import React from 'react';
import { MCQ, FILL, TRUE_FALSE, MATCH, ROUND_META } from '../data/questions.js';
const chip = v => (v === 'six' ? { t: '✓ Six!', c: 'done' } : v === 'out' ? { t: '✗ Out', c: 'out' } : { t: 'Not answered yet', c: '' });
export default function ReviewPanel({ log, onClose }) {
  const rounds = [
    MCQ.map((x, i) => ({ key: `0-${i}`, text: x.q, ans: x.options[x.answer].label })),
    FILL.map((x, i) => ({ key: `1-${i}`, text: `${x.before} ____ ${x.after}`, ans: x.options[x.answer].label })),
    TRUE_FALSE.map((x, i) => ({ key: `2-${i}`, text: x.statement, ans: x.answer ? 'True' : 'False' })),
    MATCH.pairs.map(p => ({ key: `3-${p.id}`, text: p.left.label, ans: p.right.label }))
  ];
  return (
    <div className="review" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rv-card" role="dialog" aria-modal="true" aria-label="Quiz progress">
        <h2>Quiz progress</h2>
        {rounds.map((items, r) => (
          <section key={r}>
            <h3>Over {r + 1} · {ROUND_META[r].name}</h3>
            <ol>
              {items.map((it, i) => { const c = chip(log[it.key]); return (
                <li key={it.key} className={c.c}><span className="num">{i + 1}</span>
                  <div className="rq"><p>{it.text}</p>{c.c && <p className="ans">Answer: {it.ans}</p>}<span className="chip">{c.t}</span></div></li>); })}
            </ol>
          </section>
        ))}
        <button type="button" className="btn" onClick={onClose} autoFocus>Close</button>
      </div>
    </div>
  );
}
