'use strict';
// Pause marks for the ElevenLabs v3 reading (the voice reads ~185 wpm; the brief wants 150-160 per act, with no time
// stretching). Only punctuation changes: commas, colons and dashes become "...", and a sentence of >= 10 words with no
// internal pause gets one "..." before its first clause word after the 4th word. Words are never added or removed.
const CLAUSE = /^(and|but|while|so|because|when|which|though|then|from|after|before|with|into|over|since|measured|in)$/i;
function withPauses(spoken) {
  let s = spoken.replace(/\s*[,:;—–]\s+/g, '... ');
  const ws = s.split(/\s+/);
  if (ws.length >= 10 && !/\.\.\./.test(s)) {
    const i = ws.findIndex((w, k) => k >= 4 && k <= ws.length - 3 && CLAUSE.test(w));
    if (i > 0) ws[i - 1] += '...';
    s = ws.join(' ');
  }
  return s;
}
module.exports = { withPauses };
if (require.main === module) for (const t of process.argv.slice(2)) console.log(withPauses(t));
