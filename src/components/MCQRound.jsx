import React from 'react';
import AnswerCards from './AnswerCards.jsx';
export default function MCQRound({ item, picked, busy, onPick }) {
  return <AnswerCards options={item.options} answer={item.answer} picked={picked} busy={busy} onPick={onPick} />;
}
