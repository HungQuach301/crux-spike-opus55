'use strict';
// Single source of timing for picture AND sound. Scene lengths are whole beats at 100 BPM, so
// music phrases and chord changes land exactly on cuts. Event times are scene-local seconds.
const BPM = 100;
const BEAT = 60 / BPM; // 0.6 s

// shot sizes are defined by camera scale: wide < 0.6 <= medium < 1.3 <= close < 2.4 <= detail
const SCENES = [
  // id, beats, section, shot, layout, camera target {x, y, s} in world px, drift direction
  { id: 'open', beats: 13, section: 'setup', shot: 'wide', layout: 'two-roads/fork', cam: { x: 2060, y: 1190, s: 0.42 }, drift: [1, 0] },
  { id: 'facts', beats: 10, section: 'setup', shot: 'medium', layout: 'hero-number/with-unit', cam: { x: 960, y: 560, s: 1.0 }, drift: [0, -1] },
  { id: 'extra', beats: 4, section: 'setup', shot: 'close', layout: 'two-roads/fork', cam: { x: 2560, y: 560, s: 1.6 }, drift: [1, 0] },
  { id: 'roads', beats: 12, section: 'setup', shot: 'medium', layout: 'two-roads/fork', cam: { x: 3120, y: 540, s: 1.0 }, drift: [-1, 0] },
  { id: 'timeline', beats: 8, section: 'setup', shot: 'medium', layout: 'timeline/months', cam: { x: 960, y: 600, s: 1.0 }, drift: [1, 0] },
  { id: 'interest', beats: 11, section: 'setup', shot: 'close', layout: 'stacked-cost/absolute', cam: { x: 1430, y: 640, s: 1.7 }, drift: [-1, 0] },
  { id: 'scope', beats: 8, section: 'setup', shot: 'wide', layout: 'canvas/overview', cam: { x: 2060, y: 1190, s: 0.5 }, drift: [0, 1] },
  { id: 'tax', beats: 10, section: 'setup', shot: 'medium', layout: 'threshold-matrix/rows', cam: { x: 3160, y: 1680, s: 1.0 }, drift: [1, 0] },
  { id: 'bars', beats: 12, section: 'sweep', shot: 'medium', layout: 'bar-compare/two', cam: { x: 960, y: 1800, s: 1.0 }, drift: [-1, 0] },
  { id: 'sweep', beats: 18, section: 'sweep', shot: 'medium', layout: 'bar-compare/two + line-trend/dual', cam: { x: 930, y: 1800, s: 1.05 }, drift: [0, 0] },
  { id: 'settle', beats: 5, section: 'sweep', shot: 'close', layout: 'bar-compare/two', cam: { x: 560, y: 1920, s: 1.6 }, drift: [0, 0] },
  { id: 'morph', beats: 2, section: 'sweep', shot: 'close', layout: 'flip-point/axis', cam: null, drift: [0, 0] },
  { id: 'detail', beats: 7, section: 'sweep', shot: 'detail', layout: 'hero-number/plain', cam: null, drift: [-1, 0] },
  { id: 'flip', beats: 10, section: 'sweep', shot: 'medium', layout: 'flip-point/axis', cam: { x: 1420, y: 1800, s: 1.25 }, drift: [1, 0] },
  { id: 'matrix', beats: 12, section: 'tension', shot: 'medium', layout: 'threshold-matrix/rows', cam: { x: 3160, y: 1650, s: 1.0 }, drift: [-1, 0] },
  { id: 'matrix32', beats: 2, section: 'tension', shot: 'close', layout: 'doodle-transition/circle', cam: { x: 2980, y: 1760, s: 1.8 }, drift: [0, 0] },
  { id: 'certain', beats: 10, section: 'tension', shot: 'medium', layout: 'two-column-compare', cam: { x: 3160, y: 2140, s: 1.0 }, drift: [1, 0] },
  { id: 'sequence', beats: 9, section: 'tension', shot: 'wide', layout: 'timeline/months', cam: { x: 4900, y: 1300, s: 0.5 }, drift: [1, 0] },
  { id: 'race', beats: 13, section: 'tension', shot: 'medium', layout: 'line-trend/dual', cam: { x: 5360, y: 1180, s: 1.0 }, drift: [0, -1] },
  { id: 'gap', beats: 2, section: 'tension', shot: 'close', layout: 'line-trend/single', cam: { x: 5700, y: 1170, s: 1.5 }, drift: [0, 0] },
  { id: 'cross', beats: 9, section: 'tension', shot: 'close', layout: 'line-trend/single', cam: { x: 5820, y: 1200, s: 1.6 }, drift: [1, 0] },
  { id: 'downside', beats: 6, section: 'tension', shot: 'detail', layout: 'hero-number/with-delta', cam: null, drift: [-1, 0] },
  { id: 'converge', beats: 10, section: 'resolution', shot: 'medium', layout: 'two-roads/converge', cam: { x: 3120, y: 540, s: 1.0 }, drift: [-1, 0] },
  { id: 'outro', beats: 10, section: 'resolution', shot: 'wide', layout: 'canvas/overview', cam: { x: 3200, y: 1190, s: 0.42 }, drift: [1, 0] },
];

