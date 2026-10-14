/* ============================================================================
   DE IDENTITEIT VAN EEN TAK, BEWEZEN OP EEN REFERENTIEDATASET.

   Eigenaarsbesluit (14 oktober 2026): de takken van verschillende
   toetsprocessen mogen pas anders worden samengevoegd als op een kleine,
   vaste dataset is aangetoond dat de samenvoeging geen dubbele en geen
   verdwenen takken oplevert. Dit bestand is dat bewijs.

   DE DATASET staat in test/fixtures/takidentiteit/: twee kleine bronbestanden
   met bekende takken, en hieronder vier processen die elk een ander deel raken.
   Elk proces draait zoals een batch van scripts/test-runner.js met --dekking:
   `node --test` met de lcov-reporter, en V8's ruwe dekking ernaast, die
   scripts/lib/v8takken.js tot een takkenbestand maakt. Daarna telt
   scripts/dekkingsvloer.js alles op, en schrijft hij de inventaris per bestand.

   DE WAARHEID is met de hand opgesteld, tak voor tak, als stukje brontekst
   waar het telpunt begint (WAARHEID hieronder). Hoe die lijst is gevonden: elke
   functie is los gedraaid met alle invoercombinaties en wisselende aantallen,
   en elk bereik dat V8 daarbij meldde, is tegen de bron gelegd. Er zijn er geen
   andere. Twee grenzen van de DATA staan er bewust in:
     - nooit() en eerste() draaien in geen enkel proces. Van een functie die
       nooit is gecompileerd kent V8 alleen het functiebereik; hun binnenste
       takken bestaan voor de meting niet, en de functie telt als EEN ongedekte
       tak -- zo doet Node's eigen reporter het ook in een enkel proces.
     - eerste.js begint op plek 0 met `function`. Module en functie beginnen
       daar dus op dezelfde plek; het zijn twee takken.

   Wat hier niet mag sneuvelen:
     1. De noemer is precies de lijst echte takken: geen tak twee keer, ook niet
        als V8 hem in het ene proces samengevoegd met zijn buurman meldt
        (else-tak 66-115) en in het andere los (66-100).
     2. Geen tak verdwijnt: een tak die V8 alleen in een ander proces meldt
        (return 'b', alleen in P4), telt mee, en is gedekt als hij in een proces
        WEL is uitgevoerd waar V8 hem niet meldde (P2).
     3. Een tak die in geen enkel proces is genomen (case 2, nooit, eerste) telt
        als ongedekt.
     4. Twee takken op dezelfde regel blijven twee (de vier kanten van teken op
        regel 10).
     5. De inventaris per bestand telt op tot het totaal van de vloer.
   En ernaast, als tegenvoorbeeld: de oude lcov-sleutel en een afgeleide
   sleutel "regel + volgorde op de regel" geven op dezelfde data het verkeerde
   aantal. Dat is waarom de sleutel uit de ruwe V8-dekking komt.

   MUTATIES die zijn gedraaid op scripts/lib/v8takken.js en welke toets erop
   zakte (LAT.md regel 2):
     - blokken weer op begin-eind sleutelen (de vorige identiteit): toets 1
       ("geen sleutel die geen echte tak is": de else-tak telt twee keer).
     - functies alleen op begin sleutelen: toets 1 (module en eerste() vallen
       samen op plek 0, en de sleutels kloppen niet meer met de waarheid).
     - een functie op de plek in plaats van op de eigen telling dekken: toets 1
       (de module van eerste.js, F:0-70, telt dan als ongedekt).
     - de uitgevoerde stukken van een batch niet meenemen bij het optellen:
       toets 1 (de then-tak van kies, B:45, telt dan als ongedekt).
     - de botsingenwachter uit (nooit tellen): toets 3.

   Draai los: node --test test/dekking-takidentiteit.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const DATASET = path.join(__dirname, 'fixtures', 'takidentiteit');
const VLOER = path.join(WORTEL, 'scripts', 'dekkingsvloer.js');
const v8 = require('../scripts/lib/v8takken');
const lcov = require('../scripts/lib/lcov');

const BRON = {
  'server/takken.js': fs.readFileSync(path.join(DATASET, 'takken.js'), 'utf8'),
  'server/eerste.js': fs.readFileSync(path.join(DATASET, 'eerste.js'), 'utf8')
};

/* Vier processen, elk een ander deel. P1 laadt eerste.js maar roept niets aan. */
const PROCESSEN = {
  p1: "require('../server/eerste'); fx.kies(1); fx.teken(7); fx.soort(1); fx.soort(1); fx.soort(3);",
  p2: 'fx.kies(1); fx.kies(1); fx.kies(0, 1);',
  p3: 'fx.teken(1); fx.teken(0);',
  p4: 'fx.kies(0, 0);'
};

