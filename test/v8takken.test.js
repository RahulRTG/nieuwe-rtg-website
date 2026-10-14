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
  /* Zonder NODE_TEST_CONTEXT: draait deze toets zelf onder `node --test`, dan
     zou de geneste run zich als kind melden en geen eigen lcov schrijven. */
  const env = { ...process.env, NODE_V8_COVERAGE: ruw };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['--test', '--experimental-test-coverage',
    '--test-reporter=lcov', '--test-reporter-destination=' + path.join(uit, naam + '.info'),
    path.join('test', toets)], { cwd: w, env, encoding: 'utf8' });
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

test('een tak die in twee batches voorkomt, telt een keer -- en twee keer dezelfde batch verandert niets', () => {
  const w = wereld();
  const mappen = [];
  const map = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-v8m-')); mappen.push(d); return d; };
  try {
    const ab = map(), ba = map(), abb = map();
    batch(w, ab, 'deel-1-1', 'a.test.js'); batch(w, ab, 'deel-2-1', 'b.test.js');
    batch(w, ba, 'deel-1-1', 'b.test.js'); batch(w, ba, 'deel-2-1', 'a.test.js');
    batch(w, abb, 'deel-1-1', 'a.test.js'); batch(w, abb, 'deel-2-1', 'b.test.js'); batch(w, abb, 'deel-3-1', 'b.test.js');
    const t = takkenVan(ab);
    /* DE WAARHEID VOOR DEZE BRON, met de hand nageteld: zes blokken -- de
       module, f, de klein-kant van f, g, de ja-kant en de nee-kant van g. Na A
       en B samen is alleen de klein-kant nooit uitgevoerd (f kreeg alleen 2).
       De oude optelling gaf hier 4 van 7: g's twee kanten dubbel in de noemer,
       en geen van beide gedekt. */
    assert.deepEqual([t.gedekt, t.totaal], [5, 6], 'de vloer telt wat de bron heeft:\n' + t.uit);
    const o = takkenVan(ba), d = takkenVan(abb);
    assert.deepEqual([o.gedekt, o.totaal], [t.gedekt, t.totaal], 'de volgorde van de batches doet er niet toe');
    assert.deepEqual([d.gedekt, d.totaal], [t.gedekt, t.totaal], 'een batch die nog eens draait, telt niets dubbel');
  } finally {
    fs.rmSync(w, { recursive: true, force: true });
    for (const d of mappen) fs.rmSync(d, { recursive: true, force: true });
  }
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
    assert.deepEqual(k.bestanden['server/a.js'], { takken: ['0-90', '40-60'], uitgevoerd: [[0, 40], [60, 90]] },
      'beide blokken in de noemer, en uitgevoerd is wat niet in het nul-blok ligt');
    assert.equal(r.onleesbaar, 1, 'een afgebroken ruw bestand verdwijnt niet stil');
    assert.equal(k.onleesbaar, 1);
  } finally {
    fs.rmSync(ruw, { recursive: true, force: true });
    fs.rmSync(uit, { force: true });
  }
});

test('samenvoegen: een plek die in een batch is uitgevoerd, is uitgevoerd, en de volgorde doet er niet toe', () => {
  const v8 = require('../scripts/lib/v8takken');
  /* p: na een run die de nee-kant (40-60) niet nam; q: na een run die de
     ja-kant (20-40) niet nam. Samen zijn beide kanten uitgevoerd. */
  const p = { bestanden: { 'server/a.js': { takken: ['0-90', '40-60'], uitgevoerd: [[0, 40], [60, 90]] } }, onleesbaar: 0 };
  const q = { bestanden: { 'server/a.js': { takken: ['0-90', '20-40'], uitgevoerd: [[0, 20], [40, 90]] },
    'server/b.js': { takken: ['0-5'], uitgevoerd: [] } }, onleesbaar: 1 };
  const een = v8.tel(v8.voegSamen([p, q]));
  assert.deepEqual(v8.tel(v8.voegSamen([q, p])), een);
  assert.deepEqual(een, { bestanden: 2, gedekt: 3, totaal: 4, pct: 75, onleesbaar: 1 });
});

test('de V8-regel: de telling van een plek is die van het binnenste bereik dat haar omvat', () => {
  const { uitgevoerd } = require('../scripts/lib/v8takken');
  assert.deepEqual(uitgevoerd([{ startOffset: 0, endOffset: 100, count: 1 }, { startOffset: 10, endOffset: 50, count: 0 },
    { startOffset: 20, endOffset: 30, count: 2 }]), [[0, 10], [20, 30], [50, 100]], 'een uitgevoerd blok binnen een niet-uitgevoerd blok telt');
  assert.deepEqual(uitgevoerd([{ startOffset: 0, endOffset: 10, count: 0 }]), [], 'nul is nergens uitgevoerd');
  assert.deepEqual(uitgevoerd([]), []);
});
