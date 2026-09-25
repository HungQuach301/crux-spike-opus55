# Script — Buying mortgage points: how long must we keep the home to break even?

US-only. Silent segment; narration below is for later TTS (US English).
On-screen text is exported from the rendered frames (render/export.js), so it matches the video exactly.

## title — 0s to 7s (7s)

**On screen**

- A US-only data analysis
- Mortgage points
- How long must we keep the home to break even?
- $400,000 loan · 30-year fixed · two ways to count
- US only · Base rate 7.03%, Freddie Mac PMMS, week of Sep 24, 2026

**Narration** (19 words, 163 wpm)

> Mortgage points. How long do we need to keep the home before they pay for themselves? US data only.

## assume — 7s to 19s (12s)

**On screen**

- What we assume
- 7.03%
- Average 30-year fixed rate, US
- Freddie Mac PMMS, week of Sep 24, 2026
- Loan
- $400,000, 30-year fixed
- One point
- 1% of the loan = $4,000
- Rate cut per point
- 0.125% to 0.375%
- Points bought
- 0 to 3, in steps of 0.5
- Holding period
- 1 to 15 years
- Return on cash not spent
- 5.00% a year, assumed
- Not modeled
- taxes, closing costs,
- loan balance at sale, refinancing
- Geography
- US only
- US only · Base rate 7.03%, Freddie Mac PMMS, week of Sep 24, 2026

**Narration** (31 words, 155 wpm)

> What we assume: a four hundred thousand dollar, thirty-year fixed loan at seven point oh three percent, the Freddie Mac average for September twenty-fourth. One point costs one percent.

Spoken numbers → claims: "four hundred thousand dollar" → `normal/principal`; "thirty-year" → `normal/term_years`; "seven point oh three percent" → `normal/base_rate`; "September twenty-fourth" → `normal/rate_date`; "one percent" → `normal/point_pct`

## example — 19s to 33s (14s)

**On screen**

- One case: 1.0 point, 0.25% off per point
- Upfront cost
- $4,000
- Payment at 7.03%
- $2,669.27
- Payment at 6.78%
- $2,602.37
- Monthly difference
- $66.90
- 60
- months to break even
- $4,000 ÷ $66.90, rounded up to a whole month: 5.0 years. Payments only; the cash has no other use in this count.
- US only · Base rate 7.03%, Freddie Mac PMMS, week of Sep 24, 2026

**Narration** (34 words, 146 wpm)

> One case: one point, four thousand dollars, for a quarter point off the rate. The payment falls by sixty-six dollars ninety a month. Four thousand divided by that is sixty months, five years.

Spoken numbers → claims: "four thousand dollars" → `normal/ex_cost`; "a quarter point" → `normal/ex_cut`; "sixty-six dollars ninety" → `normal/ex_saving`; "sixty months" → `normal/ex_months`; "five years" → `normal/ex_years`

## tableA — 33s to 46s (13s)

**On screen**

- 1 month
- Payments-only break-even, in years
- Largest shift across 0.5 to 3 points within any column. The rate cut per point moves the break-even; the number of points barely does.
- Points · cost
- 0.125% off
- 0.25% off
- 0.375% off
- 0.5 pt · $2,000
- 10.0
- 5.0
- 3.3
- 1.0 pt · $4,000
- 10.0
- 5.0
- 3.3
- 1.5 pt · $6,000
- 10.0
- 5.0
- 3.4
- 2.0 pt · $8,000
- 10.0
- 5.1
- 3.4
- 2.5 pt · $10,000
- 10.0
- 5.1
- 3.4
- 3.0 pt · $12,000
- 10.0
- 5.1
- 3.4
- US only · Base rate 7.03%, Freddie Mac PMMS, week of Sep 24, 2026

**Narration** (32 words, 148 wpm)

> Counting payments only, the number of points barely matters: within any column, break-even moves by one month at most. The cut per point sets it: ten years, five, or about three.

Spoken numbers → claims: "one month" → `normal/spread_months`; "ten years" → `normal/th_a_0.125`

## tableB — 46s to 61s (15s)

**On screen**

- 6 of 18
- answers flip at a 10-year hold
- Each cell: break-even years, payments only → with a 5.00% return on the upfront cash.
- Points · cost
- 0.125% off
- 0.25% off
- 0.375% off
- 0.5 pt · $2,000
- 10.0 → 13.8
- 5.0 → 5.8
- 3.3 → 3.7
- 1.0 pt · $4,000
- 10.0 → 13.8
- 5.0 → 5.8
- 3.3 → 3.7
- 1.5 pt · $6,000
- 10.0 → 13.8
- 5.0 → 5.8
- 3.4 → 3.7
- 2.0 pt · $8,000
- 10.0 → 13.8
- 5.1 → 5.8
- 3.4 → 3.8
- 2.5 pt · $10,000
- 10.0 → 13.9
- 5.1 → 5.8
- 3.4 → 3.8
- 3.0 pt · $12,000
- 10.0 → 13.9
- 5.1 → 5.8
- 3.4 → 3.8
- flip: break-even by year 10 on payments, not yet once the cash could earn 5.00%
- US only · Base rate 7.03%, Freddie Mac PMMS, week of Sep 24, 2026

**Narration** (40 words, 160 wpm)

> Now give the upfront cash another use: earning five percent a year. Each break-even gets longer. At a ten-year hold, six of eighteen answers flip. Payments say the points have paid off; with the return counted, not yet.

Spoken numbers → claims: "five percent" → `normal/return_pct`; "ten-year hold" → `normal/hold_years`; "six of eighteen" → `normal/flip_count`; "of eighteen" → `normal/cell_count`

## chart — 61s to 76s (15s)

**On screen**

- 10.0 → 13.8
- Years to break even for 1.0 point at 0.125% off ($4,000, saves $33.53 a month): payments only → with a 5.00% return on the cash.
- $0
- 0
- 5
- 10
- 15
- years held
- −$4,000
- flips for holds of 10 to 13 years
- Payments only +$2,035
- With return on cash +$507
- US only · Base rate 7.03%, Freddie Mac PMMS, week of Sep 24, 2026

**Narration** (40 words, 160 wpm)

> One of them: one point at an eighth of a percent off. Payments alone break even at ten years. With the five percent counted, it takes thirteen point eight. For holds of ten to thirteen years, the two counts disagree.

Spoken numbers → claims: "an eighth of a percent" → `normal/ch_cut`; "ten years" → `normal/ch_a_years`; "thirteen point eight" → `normal/ch_b_years`; "ten to" → `normal/ch_flip_from`; "to thirteen years" → `normal/ch_flip_to`

## close — 76s to 86s (10s)

**On screen**

- 13.9 years
- longest hold needed to break even
- At 0.125% off per point, with a 5.00% return on the upfront cash. Longest value across 0.5 to 3 points.
- Rate cut per point
- Payments only
- With return on cash
- 0.125% off
- 10.0 years
- 13.9 years
- 0.25% off
- 5.1 years
- 5.8 years
- 0.375% off
- 3.4 years
- 3.8 years
- Not modeled: taxes, closing costs, loan balance at sale, refinancing.
- The holding period is the one input only the owner knows.
- US only · Base rate 7.03%, Freddie Mac PMMS, week of Sep 24, 2026

**Narration** (27 words, 162 wpm)

> Counting the return, the thresholds run from about four years to fourteen. Taxes are left out. The holding period is the one input only the owner knows.

Spoken numbers → claims: "about four years" → `normal/th_b_0.375`; "to fourteen" → `normal/th_b_0.125`

## Pace

Total narration: 223 words over 86s = 155.6 wpm (target 150–160).
