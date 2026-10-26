import React, { useEffect, useRef } from 'react';
import { TARGET, MAX_WICKETS } from '../game/gameLogic.js';

function Fireworks() {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current, g = c.getContext('2d'); let w, h, raf, parts = [], next = 0;
    const rs = () => { w = c.width = innerWidth; h = c.height = innerHeight; };
    rs(); addEventListener('resize', rs);
    const burst = (x, y) => { const hue = Math.random() * 360; for (let i = 0; i < 50; i++) { const a = Math.random() * 6.283, s = 2 + Math.random() * 5; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, col: `hsl(${hue} 100% 60%)`, r: 2.5 }); } };
    const COL = ['#ffd35f', '#9ad9ff', '#c79cff', '#ff9fcb', '#9fe89c'];
    const loop = now => {
      g.clearRect(0, 0, w, h);
      if (now > next) { burst(w * (0.15 + Math.random() * 0.7), h * (0.1 + Math.random() * 0.4)); next = now + 450; }
      for (let i = 0; i < 3; i++) parts.push({ x: Math.random() * w, y: -10, vx: Math.random() * 2 - 1, vy: 2 + Math.random() * 3, life: 2, col: COL[(Math.random() * 5) | 0], r: 4, conf: true });
      parts = parts.filter(p => p.life > 0 && p.y < h + 20);
      parts.forEach(p => {
        p.x += p.vx; p.y += p.vy; if (!p.conf) { p.vy += 0.06; p.vx *= 0.99; p.life -= 0.014; } else p.life -= 0.004;
        g.globalAlpha = Math.max(0, Math.min(1, p.life)); g.fillStyle = p.col;
        p.conf ? g.fillRect(p.x, p.y, p.r * 1.6, p.r) : (g.beginPath(), g.arc(p.x, p.y, p.r, 0, 6.283), g.fill());
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', rs); };
  }, []);
  return <canvas ref={ref} className="fw" />;
}

export default function MatchResult({ state, onAgain }) {
  const { result, score, wickets } = state;
  const meta = {
    win: { title: 'YOU WIN!', sub: 'Magnificent! You reached the target and finished the innings.', cls: 'win', em: '🏆' },
    lose: { title: 'YOU LOST', sub: 'All ten wickets are gone. Try again!', cls: 'lose', em: '😢' },
    notwon: { title: 'NOT WON — TARGET NOT REACHED', sub: 'All questions are done, but the target was not reached.', cls: 'lose', em: '🏏' }
  }[result];
  return (
    <div className="end" role="dialog" aria-label="Match result">
      {result === 'win' && <Fireworks />}
      <div className={'end-card ' + meta.cls}>
        <div className="em">{meta.em}</div>
        <h2>{meta.title}</h2>
        <p>{meta.sub}</p>
        <div className="stats">
          <div><small>FINAL SCORE</small><b>{score}</b></div>
          <div><small>TARGET</small><b>{TARGET}</b></div>
          <div><small>WICKETS LOST</small><b>{wickets}</b></div>
          <div><small>WICKETS LEFT</small><b>{MAX_WICKETS - wickets}</b></div>
        </div>
        <button type="button" className="btn" onClick={onAgain} autoFocus>PLAY AGAIN</button>
      </div>
    </div>
  );
}