// Scene-local events. type is one of the 8 SFX types; `probe` names the DOM data-ev the renderer
// sets when the visual event is on screen (used to measure picture/sound sync).
const EVENTS = {
  open: [['appear', 0.6, 'title'], ['appear', 2.4, 'skeleton']],
  facts: [['transition', 0, 'cam'], ['count', 0.9, 'balance'], ['appear', 2.7, 'factsline']],
  extra: [['transition', 0, 'cam'], ['appear', 0.6, 'extra']],
  roads: [['transition', 0, 'cam'], ['appear', 1.2, 'roadA'], ['appear', 2.4, 'roadB'], ['compare', 3.6, 'roadsCompare']],
  timeline: [['transition', 0, 'cam'], ['appear', 0.6, 'tlBars'], ['appear', 1.8, 'tlA'], ['appear', 2.7, 'tlB']],
  interest: [['transition', 0, 'cam'], ['count', 1.5, 'intRoll'], ['reveal', 3.3, 'avoided'], ['emphasis', 4.2, 'certainLine']],
  scope: [['dismiss', 0, 'dismissL'], ['transition', 0, 'cam'], ['appear', 1.2, 'scope']],
  tax: [['transition', 0, 'cam'], ['appear', 0.9, 'taxHead'], ['appear', 1.8, 'taxRows']],
  bars: [['transition', 0, 'cam'], ['appear', 0.9, 'barA'], ['appear', 2.1, 'barB'], ['compare', 3.3, 'barsCompare'], ['appear', 4.5, 'slider']],
  sweep: [], // filled from the sweep schedule below
  settle: [['emphasis', 1.8, 'land']],
  morph: [['transition', 0, 'cam']],
  detail: [['reveal', 1.3, 'hero670'], ['emphasis', 2.2, 'underline670']],
  flip: [['transition', 0, 'cam'], ['appear', 1.2, 'below'], ['appear', 2.4, 'above'], ['emphasis', 3.3, 'arrow']],
  matrix: [['transition', 0, 'cam'], ['appear', 0.9, 'matrixHead'], ['count', 1.8, 'matrixRoll']],
  matrix32: [['emphasis', 0.3, 'circle32']],
  certain: [['transition', 0, 'cam'], ['compare', 1.2, 'columns']],
  sequence: [['dismiss', 0, 'dismissM'], ['transition', 0, 'cam'], ['appear', 1.5, 'seqText']],
  race: [['transition', 0, 'cam'], ['appear', 0.6, 'raceAxes']], // + month ticks below
  gap: [['transition', 0, 'cam']],
  cross: [['appear', 0.6, 'gapLabel'], ['threshold-cross', 2.4, 'crossMark'], ['appear', 3.3, 'crossText']],
  downside: [['reveal', 1.3, 'hero459'], ['emphasis', 2.2, 'underline459']],
  converge: [['dismiss', 0, 'dismissD'], ['transition', 0, 'cam'], ['appear', 1.5, 'convergeText']],
  outro: [['transition', 0, 'cam'], ['appear', 1.2, 'outroText'], ['dismiss', 5.1, 'fadeAll']],
};

