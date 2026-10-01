/* DE PRESTATIELAT (scripts/norm.js + BEPROEVING.json).

   De ratel bewaakte tot nu toe alleen statische meters: dekking, keuring,
   dependencies. Prestatie stond nergens vast, dus p99 en doorvoer konden
   ongemerkt wegzakken -- precies wat de ratel voor de andere meters juist
   voorkomt.

   Die cijfers komen uit De Beproeving, die een kwartier draait. De koppeling
   loopt daarom via BEPROEVING.json, en dat is meteen waar het mis kan gaan.
   Drie manieren, alle drie hier vastgelegd:

     1. het bestand ontbreekt          -> geen stilte, maar een reden
     2. de ronde is GEZAKT             -> die cijfers zijn geen lat
     3. een andere machine of modus    -> niet vergelijken, en het zeggen

   Waarom een aparte toets en niet "we draaien npm run norm even": die roept
   keuring.js aan over de hele repo en duurt minuten. Deze toets pakt de functie
   zelf en voert hem bestanden die hij niet leuk vindt.

   Draai los: node --test test/normprestatie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const norm = require('../scripts/norm.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-normpres-'));
test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let n = 0;
function schrijf(inhoud) {
  const p = path.join(TMP, 'bep' + (++n) + '.json');
  fs.writeFileSync(p, typeof inhoud === 'string' ? inhoud : JSON.stringify(inhoud));
  return p;
}
const goedeRonde = (extra) => Object.assign({
  gedraaid: '2026-08-01T22:00:00.000Z',
  modus: 'sqlite',
  machine: { kernen: 4, geheugenGB: 15, platform: 'linux', node: 'v22.0.0' },
  oordeel: 'PASS',
  gezakteDrempels: 0,
  meters: { p99Ms: 144, doorvoerPerSec: 1875, eventLoopP99Ms: 76.3, herstelSeconden: 1, verhalenSlaagPctStorm: 75.4, geheugenHellingMBPerMin: 0 }
}, extra || {});

test('1. een geslaagde ronde levert cijfers en een bron', () => {
  const r = norm.leesPrestatie(schrijf(goedeRonde()));
  assert.equal(r.reden, undefined, 'geen bezwaar');
  assert.equal(r.cijfers.p99Ms, 144);
  assert.equal(r.bron, '4k/15g/linux/sqlite', 'de bron bindt het cijfer aan machine EN modus');
});

test('2. een ontbrekend bestand geeft een REDEN, geen stille null', () => {
  const r = norm.leesPrestatie(path.join(TMP, 'bestaat-niet.json'));
  assert.equal(r.cijfers, undefined);
  assert.match(r.reden, /ontbreekt/, 'en de reden zegt wat je moet doen');
  assert.match(r.reden, /beproeving/, 'met de opdracht erin');
});

test('3. onleesbaar is iets anders dan afwezig, en zegt dat ook', () => {
  const r = norm.leesPrestatie(schrijf('{dit is geen json'));
  assert.match(r.reden, /onleesbaar/);
  assert.equal(r.cijfers, undefined, 'en levert zeker geen cijfers');
});

/* Dit is de scherpste van de drie. Een ronde die zijn eigen drempels niet haalt
   heeft wel getallen, en die zien er precies zo uit als goede getallen. Zou de
   ratel ze accepteren, dan zou een slechte ronde de lat VERLAGEN en daarna
   zichzelf goedkeuren -- een ratel die achteruit klikt. */
test('4. een GEZAKTE ronde levert geen lat, hoe geldig de getallen ook ogen', () => {
  const r = norm.leesPrestatie(schrijf(goedeRonde({ oordeel: 'GEZAKT', gezakteDrempels: 2 })));
  assert.equal(r.cijfers, undefined, 'de getallen worden niet doorgegeven');
  assert.match(r.reden, /GEZAKT/);
  assert.match(r.reden, /2 drempel/, 'en meldt hoeveel er zakten');
});

test('5. een ronde zonder meters is geen ronde', () => {
  const r = norm.leesPrestatie(schrijf({ oordeel: 'PASS', machine: { kernen: 4 } }));
  assert.match(r.reden, /geen meters/);
});

/* De bron is de rem op appels met peren. Verandert er iets aan de machine of de
   modus, dan MOET de sleutel verschillen -- anders vergelijkt de ratel een p99
   van vier kernen met een p99 van zestien en noemt het vooruitgang. */
test('6. de bron verschilt zodra machine of modus verschilt', () => {
  const basis = norm.bron(goedeRonde());
  assert.notEqual(basis, norm.bron(goedeRonde({ modus: 'postgres' })), 'andere modus');
  assert.notEqual(basis, norm.bron(goedeRonde({ machine: { kernen: 16, geheugenGB: 15, platform: 'linux' } })), 'andere kernen');
  assert.notEqual(basis, norm.bron(goedeRonde({ machine: { kernen: 4, geheugenGB: 64, platform: 'linux' } })), 'ander geheugen');
  assert.notEqual(basis, norm.bron(goedeRonde({ machine: { kernen: 4, geheugenGB: 15, platform: 'darwin' } })), 'ander platform');
  // maar een nieuwe node-versie wist de lat NIET: die wisselt vaker dan de machine
  assert.equal(basis, norm.bron(goedeRonde({ machine: { kernen: 4, geheugenGB: 15, platform: 'linux', node: 'v24.1.0' } })),
    'de node-versie hoort niet in de bron');
  assert.equal(norm.bron({}), null, 'zonder machine geen bron');
});