/* [bestand, F of B, waar het telpunt begint (en bij F: de hele functie), gedekt] */
const WAARHEID = [
  ['server/takken.js', 'F', BRON['server/takken.js'], true],
  ['server/takken.js', 'F', "function kies(c, d) {\n  if (c) {\n    return 'a';\n  } else {\n    if (d) return 'b';\n  }\n  return 'c';\n}", true],
  ['server/takken.js', 'B', "{\n    return 'a';", true],
  ['server/takken.js', 'B', ' else {', true],
  ['server/takken.js', 'B', "return 'b';", true],
  ['server/takken.js', 'B', "\n  return 'c';", true],
  ['server/takken.js', 'F', "function teken(a) { return a ? (a > 5 ? 'x' : 'y') : 'z'; }", true],
  ['server/takken.js', 'B', '? (a > 5', true],
  ['server/takken.js', 'B', "? 'x'", true],
  ['server/takken.js', 'B', ": 'y'", true],
  ['server/takken.js', 'B', ": 'z'", true],
  ['server/takken.js', 'F', "function soort(k) {\n  switch (k) {\n    case 1: return 'een';\n    case 2: return 'twee';\n    default: return 'anders';\n  }\n}", true],
  ['server/takken.js', 'B', "case 1: return 'een';", true],
  ['server/takken.js', 'B', "case 2: return 'twee';", false],
  ['server/takken.js', 'B', "default: return 'anders';", true],
  ['server/takken.js', 'F', "function nooit(n) { return n > 0 ? 'pos' : 'neg'; }", false],
  ['server/eerste.js', 'F', BRON['server/eerste.js'], true],
  ['server/eerste.js', 'F', 'function eerste(x) { return x ? 1 : 2; }', false]
];

function verwacht() {
  const uit = new Map();
  for (const [rel, soort, tekst, gedekt] of WAARHEID) {
    const bron = BRON[rel];
    const begin = bron.indexOf(tekst);
    assert.ok(begin >= 0 && bron.indexOf(tekst, begin + 1) < 0, 'het anker staat precies een keer in de bron: ' + tekst);
    const sleutel = soort === 'F' ? 'F:' + begin + '-' + (begin + tekst.length) : 'B:' + begin;
    uit.set(rel + ' ' + sleutel, gedekt);
  }
  return uit;
}

/* De wereld en de vier batches, een keer voor het hele bestand. */
let wereld = null;
function bouw() {
  if (wereld) return wereld;
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-takid-'));
  const map = path.join(w, 'dekking');
  fs.mkdirSync(path.join(w, 'server'));
  fs.mkdirSync(path.join(w, 'test'));
  fs.mkdirSync(map);
  for (const [rel, tekst] of Object.entries(BRON)) fs.writeFileSync(path.join(w, rel), tekst);
  let nr = 0;
  for (const [naam, aanroepen] of Object.entries(PROCESSEN)) {
    fs.writeFileSync(path.join(w, 'test', naam + '.test.js'),
      "const t = require('node:test'); const fx = require('../server/takken');\nt('" + naam + "', () => { " + aanroepen + ' });\n');
    const ruw = path.join(w, 'ruw-' + naam);
    /* Zonder NODE_TEST_CONTEXT: draait deze toets zelf onder `node --test`,
       dan zou de geneste run zich als kind melden en geen eigen lcov schrijven. */
    const env = { ...process.env, NODE_V8_COVERAGE: ruw };
    delete env.NODE_TEST_CONTEXT;
    const batch = 'deel-' + (++nr) + '-1';
    const r = spawnSync(process.execPath, ['--test', '--experimental-test-coverage',
      '--test-reporter=lcov', '--test-reporter-destination=' + path.join(map, batch + '.info'),
      path.join('test', naam + '.test.js')], { cwd: w, env, encoding: 'utf8' });
    assert.equal(r.status, 0, 'proces ' + naam + ' hoort zelf te slagen: ' + r.stderr);
    v8.bewaar(ruw, path.join(map, batch + '.takken.json'), w);
  }
  wereld = { w, map };
  return wereld;
}

