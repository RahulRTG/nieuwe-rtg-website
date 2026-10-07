/* DE RATEL OP DE TIJDELIJKE LOOP FABRIC-DEKKING (besluit van 6 oktober 2026).

   scripts/norm.js telt uit LOOP-FABRIC-COVERAGE.json hoeveel capabilities nog
   PARTIALLY_LOOP_CAPABLE of NOT_YET_LOOP_CAPABLE zijn, en NORM.json laat dat
   getal alleen dalen. Deze toets houdt drie dingen vast: de meter telt precies
   die twee standen (geen oordeel als achterstand), hij zakt in plaats van nul
   te geven als zijn invoer ontbreekt, en de richting is omlaag. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { leesLoopFabric, METERS } = require('../scripts/norm');

const WORTEL = path.join(__dirname, '..');
const tijdelijk = (r) => r.capabilities.filter(c =>
  c.classification === 'PARTIALLY_LOOP_CAPABLE' || c.classification === 'NOT_YET_LOOP_CAPABLE').length;

function bestand(inhoud) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'loopratel-'));
  const p = path.join(map, 'LOOP-FABRIC-COVERAGE.json');
  if (inhoud !== undefined) fs.writeFileSync(p, typeof inhoud === 'string' ? inhoud : JSON.stringify(inhoud));
  return p;
}

test('de meter telt precies de twee tijdelijke standen', () => {
  const p = bestand({ capabilities: [
    { id: 'a', classification: 'PARTIALLY_LOOP_CAPABLE' },
    { id: 'b', classification: 'NOT_YET_LOOP_CAPABLE' },
    { id: 'c', classification: 'HUMAN_REVIEW_REQUIRED' },
    { id: 'd', classification: 'PROHIBITED_FROM_LEARNING' },
    { id: 'e', classification: 'NO_LEARNING_VALUE' },
    { id: 'f', classification: 'LOOP_CAPABLE' }
  ] });
  assert.equal(leesLoopFabric(p), 2, 'een oordeel (review, verboden, geen waarde) is geen achterstand');
});

test('en op het echte register telt hij hetzelfde als een eigen telling', () => {
  const echt = JSON.parse(fs.readFileSync(path.join(WORTEL, 'LOOP-FABRIC-COVERAGE.json'), 'utf8'));
  assert.equal(leesLoopFabric(path.join(WORTEL, 'LOOP-FABRIC-COVERAGE.json')), tijdelijk(echt));
});

test('een ontbrekend, onleesbaar of leeg register laat de meter zakken in plaats van nul te geven', () => {
  assert.throws(() => leesLoopFabric(bestand()), /ontbreekt/);
  assert.throws(() => leesLoopFabric(bestand('{kapot')), /niet te lezen/);
  assert.throws(() => leesLoopFabric(bestand({ capabilities: [] })), /meter zonder invoer/);
});

test('de ratel mag alleen omlaag, en NORM.json kent hem', () => {
  const m = METERS.find(x => x.sleutel === 'loopFabricTijdelijk');
  assert.ok(m, 'de meter staat in de lijst');
  assert.equal(m.richting, 'omlaag');
  const norm = JSON.parse(fs.readFileSync(path.join(WORTEL, 'NORM.json'), 'utf8'));
  assert.equal(typeof norm.meters.loopFabricTijdelijk, 'number', 'NORM.json draagt een vastgelegde stand');
});
