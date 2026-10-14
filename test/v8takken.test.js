/* ============================================================================
   DEZELFDE TAK IS IN ELKE SCHERF DEZELFDE TAK.

   De dekkingsvloer telde de takken van alle scherven op met de sleutel die
   Node's lcov-reporter meegeeft: BRDA:<regel>,<blok>,<tak>. Dat <blok> is geen
   plek in de bron maar een VOLGNUMMER -- de hoeveelste tak van dat bestand in
   DIT proces. En V8 meldt de blokken van een functie alleen als die functie in
   dat proces is gecompileerd. Raakt de ene batch functie f wel en de andere
   niet, dan schuiven in de tweede batch alle nummers na f op, en bij het
   optellen tellen dezelfde takken als NIEUWE, ongedekte takken. Gevolg op de
   hele suite (14 oktober 2026, gemeten over de vier scherven op main): een
   noemer van 208.865 takken waarvan er ongeveer 83.000 dubbel geteld waren, en
   een vloer die per run schommelde -- dezelfde commit gaf twee keer een ander
   totaal (179.261 en 179.459).

   De stabiele sleutel is de plek van het blok in de bron: begin- en
   eindpositie in bytes, zoals V8 hem in de ruwe dekking (NODE_V8_COVERAGE)
   zelf meldt. Die is in elk proces gelijk. Deze toetsen maken twee echte
   batches tegen een vaste module en eisen dat de takken een keer tellen.

   Draai los: node --test test/v8takken.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const VLOER = path.join(WORTEL, 'scripts', 'dekkingsvloer.js');

/* Een kleine wereld: server/fx.js met twee functies, en twee toetsbestanden.
   Batch A roept f EN g aan, batch B alleen g -- in B wordt f dus nooit
   gecompileerd, en dat is precies het geval dat de nummering verschuift. */
function wereld() {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-v8takken-'));
  fs.mkdirSync(path.join(w, 'server'));
  fs.mkdirSync(path.join(w, 'test'));
  fs.writeFileSync(path.join(w, 'server', 'fx.js'), [
    "'use strict';",
    'function f(x) {',
    '  if (x > 1) return "groot";',
    '  return "klein";',
    '}',
    'function g(y) {',
    '  return y ? "ja" : "nee";',
    '}',
    'module.exports = { f, g };',
    ''
  ].join('\n'));
  fs.writeFileSync(path.join(w, 'test', 'a.test.js'),
    "const t=require('node:test');const fx=require('../server/fx');t('a',()=>{fx.f(2);fx.g(1);});\n");
  fs.writeFileSync(path.join(w, 'test', 'b.test.js'),
    "const t=require('node:test');const fx=require('../server/fx');t('b',()=>{fx.g(0);});\n");
  return w;
}

/* Een batch zoals scripts/test-runner.js hem met --dekking draait: lcov naast
   de ruwe V8-dekking, en die laatste compact bewaard naast het lcov-bestand. */
function batch(w, uit, naam, toets) {
  const ruw = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-v8ruw-'));
  const r = spawnSync(process.execPath, ['--test', '--experimental-test-coverage',
    '--test-reporter=lcov', '--test-reporter-destination=' + path.join(uit, naam + '.info'),
    path.join('test', toets)], { cwd: w, env: { ...process.env, NODE_V8_COVERAGE: ruw }, encoding: 'utf8' });
  assert.equal(r.status, 0, 'de proefbatch zelf hoort te slagen: ' + r.stderr);
  require('../scripts/lib/v8takken').bewaar(ruw, path.join(uit, naam + '.takken.json'), w);
  fs.rmSync(ruw, { recursive: true, force: true });
}

function takkenVan(map) {
  const r = spawnSync(process.execPath, [VLOER, '--map', map], { cwd: WORTEL, encoding: 'utf8' });
  const m = /takken\s+[\d.]+%\s+\((\d+)\/(\d+)\)/.exec(r.stdout + r.stderr);
  assert.ok(m, 'de vloer meldt een takkenregel:\n' + r.stdout + r.stderr);
  return { gedekt: Number(m[1]), totaal: Number(m[2]), uit: r.stdout + r.stderr };
}

