/* EEN LINK NAAR EEN STAND VAN DE APP LANDT OP DIE STAND.

   Gevonden bij de domeinkaart van FoundationOS (19 oktober 2026):
   apps/foundation/zorg.html linkte twee keer naar /apps/app.html#zorg. De app
   kent alleen #tab=<stand> en #ai (app-main-12a.js); met #zorg landde het lid
   op het beginscherm in plaats van bij het zorgaanbod. Deze toets eist voor
   elke Foundation-link naar de app die vorm, en een stand die als knop in de
   tabbalk van app.html bestaat.

   Draai los: node --test test/foundation-applinks.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const MAP = path.join(__dirname, '..', 'public', 'apps', 'foundation');
const APP = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'app.html'), 'utf8');
const STANDEN = new Set([...APP.matchAll(/<button[^>]*\sdata-tab="([a-z]+)"/g)].map((m) => m[1]));

function bestanden(map) {
  return fs.readdirSync(map, { withFileTypes: true }).flatMap((d) => d.isDirectory()
    ? bestanden(path.join(map, d.name)) : /\.(html|js)$/.test(d.name) ? [path.join(map, d.name)] : []);
}

test('elke Foundation-link naar een stand van de app gebruikt #tab=<stand> en die stand bestaat', () => {
  assert.ok(STANDEN.has('zorg'), 'de tabbalk van app.html kent de stand zorg');
  const fout = [];
  for (const f of bestanden(MAP)) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/\/apps\/app\.html#([^"'\s)<>]*)/g)) {
      const h = m[1];
      const goed = h === 'ai' || (/^tab=([a-z]+)$/.test(h) && STANDEN.has(h.slice(4)));
      if (!goed) fout.push(path.relative(MAP, f) + ': #' + h);
    }
  }
  assert.deepEqual(fout, [], 'links die op het beginscherm landen in plaats van bij hun stand');
});
