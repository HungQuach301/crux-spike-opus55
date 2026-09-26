# Script — Pay off a 5.2% car loan early, or invest the cash?

US-only. No narration was recorded in this spike; the narration below is written for later TTS (US English) and paced per scene.
On-screen text is exported from the rendered frames (render-motion/export.js). SFX cues come from the shared timeline (src/car/timeline.js).

## 01 open — 0:00.0–0:07.8 (7.8 s, 13 beats) · wide · two-roads/fork · setup

**On screen**

- 5.2%
- car loan: pay off early, or invest?
- US only

**Sound** appear×2

**Narration** (19 words, 146 wpm)

> A car loan at five point two percent. We compared paying it off early with investing the extra cash.

Spoken numbers → claims: "five point two percent" → `apr` (5.2%)

## 02 facts — 0:07.8–0:13.8 (6.0 s, 10 beats) · medium · hero-number/with-unit · setup

**On screen**

- $25,000 balance
- 5.2% APR · 48 months left

**Sound** transition×1, count×1, appear×1

**Narration** (16 words, 160 wpm)

> Twenty-five thousand dollars left at five point two percent, forty-eight monthly payments to go.

Spoken numbers → claims: "Twenty-five thousand dollars" → `balance` ($25,000); "forty-eight" → `months` (48)

## 03 extra — 0:13.8–0:16.2 (2.4 s, 4 beats) · close · two-roads/fork · setup

**On screen**

- +$400 a month

**Sound** transition×1, appear×1

**Narration** (6 words, 150 wpm)

> Four hundred extra dollars a month.

Spoken numbers → claims: "Four hundred" → `extra` ($400)

## 04 roads — 0:16.2–0:23.4 (7.2 s, 12 beats) · medium · two-roads/fork · setup

**On screen**

- +$400 a month
- A: extra to the loan
- B: invest the extra

**Sound** transition×1, appear×2, compare×1

**Narration** (17 words, 142 wpm)

> Road A sends it to the loan. Road B pays the minimum and invests it each month.

## 05 timeline — 0:23.4–0:28.2 (4.8 s, 8 beats) · medium · timeline/months · setup

**On screen**

- Loan paid off
- month 28
- month 48

**Sound** transition×1, appear×3

**Narration** (13 words, 163 wpm)

> Road A clears the loan at month twenty-eight instead of forty-eight.

Spoken numbers → claims: "twenty-eight" → `payoff_a` (28); "forty-eight" → `horizon` (48)

## 06 interest — 0:28.2–0:34.8 (6.6 s, 11 beats) · close · stacked-cost/absolute · setup

**On screen**

- Interest paid
- $1,554
- $2,744
- $1,190 avoided, certain

**Sound** transition×1, count×1, reveal×1, emphasis×1

**Narration** (17 words, 155 wpm)

> Interest drops from twenty-seven forty-four to fifteen fifty-four: a certain eleven hundred ninety dollars.

Spoken numbers → claims: "twenty-seven forty-four" → `int_b` ($2,744); "fifteen fifty-four" → `int_a` ($1,554); "eleven hundred ninety dollars" → `avoided` ($1,190)

## 07 scope — 0:34.8–0:39.6 (4.8 s, 8 beats) · wide · canvas/overview · setup

**On screen**

- US only. Inputs are stated, not forecasts.

**Sound** dismiss×1, transition×1, appear×1

**Narration** (13 words, 163 wpm)

> This analysis is US-only, and every input here is stated, not forecast.

## 08 tax — 0:39.6–0:45.6 (6.0 s, 10 beats) · medium · threshold-matrix/rows · setup

**On screen**

- Gains taxed once, at month 48
- 12%
- 22%
- 32%

**Sound** transition×1, appear×2

**Narration** (16 words, 160 wpm)

> Gains are taxed once, at month forty-eight, at twelve, twenty-two or thirty-two percent.

Spoken numbers → claims: "month forty-eight" → `horizon` (48); "twelve" → `tax_12` (12%); "twenty-two" → `tax_22` (22%); "thirty-two percent" → `tax_32` (32%)

## 09 bars — 0:45.6–0:52.8 (7.2 s, 12 beats) · medium · bar-compare/two · sweep

**On screen**

- 12%
- 22%
- 32%
- $1,190
- Interest avoided
- $333
- Extra after-tax growth
- Expected return
- 2.00%

**Sound** transition×1, appear×3, compare×1

**Narration** (17 words, 142 wpm)

> Left: interest road A avoids. Right: the extra after-tax growth road B earns by investing sooner.

## 10 sweep — 0:52.8–1:03.6 (10.8 s, 18 beats) · medium · bar-compare/two + line-trend/dual · sweep

**On screen**

- $1,190
- $1,858
- Interest avoided
- Extra after-tax growth
- Expected return
- 10.00%
- A
- B

**Sound** count×32, threshold-cross×1

**Narration** (26 words, 144 wpm)

> We sweep the expected return from two to ten percent, at twenty-two percent tax. Road B's bar grows with it, and passes road A's line.

Spoken numbers → claims: "two to" → `axis_lo` (2%); "ten percent" → `axis_hi` (10%); "twenty-two percent tax" → `tax_22` (22%)

## 11 settle — 1:03.6–1:06.6 (3.0 s, 5 beats) · close · bar-compare/two · sweep

**On screen**

- $1,190
- $1,190
- Interest avoided
- Extra after-tax growth
- Expected return
- 6.70%
- Equal

**Sound** emphasis×1 · music silence 1:05.0–1:05.4 · stillness 1:05.4–1:06.2

**Narration** (7 words, 140 wpm)

> They meet at six point seven oh.