function takkenbestanden(map) {
  return fs.readdirSync(map).filter((n) => n.endsWith('.takken.json')).sort()
    .map((n) => JSON.parse(fs.readFileSync(path.join(map, n), 'utf8')));
}

function samengevoegd(lijst) {
  const samen = v8.voegSamen(lijst);
  const uit = new Map();
  for (const [rel, d] of samen.per) for (const s of v8.sleutels(d)) {
    const k = rel + ' ' + s.sleutel;
    assert.ok(!uit.has(k), 'een sleutel komt een keer voor: ' + k);
    uit.set(k, s.gedekt);
  }
  return { samen, uit };
}

test.after(() => { if (wereld) fs.rmSync(wereld.w, { recursive: true, force: true }); });

test('de samengevoegde takken zijn precies de echte takken: niets dubbel, niets weg, en de dekking per tak klopt', () => {
  const { map } = bouw();
  const { uit } = samengevoegd(takkenbestanden(map));
  const waar = verwacht();
  const dubbel = [...uit.keys()].filter((k) => !waar.has(k));
  const weg = [...waar.keys()].filter((k) => !uit.has(k));
  assert.deepEqual(dubbel, [], 'geen sleutel die geen echte tak is (dubbel of verzonnen)');
  assert.deepEqual(weg, [], 'geen echte tak die uit de optelling verdwijnt');
  assert.equal(uit.size, 18);
  for (const [k, gedekt] of waar) assert.equal(uit.get(k), gedekt, 'dekking van ' + k);
  /* De twee gevallen waar het om begon, apart benoemd. */
  const t = BRON['server/takken.js'];
  assert.equal(uit.get('server/takken.js B:' + t.indexOf(' else {')), true,
    'de else-tak telt een keer en is gedekt, ook al meldt V8 hem in P1 samen met het vervolg');
  assert.equal(uit.get('server/takken.js B:' + t.indexOf("return 'b';")), true,
    "return 'b' telt mee (alleen P4 meldt hem) en is gedekt (in P2 uitgevoerd, waar V8 hem niet meldde)");
  /* Volgorde en herhaling doen er niet toe. */
  const lijst = takkenbestanden(map);
  const om = samengevoegd(lijst.slice().reverse()).uit;
  const twee = samengevoegd([...lijst, ...lijst]).uit;
  assert.deepEqual([...om].sort(), [...uit].sort(), 'de volgorde van de batches doet er niet toe');
  assert.deepEqual([...twee].sort(), [...uit].sort(), 'een batch die twee keer telt, telt niets dubbel');
});

test('de vloer en de inventaris per bestand rekenen op dezelfde optelling', () => {
  const { map } = bouw();
  const per = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-takid-per-')), 'per-bestand.json');
  try {
    const r = spawnSync(process.execPath, [VLOER, '--map', map, '--per-bestand', per], { cwd: WORTEL, encoding: 'utf8' });
    const tekst = r.stdout + r.stderr;
    const m = /takken\s+[\d.]+%\s+\((\d+)\/(\d+)\)/.exec(tekst);
    assert.ok(m, 'de vloer meldt een takkenregel:\n' + tekst);
    assert.deepEqual([Number(m[1]), Number(m[2])], [15, 18], 'de vloer telt de echte takken:\n' + tekst);
    const inv = JSON.parse(fs.readFileSync(per, 'utf8'));
    assert.deepEqual(inv.bestanden, {
      'server/eerste.js': { gedekt: 1, ongedekt: 1, totaal: 2 },
      'server/takken.js': { gedekt: 14, ongedekt: 2, totaal: 16 }
    });
    assert.deepEqual(inv.totaal, { gedekt: 15, ongedekt: 3, totaal: 18, pct: 83.33 });
    /* Fail-closed: ontbreekt een takkenbestand, dan geen oordeel EN geen inventaris. */
    const los = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-takid-los-'));
    const per2 = path.join(los, 'per.json');
    try {
      for (const n of fs.readdirSync(map)) fs.copyFileSync(path.join(map, n), path.join(los, n));
      fs.rmSync(path.join(los, 'deel-2-1.takken.json'));
      const z = spawnSync(process.execPath, [VLOER, '--map', los, '--per-bestand', per2], { cwd: WORTEL, encoding: 'utf8' });
      assert.notEqual(z.status, 0, 'zonder takkenbestand geen oordeel');
      assert.equal(fs.existsSync(per2), false, 'en ook geen inventaris op een halve meting');
    } finally { fs.rmSync(los, { recursive: true, force: true }); }
  } finally { fs.rmSync(path.dirname(per), { recursive: true, force: true }); }
});

