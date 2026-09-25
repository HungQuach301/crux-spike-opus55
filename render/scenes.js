'use strict';
/* Deterministic scene renderer: renderFrame(t, datasetId) paints the stage for time t (seconds).
 * No CSS animations or timers — every frame is a pure function of t, so any frame can be
 * re-rendered in isolation. Numbers only enter the page through K(claimId). */

// ---------------- tokens ----------------
const TOK = {
  bg: '#0E1116', surface: '#171B22', ink: '#F2F4F7', inkMuted: '#9AA4B2', accent: '#4C8DFF',
  warn: '#F2B441', positive: '#3FBF7F', negative: '#E5484D', grid: '#2A303B',
};
const W = 1920, H = 1080, M = 96, GUT = 32, COLS = 12;
const COLW = (W - 2 * M - (COLS - 1) * GUT) / COLS;
const colX = (c) => M + (c - 1) * (COLW + GUT);
const spanW = (a, b) => colX(b) + COLW - colX(a);
const RIGHT = W - M, BOTTOM = H - M;
const FOOT_Y = BOTTOM - 34;
const L1_Y = M + 16; // l1 glyph box (ascent) starts ~14px above its line box

// motion tokens
const DRIFT = 12;        // px/s, within 8–20
const STAGGER = 0.06;    // s, within 40–80 ms
const OVERSHOOT = 0.04;  // 4%, within 3–5%
const ENTER = 0.5, ENTER_DIST = 16, FADE = 0.4;

// back-out easing tuned so the peak is exactly 1 + OVERSHOOT
function backOutS(os) {
  const peak = (s) => { let m = 0; for (let i = 0; i <= 2000; i++) { const x = i / 2000; m = Math.max(m, bo(x, s)); } return m; };
  let lo = 0, hi = 3;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (peak(mid) > 1 + os) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
}
function bo(x, s) { const u = x - 1; return 1 + (s + 1) * u * u * u + s * u * u; }
const S_BACK = backOutS(OVERSHOOT);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeBack = (p) => bo(clamp(p), S_BACK);

// ---------------- claims ----------------
let D = null;          // current dataset
let CLAIMS = {};
const USED = new Set();
function K(id) {
  const c = CLAIMS[id];
  if (!c) throw new Error('unknown claim ' + id);
  USED.add(id);
  return `<span class="n">${esc(c.display)}</span>`;
}
const V = (id) => CLAIMS[id].value;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const plural = (id, one, many) => (V(id) === 1 ? one : many);

// ---------------- primitives ----------------
function enterStyle(tl, t0, dist = ENTER_DIST) {
  const p = clamp((tl - t0) / ENTER);
  const e = easeBack(p);
  return `opacity:${clamp(p * 2).toFixed(3)};transform:translateY(${((1 - e) * dist).toFixed(2)}px);`;
}
function scaleIn(tl, t0) {
  const p = clamp((tl - t0) / ENTER);
  const e = easeBack(p);
  return `opacity:${clamp(p * 2).toFixed(3)};transform:scale(${(0.9 + 0.1 * e).toFixed(4)});transform-origin:left top;`;
}
function T(cls, x, y, html, tl, t0, extra = '', anim = enterStyle) {
  return `<div class="t ${cls}" style="left:${x}px;top:${y}px;${extra}${anim(tl, t0)}">${html}</div>`;
}
function TW(cls, x, y, w, html, tl, t0) { // wrapping text block
  return `<div class="t wrap ${cls}" style="left:${x}px;top:${y}px;width:${w}px;${enterStyle(tl, t0)}">${html}</div>`;
}

function footer(tl) {
  const rate = D.rateLabel === 'source'
    ? `Base rate ${K('base_rate')}, Freddie Mac PMMS, week of ${K('rate_date')}`
    : `Base rate ${K('base_rate')} <span class="warn" style="font-weight:600">ILLUSTRATIVE</span>, not a published average`;
  return T('l3 muted', M, FOOT_Y, `US only · ${rate}`, tl, 0.1, '', (a, b) => enterStyle(a, b, 0));
}

// ---------------- scenes ----------------
const SCENES = [
  { id: 'title', dur: 7, hold: 5.5, still: [3.0, 7] },
  { id: 'assume', dur: 12, hold: 10.5, still: [2.0, 12] },
  { id: 'example', dur: 14, hold: 12.5, still: [3.2, 14] },
  { id: 'tableA', dur: 13, hold: 11.5, still: [3.0, 13] },
  { id: 'tableB', dur: 15, hold: 13.5, still: [4.5, 15] },
  { id: 'chart', dur: 15, hold: 13.5, still: [6.5, 15] },
  { id: 'close', dur: 10, hold: 8.5, still: [2.5, 10] },
];
let acc = 0;
for (const s of SCENES) { s.start = acc; acc += s.dur; }
const TOTAL = acc;

