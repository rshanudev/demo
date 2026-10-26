import React, { useEffect, useRef } from 'react';

/* Letter boxes: type the missing word with the keyboard (a hidden input opens the phone keyboard when you tap the boxes). */
export default function FillBlanksRound({ answerText, typed, setTyped, done, busy, onSubmit }) {
  const inp = useRef();
  const letters = answerText.replace(/\s/g, '').length;
  const locked = busy || !!done;

  useEffect(() => { if (!locked && inp.current) inp.current.focus({ preventScroll: true }); }, [answerText, locked]);
  useEffect(() => {
    const h = e => {
      if (locked || !inp.current || document.querySelector('.review')) return;
      if (document.activeElement !== inp.current && /^[a-z]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) inp.current.focus();
    };
    addEventListener('keydown', h);
    return () => removeEventListener('keydown', h);
  }, [locked]);

  let li = 0;
  const boxes = [...answerText].map((ch, i) => {
    if (ch === ' ') return <i key={i} className="gap" />;
    const k = li++, v = typed[k] || '';
    const cls = 'lb ' + (done ? (done.correct ? 'ok' : 'bad') : k === typed.length ? 'cur' : v ? 'has' : '');
    return <b key={i} className={cls}>{v}</b>;
  });
  const hint = () => { if (!locked && !typed) setTyped(answerText.replace(/\s/g, '')[0].toLowerCase()); };
  const ready = typed.length === letters;

  return (
    <div className="fill">
      <div className="fillbox" style={{ '--n': letters + (answerText.split(' ').length - 1) * 0.5 }} onClick={() => inp.current && inp.current.focus()}>
        {boxes}
        <input ref={inp} className="hid" value={typed} disabled={locked} maxLength={letters} inputMode="text" autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="done" aria-label="Type the missing word"
          onChange={e => setTyped(e.target.value.replace(/[^a-z]/gi, '').slice(0, letters).toLowerCase())}
          onKeyDown={e => { if (e.key === 'Enter' && ready && !locked) onSubmit(); }} />
      </div>
      <div className="fillbtns">
        <button type="button" className="fb tip" disabled={locked || !!typed} onClick={hint}>Hint</button>
        <button type="button" className="fb" disabled={locked || !typed} onClick={() => setTyped(typed.slice(0, -1))} aria-label="Delete a letter">⌫</button>
        <button type="button" className="fb go" disabled={locked || !ready} onClick={onSubmit}>Check ✓</button>
        {done && !done.correct && <span className="chip ansline">Answer: {answerText}</span>}
      </div>
    </div>
  );
}
