'use strict';
// Test D M3: focus racks on the story turns of acts 2 and 3 (timeline.turns, cue words late in the line so the rack
// is not absorbed by the cut). Loaded after the scene files: it adds the rack to whatever camera the scene already has.
(function () {
  const CAM = window.CAMS.CAM;
  for (const [id, z] of [['a2-1982', -260], ['a2-climax', -280], ['a2-1991', -250], ['a3-decade', -260], ['a3-answer', -240]]) {
    const c = CAM[id] || (CAM[id] = { f: 50, base: {} });
    if (c.focus === undefined) c.focus = 0;
    c.racks = [...(c.racks || []).filter((r) => r[0] !== 'turn'), ['turn', 0.8, z]];
  }
})();