function movingSeconds(t) {
  // time spent outside "still" windows up to t — drift pauses while a focal number holds
  let moving = 0;
  for (const s of SCENES) {
    const a = s.start, b = s.start + s.dur;
    const seg = clamp(t, a, b) - a;
    const st = clamp(seg, s.still[0], s.still[1]) - s.still[0];
    moving += seg - Math.max(0, st);
  }
  return moving;
}

function dots(t) {
  const off = (movingSeconds(t) * DRIFT) % 96;
  return `<svg width="${W}" height="${H}"><defs><pattern id="g" width="96" height="96" patternUnits="userSpaceOnUse" patternTransform="translate(${off.toFixed(2)},0)">`
    + `<circle cx="0" cy="0" r="2" fill="${TOK.grid}"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`;
}

function sceneTitle(tl) {
  return [
    T('l3 muted', M, M, 'A US-only data analysis', tl, 0.2),
    T('l1 ink', M, 380, 'Mortgage points', tl, 0.4, '', scaleIn),
    T('l2 muted', M, 540, 'How long must we keep the home to break even?', tl, 0.9),
    T('l3 muted', M, 640, `${K('principal')} loan · ${K('term_years')}-year fixed · two ways to count`, tl, 1.4),
    footer(tl),
  ].join('');
}

function sceneAssume(tl) {
  const out = [T('l2b ink', M, M, 'What we assume', tl, 0.1)];
  out.push(T('l1 ink', M, 240, K('base_rate'), tl, 0.3, '', scaleIn));
  out.push(T('l3 muted', M, 390, `Average ${K('term_years')}-year fixed rate, US`, tl, 0.6));
  if (D.rateLabel === 'source') out.push(T('l3 muted', M, 430, `Freddie Mac PMMS, week of ${K('rate_date')}`, tl, 0.7));
  else out.push(T('l3s warn', M, 430, 'ILLUSTRATIVE, not a published average', tl, 0.7));
  const rows = [
    ['Loan', `${K('principal')}, ${K('term_years')}-year fixed`],
    ['One point', `${K('point_pct')} of the loan = ${K('one_point_cost')}`],
    ['Rate cut per point', `${K('cut_min')} to ${K('cut_max')}`],
    ['Points bought', `${K('points_min')} to ${K('points_max')}, in steps of ${K('points_step')}`],
    ['Holding period', `${K('hold_min')} to ${K('hold_max')} years`],
    ['Return on cash not spent', `${K('return_pct')} a year, assumed`],
    ['Not modeled', 'taxes, closing costs,'],
    ['', 'loan balance at sale, refinancing'],
    ['Geography', 'US only'],
  ];
  rows.forEach(([a, b], i) => {
    const y = 240 + i * 72, t0 = 0.8 + i * STAGGER;
    if (a) out.push(T('l3 muted', colX(6), y, a, tl, t0));
    out.push(T('l3s ink', colX(9), y, b, tl, t0));
  });
  out.push(footer(tl));
  return out.join('');
}

function sceneExample(tl) {
  const n = V('ex_points');
  const out = [T('l2b ink', M, M, `One case: ${K('ex_points')} ${n === 1 ? 'point' : 'points'}, ${K('ex_cut')} off per point`, tl, 0.1)];
  const rows = [
    ['Upfront cost', K('ex_cost'), 'ink'],
    [`Payment at ${K('base_rate')}`, K('ex_base_pay'), 'ink'],
    [`Payment at ${K('ex_new_rate')}`, K('ex_new_pay'), 'ink'],
    ['Monthly difference', K('ex_saving'), 'accent'],
  ];
  rows.forEach(([a, b, c], i) => {
    const y = 250 + i * 150, t0 = 0.5 + i * 0.5;
    out.push(T('l3 muted', M, y, a, tl, t0));
    out.push(T(`l2 ${c}`, M, y + 40, b, tl, t0 + STAGGER));
  });
  const months = V('ex_months');
  out.push(T('l1 ink', colX(7), 300, K('ex_months'), tl, 2.7, '', scaleIn));
  out.push(T('l2 ink', colX(7), 450, months === null ? 'no break-even in the term' : 'months to break even', tl, 2.9));
  out.push(TW('l3 muted', colX(7), 540, spanW(7, 12),
    `${K('ex_cost')} ÷ ${K('ex_saving')}, rounded up to a whole month: ${K('ex_years')} years. Payments only; the cash has no other use in this count.`, tl, 3.2));
  out.push(footer(tl));
  return out.join('');
}

