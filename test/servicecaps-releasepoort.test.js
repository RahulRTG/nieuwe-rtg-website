/* ============================================================================
   SERVICECAPABILITIES ZIJN EEN RELEASEPOORT, GEEN RAPPORT.

   scripts/check.js heeft bewust een aflopende ratel voor dagelijks werk. Een
   release mag die acht bestaande gaten niet erven: --controle moet rood zijn
   zodra minstens één bevestigbare capability geen echte magNu-lezer heeft, en
   release-gate.js moet precies die strikte stand uitvoeren.

   De toets bevat expres geen lijst met uitzonderingen. Zodra een capability
   een lezer krijgt of uit de actieve teamtabel (contract + UI) verdwijnt, wordt
   de actuele telling vanzelf lager; alleen nul maakt de controle groen.

   Draai los: node --test test/servicecaps-releasepoort.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');

function draai(...args) {
  return cp.spawnSync(process.execPath, ['scripts/servicecaps.js', ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 30000
  });
}

test('1. --controle volgt de actuele telling en kent geen schuldvrijstelling', () => {
  const rapport = draai();
  assert.equal(rapport.status, 0, rapport.stderr);
  const m = /^\s*(\d+) van (\d+) bevoegdheden die het LID bevestigt/m.exec(rapport.stdout);
  assert.ok(m, 'het rapport gaf geen controleerbare telling');
  const stil = Number(m[1]);
  const streng = draai('--controle');
  assert.equal(streng.status, stil === 0 ? 0 : 1,
    '--controle volgt niet de echte nulgrens; stille capabilities: ' + stil);
  if (stil) assert.match(streng.stderr, new RegExp('servicecaps: ' + stil + ' bevoegdheid'));
});
test('2. de releaseketen roept de strikte stand aan vóór bewijs en uitrol', () => {
  const bron = fs.readFileSync(path.join(ROOT, 'scripts', 'release-gate.js'), 'utf8');
  const controle = bron.indexOf("['scripts/servicecaps.js', '--controle']");
  const bewijs = bron.indexOf("['scripts/release-bewijs.js']");
  assert.ok(controle >= 0, 'de releaseketen draait servicecaps niet met --controle');
  assert.ok(bewijs > controle, 'het releasebewijs wordt gemaakt voordat de capabilitypoort slaagt');
  assert.doesNotMatch(bron, /servicecaps[^\n]*(?:allow|uitzonder|baseline)/i,
    'de releaseketen bevat een uitzonderingslijst voor stille capabilities');
});
