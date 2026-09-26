'use strict';
// Narration for later TTS (US English), one entry per scene, paced to the scene lengths.
// `numbers`: [spoken phrase, claimId, the claim's on-screen display]. Tests check each phrase is
// in the text and that the claim still displays that value.
module.exports = [
  { scene: 'open', text: 'A car loan at five point two percent. We compared paying it off early with investing the extra cash.', numbers: [['five point two percent', 'apr', '5.2%']] },
  { scene: 'facts', text: 'Twenty-five thousand dollars left at five point two percent, forty-eight monthly payments to go.', numbers: [['Twenty-five thousand dollars', 'balance', '$25,000'], ['forty-eight', 'months', '48']] },
  { scene: 'extra', text: 'Four hundred extra dollars a month.', numbers: [['Four hundred', 'extra', '$400']] },
  { scene: 'roads', text: 'Road A sends it to the loan. Road B pays the minimum and invests it each month.', numbers: [] },
  { scene: 'timeline', text: 'Road A clears the loan at month twenty-eight instead of forty-eight.', numbers: [['twenty-eight', 'payoff_a', '28'], ['forty-eight', 'horizon', '48']] },
  { scene: 'interest', text: 'Interest drops from twenty-seven forty-four to fifteen fifty-four: a certain eleven hundred ninety dollars.', numbers: [['twenty-seven forty-four', 'int_b', '$2,744'], ['fifteen fifty-four', 'int_a', '$1,554'], ['eleven hundred ninety dollars', 'avoided', '$1,190']] },
  { scene: 'scope', text: 'This analysis is US-only, and every input here is stated, not forecast.', numbers: [] },
  { scene: 'tax', text: 'Gains are taxed once, at month forty-eight, at twelve, twenty-two or thirty-two percent.', numbers: [['month forty-eight', 'horizon', '48'], ['twelve', 'tax_12', '12%'], ['twenty-two', 'tax_22', '22%'], ['thirty-two percent', 'tax_32', '32%']] },
  { scene: 'bars', text: 'Left: interest road A avoids. Right: the extra after-tax growth road B earns by investing sooner.', numbers: [] },
  { scene: 'sweep', text: 'We sweep the expected return from two to ten percent, at twenty-two percent tax. Road B\'s bar grows with it, and passes road A\'s line.', numbers: [['two to', 'axis_lo', '2%'], ['ten percent', 'axis_hi', '10%'], ['twenty-two percent tax', 'tax_22', '22%']] },
  { scene: 'settle', text: 'They meet at six point seven oh.', numbers: [['six point seven oh', 'be_22', '6.70%']] },
  { scene: 'morph', text: 'That crossing point.', numbers: [] },
  { scene: 'detail', text: 'Six point seven oh percent is the break-even expected return.', numbers: [['Six point seven oh percent', 'be_22', '6.70%']] },
  { scene: 'flip', text: 'Below it, road A ends ahead at month forty-eight. Above it, road B does.', numbers: [['month forty-eight', 'horizon', '48']] },
  { scene: 'matrix', text: 'Tax moves the threshold: six percent at twelve percent tax, seven point five nine at thirty-two.', numbers: [['six percent', 'be_12', '6.00%'], ['twelve percent tax', 'tax_12', '12%'], ['seven point five nine', 'be_32', '7.59%'], ['thirty-two', 'tax_32', '32%']] },
  { scene: 'matrix32', text: 'The highest threshold.', numbers: [] },
  { scene: 'certain', text: 'The loan payoff return is certain. The investment return is an expectation, not a promise.', numbers: [] },
  { scene: 'sequence', text: 'One stated sequence: eight percent a year, then minus twenty in year four.', numbers: [['eight percent', 'seq_first', '8%'], ['minus twenty', 'seq_second', '−20%'], ['year four', 'seq_year', '4']] },
  { scene: 'race', text: 'We track net worth after tax, month by month. The two roads run almost together for the first three years.', numbers: [] },
  { scene: 'gap', text: 'Now the difference.', numbers: [] },
  { scene: 'cross', text: 'Road B leads early, then drops behind road A from month thirty-eight on.', numbers: [['month thirty-eight', 'cross_month', '38']] },
  { scene: 'downside', text: 'Road A finishes four hundred fifty-nine dollars ahead.', numbers: [['four hundred fifty-nine dollars', 'gap_end', '$459']] },
  { scene: 'converge', text: 'At twenty-two percent tax, the answer flips at six point seven oh percent expected return.', numbers: [['twenty-two percent tax', 'tax_22', '22%'], ['six point seven oh percent', 'be_22', '6.70%']] },
  { scene: 'outro', text: 'That is a threshold, not a forecast. Where a return lands is not known in advance.', numbers: [] },
];