Spoken numbers → claims: "six point seven oh" → `be_22` (6.70%)

## 12 morph — 1:06.6–1:07.8 (1.2 s, 2 beats) · close · flip-point/axis · sweep

**On screen**


**Sound** transition×1

**Narration** (3 words, 150 wpm)

> That crossing point.

## 13 detail — 1:07.8–1:12.0 (4.2 s, 7 beats) · detail · hero-number/plain · sweep

**On screen**

- 6.70%
- break-even return · 22% tax

**Sound** reveal×1, emphasis×1 · stillness 1:09.1–1:09.9

**Narration** (11 words, 157 wpm)

> Six point seven oh percent is the break-even expected return.

Spoken numbers → claims: "Six point seven oh percent" → `be_22` (6.70%)

## 14 flip — 1:12.0–1:18.0 (6.0 s, 10 beats) · medium · flip-point/axis · sweep

**On screen**

- A
- B
- 6.70%
- Below: A ends ahead
- Above: B

**Sound** transition×1, appear×2, emphasis×1

**Narration** (15 words, 150 wpm)

> Below it, road A ends ahead at month forty-eight. Above it, road B does.

Spoken numbers → claims: "month forty-eight" → `horizon` (48)

## 15 matrix — 1:18.0–1:25.2 (7.2 s, 12 beats) · medium · threshold-matrix/rows · tension

**On screen**

- 12%
- 22%
- 32%
- Break-even by tax rate
- 6.70%
- 6.00%
- 7.59%

**Sound** transition×1, appear×1, count×1

**Narration** (17 words, 142 wpm)

> Tax moves the threshold: six percent at twelve percent tax, seven point five nine at thirty-two.

Spoken numbers → claims: "six percent" → `be_12` (6.00%); "twelve percent tax" → `tax_12` (12%); "seven point five nine" → `be_32` (7.59%); "thirty-two" → `tax_32` (32%)

## 16 matrix32 — 1:25.2–1:26.4 (1.2 s, 2 beats) · close · doodle-transition/circle · tension

**On screen**

- 12%
- 6.00%
- 22%
- 6.70%
- 32%
- 7.59%

**Sound** emphasis×1

**Narration** (3 words, 150 wpm)

> The highest threshold.

## 17 certain — 1:26.4–1:32.4 (6.0 s, 10 beats) · medium · two-column-compare · tension

**On screen**

- Loan payoff
- Investing
- 5.2%
- certain
- 2%–10%
- expected, not certain

**Sound** transition×1, compare×1

**Narration** (15 words, 150 wpm)

> The loan payoff return is certain. The investment return is an expectation, not a promise.

## 18 sequence — 1:32.4–1:37.8 (5.4 s, 9 beats) · wide · timeline/months · tension

**On screen**

- A stated sequence
- 8%
- then −20%

**Sound** dismiss×1, transition×1, appear×1

**Narration** (13 words, 144 wpm)

> One stated sequence: eight percent a year, then minus twenty in year four.

Spoken numbers → claims: "eight percent" → `seq_first` (8%); "minus twenty" → `seq_second` (−20%); "year four" → `seq_year` (4)

## 19 race — 1:37.8–1:45.6 (7.8 s, 13 beats) · medium · line-trend/dual · tension

**On screen**

- Month 48
- Net worth after tax
- A
- B
- not a forecast

**Sound** transition×1, appear×1, count×8

**Narration** (20 words, 154 wpm)

> We track net worth after tax, month by month. The two roads run almost together for the first three years.

## 20 gap — 1:45.6–1:46.8 (1.2 s, 2 beats) · close · line-trend/single · tension

**On screen**


**Sound** transition×1

**Narration** (3 words, 150 wpm)

> Now the difference.

## 21 cross — 1:46.8–1:52.2 (5.4 s, 9 beats) · close · line-trend/single · tension

**On screen**

- B minus A
- A ahead from month 38

**Sound** appear×2, threshold-cross×1 · music silence 1:48.8–1:49.2 · stillness 1:49.2–1:50.0

**Narration** (14 words, 156 wpm)

> Road B leads early, then drops behind road A from month thirty-eight on.

Spoken numbers → claims: "month thirty-eight" → `cross_month` (38)

## 22 downside — 1:52.2–1:55.8 (3.6 s, 6 beats) · detail · hero-number/with-delta · tension

**On screen**

- +$459
- A, month 48

**Sound** reveal×1, emphasis×1 · music silence 1:53.1–1:53.5 · stillness 1:53.5–1:54.3

**Narration** (9 words, 150 wpm)

> Road A finishes four hundred fifty-nine dollars ahead.

Spoken numbers → claims: "four hundred fifty-nine dollars" → `gap_end` ($459)

## 23 converge — 1:55.8–2:01.8 (6.0 s, 10 beats) · medium · two-roads/converge · resolution

**On screen**

- Flip at 6.70% expected return · 22% tax

**Sound** dismiss×1, transition×1, appear×1

**Narration** (16 words, 160 wpm)

> At twenty-two percent tax, the answer flips at six point seven oh percent expected return.

Spoken numbers → claims: "twenty-two percent tax" → `tax_22` (22%); "six point seven oh percent" → `be_22` (6.70%)

## 24 outro — 2:01.8–2:07.8 (6.0 s, 10 beats) · wide · canvas/overview · resolution

**On screen**

- A threshold, not a forecast. US only.

**Sound** transition×1, appear×1, dismiss×1

**Narration** (16 words, 160 wpm)

> That is a threshold, not a forecast. Where a return lands is not known in advance.

## Pace

Total narration: 322 words over 127.8 s = 151.2 wpm (target 150–160).
