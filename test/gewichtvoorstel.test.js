/* ============================================================================
   HET VOORSTEL VOOR EEN NIEUW GEWICHTREGISTER.

   CI meet, CI stelt voor, een mens merget. Dit bestand bewaakt de twee kanten
   waarop dat mis kan gaan, en ze zijn allebei erger dan ze klinken:

     te veel voorstellen -- ruis went, en dan wordt ook het echte voorstel
                            weggeklikt;
     te veel macht       -- een script dat bij een storing de bouw laat zakken
                            of naar main schrijft, is geen voorstel maar een
                            besluit.
   ========================================================================== */
'use strict';
require('./toetsnaam');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'gewichtvoorstel.js');
const { lijf } = require('../scripts/gewichtvoorstel');

function draai(rijen, env) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'gewichtvoorstel-'));
  const bestand = path.join(map, 'oordeel.json');
  fs.writeFileSync(bestand, JSON.stringify(rijen));
  try {
    const uit = execFileSync(process.execPath, [SCRIPT, '--oordeel', bestand], {
      encoding: 'utf8', stdio: 'pipe',
      env: Object.assign({}, process.env, { GITHUB_TOKEN: '', GITHUB_REPOSITORY: '' }, env || {})
    });
    return { code: 0, uit };
  } catch (e) {
    return { code: e.status, uit: String(e.stdout || '') + String(e.stderr || '') };
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
}

test('bij ACTUEEL wordt er niets voorgesteld', () => {
  const r = draai([{ modus: 'dekking', status: 'ACTUEEL', fout: 0.01 }]);
  assert.equal(r.code, 0);
  assert.match(r.uit, /geen voorstel/, 'een register dat klopt hoort niemand lastig te vallen');
});

test('zonder token gebeurt er niets, en de bouw zakt niet', () => {
  /* Een voorstel dat niet lukt is geen kapotte keten. Zou dit script hier een
     foutcode geven, dan staat er een rood vinkje over de verkeerde vraag. */
  const r = draai([{ modus: 'dekking', status: 'VEROUDERD', fout: 0.4 }]);
  assert.equal(r.code, 0, 'een mislukt voorstel mag de keten nooit laten zakken');
  assert.match(r.uit, /geen token/, 'en het hoort te zeggen waarom er niets gebeurde');
});

test('een onleesbaar oordeel is geen reden om iets te doen', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'gewichtvoorstel-'));
  try {
    const r = execFileSync(process.execPath,
      [SCRIPT, '--oordeel', path.join(map, 'bestaat-niet.json')],
      { encoding: 'utf8', stdio: 'pipe' });
    assert.match(r, /geen driftoordeel/);
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

test('de tekst van het voorstel draagt de projectiefout en geen oordeel over de toetsen', () => {
  const tekst = lijf([{ modus: 'dekking', status: 'VEROUDERD', fout: 0.31,
    totaleKosten: 0.38, maxBestand: 2.12, maxNaam: 'ast-grens.test.js',
    stempel: { waar: 'lokaal' } }]);
  assert.match(tekst, /31%/, 'de projectiefout is de maat die telt en hoort er te staan');
  assert.match(tekst, /ast-grens\.test\.js/, 'en het ergste bestand erbij');
  assert.match(tekst, /NORM\.json/,
    'een trage toets is hier geen fout maar een ander gewicht -- dat hoort er expliciet bij');
});

test('het voorstel gaat naar een eigen tak en nooit naar main', () => {
  const bron = fs.readFileSync(SCRIPT, 'utf8');
  const { TAK } = require('../scripts/gewichtvoorstel');
  assert.ok(TAK && TAK !== 'main' && TAK !== 'master', 'de doeltak is een eigen tak');
  assert.match(bron, /git\('checkout', '-B', TAK\)/, 'er wordt op die tak gewerkt');
  assert.doesNotMatch(bron, /push\([^)]*'main'/, 'nergens een push naar main');
});
