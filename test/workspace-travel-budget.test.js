/* Het Travel-paneel declareert 40 KB als Peek-budget. Omdat deze bronbestanden
   samen met de modulehost worden geladen, bewaken we de echte bronomvang en
   verbieden we stil achtergrondpolling in de moduleset. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'public/shared/travel-request-controller.js',
  'public/shared/interface/modules/travel-actions.js',
  'public/shared/interface/modules/travel-continuity.js',
  'public/shared/interface/modules/travel-dossier-view.js',
  'public/shared/interface/modules/travel-edge.js',
  'public/shared/interface/modules/travel-view.js',
  'public/shared/interface/modules/travel.js'
];

test('de volledige TravelOS-module blijft binnen haar gedeclareerde Peek-budget', () => {
  const sources = FILES.map((file) => fs.readFileSync(path.join(ROOT, file)));
  const bytes = sources.reduce((total, source) => total + source.byteLength, 0);
  assert.ok(bytes <= 40 * 1024, 'TravelOS gebruikt ' + bytes + ' bytes van een budget van 40960');
  const code = Buffer.concat(sources).toString('utf8');
  assert.doesNotMatch(code, /setInterval\s*\(/, 'een geminimaliseerd Travel-paneel mag niet pollen');
});
