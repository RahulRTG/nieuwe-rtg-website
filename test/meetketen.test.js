/* DE MEETKETEN: STEMPEL, VERSHEID EN DE WACHT VOOR HET REGISTER.

   Draai los: node --experimental-sqlite --test test/meetketen.test.js

   Drie dingen die deze sessie echt zijn misgegaan en die hier vastliggen:

   1. EEN REGISTER ZONDER STEMPEL IS NIET NA TE LOPEN. Van de vierentwintig
      registers droegen er drie een datum en EEN de commit. POORTWACHT.json liep
      196 routes achter en dat was alleen te ontdekken door het te vermoeden.

   2. REQUIREN MAG GEEN MEETRONDE STARTEN. Een onschuldige laadcontrole
      (`node -e "require('./scripts/rolproef-route.js')"`) draaide de rolproef met
      de STANDAARDbegrenzing en schreef ROLPROEF.json van 3377 beproefde routes
      terug naar 292. Het register zag er daarna volkomen normaal uit.

   3. process.exit() KAPT EEN PIPE AF. De poortwacht printte 484 KB JSON en
      exit'te meteen; naar een BESTAND ging dat goed, naar een PIPE kwam er
      146176 bytes uit -- geldige tekst, kapotte JSON, exitcode 0. De ergste
      soort fout: hij ziet er geslaagd uit.

   DE MUTATIES (LAT.md regel 2). Drie gedaan; twee beten meteen, de eerste niet:

     de require.main-wacht uit een proef halen -> toets 4 zakt
     process.exitCode terug naar process.exit  -> toets 5 zakt
     boomVuil altijd false teruggeven          -> BEET EERST NIET.

   Die laatste hoorde te zakken en deed niets, want toets 2 voedt versheid()
   handgemaakte objecten en toetst dus hoe hij een vuile boom BEHANDELT -- niet
   of stempel() er ooit een opmerkt. Met boomVuil hardgezet op false zou elk
   register zich als reproduceerbaar voordoen en bleef de suite groen. Toets 1
   berekent de verwachting nu zelf uit `git status --porcelain`; daarna beet de
   mutatie zoals het hoort. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { stempel, versheid } = require('../scripts/lib/stempel');
const versheidMeter = require('../scripts/versheid');

const WORTEL = path.join(__dirname, '..');

test('1. een stempel draagt wanneer, waartegen en of de boom schoon was', () => {
  const s = stempel({ routesToen: 42 });
  assert.ok(s.op && !Number.isNaN(Date.parse(s.op)), 'op is een leesbare tijd');
  assert.ok(s.commit === null || /^[0-9a-f]{7,40}$/.test(s.commit), 'commit is een hash of null');
  /* En boomVuil moet de ECHTE toestand dragen, niet alleen het juiste type.
     Een eerdere versie van deze toets keek alleen naar `typeof` -- toen ik
     boomVuil hardcodeerde op false bleef zij vrolijk groen, terwijl elk register
     zich daarmee als reproduceerbaar zou voordoen. De verwachting wordt hier
     los berekend: dat is geen tweede implementatie maar de hele bedoeling van
     een toets. */
  const echtVuil = spawnSync('git', ['status', '--porcelain'],
    { cwd: WORTEL, encoding: 'utf8' }).stdout.trim().length > 0;
  assert.equal(s.boomVuil, echtVuil,
    'boomVuil zegt ' + s.boomVuil + ' terwijl de boom ' + (echtVuil ? 'vuil' : 'schoon') + ' is');
  assert.equal(s.node, process.version);
  assert.equal(s.routesToen, 42, 'wat het instrument zelf weet, komt er ongewijzigd bij');
});

test('2. onbekend is geen schoon: een register zonder stempel heet verouderd', () => {
  /* Het verschil dat de hele laag draagt. Niet weten of de boom schoon was mag
     nooit als schoon lezen -- dan is een onreproduceerbare meting niet van een
     reproduceerbare te onderscheiden. */
  assert.equal(versheid(null).vers, false);
  assert.match(versheid(null).reden, /geen stempel/);
  assert.equal(versheid({ op: 'x' }).vers, false, 'zonder commit is niets te herleiden');
  assert.match(versheid({ op: 'x' }).reden, /zonder commit/);
  const vuil = versheid({ op: 'x', commit: 'abc1234', boomVuil: true }, 'abc1234');
  assert.equal(vuil.vers, false, 'gemeten met vuile boom is niet reproduceerbaar');
  assert.match(vuil.reden, /ongecommit/);
  const oud = versheid({ op: 'x', commit: 'aaaaaaa', boomVuil: false }, 'bbbbbbb');
  assert.equal(oud.vers, false, 'een andere commit is achterhaald');
  const goed = versheid({ op: 'x', commit: 'abc1234', boomVuil: false }, 'abc1234');
  assert.equal(goed.vers, true);
});

