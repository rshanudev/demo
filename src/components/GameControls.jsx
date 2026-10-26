import React from 'react';
const SPEAKER = 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z';
export default function GameControls({ muted, onMute, onRestart }) {
  return (
    <div className="ctrls">
      <button type="button" className="cb" onClick={onMute} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={SPEAKER} />{muted ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}</svg>
      </button>
      <button type="button" className="cb" onClick={onRestart} aria-label="Restart match" title="Restart match">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4.5 4.5v4h4" /></svg>
      </button>
    </div>
  );
}