// Shared table geometry for tableA / tableB (same layout under every dataset).
function table(tl, mode, t0) {
  const top = 272, bottom = 880;
  const nR = D.rows.length, nC = D.cols.length;
  const rowH = Math.min(72, Math.floor((bottom - top) / (nR + 1)));
  const x0 = colX(4), cw = (RIGHT - x0) / nC;
  const out = [];
  out.push(`<div class="cell hdr lbl" style="left:${M}px;top:${top}px;width:${spanW(1, 3)}px;height:${rowH}px;${enterStyle(tl, t0)}"><span>Points · cost</span></div>`);
  D.cols.forEach((c, ci) => out.push(`<div class="cell hdr" style="left:${(x0 + ci * cw).toFixed(1)}px;top:${top}px;width:${cw.toFixed(1)}px;height:${rowH}px;${enterStyle(tl, t0 + ci * STAGGER)}"><span>${K(c)} off</span></div>`));
  out.push(`<div class="rule" style="left:${M}px;top:${top + rowH - 1}px;width:${RIGHT - M}px;${enterStyle(tl, t0, 0)}"></div>`);
  const flipOn = mode === 'AB' ? clamp((tl - (t0 + 2.6)) / ENTER) : 0;
  D.rows.forEach((r, ri) => {
    const y = top + (ri + 1) * rowH;
    out.push(`<div class="cell lbl ink" style="left:${M}px;top:${y}px;width:${spanW(1, 3)}px;height:${rowH}px;color:${TOK.ink};${enterStyle(tl, t0 + (ri + 1) * STAGGER)}"><span>${K(r.pts)} pt · ${K(r.cost)}</span></div>`);
    D.cols.forEach((_, ci) => {
      const cell = D.cells[ri][ci];
      const st = t0 + (ri + ci + 1) * STAGGER;
      const x = (x0 + ci * cw).toFixed(1);
      let cls = 'cell', txt = '—', style = '';
      if (cell) {
        if (mode === 'A') { txt = K(cell.a); style = `color:${TOK.ink};`; }
        else {
          txt = `${K(cell.a)} → ${K(cell.b)}`;
          if (cell.flip && flipOn > 0) {
            const fs = clamp((tl - (t0 + 2.6 + (ri + ci) * STAGGER)) / ENTER);
            if (fs > 0) cls += ' flip';
          }
        }
      }
      out.push(`<div class="${cls}" style="left:${x}px;top:${y + 4}px;width:${(cw - 8).toFixed(1)}px;height:${rowH - 8}px;${style}${enterStyle(tl, st)}"><span>${txt}</span></div>`);
    });
  });
  return out.join('');
}

function sceneTableA(tl) {
  const sp = V('spread_months');
  const out = [
    T('l1 ink', M, L1_Y, `${K('spread_months')}<span class="l2 muted"> ${sp === 1 ? 'month' : 'months'}</span>`, tl, 2.4, '', scaleIn),
    T('l2b ink', colX(5), M, 'Payments-only break-even, in years', tl, 0.1),
    TW('l3 muted', colX(5), M + 70, spanW(5, 12),
      `Largest shift across ${K(D.rows[0].pts)} to ${K('points_max')} points within any column. The rate cut per point moves the break-even; the number of points barely does.`, tl, 2.6),
    table(tl, 'A', 0.5),
    footer(tl),
  ];
  return out.join('');
}

function sceneTableB(tl) {
  const out = [
    T('l1 ink', M, L1_Y, `${K('flip_count')}<span class="l2 muted"> of </span>${K('cell_count')}`, tl, 3.6, '', scaleIn),
    T('l2b ink', colX(6), M, `answers flip at a ${K('hold_years')}-year hold`, tl, 0.1),
    TW('l3 muted', colX(6), M + 70, spanW(6, 12),
      `Each cell: break-even years, payments only → with a ${K('return_pct')} return on the upfront cash.`, tl, 0.3),
    table(tl, 'AB', 0.5),
  ];
  // legend (grayscale-safe: outlined box + words, not color alone)
  const ly = 896, lt = 3.4;
  out.push(`<div style="position:absolute;left:${M}px;top:${ly + 4}px;width:40px;height:28px;box-sizing:border-box;border:2px solid ${TOK.warn};background:${TOK.surface};${enterStyle(tl, lt)}"></div>`);
  out.push(T('l3 muted', M + 56, ly, `flip: break-even by year ${K('hold_years')} on payments, not yet once the cash could earn ${K('return_pct')}`, tl, lt));
  if (D.cells.flat().some((c) => c === null)) out.push(T('l3 muted', RIGHT - 300, ly, '— no lender quote', tl, lt, 'width:300px;text-align:right;'));
  out.push(footer(tl));
  return out.join('');
}