// Sweep: slider moves 2% -> 10% between local 0.6 s and 9.6 s; the display snaps to the 0.25% grid.
const SWEEP = { t0: 0.6, t1: 9.6, lo: 2, hi: 10, steps: 32 };
// Race: lines draw months 0..48 between local 0.9 s and 7.8 s; a tick every 6 months.
const RACE = { t0: 0.9, t1: 7.2, tickEvery: 6 };
// Settle: slider glides 10% -> break-even between 0.3 s and 1.8 s (lands at 1.8).
const SETTLE = { t0: 0.3, t1: 1.8 };

// Intentional music silences: 0.4 s right before each decisive number (max 3).
const SILENCES = [['settle', 1.8], ['cross', 2.4], ['downside', 1.3]];
const SILENCE_LEN = 0.4;
// Stillness: camera + background drift stop when a decisive number lands.
const STILL = [['settle', 1.8, 0.8], ['detail', 1.3, 0.8], ['cross', 2.4, 0.8], ['downside', 1.3, 0.8]];

function build(data) {
  let t = 0;
  const scenes = SCENES.map((s, i) => {
    const dur = +(s.beats * BEAT).toFixed(3);
    const o = { ...s, index: i, start: +t.toFixed(3), dur };
    t += dur;
    return o;
  });
  const total = +t.toFixed(3);
  const byId = Object.fromEntries(scenes.map((s) => [s.id, s]));

  // sweep schedule: step k shows r_k from time tk; threshold-cross at the first k where barB > barA
  const sw = byId.sweep;
  const stepTimes = [];
  for (let k = 0; k <= SWEEP.steps; k++) stepTimes.push(SWEEP.t0 + (k / SWEEP.steps) * (SWEEP.t1 - SWEEP.t0));
  const crossK = data.sweep.findIndex((p) => p.barB > p.barA);
  const ev = [];
  const push = (scene, type, local, probe) => ev.push({ id: `${scene}:${probe}`, scene, type, t: +(byId[scene].start + local).toFixed(4), probe });
  for (const s of scenes) for (const [type, local, probe] of EVENTS[s.id]) push(s.id, type, local, probe);
  for (let k = 1; k <= SWEEP.steps; k++) push('sweep', 'count', stepTimes[k], `step${k}`);
  push('sweep', 'threshold-cross', stepTimes[crossK], `cross${crossK}`);
  const rc = byId.race;
  for (let m = RACE.tickEvery; m <= 48; m += RACE.tickEvery) push('race', 'count', RACE.t0 + (m / 48) * (RACE.t1 - RACE.t0), `month${m}`);
  ev.sort((a, b) => a.t - b.t);

  const silences = SILENCES.map(([sc, at]) => ({ scene: sc, start: +(byId[sc].start + at - SILENCE_LEN).toFixed(4), end: +(byId[sc].start + at).toFixed(4) }));
  const still = STILL.map(([sc, at, d]) => ({ scene: sc, start: +(byId[sc].start + at).toFixed(4), end: +(byId[sc].start + at + d).toFixed(4) }));
  return { bpm: BPM, beat: BEAT, total, scenes, events: ev, silences, still, sweep: { ...SWEEP, stepTimes, crossK }, race: RACE, settle: SETTLE };
}

module.exports = { BPM, BEAT, SCENES, EVENTS, SWEEP, RACE, SETTLE, SILENCES, STILL, build };
