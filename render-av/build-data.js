'use strict';
// Serializes claims + the voice-driven timeline for the browser and the audio mixer.
//   out/timeline.json, render-av/data.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const data = require('../src/av/data').build();
const script = require('../src/av/script');
const T = require('../src/av/timeline');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'voice', f), 'utf8'));
const timeline = T.build({ script, prepared: rd('script.json'), asr: rd('asr.json') });
const { byId, ...dataOut } = data;
fs.writeFileSync(path.join(__dirname, 'data.js'), 'window.DATA = ' + JSON.stringify(dataOut) + ';\nwindow.TL = ' + JSON.stringify(timeline) + ';\n');
fs.writeFileSync(path.join(ROOT, 'out', 'timeline.json'), JSON.stringify(timeline, null, 1));
module.exports = { data, timeline };
if (require.main === module) {
  console.log('wrote render-av/data.js and out/timeline.json', timeline.total + 's', timeline.scenes.length, 'scenes', timeline.events.length, 'events');
  console.log('alignment', timeline.alignment.map((a) => `${a.scene} ${a.matched}/${a.total}`).join(', '));
  console.log(timeline.scenes.map((s) => `${s.id}:${s.dur}`).join(' '));
}