test('een takkenbestand van de oude versie, of een botsing op het begin, levert geen meting op', () => {
  const { map } = bouw();
  const lijst = takkenbestanden(map);
  assert.throws(() => v8.voegSamen([...lijst, { versie: 1, bestanden: {}, onleesbaar: 0 }]), /versie 1/,
    'oude begin-eind-sleutels zijn niet met de nieuwe op te tellen');
  /* Twee blokken die in EEN proces op dezelfde plek beginnen: dan is het begin
     geen identiteit meer. Met de hand gebouwd, want V8 doet het (gemeten) niet. */
  const ruw = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-takid-bots-'));
  const uit = path.join(ruw, 'x.takken.json');
  try {
    fs.writeFileSync(path.join(ruw, 'c.json'), JSON.stringify({ result: [{ url: 'file:///rtg/server/a.js', functions: [
      { functionName: '', isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: 90, count: 1 },
        { startOffset: 10, endOffset: 20, count: 0 }, { startOffset: 10, endOffset: 30, count: 0 }] }] }] }));
    v8.bewaar(ruw, uit, '/rtg');
    const k = JSON.parse(fs.readFileSync(uit, 'utf8'));
    assert.equal(k.bestanden['server/a.js'].botsingen, 1);
    assert.equal(v8.tel(v8.voegSamen([k])).botsingen, 1);
    const vloerMap = path.join(ruw, 'vloer');
    fs.mkdirSync(vloerMap);
    fs.writeFileSync(path.join(vloerMap, 'deel-1-1.info'), 'TN:\nSF:/rtg/server/a.js\nDA:1,1\nend_of_record\n');
    fs.copyFileSync(uit, path.join(vloerMap, 'deel-1-1.takken.json'));
    const r = spawnSync(process.execPath, [VLOER, '--map', vloerMap], { cwd: WORTEL, encoding: 'utf8' });
    assert.notEqual(r.status, 0, 'een botsing is geen meting');
    assert.match(r.stdout + r.stderr, /dezelfde plek/);
  } finally { fs.rmSync(ruw, { recursive: true, force: true }); }
});

test('tegenvoorbeeld: de lcov-sleutel en "regel + volgorde op de regel" tellen op dezelfde data verkeerd', () => {
  const { map } = bouw();
  const infos = fs.readdirSync(map).filter((n) => n.endsWith('.info')).sort()
    .map((n) => fs.readFileSync(path.join(map, n), 'utf8'));
  /* De oude optelling (BRDA-sleutel regel:blok:tak). */
  const oud = lcov.tel(lcov.voegSamen(infos)).takken;
  assert.notEqual(oud.totaal, 18, 'de BRDA-sleutel telt niet de echte takken (' + oud.gedekt + '/' + oud.totaal + ')');
  /* Een afgeleide sleutel: per regel de volgorde van de takken op die regel. */
  const per = new Map();
  for (const t of infos) {
    let bestand = null;
    const opRegel = new Map();
    for (const r of t.split('\n')) {
      if (r.startsWith('SF:')) { bestand = path.basename(r.slice(3)); opRegel.clear(); continue; }
      if (!r.startsWith('BRDA:')) continue;
      const [regel, , , n] = r.slice(5).split(',');
      const i = (opRegel.get(regel) || 0) + 1;
      opRegel.set(regel, i);
      const k = bestand + ':' + regel + '#' + i;
      per.set(k, (per.get(k) || 0) + (n === '-' ? 0 : Number(n)));
    }
  }
  const gedekt = [...per.values()].filter((n) => n > 0).length;
  assert.notDeepEqual([gedekt, per.size], [15, 18],
    'regel + volgorde voegt verschillende takken samen: P1 meldt op regel 10 eerst ": \'y\'", P3 eerst "? (a > 5"');
});
