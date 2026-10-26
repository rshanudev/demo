import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import Icon from './Icon.jsx';
import { MATCH } from '../data/questions.js';

const PAL = ['#ff5f9a', '#f5b82e', '#2fa8f0', '#8a52e8', '#2fb36a'];

/* Pick an item on the left, then its partner on the right. Correct pairs get an animated line; a wrong pair costs a wicket. */
export default function MatchingRound({ matched, busy, onAttempt }) {
  const [sel, setSel] = useState(null);
  const [wrong, setWrong] = useState(null);
  const [ok, setOk] = useState([]);                  // confirmed immediately (the game state follows at bat contact)
  const [lines, setLines] = useState([]);
  const box = useRef(), L = useRef({}), Rr = useRef({}), measureRef = useRef(null);
  const done = [...new Set([...matched, ...ok])];
  const byId = id => MATCH.pairs.find(p => p.id === id);

  const measure = () => {
    if (!box.current) return;
    const b = box.current.getBoundingClientRect();
    const next = done.map(id => {
      const l = L.current[id], r = Rr.current[id]; if (!l || !r) return null;
      const lb = l.getBoundingClientRect(), rb = r.getBoundingClientRect();
      const x1 = lb.right - b.left, y1 = lb.top + lb.height / 2 - b.top, x2 = rb.left - b.left, y2 = rb.top + rb.height / 2 - b.top;
      return { id, x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1) };
    }).filter(Boolean).map(l => ({ ...l, k: [l.x1, l.y1, l.x2, l.y2].map(Math.round).join() }));
    setLines(prev => (prev.map(l => l.id + l.k).join('|') === next.map(l => l.id + l.k).join('|') ? prev : next));
  };
  measureRef.current = measure;
  useLayoutEffect(measure, [done.length]);   // eslint-disable-line
  useEffect(() => { const ro = new ResizeObserver(() => measureRef.current && measureRef.current()); box.current && ro.observe(box.current); return () => ro.disconnect(); }, []);
  useEffect(() => { if (!wrong) return; const t = setTimeout(() => setWrong(null), 900); return () => clearTimeout(t); }, [wrong]);

  const pickLeft = id => { if (busy || done.includes(id)) return; setSel(id); };
  const pickRight = id => {
    if (busy || sel === null || done.includes(id)) return;
    const good = sel === id;
    if (good) setOk(o => [...o, id]); else setWrong({ l: sel, r: id });
    onAttempt(good, sel);
    setSel(null);
  };
  const card = (side, p, id, isLeft) => {
    const d = done.includes(id), cls = ['mc', isLeft ? 'l' : 'r', d ? 'ok' : '', isLeft && sel === id ? 'sel' : '', wrong && (isLeft ? wrong.l === id : wrong.r === id) ? 'bad' : ''].join(' ');
    return (
      <button key={side + id} type="button" className={cls} style={{ '--pc': PAL[id] }} ref={el => ((isLeft ? L : Rr).current[id] = el)}
        disabled={busy || d} onClick={() => (isLeft ? pickLeft(id) : pickRight(id))}>
        <Icon label={p.label} emoji={p.emoji} /><span className="tx">{p.label}</span>
      </button>
    );
  };
  return (
    <div ref={box} className={'match' + (busy ? ' busy' : '')}>
      <svg className="lines" aria-hidden="true">
        {lines.map(l => <line key={l.id} className="ln" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={PAL[l.id]} style={{ '--len': l.len }} />)}
      </svg>
      <div className="col">{MATCH.pairs.map(p => card('L', p.left, p.id, true))}</div>
      <div className="col">{MATCH.rightOrder.map(id => card('R', byId(id).right, id, false))}</div>
    </div>
  );
}
