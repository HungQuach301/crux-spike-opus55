'use strict';
// Test D shot list: per scene [angle, focal length (mm, 35 mm-equivalent), camera move, reason for the move,
// seconds of move at the scene start (layout rules skip it), composition]. Size comes from the script.
// Moves are physical (dolly/truck/crane/orbit/push) with inertia; a rack focus is listed where it marks a turn.
const S = {
  // ---- cold open: dark, wide, the two lines born from one point
  'co-lines': ['low', 24, 'crane up from the floor grid', 'reveal the single starting point of both lines before any words', 2.0, 'center'],
  'co-same': ['eye-level', 35, 'slow dolly in', 'draw the viewer into the three matching facts', 1.0],
  'co-broke': ['eye-level', 50, 'truck right, follow the falling line', 'follow the 1966 line down to zero, time moving left to right', 1.2],
  'co-question': ['slightly high', 85, 'rack focus from zero point to the surviving line', 'shift attention to the other fate as the question lands', 0.8, 'center'],
  ident: ['eye-level', 50, 'push in on the title', 'short sonic and visual signature before the story starts', 0.6, 'center'],
  // ---- act 1
  'a1-est': ['high', 24, 'crane down onto the 1966 marker', 'establishing shot: place the viewer in January 1966', 1.6],
  'a1-start': ['eye-level', 50, 'dolly in to the balance card', 'introduce the first retiree through the money', 0.9],
  'a1-who': ['low', 35, 'slow truck left along the future years', 'hint at the hard decade ahead without showing it', 1.0],
  'a1-hook': ['eye-level', 35, 'pull back to reveal the row of start years', 'the promise spans every start year, so widen', 1.2],
  'a1-mix': ['slightly high', 50, 'orbit 10 degrees around the portfolio ring', 'show the two parts of the mix as one object', 1.0, 'center'],
  'a1-assets': ['eye-level', 85, 'push in on the stock slice', 'isolate what the stock part actually holds', 0.8],
  'a1-rebal': ['eye-level', 50, 'static, the ring re-balances itself', 'the rule moves, the camera holds still to show it', 0],
  'a1-rule': ['eye-level', 50, 'dolly in to the withdrawal card', 'the first-year withdrawal is the core input', 0.8],
  'a1-raise': ['slightly low', 35, 'crane up along the rising withdrawal steps', 'follow the nominal withdrawal as it climbs', 1.2],
  'a1-real': ['eye-level', 85, 'rack focus from nominal steps to flat real line', 'switch from nominal to real at the turn of the sentence', 0.8],
  'a1-horizon': ['high', 24, 'truck right along thirty years of floor', 'show the length of the plan left to right', 1.6],
  'a1-notax': ['eye-level', 50, 'static on the rules list', 'a plain list needs a still frame to read', 0],
  'a1-mirror-in': ['eye-level', 35, 'orbit 15 degrees to reveal a second path', 'the second retiree enters from the mirrored side', 1.2],
  'a1-mirror-rule': ['eye-level', 50, 'truck left while the years reverse', 'camera moves against time to show reversal', 1.0],
  'a1-illus': ['eye-level', 85, 'push in on the ILLUSTRATIVE badge', 'the honesty label must be read clearly', 0.6, 'center'],
  'a1-samewd': ['eye-level', 50, 'pedestal down to the two withdrawal rows', 'compare the identical withdrawals side by side', 0.8],
  'a1-question': ['eye-level', 35, 'slow dolly out to the balance scale', 'frame the chapter question on a neutral wide', 1.0, 'center'],
  'a1-avg1966': ['eye-level', 85, 'push in on the 1966 average', 'first reveal of the core number', 0.7],
  'a1-avgmirror': ['eye-level', 85, 'rack focus from 1966 average to mirror average', 'the turn: the second number matches the first', 0.6, 'center'],
  'a1-geo': ['slightly high', 50, 'orbit around the compounding stack', 'show the product is the same from either end', 1.0],
  'a1-arith': ['eye-level', 50, 'truck left across the thirty bars', 'scan the simple average of all thirty years', 0.8],
  'a1-payoff': ['eye-level', 35, 'slow dolly out to the balanced scale', 'act payoff: everything equal except the order', 1.0, 'center'],
  // ---- act 2
  'a2-est': ['high', 24, 'crane down onto the two-lane road of years', 'establishing shot for the two fates', 1.8],
  'a2-q': ['eye-level', 50, 'static on the chapter question', 'hold still so the question can be read', 0],
  'a2-y1': ['eye-level', 50, 'dolly in to the first bar pair, then rack focus to the mirror bar', 'year one is where the paths split; focus follows the sentence', 0.8],
  'a2-gap1': ['slightly high', 35, 'pull back to both lines', 'show the split already visible after one year', 1.0],
  'a2-infl': ['low', 50, 'crane up with the inflation column', 'inflation rises, the camera rises with it', 1.0],
  'a2-7374': ['eye-level', 35, 'truck right into 1973', 'time moves left to right into the bear market', 1.0],
  'a2-1974inf': ['eye-level', 85, 'push in on the two 1974 figures', 'the loss and the inflation hit together', 0.6],
  'a2-bal74': ['eye-level', 85, 'slow push in on the balance card', 'the decisive balance needs the full frame', 0.8],
  'a2-bal74m': ['eye-level', 50, 'truck to the mirror card', 'same year, other retiree, side by side', 0.8],
  'a2-bite': ['slightly high', 50, 'dolly in to the shrinking ring', 'show the withdrawal as a bigger bite', 0.9],
  'a2-sell': ['eye-level', 85, 'static close on the withdrawn coins', 'mechanism beat, no distraction from motion', 0],
  'a2-7576': ['low', 35, 'crane up as the light warms', 'hope returns for a moment, lift the frame', 0.9],
  'a2-7576n': ['eye-level', 85, 'push in on the two good-year figures', 'the gains are real, read them close', 0.6],
  'a2-7576b': ['slightly high', 50, 'pull back to the smaller balance', 'context: the gains compound on less', 0.8],
  'a2-grind': ['low', 35, 'crane up along the inflation wall', 'the grind of rising prices', 1.0],
  'a2-1979': ['eye-level', 85, 'static close on the 1979 inflation figure', 'let the peak inflation number sit', 0],
  'a2-1981': ['eye-level', 85, 'push in on the nominal withdrawal', 'make the size of the 1981 withdrawal felt', 0.6],
  'a2-1982': ['high', 24, 'crane down as light rises on 1982', 'the turn of act two gets its own wide', 1.4],
  'a2-1982r': ['eye-level', 50, 'dolly in to the 1982 bar', 'the good year for the 1966 retiree', 0.7],
  'a2-1982w': ['eye-level', 85, 'rack focus from the gain to the withdrawal share', 'undercut the good news at the turn', 0.6],
  'a2-late': ['slightly high', 35, 'slow pull back from the 1966 line', 'distance for a sober beat', 0.9],
  'a2-mirror-boom': ['eye-level', 35, 'truck left along the mirror line', 'the same years sit early on the mirror path', 0.9],
  'a2-seq': ['eye-level', 50, 'slow push in on the term card', 'the idea gets a name, give it the frame', 0.6, 'center'],
  'a2-climb': ['eye-level', 50, 'push in on the widening gap', 'acceleration toward the climax', 0.5],
  'a2-climax-in': ['low', 85, 'fast push in on 1986', 'tension peak, short and close', 0.4],
  'a2-climax': ['eye-level', 85, 'hold, micro push on the gap figure', 'climax number held still for reading', 0.3],
  'a2-years': ['eye-level', 50, 'pull back across the stacked years', 'translate the gap into years of spending', 0.9],
  'a2-rest': ['high', 24, 'slow crane up and away', 'valley after the climax, room to breathe', 1.6],
  'a2-mirror-late': ['eye-level', 35, 'truck right to 1987 on the mirror path', 'the bad year arrives late for the mirror', 1.0],
  'a2-1991': ['eye-level', 85, 'slow push in on the empty account', 'payoff of act two, the account reaches zero', 0.8],
  'a2-short': ['eye-level', 50, 'static on the empty years', 'the missing years should sit still and empty', 0],
  'a2-mirror-end': ['eye-level', 50, 'truck right to the end of 1995', 'reach the end of the thirty years', 0.9],
  'a2-mirror-real': ['eye-level', 85, 'rack focus from nominal to real figure', 'convert the ending to 1966 dollars', 0.6],
  'a2-payoff': ['eye-level', 35, 'slow dolly out to both averages', 'callback frame to the equal averages', 1.0, 'center'],
  // ---- act 3
  'a3-est': ['top-down', 24, 'crane up to the map of start years', 'establishing shot of every start year', 1.8],
  'a3-all': ['high', 35, 'truck right across the map, 1928 to 1996', 'scan all 69 start years left to right', 1.4],
  'a3-q': ['eye-level', 50, 'static on the chapter question', 'hold still so the question can be read', 0],
  'a3-fine': ['high', 35, 'slow orbit over the map', 'most cells survive, show the whole field', 1.2],
  'a3-good': ['eye-level', 85, 'push in on the 1982 cell', 'one good start year up close', 0.7],
  'a3-1929': ['eye-level', 50, 'truck left to 1929', 'a start year near the crash, back in time', 1.0],
  'a3-nohurt': ['high', 35, 'pull back over the bright cells', 'order did no harm for many start years', 1.0],
  'a3-less': ['high', 35, 'pedestal down to the threshold line', 'surviving versus ending below the start', 0.9],
  'a3-four': ['eye-level', 50, 'dolly in to the dark cells', 'the four failures come into view', 0.8],
  'a3-four2': ['eye-level', 85, 'rack focus across the dark cells', 'complete the list cell by cell', 0.6],
  'a3-avg-not': ['slightly high', 35, 'orbit to the averages scatter', 'turn of act three begins: averages', 1.0],
  'a3-real66': ['eye-level', 50, 'push in on the 1966 dot', 'locate 1966 among the averages', 0.7],
  'a3-1969': ['eye-level', 50, 'truck between the 1969 and 1928 dots', 'compare two averages side by side', 0.9],
  'a3-1928': ['eye-level', 85, 'rack focus from 1928 to 1969', 'the paradox: higher average, worse fate', 0.6],
  'a3-share': ['high', 24, 'crane down onto the first-decade bars', 'act three turn gets its own wide', 1.4],
  'a3-decade': ['eye-level', 50, 'truck right along the ten first-decade bars', 'the first decade drawn in time order', 0.9],
  'a3-1966d': ['eye-level', 85, 'push in on the 1966 first-decade figure', 'decisive number at close range', 0.6],
  'a3-mirror-d': ['eye-level', 85, 'rack focus to the mirror first decade', 'contrast of the two first decades', 0.6],
  'a3-answer': ['eye-level', 35, 'dolly in on the answer card', 'the answer to the opening question', 0.8, 'center'],
  'a3-nuance': ['slightly high', 35, 'pull back to the full scatter', 'precision needs the whole picture', 1.0],
  'a3-avg-callback': ['eye-level', 85, 'push in on the fading average', 'last callback of the core number', 0.6],
  'a3-limits': ['eye-level', 50, 'static on the limits list', 'a caveat list must be read calmly', 0],
  'a3-usonly': ['high', 24, 'slow crane up over one country', 'scope of the data: one market', 1.2],
  'a3-overlap': ['eye-level', 50, 'truck right along overlapping windows', 'show the windows share most of their years', 1.0],
  'a3-bare': ['eye-level', 50, 'static on the model list', 'a plain list needs a still frame to read', 0],
  // ---- method, outro
  method: ['eye-level', 50, 'slow push in on the sources card', 'credits must be readable and calm', 0.8],
  'method-model': ['eye-level', 50, 'static on the model card', 'assumptions are read, not watched', 0],
  outro: ['eye-level', 35, 'slow dolly out, leaving the end-screen area clear', 'close the story and free space for end screens', 1.4],
};

const SIZES = ['extreme-wide', 'wide', 'medium', 'close-up', 'extreme-close-up'];
function nextSize(s) { const i = SIZES.indexOf(s); return SIZES[i >= 3 ? i - 1 : i + 1]; }

function forScenes(scenes) {
  const out = {};
  for (const sc of scenes) {
    const base = sc.id.replace(/-[bc]$/, '');
    const r = S[base];
    if (!r) throw new Error('no shot for scene ' + sc.id);
    const [angle, focalMm, move, reason, secs, composition] = r;
    const split = sc.id !== base;
    out[sc.id] = {
      id: 'sh-' + sc.id, scene: sc.id, size: sc.shotSize, angle, focalMm,
      move: split ? 'cut on action to a new size, then hold' : move,
      moveReason: split ? 'a long line needs a second angle to keep attention' : reason,
      moveSeconds: split ? 0 : secs, composition: composition || null,
      lens: `${focalMm} mm (35 mm equivalent, vertical fov ${(2 * Math.atan(12 / focalMm) * 180 / Math.PI).toFixed(1)}°)`,
      depth: 'foreground card / mid chart / background floor and year wall (≥ 3 layers)',
    };
  }
  return out;
}

module.exports = { forScenes, nextSize, SHOTS: S };