function sceneChart(tl) {
  const C = D.chart;
  const out = [];
  out.push(T('l1 ink', M, L1_Y, `${K('ch_a_years')}<span class="l2 muted"> → </span>${K('ch_b_years')}`, tl, 5.8, '', scaleIn));
  out.push(TW('l3 muted', colX(8), M, spanW(8, 12),
    `Years to break even for ${K('ch_points')} ${V('ch_points') === 1 ? 'point' : 'points'} at ${K('ch_cut')} off (${K('ch_cost')}, saves ${K('ch_saving')} a month): payments only → with a ${K('return_pct')} return on the cash.`, tl, 0.2));

  const x0 = M + 200, x1 = RIGHT - 300, y0 = 300, y1 = 820;
  const ymin = Math.min(C.yMin, 0), ymax = Math.max(C.yMax, 0);
  const X = (m) => x0 + (m / C.months) * (x1 - x0);
  const Y = (v) => y1 - ((v - ymin) / (ymax - ymin)) * (y1 - y0);
  const prog = clamp((tl - 1.0) / 4.0);
  const upto = Math.max(1, Math.floor(prog * C.months));
  const path = (arr) => arr.slice(0, upto + 1).map((v, m) => `${m ? 'L' : 'M'}${X(m).toFixed(1)},${Y(v).toFixed(1)}`).join('');

  let svg = `<svg width="${W}" height="${H}">`;
  // flip band
  const bandOn = C.flipFrom !== null && tl > 5.2;
  if (bandOn) {
    const bx0 = X(C.aMonths), bx1 = X(C.bMonths === null || C.bMonths > C.months ? C.months : C.bMonths);
    const o = clamp((tl - 5.2) / ENTER);
    svg += `<g opacity="${o.toFixed(3)}"><rect x="${bx0}" y="${y0}" width="${bx1 - bx0}" height="${y1 - y0}" fill="${TOK.surface}"/>`
      + `<line x1="${bx0}" y1="${y0}" x2="${bx0}" y2="${y1}" stroke="${TOK.warn}" stroke-width="2"/>`
      + `<line x1="${bx1}" y1="${y0}" x2="${bx1}" y2="${y1}" stroke="${TOK.warn}" stroke-width="2"/></g>`;
  }
  svg += `<line x1="${x0}" y1="${Y(0)}" x2="${x1}" y2="${Y(0)}" stroke="${TOK.grid}" stroke-width="2"/>`;
  svg += `<line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="${TOK.grid}" stroke-width="2"/>`;
  svg += `<path d="${path(C.pathA)}" fill="none" stroke="${TOK.inkMuted}" stroke-width="4" stroke-dasharray="14 10"/>`;
  svg += `<path d="${path(C.pathB)}" fill="none" stroke="${TOK.accent}" stroke-width="5"/>`;
  if (C.aMonths !== null && upto >= C.aMonths && C.aMonths <= C.months) svg += `<circle cx="${X(C.aMonths)}" cy="${Y(0)}" r="9" fill="${TOK.bg}" stroke="${TOK.inkMuted}" stroke-width="4"/>`;
  if (C.bMonths !== null && upto >= C.bMonths && C.bMonths <= C.months) svg += `<circle cx="${X(C.bMonths)}" cy="${Y(0)}" r="9" fill="${TOK.accent}"/>`;
  svg += '</svg>';
  out.push(`<div style="position:absolute;left:0;top:0;${enterStyle(tl, 0.4, 0)}">${svg}</div>`);

  // axes labels
  out.push(T('l3 muted', x0 - 24, Y(0) - 17, K('y_zero'), tl, 0.6, 'transform-origin:right;', (a, b) => enterStyle(a, b, 0) + 'translate:-100% 0;'));
  C.xTicks.forEach((tk, i) => out.push(T('l3 muted', X(tk.v * 12), y1 + 14, K(tk.id), tl, 0.6 + i * STAGGER, '', (a, b) => enterStyle(a, b, 0) + 'translate:-50% 0;')));
  out.push(T('l3 muted', x1, y1 + 54, 'years held', tl, 0.9, '', (a, b) => enterStyle(a, b, 0) + 'translate:-100% 0;'));
  out.push(T('l3 muted', x0 - 24, Y(C.pathA[0]) - 17, K('ch_neg_cost'), tl, 0.6, '', (a, b) => enterStyle(a, b, 0) + 'translate:-100% 0;'));
  if (bandOn) {
    const bx0 = X(C.aMonths), bx1 = X(C.bMonths === null || C.bMonths > C.months ? C.months : C.bMonths);
    out.push(TW('l3s warn', bx0 + 16, y1 - 92, Math.max(240, bx1 - bx0 - 24),
      `flips for holds of ${K('ch_flip_from')} to ${K('ch_flip_to')} years`, tl, 5.4));
  }

  // end labels (nudged apart if close)
  if (prog >= 1) {
    let ya = Y(C.pathA.at(-1)) - 36, yb = Y(C.pathB.at(-1)) - 36;
    if (Math.abs(ya - yb) < 84) { const mid = (ya + yb) / 2; if (ya < yb) { ya = mid - 42; yb = mid + 42; } else { ya = mid + 42; yb = mid - 42; } }
    const lim = (v) => clamp(v, y0 - 40, y1 - 110);
    ya = lim(ya); yb = lim(yb);
    if (Math.abs(ya - yb) < 84) { if (ya <= yb) ya = yb - 84; else yb = ya - 84; }
    out.push(T('l3 muted', x1 + 24, ya, `Payments only<br>${K('ch_end_a')}`, tl, 5.0));
    out.push(T('l3s accent', x1 + 24, yb, `With return on cash<br>${K('ch_end_b')}`, tl, 5.0 + STAGGER));
  }
  out.push(footer(tl));
  return out.join('');
}

