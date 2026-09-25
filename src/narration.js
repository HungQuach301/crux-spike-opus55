'use strict';
// Narration for later TTS (US English). One entry per scene, timed to the scene lengths in
// render/scenes.js. `numbers` maps each spoken number to the claim it comes from; the test
// suite checks the phrase is in the text and the claim value matches.
module.exports = [
  { scene: 'title', text: 'Mortgage points. How long do we need to keep the home before they pay for themselves? US data only.', numbers: [] },
  { scene: 'assume', text: 'What we assume: a four hundred thousand dollar, thirty-year fixed loan at seven point oh three percent, the Freddie Mac average for September twenty-fourth. One point costs one percent.',
    numbers: [['four hundred thousand dollar', 'principal', 400000], ['thirty-year', 'term_years', 30], ['seven point oh three percent', 'base_rate', 7.03], ['September twenty-fourth', 'rate_date', '2026-09-24'], ['one percent', 'point_pct', 1]] },
  { scene: 'example', text: 'One case: one point, four thousand dollars, for a quarter point off the rate. The payment falls by sixty-six dollars ninety a month. Four thousand divided by that is sixty months, five years.',
    numbers: [['four thousand dollars', 'ex_cost', 4000], ['a quarter point', 'ex_cut', 0.25], ['sixty-six dollars ninety', 'ex_saving', 66.9], ['sixty months', 'ex_months', 60], ['five years', 'ex_years', 60]] },
  { scene: 'tableA', text: 'Counting payments only, the number of points barely matters: within any column, break-even moves by one month at most. The cut per point sets it: ten years, five, or about three.',
    numbers: [['one month', 'spread_months', 1], ['ten years', 'th_a_0.125', 120]] },
  { scene: 'tableB', text: 'Now give the upfront cash another use: earning five percent a year. Each break-even gets longer. At a ten-year hold, six of eighteen answers flip. Payments say the points have paid off; with the return counted, not yet.',
    numbers: [['five percent', 'return_pct', 5], ['ten-year hold', 'hold_years', 10], ['six of eighteen', 'flip_count', 6], ['of eighteen', 'cell_count', 18]] },
  { scene: 'chart', text: 'One of them: one point at an eighth of a percent off. Payments alone break even at ten years. With the five percent counted, it takes thirteen point eight. For holds of ten to thirteen years, the two counts disagree.',
    numbers: [['an eighth of a percent', 'ch_cut', 0.125], ['ten years', 'ch_a_years', 120], ['thirteen point eight', 'ch_b_years', 166], ['ten to', 'ch_flip_from', 10], ['to thirteen years', 'ch_flip_to', 13]] },
  { scene: 'close', text: 'Counting the return, the thresholds run from about four years to fourteen. Taxes are left out. The holding period is the one input only the owner knows.',
    numbers: [['about four years', 'th_b_0.375', 45], ['to fourteen', 'th_b_0.125', 167]] },
];
