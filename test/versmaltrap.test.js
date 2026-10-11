/* ============================================================================
   DE TRAP VAN HET VERSMALLEN (KEURING.md par. 8, ARCHITECTOPDRACHT.md fase 8)

   Fase 8 bouwt niets aan: hij beschrijft de trap. Deze toets houdt twee
   dingen vast die zonder hem stil zouden verschuiven:

     1. elk instrument dat par. 8 noemt, bestaat. Een trap die naar verdwenen
        meters wijst, beschrijft een recht dat niemand meer kan verdienen of
        intrekken;
     2. de stand is trede 0. Geen selectie- of uitvoeringscode van de keten
        leest de Architect of de toetsroutekaart, en de Architect zegt bij
        elke wijziging dat toetsreductie niet is toegestaan.

   Mutaties die deze toets laat zakken: hernoem een instrument dat par. 8
   noemt; of laat scripts/plan.js scripts/toetsroutes.js inladen.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const A = require('../scripts/lib/codearchitect');

const WORTEL = path.join(__dirname, '..');
const keuring = fs.readFileSync(path.join(WORTEL, 'KEURING.md'), 'utf8');
const par8 = keuring.slice(keuring.indexOf('## 8. De trap'));

test('1. par. 8 staat er, met vier treden en de stand', () => {
  assert.ok(keuring.includes('## 8. De trap'), 'KEURING.md mist de trap');
  for (const t of ['| 0 |', '| 1 |', '| 2 |', '| 3 |']) assert.ok(par8.includes(t), 'trede ontbreekt: ' + t);
  assert.match(par8, /\*\*Stand: trede 0\.\*\*/);
  assert.match(par8, /Intrekken gaat vanzelf, toekennen nooit/);
});

test('2. elk instrument dat par. 8 noemt, bestaat', () => {
  const genoemd = [...new Set(par8.match(/`((?:scripts|test)\/[\w./-]+\.js)`/g) || [])].map((x) => x.slice(1, -1));
  assert.ok(genoemd.length >= 5, 'par. 8 noemt te weinig instrumenten: ' + genoemd.join(', '));
  for (const p of genoemd) assert.ok(fs.existsSync(path.join(WORTEL, p)), p + ' wordt genoemd maar bestaat niet');
  const wetten = require('../WETTEN.json').wetten.map((w) => w.id);
  for (const id of par8.match(/`(keuring-[a-z-]+)`/g) || []) assert.ok(wetten.includes(id.slice(1, -1)), id + ' staat niet in WETTEN.json');
});

test('3. de stand is trede 0: de keten selecteert niets met de Architect of de toetsroutekaart', () => {
  const keten = ['scripts/plan.js', 'scripts/evidence.js', 'scripts/test-runner.js', 'scripts/lib/evidence-dag.js',
    'scripts/lib/bewijsboek.js', 'scripts/lib/risico.js', 'scripts/lib/semdiff.js'];
  for (const p of keten) {
    const bron = fs.readFileSync(path.join(WORTEL, p), 'utf8');
    assert.doesNotMatch(bron, /require\([^)]*(?:codearchitect|toetsroutes|TOETSROUTES)/, p + ' leest de Architect of de toetsroutekaart: dat is een trede boven 0');
  }
});

test('4. de Architect zegt bij elke wijziging dat toetsreductie niet mag', () => {
  const lezer = A.maakLezer();
  for (const b of [['server/kern/pay/poort.js'], ['README.md'], ['bestaat/niet.js']]) {
    const i = A.impact(lezer, b);
    assert.equal(i.toetsreductie.toegestaan, false, b[0]);
    assert.match(i.toetsreductie.reden, /KEURING\.md/);
  }
});
