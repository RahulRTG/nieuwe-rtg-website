/* ============================================================================
   DE SCHERMMUTATIEMOTOR ZELF -- want een meter die je niet kunt narekenen is
   een belofte.

   WAAROM DIT BESTAAT. scripts/mutatie.js kent twee fasen en een schermtoets valt
   in geen van beide op de manier die ertoe doet: hij laadt geen module (hij
   bezoekt een adres) en de liegpoort leegt de API, niet de PAGINA. Een
   schermtoets die op het verkeerde element kijkt, heet in beide fasen keurig
   "gevoelig". Dat is hier twee keer echt gebeurd.

   Deze toets houdt de drie beweringen vast waar de motor op staat:
     1. hij vindt het scherm uit de toets zelf, niet uit een register;
     2. hij muteert alleen BINNEN het inline script, en nooit in commentaar --
        een mutatie in commentaar verandert niets en zou als "de toets merkte
        het niet" tellen, en dat is geen meting maar ruis;
     3. zijn twee operatoren halen echt iets weg.

   Draai los: node --test test/schermmutatie.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { OPERATOREN, muteerScherm, schermenVan, scriptBereik } = require('../scripts/schermmutatie');
const { spawnSync } = require('child_process');
const { SPOOR } = require('../scripts/mutatie');

const WORTEL = path.join(__dirname, '..');

/* De twee proefbestanden hieronder staan in server/data/ omdat die map buiten
   de repo valt (.gitignore) -- een tijdelijk .js-bestand hoort niet tussen de
   toetsen te belanden. Maar juist DAAROM bestaat hij in een verse checkout
   nog niet: hij wordt pas aangemaakt als een server start. Deze toetsen
   slaagden dus alleen zolang er toevallig eerder in dezelfde scherf iets een
   server had geboot, en dat is geen eigenschap van deze toets maar van de
   scherfindeling. Op 2 september 2026 verschoof die indeling (vijf nieuwe
   toetsbestanden) en zakten ze met ENOENT. De map wordt nu gemaakt in plaats
   van aangenomen. */
const PROEFMAP = path.join(WORTEL, 'server', 'data');
fs.mkdirSync(PROEFMAP, { recursive: true });

test('1. het scherm komt uit de toets zelf en niet uit een register', () => {
  const s = schermenVan(path.join(WORTEL, 'test/gegevenskaart-scherm.e2e.js'));
  assert.deepEqual(s, ['public/apps/mijn-gegevens.html'],
    'de motor leest het adres dat de toets bezoekt; een register ernaast zou wegdrijven');
});

test('1b. een toets die geen pagina bezoekt levert geen gok op', () => {
  const tmp = path.join(PROEFMAP, 'schermmutatie-proef.js');
  fs.writeFileSync(tmp, "// geen page.goto hier\n");
  try {
    assert.deepEqual(schermenVan(tmp), [], 'liever niets dan een verzonnen scherm');
  } finally { fs.unlinkSync(tmp); }
});

test('1c. en een pagina die niet bestaat wordt niet meegenomen', () => {
  const tmp = path.join(PROEFMAP, 'schermmutatie-proef2.js');
  fs.writeFileSync(tmp, "await page.goto(base + '/apps/bestaat-niet-xyz.html');\n");
  try {
    assert.deepEqual(schermenVan(tmp), []);
  } finally { fs.unlinkSync(tmp); }
});

test('2. er wordt alleen binnen het inline script gemuteerd', () => {
  const pad = path.join(WORTEL, 'public/apps/mijn-gegevens.html');
  const bron = fs.readFileSync(pad, 'utf8');
  const b = scriptBereik(bron);
  assert.ok(b && b.tot > b.van, 'het script is gevonden');
  for (const op of OPERATOREN) {
    const uit = muteerScherm(bron, op, 0);
    assert.ok(uit, op.naam + ' vindt geen plek op een scherm dat er vol mee staat');
    /* De verandering moet BINNEN het bereik vallen. Daarbuiten staat CSS en
       opmaak; een mutatie daar zegt niets over wat de toets ziet. */
    let eerste = 0;
    while (eerste < bron.length && bron[eerste] === uit.bron[eerste]) eerste++;
    assert.ok(eerste >= b.van && eerste <= b.tot,
      op.naam + ' muteerde buiten het script (op teken ' + eerste + ', script loopt ' + b.van + '-' + b.tot + ')');
  }
});

