'use strict';
// Builds every dataset the renderer uses and the claims ledger behind each on-screen number.
// Scenes may only show strings that come out of `claims` (see render/scenes.js `K()`).
const C = require('./calc');

const SOURCE = {
  name: 'Freddie Mac Primary Mortgage Market Survey (PMMS)',
  url: 'https://www.freddiemac.com/pmms',
  releaseUrl: 'https://www.globenewswire.com/news-release/2026/09/24/3368592/0/en/mortgage-rates-average-7-03.html',
  date: '2026-09-24',
  dateDisplay: 'Sep 24, 2026',
  ratePct: 7.03,
  note: 'Release title "Mortgage Rates Average 7.03%" (Freddie Mac, 2026-09-24) retrieved via web search index on 2026-09-25; direct page fetch blocked by sandbox egress proxy.',
};

const BASE = {
  id: 'normal',
  principal: 400000,
  termMonths: 360,
  baseRatePct: SOURCE.ratePct,
  rateLabel: 'source', // 'source' | 'illustrative'
  points: [0, 0.5, 1, 1.5, 2, 2.5, 3],
  cuts: [0.125, 0.25, 0.375],
  holdYears: Array.from({ length: 15 }, (_, i) => i + 1),
  returnPct: 5.0,
  example: { points: 1, cut: 0.25 },
  chart: { points: 1, cut: 0.125 },
  missing: [], // [points, cut] combos with no lender quote
};

const DATASETS = {
  normal: BASE,
  // Longest numbers and labels, most rows/columns: jumbo loan, high rate, fine grids.
  extreme: {
    ...BASE,
    id: 'extreme',
    principal: 9999999,
    baseRatePct: 12.875,
    rateLabel: 'illustrative',
    points: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3],
    cuts: [0.0625, 0.125, 0.1875, 0.25, 0.3125, 0.375],
    returnPct: 11.875,
    example: { points: 2.75, cut: 0.0625 },
    chart: { points: 2.75, cut: 0.0625 },
  },
  // Same as normal, but some lender quotes are unavailable.
  missing: {
    ...BASE,
    id: 'missing',
    missing: [[0.5, 0.375], [1.5, 0.125], [2, 0.25], [2.5, 0.375], [3, 0.125], [3, 0.25]],
  },
};

// ---------- formatting (display strings are part of each claim) ----------
const usd = (x, cents = false) =>
  (x < 0 ? '−' : '') + '$' + Math.abs(x).toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0,
  });
const pct = (x) => {
  // shortest of 2..4 decimals that is exact, min 2
  for (const d of [2, 3, 4]) if (Math.abs(+x.toFixed(d) - x) < 1e-9) return x.toFixed(d) + '%';
  return x.toFixed(4) + '%';
};
const cutPct = (x) => { // 0.125 -> "0.125%", 0.25 -> "0.25%"
  for (const d of [2, 3, 4]) if (Math.abs(+x.toFixed(d) - x) < 1e-9) return x.toFixed(d) + '%';
  return x.toFixed(4) + '%';
};
const yrs = (m) => (m === null ? 'never' : (m / 12).toFixed(1));
const pts = (p) => (Number.isInteger(p) ? p.toFixed(1) : String(p));