function sceneClose(tl) {
  const th = D.thresholds;
  const first = th[0];
  const never = V(first.b) === null;
  const out = [
    T('l1 ink', M, L1_Y, `${K(first.b)}${never ? '' : '<span class="l2 muted"> years</span>'}`, tl, 1.6, '', scaleIn),
    T('l2b ink', colX(6), M, never ? 'no break-even within the loan term' : 'longest hold needed to break even', tl, 0.1),
    TW('l3 muted', colX(6), M + 70, spanW(6, 12),
      `At ${K(first.cut)} off per point, with a ${K('return_pct')} return on the upfront cash. Longest value across ${K(D.rows[0].pts)} to ${K('points_max')} points.`, tl, 0.3),
  ];
  const top = 300, n = th.length, pitch = Math.min(80, Math.floor(420 / (n + 1)));
  out.push(T('l3s muted', M, top, 'Rate cut per point', tl, 0.4));
  out.push(T('l3s muted', colX(5), top, 'Payments only', tl, 0.4));
  out.push(T('l3s muted', colX(9), top, 'With return on cash', tl, 0.4));
  out.push(`<div class="rule" style="left:${M}px;top:${top + 46}px;width:${RIGHT - M}px;${enterStyle(tl, 0.4, 0)}"></div>`);
  th.forEach((r, i) => {
    const y = top + (i + 1) * pitch, t0 = 0.6 + i * STAGGER;
    out.push(T('l3 muted', M, y + 10, `${K(r.cut)} off`, tl, t0));
    out.push(T('l3 muted', colX(5), y + 10, `${K(r.a)}${V(r.a) === null ? '' : ' years'}`, tl, t0));
    out.push(T('l2 ink', colX(9), y, `${K(r.b)}${V(r.b) === null ? '' : ' years'}`, tl, t0 + STAGGER));
  });
  out.push(T('l3 muted', M, 800, 'Not modeled: taxes, closing costs, loan balance at sale, refinancing.', tl, 2.2));
  out.push(T('l3 muted', M, 846, 'The holding period is the one input only the owner knows.', tl, 2.4));
  out.push(footer(tl));
  return out.join('');
}

const PAINT = { title: sceneTitle, assume: sceneAssume, example: sceneExample, tableA: sceneTableA, tableB: sceneTableB, chart: sceneChart, close: sceneClose };

function setDataset(id) {
  D = window.DATA[id];
  CLAIMS = Object.fromEntries(D.claims.map((c) => [c.claimId, c]));
}

function renderFrame(t, datasetId = 'normal') {
  setDataset(datasetId);
  const s = SCENES.find((x) => t >= x.start && t < x.start + x.dur) || SCENES[SCENES.length - 1];
  const tl = t - s.start;
  const o = clamp(Math.min(tl / FADE, (s.dur - tl) / FADE));
  document.getElementById('stage').innerHTML =
    dots(t) + `<div id="scene" data-scene="${s.id}" style="position:absolute;inset:0;opacity:${o.toFixed(3)}">${PAINT[s.id](tl)}</div>`;
  return s.id;
}

window.SEG = { SCENES, TOTAL, renderFrame, USED, TOK, colX, spanW, M, W, H };
