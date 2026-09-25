'use strict';
// Serializes computed datasets for the browser and writes claims.json.
const fs = require('fs');
const path = require('path');
const { buildAll, SOURCE } = require('../src/data');

const all = buildAll();
fs.writeFileSync(path.join(__dirname, 'data.js'), 'window.DATA = ' + JSON.stringify(all) + ';\n');
module.exports = { all, SOURCE };
if (require.main === module) console.log('wrote render/data.js');