test('2b. commentaar blijft buiten schot', () => {
  /* Een mutatie in commentaar verandert niets. Zou de motor hem toch tellen,
     dan heet elke toets "merkte het niet" op een regel waar niets gebeurde --
     en dan meet de meter zichzelf. */
  const nep = ['<script>',
    "  // if (weg) { el.appendChild(x); }",
    "  /* el.appendChild(commentaar); */",
    "  if (echt) { doeIets(); }",
    '</script>'].join('\n');
  const uit = muteerScherm(nep, OPERATOREN.find(o => o.naam === 'blok-weg'), 0);
  assert.ok(uit, 'er is een echte plek');
  assert.match(uit.regel, /if \(echt\)/, 'en dat is de code-regel, niet het commentaar erboven');
});

test('3. de operatoren halen echt iets weg', () => {
  const nep = ['<script>', "  if (k.iets) {", "    el.appendChild(maak('b'));", "  }", '</script>'].join('\n');
  const blok = muteerScherm(nep, OPERATOREN.find(o => o.naam === 'blok-weg'), 0);
  assert.match(blok.bron, /if \(false\) \{/, 'het blok rendert niet meer');
  const kind = muteerScherm(nep, OPERATOREN.find(o => o.naam === 'appendChild-weg'), 0);
  assert.ok(!/appendChild/.test(kind.bron), 'het onderdeel komt niet meer in de boom');
  /* En de rest van het bestand blijft heel: een mutatie die de pagina stukmaakt
     laat de toets zakken om de verkeerde reden. */
  assert.match(kind.bron, /if \(k\.iets\) \{/, 'de rest staat er nog');
});

test('3b. een tweede schot valt op een andere plek dan het eerste', () => {
  /* Zonder dit zou de motor drie keer dezelfde mutatie draaien en drie keer
     hetzelfde antwoord "meten". */
  const pad = path.join(WORTEL, 'public/apps/mijn-gegevens.html');
  const bron = fs.readFileSync(pad, 'utf8');
  const op = OPERATOREN.find(o => o.naam === 'appendChild-weg');
  const een = muteerScherm(bron, op, 0);
  const twee = muteerScherm(bron, op, 1);
  assert.ok(een && twee);
  assert.notEqual(een.regel, twee.regel, 'schot twee raakt een andere regel');
  assert.notEqual(een.bron, twee.bron);
});

test('4. twee ronden tegelijk worden geweigerd, met de reden erbij', () => {
  /* DIT KOMT UIT EEN ECHTE BREUK. Ik startte een tweede ronde terwijl de eerste
     nog liep, allebei op hetzelfde bestand: de een zette het origineel terug
     terwijl de ander zijn mutatie er net in had staan. Wat overbleef was een
     pagina met een halve mutatie, en de meter meldde "stond al rood" over een
     toets die groen was. De opruimwacht redde de werkboom -- maar een meter die
     stille onzin KAN meten, hoort niet te starten. */
  const had = fs.existsSync(SPOOR) ? fs.readFileSync(SPOOR, 'utf8') : null;
  fs.mkdirSync(path.dirname(SPOOR), { recursive: true });
  fs.writeFileSync(SPOOR, JSON.stringify({ 'public/apps/iets.html': 'bron' }));
  try {
    const r = spawnSync('node', ['scripts/schermmutatie.js', 'test/gegevenskaart-scherm.e2e.js'],
      { cwd: WORTEL, encoding: 'utf8', timeout: 30000 });
    assert.equal(r.status, 1, 'hij weigert te starten');
    assert.match(String(r.stdout), /nog een mutatie open/, 'en zegt WAT er openstaat');
    assert.match(String(r.stdout), /verminken elkaar/, 'met de reden waarom dat erg is');
    assert.match(String(r.stdout), /--opruimen/, 'en hoe je verder komt');
  } finally {
    /* Het kindproces ruimt het spoor zelf op als het afsluit (de opruimwacht
       van scripts/mutatie.js), dus het bestand kan hier al weg zijn. Terugzetten
       wat er WAS, en niet aannemen dat het er nog staat. */
    if (had === null) { try { fs.unlinkSync(SPOOR); } catch (e) {} }
    else fs.writeFileSync(SPOOR, had);
  }
});