test('een tak die in twee batches voorkomt, telt een keer in de noemer', () => {
  const w = wereld();
  try {
    const alleenA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-v8a-'));
    const samen = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-v8ab-'));
    batch(w, alleenA, 'deel-1-1', 'a.test.js');
    batch(w, samen, 'deel-1-1', 'a.test.js');
    batch(w, samen, 'deel-2-1', 'b.test.js');
    const a = takkenVan(alleenA);
    const ab = takkenVan(samen);
    /* B voegt geen enkele nieuwe plek in de bron toe: hij raakt alleen g, en g
       zat al in A. De noemer mag dus niet groeien -- dat deed hij wel, omdat
       B's volgnummers na het weggevallen f een plaats opschoven. */
    assert.equal(ab.totaal, a.totaal, 'dezelfde bron, dezelfde takken:\nA: ' + a.uit + '\nA+B: ' + ab.uit);
    /* En B voegt een gedekte arm toe: de nee-kant van g, die A niet nam. */
    assert.ok(ab.gedekt > a.gedekt, 'de nee-kant van g uit batch B telt mee');
    for (const d of [alleenA, samen]) fs.rmSync(d, { recursive: true, force: true });
  } finally { fs.rmSync(w, { recursive: true, force: true }); }
});

test('bij elk lcov-bestand hoort een takkenbestand, anders telt de vloer niet', () => {
  const w = wereld();
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-v8los-'));
  try {
    batch(w, map, 'deel-1-1', 'a.test.js');
    fs.rmSync(path.join(map, 'deel-1-1.takken.json'));
    const r = spawnSync(process.execPath, [VLOER, '--map', map], { cwd: WORTEL, encoding: 'utf8' });
    assert.notEqual(r.status, 0, 'zonder takkenbestand is er geen takkenmeting -- en dus geen oordeel');
    assert.match(r.stdout + r.stderr, /deel-1-1/, 'en de melding noemt het bestand');
  } finally {
    fs.rmSync(w, { recursive: true, force: true });
    fs.rmSync(map, { recursive: true, force: true });
  }
});

test('het takkenbestand houdt alleen de eigen bron vast, en een onleesbaar ruw bestand wordt geteld', () => {
  const v8 = require('../scripts/lib/v8takken');
  const ruw = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-v8hand-'));
  const uit = path.join(ruw, '..', path.basename(ruw) + '.takken.json');
  try {
    const wortel = '/rtg';
    fs.writeFileSync(path.join(ruw, 'coverage-1.json'), JSON.stringify({ result: [
      { url: 'file:///rtg/server/a.js', functions: [
        { functionName: '', isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: 90, count: 1 }, { startOffset: 40, endOffset: 60, count: 0 }] }] },
      { url: 'file:///rtg/node_modules/x/i.js', functions: [{ functionName: '', isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: 9, count: 1 }] }] },
      { url: 'file:///rtg/test/a.test.js', functions: [{ functionName: '', isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: 9, count: 1 }] }] },
      { url: 'node:internal/x', functions: [{ functionName: '', isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: 9, count: 1 }] }] }
    ] }));
    fs.writeFileSync(path.join(ruw, 'coverage-2.json'), '{"result":[{"url":"file:///rtg/serv');
    const r = v8.bewaar(ruw, uit, wortel);
    const k = JSON.parse(fs.readFileSync(uit, 'utf8'));
    assert.deepEqual(Object.keys(k.bestanden), ['server/a.js'], 'node_modules, toetsen en node-intern vallen buiten de meting');
    assert.deepEqual(k.bestanden['server/a.js'], { gedekt: ['0-90'], open: ['40-60'] });
    assert.equal(r.onleesbaar, 1, 'een afgebroken ruw bestand verdwijnt niet stil');
    assert.equal(k.onleesbaar, 1);
  } finally {
    fs.rmSync(ruw, { recursive: true, force: true });
    fs.rmSync(uit, { force: true });
  }
});

test('samenvoegen: gedekt in een batch is gedekt, en de volgorde doet er niet toe', () => {
  const v8 = require('../scripts/lib/v8takken');
  const p = { bestanden: { 'server/a.js': { gedekt: ['0-90'], open: ['40-60', '60-80'] } }, onleesbaar: 0 };
  const q = { bestanden: { 'server/a.js': { gedekt: ['0-90', '40-60'], open: [] }, 'server/b.js': { gedekt: [], open: ['0-5'] } }, onleesbaar: 0 };
  const een = v8.tel(v8.voegSamen([p, q]));
  const twee = v8.tel(v8.voegSamen([q, p]));
  assert.deepEqual(een, twee);
  assert.deepEqual(een, { bestanden: 2, gedekt: 2, totaal: 4, pct: 50, onleesbaar: 0 });
});
