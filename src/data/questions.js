/* ===== EDIT YOUR QUESTIONS HERE =====
   Option pictures: put PNGs in public/assets/<label with dashes>.png (e.g. mobile-phone.png).
   The emoji is shown until the picture exists. */
const o = (label, emoji) => ({ label, emoji });

export const MCQ = [
  { q: 'Which of these is an example of mass communication?', options: [o('newspaper', '📰'), o('telephone', '☎️'), o('letter', '✉️'), o('whisper', '🤫')], answer: 0 },
  { q: 'In olden days, which bird carried messages?', options: [o('pigeon', '🕊️'), o('crow', '🐦‍⬛'), o('parrot', '🦜'), o('owl', '🦉')], answer: 0 },
  { q: 'Which device is a portable version of a telephone?', options: [o('fax', '📠'), o('mobile phone', '📱'), o('radio', '📻'), o('television', '📺')], answer: 1 },
  { q: 'Which is an example of one to one communication?', options: [o('telephone call', '☎️'), o('radio', '📻'), o('movie', '🎬'), o('magazine', '📖')], answer: 0 },
  { q: 'Which machine prints out a document sent over a phone line?', options: [o('calculator', '🧮'), o('television', '📺'), o('fax machine', '📠'), o('camera', '📷')], answer: 2 }
];

export const FILL = [
  { before: 'A', after: 'is an example of mass communication.', options: [o('mobile phone', '📱'), o('telephone', '☎️'), o('email', '📧'), o('newspaper', '📰')], answer: 3 },
  { before: 'In olden days', after: 'were used to carry messages.', options: [o('pigeons', '🕊️'), o('crows', '🐦‍⬛'), o('dogs', '🐕'), o('parrots', '🦜')], answer: 0 },
  { before: 'A', after: 'is a portable version of a telephone.', options: [o('fax', '📠'), o('mobile phone', '📱'), o('letter', '✉️'), o('telegram', '📨')], answer: 1 },
  { before: 'A', after: 'is an example of one to one communication.', options: [o('telephone', '☎️'), o('radio', '📻'), o('movie', '🎬'), o('magazine', '📖')], answer: 0 },
  { before: 'A', after: 'prints out the document.', options: [o('mobile phone', '📱'), o('fax machine', '📠'), o('telegram', '📨'), o('telephone', '☎️')], answer: 1 }
];

export const TRUE_FALSE = [
  { statement: 'A newspaper is an example of mass communication.', answer: true },
  { statement: 'In olden days, crows were used to carry messages.', answer: false },
  { statement: 'A mobile phone is a portable version of a telephone.', answer: true },
  { statement: 'A radio is an example of one to one communication.', answer: false },
  { statement: 'A fax machine can print out a document.', answer: true }
];

export const MATCH = {
  pairs: [
    { id: 0, left: o('telephone', '☎️'), right: o('talk to one person', '🗣️') },
    { id: 1, left: o('newspaper', '📰'), right: o('read the daily news', '🗞️') },
    { id: 2, left: o('radio', '📻'), right: o('listen to songs and news', '🎶') },
    { id: 3, left: o('pigeon', '🕊️'), right: o('carried messages long ago', '📜') },
    { id: 4, left: o('mobile phone', '📱'), right: o('a portable telephone', '🤳') }
  ],
  rightOrder: [2, 4, 0, 3, 1]
};

export const ROUND_META = [
  { name: 'Multiple Choice', short: 'Over 1 · Multiple Choice' },
  { name: 'Fill in the Blanks', short: 'Over 2 · Fill in the Blanks' },
  { name: 'True or False', short: 'Over 3 · True or False' },
  { name: 'Match the Following', short: 'Over 4 · Match the Following' }
];

export const BATSMEN = ['Aarav', 'Vihaan', 'Kabir', 'Ishaan', 'Rohan', 'Arjun', 'Dev', 'Neel', 'Veer', 'Yash'];
