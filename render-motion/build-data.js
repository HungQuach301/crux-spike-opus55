'use strict';
// Serializes data + timeline for the browser and for the audio generator.
const fs = require('fs');
const path = require('path');
const data = require('../src/car/data').build();
const timeline = require('../src/car/timeline').build(data);
fs.writeFileSync(path.join(__dirname, 'data.js'), 'window.DATA = ' + JSON.stringify(data) + ';\nwindow.TL = ' + JSON.stringify(timeline) + ';\n');
fs.mkdirSync(path.join(__dirname, '..', 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'out', 'timeline.json'), JSON.stringify(timeline, null, 1));
module.exports = { data, timeline };
if (require.main === module) console.log('wrote render-motion/data.js and out/timeline.json', timeline.total + 's');
