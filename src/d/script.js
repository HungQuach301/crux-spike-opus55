'use strict';
// Test D script: "Same average, different fate". Acts -> scenes -> sentences.
// `t` = on-screen/subtitle text (numbers as digits); `d` = performance direction for this sentence
// (emotion, pauses, emphasis) sent to TTS; `decisive` = the sentence ends on a decisive number (≥ 1 s of
// silence follows it). Scene fields: layout (family/variant), shot (size), lead = seconds of picture
// before the first word, hold = seconds after the last word, cut = transition into the scene.
// Every number in `t` is a claim (src/d/claims.js). "We" = the analyst only; no advice, no forecast.

const ACTS = [
  {
    id: 'cold-open', title: 'Cold open', question: 'What decided which retiree went broke?',
    scenes: [
      { id: 'co-lines', layout: 'duel/emerge', shot: 'extreme-wide', lead: 1.6, lines: [] },
      { id: 'co-same', layout: 'duel/overlay', shot: 'wide', lines: [
        { t: 'Two retirees with the same balance, the same withdrawals and the same average return.', d: 'Quiet, close to the mic, one flowing line at an even pace; no pauses between the phrases.' },
      ] },
      { id: 'co-broke', layout: 'duel/split', shot: 'medium', hold: 1.2, lines: [
        { t: 'One ran out of money in 1991.', d: 'Flat, factual. Stress "ran out". Full stop, then silence.', decisive: true },
      ] },
      { id: 'co-question', layout: 'duel/split', shot: 'close-up', hold: 0.2, lines: [
        { t: 'So what decided it?', d: 'A real question, curious, not dramatic. Rising end.' },
      ] },
    ],
  },
  {
    id: 'ident', title: 'Ident', scenes: [
      { id: 'ident', layout: 'title/ident', shot: 'insert', lead: 2.2, lines: [] },
    ],
  },
  {
    id: 'act1', title: 'Two retirees, one set of rules',
    question: 'If two people earn the same average return, do they end up in the same place?',
    turn: 'The mirror retiree takes out the same dollars and earns the same average; only the order differs.',
    payoff: 'Everything is equal except the order of the years.',
    scenes: [
      { id: 'a1-est', layout: 'world/establish', shot: 'extreme-wide', lead: 0.7, lines: [
        { t: 'It is January 1966.', d: 'Scene-setting, unhurried. Small pause after.' },
      ] },
      { id: 'a1-start', layout: 'ledger/card', shot: 'medium', lines: [
        { t: 'The first retiree starts with $1 million, measured in 1966 dollars.', d: 'Warm, plain. Stress "one million". "Measured in 1966 dollars" softer, as a footnote.' },
      ] },
      { id: 'a1-who', layout: 'ledger/card', shot: 'close-up', lines: [
        { t: 'They retire at the start of a hard decade for markets, though nobody knows it yet.', sp: 'They retire at the start of a hard decade for markets... though nobody knows it yet.', d: 'Quiet dramatic irony, a touch slower on "nobody knows that yet".' },
      ] },
      { id: 'a1-hook', layout: 'promise/card', shot: 'wide', lines: [
        { t: 'By the end of this video, you will know which ten years decided the fate of this retiree, and whether the same thing held for every start year since 1928.', sp: 'By the end of this video, you will know which ten years decided the fate of this retiree... and whether the same thing held, for every start year since 1928.', d: 'The promise. Clear and concrete, a little forward lean. Breathe at the comma.' },
      ] },
      { id: 'a1-mix', layout: 'donut/split', shot: 'medium', lines: [
        { t: 'The money sits in a portfolio of 60% stocks and 40% bonds.', d: 'Matter-of-fact, even pace on the two numbers.' },
      ] },
      { id: 'a1-assets', layout: 'donut/detail', shot: 'close-up', lines: [
        { t: 'The stocks are the Standard & Poor\'s 500 index, with dividends reinvested.', d: 'Neutral, clear.' },
        { t: 'The bonds are 10-year US Treasury bonds.', d: 'Same register.' },
      ] },
      { id: 'a1-rebal', layout: 'donut/rebalance', shot: 'medium', lines: [
        { t: 'Every January, the portfolio is rebalanced back to that mix.', d: 'Light, procedural.' },
      ] },
      { id: 'a1-rule', layout: 'rules/card', shot: 'medium', lines: [
        { t: 'In the first year, the retiree withdraws 4% of the starting balance.', d: 'Stress "first year". Not a recommendation: descriptive, cool.' },
        { t: 'That is $40,000, in 1966 dollars.', d: 'Short. Let the number sit.' },
      ] },
      { id: 'a1-raise', layout: 'rules/escalator', shot: 'wide', lines: [
        { t: 'After that, the withdrawal rises each year with the previous year\'s inflation, so it always buys the same groceries.', d: 'Explaining, friendly. Slight smile on "groceries".' },
      ] },
      { id: 'a1-real', layout: 'rules/constant', shot: 'close-up', lines: [
        { t: 'In real terms, it never changes.', d: 'Short, firm.' },
        { t: 'In nominal terms, the dollars of the day, it climbs every year.', d: 'Contrast with the previous line; stress "nominal".' },
      ] },
      { id: 'a1-horizon', layout: 'timeline/ribbon', shot: 'extreme-wide', lines: [
        { t: 'The plan runs for 30 years, from 1966 through 1995.', d: 'Spacious, a long horizon. Slow down slightly.' },
      ] },
      { id: 'a1-notax', layout: 'rules/list', shot: 'medium', lines: [
        { t: 'No taxes, no fees.', d: 'Crisp, two beats.' },
        { t: 'We keep the model this bare on purpose, so that one thing can change at a time.', d: 'Analyst voice, candid. "We" is the analyst.' },
      ] },
      { id: 'a1-mirror-in', layout: 'mirror/enter', shot: 'wide', lead: 0.6, lines: [
        { t: 'Now meet the second retiree.', d: 'A small turn in tone, intrigue.' },
      ] },
      { id: 'a1-mirror-rule', layout: 'mirror/reverse', shot: 'medium', lines: [
        { t: 'The mirror retiree lives through the exact same 30 annual returns, but in reverse order.', d: 'Precise. Stress "exact same" and "reverse".' },
        { t: 'The return of 1995 arrives first, and the return of 1966 arrives last.', d: 'Walk through it slowly, like laying cards.' },
      ] },
      { id: 'a1-illus', layout: 'mirror/badge', shot: 'close-up', lines: [
        { t: 'This retiree is illustrative: no one lived through these years in this order.', d: 'Honest aside, slightly lower.' },
      ] },
      { id: 'a1-samewd', layout: 'ledger/twin', shot: 'medium', lines: [
        { t: 'Inflation stays in its real calendar order, so both retirees take out the same dollars every year.', d: 'Careful, a clarifying point. Stress "same dollars".' },
      ] },
      { id: 'a1-question', layout: 'duel/scale', shot: 'wide', lines: [
        { t: 'Here is the question this first part answers.', sp: 'Here is the question... this first part answers.', d: 'Framing, slower.' },
        { t: 'If two people earn the same average return, do they end up in the same place?', sp: 'If two people earn the same average return... do they end up, in the same place?', d: 'Genuine question, open, rising end.' },
      ] },
      { id: 'a1-avg1966', layout: 'average/reveal', shot: 'close-up', hold: 1.1, lines: [
        { t: 'The portfolio of the 1966 retiree earned an average return of 9.7%.', d: 'Reveal. Stress "nine point seven". Pause after.' },
      ] },
      { id: 'a1-avgmirror', layout: 'average/match', shot: 'close-up', lines: [
        { t: 'For the mirror retiree, the average is also 9.7%.', d: 'Same melody as the previous line, as an echo.' },
        { t: 'Not close.', d: 'Short, dry.' },
        { t: 'Identical.', d: 'Beat. Land it.' },
      ] },
      { id: 'a1-geo', layout: 'average/explain', shot: 'medium', lines: [
        { t: 'That is the geometric average, the compound rate that turns the starting dollar into the ending dollar.', d: 'Teacherly, calm; define it cleanly.' },
        { t: 'Multiplication does not care about order, so the same years in any order give the same average.', d: 'Light, almost playful logic.' },
      ] },
      { id: 'a1-arith', layout: 'average/table', shot: 'medium', lines: [
        { t: 'Even the simple arithmetic average, adding up the 30 returns and dividing by 30, is the same for both: 10.3%.', d: 'Brisk aside, a footnote with a smile.' },
      ] },
      { id: 'a1-payoff', layout: 'duel/scale', shot: 'wide', variant: 2, hold: 1.0, lines: [
        { t: 'Same money in.', d: 'Beat.' },
        { t: 'Same money out.', d: 'Beat.' },
        { t: 'Same average.', d: 'Beat.' },
        { t: 'The only thing that differs is the order.', d: 'Slow, the thesis. Stress "order".' },
      ] },
    ],
  },
  {
    id: 'act2', title: 'Two fates',
    question: 'When does the order start to matter, and how much does it cost?',
    turn: '1982: the good years finally reach the 1966 retiree, but the withdrawals now eat a much bigger share of a smaller balance.',
    payoff: 'The 1966 retiree runs out in 1991; the mirror ends with more real money than they started with.',
    scenes: [
      { id: 'a2-est', layout: 'world/road', shot: 'extreme-wide', lead: 1.6, lines: [
        { t: 'Watch the two balances year by year.', d: 'Inviting, fresh start of a chapter.' },
      ] },
      { id: 'a2-q', layout: 'question/card', shot: 'medium', lines: [
        { t: 'The question now: when does the order start to matter, and how much does it cost?', d: 'Chapter question, clear.' },
      ] },
      { id: 'a2-y1', layout: 'duel/bars', shot: 'medium', lines: [
        { t: 'Year one.', d: 'Short, a marker.' },
        { t: 'The 1966 retiree loses 4.8%.', d: 'Neutral, slight weight on "loses".' },
        { t: 'The mirror retiree gets the 1995 return first: a gain of 31.7%.', d: 'Brighter, but restrained.' },
      ] },
      { id: 'a2-gap1', layout: 'duel/lines', shot: 'wide', lines: [
        { t: 'One year in, and the paths have already split.', d: 'Observational.' },
      ] },
      { id: 'a2-infl', layout: 'escalator/rise', shot: 'medium', lines: [
        { t: 'Then inflation starts to climb.', d: 'A shade darker.' },
        { t: 'By 1969 it is 6.2% a year, and every withdrawal grows with it.', d: 'Even, stress "every withdrawal".' },
      ] },
      { id: 'a2-7374', layout: 'duel/lines', shot: 'medium', variant: 2, lines: [
        { t: 'In 1973 and 1974, stocks and bonds fall together.', d: 'Grave, steady.' },
      ] },
      { id: 'a2-1974inf', layout: 'escalator/peak', shot: 'close-up', lines: [
        { t: 'In 1974 alone, the portfolio loses 14.7%, while prices rise 12.3%.', d: 'Two hits, one sentence; do not rush the numbers.' },
      ] },
      { id: 'a2-bal74', layout: 'ledger/drop', shot: 'close-up', hold: 1.1, lines: [
        { t: 'In 1966 dollars, the 1966 retiree ends 1974 with $461,000.', d: 'Quiet weight. Stress the number, then a real pause.', decisive: true },
      ] },
      { id: 'a2-bal74m', layout: 'ledger/twin', shot: 'medium', lines: [
        { t: 'The mirror retiree, same year, same withdrawals: $1.27 million, also in 1966 dollars.', d: 'Contrast, measured.' },
      ] },
      { id: 'a2-bite', layout: 'donut/bite', shot: 'medium', lines: [
        { t: 'Here is why a bad start is so hard to undo.', d: 'Leaning in, explanatory.' },
        { t: 'The withdrawal is still $40,000 in 1966 dollars, but it is now taken from a much smaller pile.', d: 'Build through the sentence; stress "much smaller".' },
      ] },
      { id: 'a2-sell', layout: 'donut/bite', shot: 'close-up', variant: 2, lines: [
        { t: 'Every dollar withdrawn after a loss is a dollar that is not there when the recovery comes.', d: 'Slow, the mechanism. Even stress.' },
      ] },
      { id: 'a2-seq', layout: 'title/term', shot: 'medium', lines: [
        { t: 'Analysts call this sequence-of-returns risk.', d: 'Naming the idea, neutral, not academic.' },
      ] },
      { id: 'a2-7576', layout: 'duel/bars', shot: 'medium', variant: 3, lines: [
        { t: 'Good years do come.', d: 'A lift, hopeful.' },
      ] },
      { id: 'a2-7576n', layout: 'duel/bars', shot: 'close-up', variant: 4, lines: [
        { t: 'In 1975 the portfolio gains 23.6%, and in 1976 another 20.7%.', d: 'Brighter, steady on the numbers.' },
      ] },
      { id: 'a2-7576b', layout: 'ledger/drop', shot: 'medium', variant: 2, lines: [
        { t: 'But they compound on a balance that has already been cut, while the withdrawals keep rising.', d: 'The hope undercut, calm.' },
      ] },
      { id: 'a2-grind', layout: 'escalator/grind', shot: 'medium', lines: [
        { t: 'Through the rest of the decade, inflation keeps rising.', d: 'Grinding, patient.' },
      ] },
      { id: 'a2-1979', layout: 'escalator/peak', shot: 'close-up', variant: 2, lines: [
        { t: 'In 1979 it reaches 13.3%.', d: 'Flat statement.' },
      ] },
      { id: 'a2-1981', layout: 'ledger/climb', shot: 'close-up', lines: [
        { t: 'By 1981, the yearly withdrawal has grown to $108,553 in nominal dollars.', d: 'Stress the size of the number, not dramatic.' },
        { t: 'In 1966 dollars, it is still $40,000.', d: 'Gentle reminder, callback tone.' },
      ] },
      { id: 'a2-1982', layout: 'world/dawn', shot: 'wide', lead: 0.5, lines: [
        { t: 'Then, in 1982, the good years finally arrive.', d: 'The turn. Lift the tone a little.' },
      ] },
      { id: 'a2-1982r', layout: 'duel/bars', shot: 'medium', variant: 2, lines: [
        { t: 'That year the 1966 retiree gains 25.4%.', d: 'Positive, but not celebratory.' },
      ] },
      { id: 'a2-1982w', layout: 'ledger/share', shot: 'close-up', lines: [
        { t: 'But the withdrawal now takes 16.9% of what is left.', d: 'Undercut the good news. Stress "sixteen point nine".' },
      ] },
      { id: 'a2-late', layout: 'duel/lines', shot: 'wide', variant: 3, lines: [
        { t: 'The boom comes too late.', d: 'Short. Heavy.' },
      ] },
      { id: 'a2-mirror-boom', layout: 'duel/lines', shot: 'medium', variant: 4, lines: [
        { t: 'For the mirror retiree, those same years came first, when the balance was largest.', d: 'Explaining the contrast, smooth.' },
      ] },
      { id: 'a2-climb', layout: 'gap/widen', shot: 'close-up', lines: [
        { t: 'The gap widens every year.', d: 'Tighter, faster.' },
      ] },
      { id: 'a2-climax-in', layout: 'gap/peak', shot: 'extreme-close-up', lines: [
        { t: 'In 1986 it peaks.', d: 'Quick, tense.' },
      ] },
      { id: 'a2-climax', layout: 'gap/number', shot: 'extreme-close-up', hold: 1.3, lines: [
        { t: 'In 1966 dollars, the mirror retiree is now ahead by $1.96 million.', d: 'Climax. Slow down, stress each part of the number, then silence.', decisive: true },
      ] },
      { id: 'a2-years', layout: 'ledger/years', shot: 'medium', lines: [
        { t: 'At $40,000 a year in 1966 dollars, that gap would pay for 49 more years of withdrawals.', d: 'Concrete, slower; make the size felt.' },
      ] },
      { id: 'a2-rest', layout: 'world/rest', shot: 'extreme-wide', lead: 1.4, lines: [
        { t: 'From there, the story of the 1966 retiree is short.', d: 'Soft, after the storm. Slower.' },
      ] },
      { id: 'a2-mirror-late', layout: 'duel/lines', shot: 'wide', variant: 5, lines: [
        { t: 'The mirror retiree meets the bad years late: the 1974 loss arrives in 1987, on a balance big enough to absorb it.', d: 'Even, explanatory.' },
      ] },
      { id: 'a2-1991', layout: 'ledger/zero', shot: 'close-up', hold: 1.2, lines: [
        { t: 'The account pays out its last $96,829, in nominal dollars, and hits zero in 1991.', d: 'Plain, almost gentle. Stress the year. Silence after.', decisive: true },
      ] },
      { id: 'a2-short', layout: 'ledger/missing', shot: 'medium', lines: [
        { t: 'That last payment is short of the full withdrawal, and the final 4 years of the plan get nothing.', d: 'Quiet consequence.', claims: { 4: 'emptyYears' } },
      ] },
      { id: 'a2-mirror-end', layout: 'ledger/twin', shot: 'medium', variant: 2, lines: [
        { t: 'The mirror retiree finishes 1995 with $6.96 million in nominal dollars.', d: 'Neutral statement.' },
      ] },
      { id: 'a2-mirror-real', layout: 'ledger/real', shot: 'close-up', lines: [
        { t: 'In 1966 dollars that is $1.44 million, more than the starting balance, after 30 years of withdrawals.', d: 'Stress "more than". Measured.' },
      ] },
      { id: 'a2-payoff', layout: 'average/echo', shot: 'wide', hold: 1.0, lines: [
        { t: 'Both portfolios averaged 9.7% a year.', d: 'The callback. Slow and flat, let the irony carry itself.' },
        { t: 'The average did not decide who went broke.', d: 'Clear, final.' },
      ] },
    ],
  },
  {
    id: 'act3', title: 'Every start year',
    question: 'Was 1966 a fluke, and what actually decides the outcome?',
    turn: 'The four failures share one thing: a first decade that lost money after inflation. The 30-year average does not separate them.',
    payoff: 'The first decade decides whether a retiree survives long enough for the average to count; the limits of the analysis.',
    scenes: [
      { id: 'a3-est', layout: 'map/establish', shot: 'extreme-wide', lead: 1.6, lines: [
        { t: 'So was 1966 a fluke?', d: 'New chapter, open question, unhurried.' },
      ] },
      { id: 'a3-all', layout: 'map/grid', shot: 'wide', lines: [
        { t: 'We ran the same rules for every start year from 1928 to 1996.', d: 'Analyst voice, even.' },
        { t: 'That is 69 retirements, each with 30 years of data.', d: 'Stress "sixty-nine".' },
      ] },
      { id: 'a3-q', layout: 'question/card', shot: 'medium', variant: 2, lines: [
        { t: 'The question for this part: what actually decides the outcome?', d: 'Chapter question.' },
      ] },
      { id: 'a3-fine', layout: 'map/scan', shot: 'medium', lines: [
        { t: 'Most of these retirees never ran out.', d: 'Reassuring but factual.' },
        { t: 'In 65 of the 69 start years, the money lasted all 30 years.', d: 'Even, clear.' },
      ] },
      { id: 'a3-good', layout: 'map/focus', shot: 'close-up', lines: [
        { t: 'A retiree who started in 1982 under the same rules ended with $5.36 million in 1982 dollars.', d: 'Bright, one example. Stress "1982 dollars" lightly.' },
      ] },
      { id: 'a3-1929', layout: 'map/focus', shot: 'medium', variant: 2, lines: [
        { t: 'Even a retiree who started in 1929, the year of the crash, never ran out.', d: 'Surprise, understated.' },
        { t: 'Prices fell through the Depression, so the withdrawals shrank, and after inflation the first decade still averaged 3.9% a year.', d: 'Explaining, patient; stress "after inflation".' },
      ] },
      { id: 'a3-nohurt', layout: 'map/scan', shot: 'wide', variant: 2, lines: [
        { t: 'For many start years, the order of returns did no harm at all.', d: 'Fair-minded.' },
      ] },
      { id: 'a3-less', layout: 'map/threshold', shot: 'medium', lines: [
        { t: 'Surviving is not the same as thriving.', d: 'Short, wry.' },
        { t: 'In 26 of the 69 start years, the retiree ended with less than the starting balance, after inflation.', d: 'Even, factual.' },
      ] },
      { id: 'a3-four', layout: 'map/highlight', shot: 'medium', lines: [
        { t: '4 start years ran out of money, beginning with 1965 and 1966.', d: 'Slow, equal weight on each year.', claims: { 4: 'n4' } },
      ] },
      { id: 'a3-four2', layout: 'map/highlight', shot: 'close-up', variant: 2, lines: [
        { t: 'Then 1968 and 1969.', d: 'Completing the list, quieter.' },
      ] },
      { id: 'a3-avg-not', layout: 'scatter/avg', shot: 'medium', lines: [
        { t: 'Their long-run averages do not single them out.', d: 'The turn begins. Curious.' },
      ] },
      { id: 'a3-real66', layout: 'scatter/rank', shot: 'medium', lines: [
        { t: 'After inflation, the 1966 retiree averaged 4.1% a year over all 30 years.', d: 'Precise, stress "after inflation".' },
        { t: '17 start years had a lower real average than that, and never ran out.', d: 'Stress "lower" and "never".' },
      ] },
      { id: 'a3-1969', layout: 'scatter/pair', shot: 'close-up', lines: [
        { t: 'After inflation, the 1969 retiree averaged 5.6% a year.', d: 'Careful, even.' },
        { t: 'The 1928 retiree averaged less: 4.9%.', d: 'Stress "less".' },
      ] },
      { id: 'a3-1928', layout: 'scatter/pair', shot: 'medium', variant: 2, lines: [
        { t: 'Yet 1928 ended with $1.21 million in 1928 dollars, and 1969 ran out of money in its 28th year.', d: 'The paradox; slow down on the second half.' },
      ] },
      { id: 'a3-share', layout: 'decade/reveal', shot: 'wide', lead: 0.4, lines: [
        { t: 'What the four failures share is their first decade.', d: 'The answer arriving. Stress "first decade".' },
      ] },
      { id: 'a3-decade', layout: 'decade/bars', shot: 'medium', lines: [
        { t: 'In every one of them, the portfolio lost money after inflation over its first 10 years.', d: 'Firm, even.' },
      ] },
      { id: 'a3-1966d', layout: 'decade/bars', shot: 'close-up', variant: 2, hold: 1.0, lines: [
        { t: 'After inflation, the first decade of the 1966 retiree averaged −1.8%.', d: 'Heavy, slow. Pause after.', decisive: true },
      ] },
      { id: 'a3-mirror-d', layout: 'decade/twin', shot: 'close-up', lines: [
        { t: 'In the first decade, the mirror retiree averaged 6.9% a year after inflation.', d: 'Contrast, lighter.' },
      ] },
      { id: 'a3-answer', layout: 'answer/card', shot: 'medium', lines: [
        { t: 'So, what decided it?', d: 'Callback to the opening question. Beat.' },
        { t: 'Not the average.', d: 'Short.' },
        { t: 'The first 10 years.', d: 'Land it, slow.' },
      ] },
      { id: 'a3-nuance', layout: 'scatter/all', shot: 'wide', lines: [
        { t: 'To be precise: across all 69 start years, the 30-year real return still lines up best with how much is left at the end.', d: 'Scrupulous, analytic. Not defensive.' },
        { t: 'But every retiree who ran out met a bad first decade.', d: 'Stress "every".' },
      ] },
      { id: 'a3-avg-callback', layout: 'average/ghost', shot: 'close-up', hold: 1.1, lines: [
        { t: 'The 9.7% average described the 1966 retiree perfectly, and it said nothing about 1991.', d: 'The third meaning of the core number. Wry, quiet. Silence after.', decisive: true },
      ] },
      { id: 'a3-limits', layout: 'limits/list', shot: 'medium', lead: 0.4, lines: [
        { t: 'Now the limits of this analysis.', sp: 'Now... the limits of this analysis.', d: 'Change of register, straightforward.' },
        { t: 'This is history, not a forecast.', d: 'Plain, deliberate.' },
      ] },
      { id: 'a3-usonly', layout: 'limits/globe', shot: 'wide', lines: [
        { t: 'It is US only, one country with one set of markets.', d: 'Neutral.' },
      ] },
      { id: 'a3-overlap', layout: 'limits/overlap', shot: 'medium', lines: [
        { t: 'The 69 windows overlap, so 98 years of data hold only 3 separate 30-year stretches.', d: 'Careful, a statistical caveat; do not rush.' },
      ] },
      { id: 'a3-bare', layout: 'limits/list', shot: 'close-up', variant: 2, lines: [
        { t: 'And the model is bare: no taxes, no fees, one portfolio mix and one withdrawal rule.', d: 'List rhythm, light.' },
        { t: 'Change any of those, and every number here changes too.', d: 'Final caveat, open.' },
      ] },
    ],
  },
  {
    id: 'method', title: 'Method',
    scenes: [
      { id: 'method', layout: 'method/sources', shot: 'medium', lead: 0.8, lines: [
        { t: 'The data: annual returns compiled at NYU Stern, and consumer prices from the Bureau of Labor Statistics via FRED.', d: 'Credits voice: clear, neutral, steady.' },
      ] },
      { id: 'method-model', layout: 'method/model', shot: 'close-up', hold: 2.4, lines: [
        { t: 'Returns include dividends and bond coupons, and the portfolio is rebalanced once a year.', d: 'Neutral.' },
        { t: 'Every number and formula is listed in the description.', d: 'Light.' },
      ] },
    ],
  },
  {
    id: 'outro', title: 'Outro',
    scenes: [
      { id: 'outro', layout: 'end/screen', shot: 'wide', lead: 1.0, hold: 17.0, lines: [
        { t: 'Two retirees, one average, and a fate decided by the order of the years.', d: 'Closing line, warm and slow. Let the music take over after.' },
      ] },
    ],
  },
];

module.exports = { ACTS };