test('2b. vers gaat over veranderde CODE, niet over een veranderde commit', () => {
  /* Zonder dit onderscheid is `vers` onbereikbaar: je meet, je COMMIT de verse
     registers, HEAD verspringt, en de meter verklaart zijn eigen meting van een
     minuut oud verouderd. Een meter die nooit groen kan worden meet niets
     (LAT.md regel 9). Wat telt is of er sinds de meting code is gewijzigd -- een
     commit die alleen registers of documentatie aanraakt, maakt niets ongeldig. */
  const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'],
    { cwd: WORTEL, encoding: 'utf8' }).stdout.trim();
  const opHead = versheid({ op: 'x', commit: head, boomVuil: false }, head);
  assert.equal(opHead.vers, true, 'op de huidige commit is een meting vers');

  const weg = versheid({ op: 'x', commit: 'deadbee', boomVuil: false }, head);
  assert.equal(weg.vers, false, 'een commit die niet meer bestaat is niet vers');
  assert.match(weg.reden, /bestaat/,
    'een mislukte vergelijking mag nooit als "geen wijzigingen" lezen');
});

test('3. de versheidsmeter kent elk meetregister en zegt hoe je het herstelt', () => {
  const uit = versheidMeter.meet();
  assert.ok(uit.rijen.length >= 10, 'de meetregisters staan erin (' + uit.rijen.length + ')');
  for (const r of uit.rijen) {
    assert.ok(r.register.endsWith('.json'), 'een register is een bestand');
    assert.ok(r.hoe && r.hoe.length > 5, r.register + ' zegt niet HOE je hem bijwerkt');
    assert.ok(r.wat && r.wat.length > 10, r.register + ' zegt niet WAT hij meet');
    assert.ok(['vers', 'verouderd', 'ontbreekt'].includes(r.staat), 'een bekende staat');
    if (r.staat !== 'vers') assert.ok(r.reden && r.reden.length > 10, r.register + ' mist een reden');
  }
});

test('4. requiren van een proef start GEEN meetronde', () => {
  /* De duurste les van deze sessie. Elk instrument dat bij het draaien een
     register OVERSCHRIJFT moet de wacht dragen die scripts/bewijsmatrix.js al
     had. Deze toets leest de bron: hem echt requiren zou, als de wacht weg is,
     precies de schade aanrichten die hij moet voorkomen. */
  const proeven = ['rolproef-route.js', 'invoerproef-route.js', 'idemproef-route.js',
    'staatproef-route.js', 'bewijsmatrix.js'];
  for (const naam of proeven) {
    const bron = fs.readFileSync(path.join(WORTEL, 'scripts', naam), 'utf8');
    assert.match(bron, /require\.main\s*!==\s*module/,
      naam + ' overschrijft een register maar heeft geen require.main-wacht: ' +
      'iets dat hem alleen laadt, start een volledige meetronde');
  }
});

test('5. de poortwacht overleeft een pipe zonder afgekapt te worden', () => {
  /* Naar een bestand ging het altijd goed; naar een pipe kwam er 146176 bytes
     uit met exitcode 0. Deze toets pijpt hem daarom ECHT, tegen een adres waar
     niets luistert -- alle routes onbereikbaar, uitslag volledig, en dat is
     precies genoeg om de afkapping te betrappen. */
  const r = spawnSync(process.execPath,
    ['--experimental-sqlite', 'scripts/poortwacht.js', '--json', '--per-route', 'http://127.0.0.1:1'],
    { cwd: WORTEL, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 300000 });
  const uit = r.stdout || '';
  assert.ok(uit.length > 200000, 'de uitslag is groot genoeg om af te kappen (' + uit.length + ')');
  let j;
  assert.doesNotThrow(() => { j = JSON.parse(uit); },
    'de uitslag is door een pipe afgekapt; gebruik process.exitCode en niet process.exit()');
  assert.ok(Array.isArray(j.perRoute) && j.perRoute.length > 1000,
    'alle routes staan erin (' + (j.perRoute || []).length + ')');
  assert.equal(j.perRoute.length, j.totaal, 'de lijst is even lang als het totaal');
});