/* De meters zelf: richting is hier geen detail. Staat p99Ms per ongeluk op
   "omhoog", dan viert de ratel elke vertraging als vooruitgang. */
test('7. elke prestatiemeter heeft een richting die klopt met wat hij meet', () => {
  const verwacht = {
    p99Ms: 'omlaag', doorvoerPerSec: 'omhoog', eventLoopP99Ms: 'omlaag',
    herstelSeconden: 'omlaag', verhalenSlaagPctStorm: 'omhoog', geheugenHellingMBPerMin: 'omlaag'
  };
  assert.equal(norm.PRESTATIEMETERS.length, Object.keys(verwacht).length, 'geen meter erbij of eraf zonder deze lijst bij te werken');
  for (const m of norm.PRESTATIEMETERS) {
    assert.equal(m.richting, verwacht[m.sleutel], m.sleutel + ' wijst de verkeerde kant op');
    assert.ok(m.wat && m.wat.length > 10, m.sleutel + ' hoort uit te leggen wat hij meet');
  }
  // en het oordeel volgt die richting echt
  const p99 = norm.PRESTATIEMETERS.find(m => m.sleutel === 'p99Ms');
  assert.equal(norm.oordeel(p99, 100, 144), 'beter', 'sneller is beter');
  assert.equal(norm.oordeel(p99, 200, 144), 'slechter', 'trager is slechter');
  const dv = norm.PRESTATIEMETERS.find(m => m.sleutel === 'doorvoerPerSec');
  assert.equal(norm.oordeel(dv, 2000, 1875), 'beter', 'meer doorvoer is beter');
  assert.equal(norm.oordeel(dv, 1000, 1875), 'slechter', 'minder doorvoer is slechter');
});

/* En de andere kant van de brug: schrijft De Beproeving wel precies de sleutels
   die de ratel verwacht? Zonder deze toets kan een hernoeming aan de ene kant
   de hele prestatielat stil uitschakelen -- de meters worden dan eeuwig "niet
   gemeten" en niemand die het merkt. */
test('8. de beproeving schrijft exact de sleutels die de ratel leest', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'beproeving.js'), 'utf8');
  const blok = bron.slice(bron.indexOf('const cijfers = {'));
  assert.ok(blok.length > 100, 'het cijferblok staat er nog');
  for (const m of norm.PRESTATIEMETERS) {
    assert.match(blok, new RegExp('\\b' + m.sleutel + '\\s*:'), m.sleutel + ' wordt niet weggeschreven');
  }
  for (const veld of ['gedraaid', 'modus', 'machine', 'oordeel', 'gezakteDrempels']) {
    assert.match(blok, new RegExp('\\b' + veld + '\\s*:'), veld + ' hoort in BEPROEVING.json');
  }
});

test('9. prestatieschuld sluit alleen met schoon, vergelijkbaar en volledig kandidaatbewijs', () => {
  const { assess } = require('../scripts/performance-debt');
  const commit = '558f4e60386f862a5c3a755c97faba821651768a';
  const lat = { prestatieBron: '4k/17g/linux/sqlite', prestatieKalibratie: 13.3 };
  const geldig = () => ({ stempel: { commit: commit.slice(0, 9), boomVuil: false },
    modus: 'sqlite', machine: { kernen: 4, geheugenGB: 17, platform: 'linux', kalibratieBasisMs: 13.3 },
    oordeel: 'PASS', gezakteDrempels: 0, meters: { stormDuurSec: 180, endpointsOnbereikt: 0, p99Ms: 144, eventLoopP99Ms: 64.8 } });
  const goed = assess(commit, lat, geldig());
  assert.equal(goed.status, 'PASS');
  assert.deepEqual(goed.targets, { p99Ms: 144, eventLoopP99Ms: 64.8 });
  assert.deepEqual(goed.blockers, []);
  const gevallen = [
    ['verkeerde commit', m => { m.stempel.commit = 'fffffffff'; }],
    ['vuile boom', m => { m.stempel.boomVuil = true; }],
    ['andere hardware', m => { m.machine.kernen = 8; }],
    ['andere kalibratie', m => { m.machine.kalibratieBasisMs = 2; }],
    ['trage p99', m => { m.meters.p99Ms = 145; }],
    ['trage eventloop', m => { m.meters.eventLoopP99Ms = 64.9; }],
    ['boolean is geen cijfer', m => { m.meters.p99Ms = true; }],
    ['NaN is geen meting', m => { m.meters.eventLoopP99Ms = NaN; }],
    ['negatief is geen meting', m => { m.meters.p99Ms = -1; }],
    ['rood gedrag', m => { m.oordeel = 'GEZAKT'; }],
    ['vervalste PASS', m => { m.gezakteDrempels = 1; }],
    ['te korte storm', m => { m.meters.stormDuurSec = 179; }],
    ['onbereikte routes', m => { m.meters.endpointsOnbereikt = 1; }]
  ];
  for (const [naam, wijzig] of gevallen) {
    const m = geldig(); wijzig(m);
    const uit = assess(commit, lat, m);
    assert.equal(uit.status, 'BLOCKED', naam);
    assert.ok(uit.blockers.length, naam + ' heeft een concrete reden');
  }
  assert.equal(assess(commit, lat, null).status, 'BLOCKED', 'historisch bewijs vervangt geen verse meting');
  assert.equal(assess('558f4e603', lat, geldig()).status, 'BLOCKED', 'volledige kandidaatidentiteit is verplicht');
});