function build(ds) {
  const claims = [];
  const byId = {};
  const add = (claimId, value, display, how, inputs) => {
    if (byId[claimId]) return byId[claimId];
    const c = { claimId, dataset: ds.id, value, display, ...how, inputs };
    claims.push(c); byId[claimId] = c; return c;
  };
  const input = (id, value, display, note) => add(id, value, display, { formula: 'input', note }, {});

  // ---- inputs ----
  input('principal', ds.principal, usd(ds.principal), 'Base case loan amount (brief).');
  input('term_years', ds.termMonths / 12, String(ds.termMonths / 12), '30-year fixed (brief).');
  if (ds.rateLabel === 'source') {
    add('base_rate', ds.baseRatePct, pct(ds.baseRatePct),
      { source: SOURCE.releaseUrl, sourceIndex: SOURCE.url, sourceDate: SOURCE.date, note: SOURCE.note }, {});
    add('rate_date', SOURCE.date, SOURCE.dateDisplay, { source: SOURCE.releaseUrl, note: 'PMMS weekly release date.' }, {});
  } else {
    input('base_rate', ds.baseRatePct, pct(ds.baseRatePct), 'ILLUSTRATIVE stress-test rate, not a published average.');
  }
  input('point_pct', 1, '1%', '1 point = 1% of loan amount (brief).');
  input('one_point', 1, '1', 'One point (definition).');
  input('return_pct', ds.returnPct, pct(ds.returnPct), 'Assumed annual return on cash not spent on points, compounded monthly (j = k/12). Stated assumption, not a forecast.');
  input('cut_min', Math.min(...ds.cuts), cutPct(Math.min(...ds.cuts)), 'Sweep low end, rate reduction per point (brief).');
  input('cut_max', Math.max(...ds.cuts), cutPct(Math.max(...ds.cuts)), 'Sweep high end (brief).');
  input('points_min', Math.min(...ds.points), String(Math.min(...ds.points)), 'Sweep (brief).');
  input('points_max', Math.max(...ds.points), String(Math.max(...ds.points)), 'Sweep (brief).');
  input('points_step', ds.points[1] - ds.points[0], String(ds.points[1] - ds.points[0]), 'Sweep step (brief).');
  input('hold_min', ds.holdYears[0], String(ds.holdYears[0]), 'Holding-period sweep (brief).');
  input('hold_max', ds.holdYears.at(-1), String(ds.holdYears.at(-1)), 'Holding-period sweep (brief).');
  add('one_point_cost', C.pointsCost(ds.principal, 1), usd(C.pointsCost(ds.principal, 1)),
    { formula: 'cost = principal × points / 100' }, { principal: ds.principal, points: 1 });

  const common = { principal: ds.principal, baseRatePct: ds.baseRatePct, termMonths: ds.termMonths, annualReturnPct: ds.returnPct };
  const isMissing = (p, c) => ds.missing.some(([mp, mc]) => mp === p && mc === c);

  // ---- grid ----
  const rows = ds.points.filter((p) => p > 0);
  const grid = rows.map((p) => ds.cuts.map((c) => {
    if (isMissing(p, c)) return null;
    return C.scenario({ ...common, points: p, cutPerPointPct: c });
  }));

  // Row / column labels
  rows.forEach((p) => {
    add(`pts_${p}`, p, pts(p), { formula: 'input (sweep value)' }, {});
    add(`cost_${p}`, C.pointsCost(ds.principal, p), usd(C.pointsCost(ds.principal, p)),
      { formula: 'cost = principal × points / 100' }, { principal: ds.principal, points: p });
  });
  ds.cuts.forEach((c) => add(`cut_${c}`, c, cutPct(c), { formula: 'input (sweep value)' }, {}));

  // Choose the holding period with the most flipped answers (ties -> shortest).
  let hold = ds.holdYears[0], best = -1;
  for (const y of ds.holdYears) {
    const n = grid.flat().filter((s) => s && C.flipYears(s, [y]).length).length;
    if (n > best) { best = n; hold = y; }
  }
  const available = grid.flat().filter(Boolean).length;

  const cellClaims = grid.map((row, ri) => row.map((s, ci) => {
    if (!s) return null;
    const p = rows[ri], c = ds.cuts[ci];
    const inputs = { principal: ds.principal, baseRatePct: ds.baseRatePct, termMonths: ds.termMonths, points: p, cutPerPointPct: c };
    const a = add(`be_simple_${p}_${c}`, s.simpleMonths, yrs(s.simpleMonths),
      { formula: 'years = ceil(cost / (M(base) − M(base − points×cut))) / 12; M = L·i/(1−(1+i)^−n), i = r/12, payments rounded to cents' }, inputs);
    const b = add(`be_opp_${p}_${c}`, s.oppMonths, yrs(s.oppMonths),
      { formula: 'years = min m s.t. Σ_{t=1..m} saving/(1+j)^t ≥ cost, j = returnPct/12, / 12; "never" if not within term' },
      { ...inputs, returnPct: ds.returnPct });
    return { a: a.claimId, b: b.claimId, flip: C.flipYears(s, [hold]).length > 0 };
  }));

  add('hold_years', hold, String(hold), { formula: 'argmax over holdYears of count(cells where simple ≤ 12·H < opp); ties → shortest H' }, { holdYears: ds.holdYears });
  add('flip_count', best, String(best), { formula: 'count(cells where simpleMonths ≤ 12·hold < oppMonths)' }, { hold });
  add('cell_count', available, String(available), { formula: 'count(cells with a lender quote)' }, { rows: rows.length, cols: ds.cuts.length, missing: ds.missing.length });

  // Largest spread of payments-only break-even within a column (effect of # of points).
  let spread = 0;
  ds.cuts.forEach((_, ci) => {
    const ms = grid.map((r) => r[ci]).filter(Boolean).map((s) => s.simpleMonths).filter((m) => m !== null);
    if (ms.length) spread = Math.max(spread, Math.max(...ms) - Math.min(...ms));
  });
  add('spread_months', spread, String(spread), { formula: 'max over cut columns of (max − min) simpleMonths across point rows' }, {});

  // ---- worked example ----
  const ex = C.scenario({ ...common, points: ds.example.points, cutPerPointPct: ds.example.cut });
  const exIn = { ...common, points: ds.example.points, cutPerPointPct: ds.example.cut };
  add('ex_points', ds.example.points, pts(ds.example.points), { formula: 'input (example)' }, {});
  add('ex_cut', ds.example.cut, cutPct(ds.example.cut), { formula: 'input (example)' }, {});
  add('ex_cost', ex.cost, usd(ex.cost), { formula: 'cost = principal × points / 100' }, exIn);
  add('ex_base_pay', ex.basePay, usd(ex.basePay, true), { formula: 'M = L·i/(1−(1+i)^−n), i = base/12, n = 360, rounded to cents' }, exIn);
  add('ex_new_rate', ex.newRate, pct(ex.newRate), { formula: 'newRate = base − points × cut' }, exIn);
  add('ex_new_pay', ex.newPay, usd(ex.newPay, true), { formula: 'M at newRate, rounded to cents' }, exIn);
  add('ex_saving', ex.saving, usd(ex.saving, true), { formula: 'saving = M(base) − M(newRate)' }, exIn);
  add('ex_months', ex.simpleMonths, ex.simpleMonths === null ? 'never' : String(ex.simpleMonths), { formula: 'ceil(cost / saving)' }, exIn);
  add('ex_years', ex.simpleMonths, yrs(ex.simpleMonths), { formula: 'months / 12, 1 decimal' }, exIn);
  add('ex_opp_months', ex.oppMonths, ex.oppMonths === null ? 'never' : String(ex.oppMonths), { formula: 'min m: Σ saving/(1+j)^t ≥ cost, j = return/12' }, { ...exIn, returnPct: ds.returnPct });

  // ---- flip chart (net position over holding years) ----
  const ch = C.scenario({ ...common, points: ds.chart.points, cutPerPointPct: ds.chart.cut });
  const chIn = { ...common, points: ds.chart.points, cutPerPointPct: ds.chart.cut };
  const months = ds.holdYears.at(-1) * 12;
  const pathA = C.netPathSimple(ch.cost, ch.saving, months);
  const pathB = C.netPathOpportunity(ch.cost, ch.saving, ds.returnPct, months);
  add('ch_points', ds.chart.points, pts(ds.chart.points), { formula: 'input (chart)' }, {});
  add('ch_cut', ds.chart.cut, cutPct(ds.chart.cut), { formula: 'input (chart)' }, {});
  add('ch_cost', ch.cost, usd(ch.cost), { formula: 'cost = principal × points / 100' }, chIn);
  add('ch_saving', ch.saving, usd(ch.saving, true), { formula: 'M(base) − M(newRate)' }, chIn);
  add('ch_a_years', ch.simpleMonths, yrs(ch.simpleMonths), { formula: 'ceil(cost/saving)/12' }, chIn);
  add('ch_b_years', ch.oppMonths, yrs(ch.oppMonths), { formula: 'opportunity break-even months / 12' }, { ...chIn, returnPct: ds.returnPct });
  const fy = C.flipYears(ch, ds.holdYears);
  add('ch_flip_from', fy.length ? fy[0] : null, fy.length ? String(fy[0]) : '—', { formula: 'first H in holdYears with simple ≤ 12H < opp' }, chIn);
  add('ch_flip_to', fy.length ? fy.at(-1) : null, fy.length ? String(fy.at(-1)) : '—', { formula: 'last H in holdYears with simple ≤ 12H < opp' }, chIn);
  const yMin = Math.min(...pathA, ...pathB), yMax = Math.max(...pathA, ...pathB);
  add('ch_end_a', pathA.at(-1), (pathA.at(-1) >= 0 ? '+' : '') + usd(Math.round(pathA.at(-1))),
    { formula: `month-${months} value of netPathSimple = m·saving − cost` }, chIn);
  add('ch_end_b', pathB.at(-1), (pathB.at(-1) >= 0 ? '+' : '') + usd(Math.round(pathB.at(-1))),
    { formula: `month-${months} value of netPathOpportunity = FV_j(savings) − cost·(1+j)^m` }, { ...chIn, returnPct: ds.returnPct });
  const xTicks = [0, 5, 10, 15].filter((v) => v <= ds.holdYears.at(-1));
  xTicks.forEach((v) => add(`xt_${v}`, v, String(v), { formula: 'axis tick (years)' }, {}));
  add('ch_neg_cost', -ch.cost, usd(-ch.cost), { formula: 'net position at month 0 = −cost' }, chIn);
  add('y_zero', 0, '$0', { formula: 'axis reference: break-even line' }, {});

  // ---- thresholds for close (opportunity version, max across point rows per cut) ----
  const thresholds = ds.cuts.map((c, ci) => {
    const col = grid.map((r) => r[ci]).filter(Boolean);
    const maxOf = (k) => (col.some((s) => s[k] === null) ? null : Math.max(...col.map((s) => s[k])));
    const a = maxOf('simpleMonths'), b = maxOf('oppMonths');
    add(`th_a_${c}`, a, yrs(a), { formula: 'max over point rows of simpleMonths / 12' }, { cut: c });
    add(`th_b_${c}`, b, yrs(b), { formula: 'max over point rows of oppMonths / 12' }, { cut: c, returnPct: ds.returnPct });
    return { cut: `cut_${c}`, a: `th_a_${c}`, b: `th_b_${c}`, bMonths: b };
  });

  return {
    id: ds.id,
    rateLabel: ds.rateLabel,
    sourceUrl: ds.rateLabel === 'source' ? SOURCE.url : null,
    rows: rows.map((p) => ({ pts: `pts_${p}`, cost: `cost_${p}` })),
    cols: ds.cuts.map((c) => `cut_${c}`),
    cells: cellClaims,
    thresholds,
    chart: {
      pathA, pathB, months, yMin, yMax,
      aMonths: ch.simpleMonths, bMonths: ch.oppMonths,
      flipFrom: fy.length ? fy[0] : null, flipTo: fy.length ? fy.at(-1) : null,
      xTicks: xTicks.map((v) => ({ v, id: `xt_${v}` })),
    },
    claims,
  };
}

function buildAll() {
  const out = {};
  for (const k of Object.keys(DATASETS)) out[k] = build(DATASETS[k]);
  return out;
}

module.exports = { SOURCE, DATASETS, build, buildAll, fmt: { usd, pct, cutPct, yrs, pts } };
