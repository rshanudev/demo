import React, { useState } from 'react';
const slug = s => s.toLowerCase().replace(/\s+/g, '-');
/* Shows public/assets/<label>.png when it exists, otherwise the emoji. */
export default function Icon({ label, emoji }) {
  const [ok, setOk] = useState(false);
  return (
    <span className={'pic' + (ok ? ' has' : '')}>
      {!ok && <span className="emo">{emoji}</span>}
      <img src={`${import.meta.env.BASE_URL}assets/${slug(label)}.png`} alt="" draggable={false} onLoad={() => setOk(true)} onError={e => e.currentTarget.remove()} />
    </span>
  );
}
