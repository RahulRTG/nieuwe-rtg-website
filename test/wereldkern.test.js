/* DE WERELDKERN: spreken de vier samenhanglagen ECHT dezelfde taal?

   Er bestond al een toets met die naam, in test/geldwereld.test.js -- maar
   die keek alleen naar geldwereld. Hij beloofde vier en mat er een. Zo'n
   toets is erger dan geen: hij geeft een gerust gevoel over iets dat niemand
   nakijkt (LAT.md regel 9).

   Deze toets laadt ze alle vier en vergelijkt ze met elkaar. Wat hier
   gehandhaafd wordt is de GRAMMATICA (welke signalen bestaan, hoe ze wegen,
   hoe een stukke bron zich meldt), niet het woordenboek: elke wereld heeft
   zijn eigen statussen, en dat hoort zo. Een reis is 'geboekt', een taak is
   'open'; die gelijktrekken zou van vier werelden een grijze middelmaat
   maken.

   Draai los: node --experimental-sqlite --test test/wereldkern.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { SIGNALEN, RANG, bron, betekenisVan } = require('../server/kern/wereldkern');

const WERELDEN = ['geldwereld', 'reiswereld', 'kantoorwereld', 'socialewereld'];
const bestand = (n) => fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', n + '.js'), 'utf8');

test('1. de grammatica staat op EEN plek: geen enkele wereld houdt een eigen kopie', () => {
  for (const w of WERELDEN) {
    const s = bestand(w);
    assert.ok(/require\('\.\/wereldkern'\)/.test(s), w + ' hoort de wereldkern te gebruiken');
    assert.equal(/function bron\s*\(naam, fn, uit, stil\)/.test(s), false,
      w + ' houdt nog een eigen kopie van bron(); die stond in alle vier letterlijk hetzelfde');
    assert.equal(/const rang = \{ incident:/.test(s), false,
      w + ' houdt nog een eigen rangtabel; dan bedoelt de eerste die er een verandert iets anders');
  }
});

test('2. elke wereld haalt zijn woordenboek door de poort, en houdt het zelf', () => {
  for (const w of WERELDEN) {
    const s = bestand(w);
    assert.ok(/betekenisVan\(BETEKENIS\)/.test(s),
      w + ' hoort zijn statussen door betekenisVan te halen, zodat een onbekend signaal knalt');
    assert.ok(/const BETEKENIS = \{/.test(s),
      w + ' hoort zijn EIGEN statussen te houden; die horen bij de wereld die ze kent');
  }
});

test('3. een vijfde signaal bestaat niet, en wordt hardop geweigerd', () => {
  /* Zonder deze poort gaf een onbekend signaal `RANG[sig]` undefined, en
     `undefined - 0` is NaN. Een vergelijkfunctie die NaN teruggeeft sorteert
     niet: de rij blijft staan zoals hij was, zonder klacht. Zo'n fout vind je
     nooit terug vanaf het scherm. */
  assert.throws(() => betekenisVan({ raar: { sig: 'urgent', teken: '!' } }),
    /onbekende signaal/, 'een verzonnen signaal hoort meteen te knallen');
  assert.throws(() => betekenisVan({ leeg: {} }), /onbekende signaal/,
    'een status zonder signaal hoort ook te knallen');
  // en de vier echte gaan er gewoon door
  const b = betekenisVan(Object.fromEntries(SIGNALEN.map((s) => [s, { sig: s, teken: '.' }])));
  for (const s of SIGNALEN) assert.equal(b(s).sig, s);
  assert.deepEqual(b('bestaatniet'), {}, 'een onbekende status is leeg, en dat mag: die telt als onbekend');
});

test('4. de volgorde is overal dezelfde: stuk bovenaan, gezond onderaan, gatloos achteraan', () => {
  assert.deepEqual(SIGNALEN, ['incident', 'aandacht', 'actief', 'gezond']);
  const oplopend = SIGNALEN.map((s) => RANG[s]);
  assert.deepEqual(oplopend, [...oplopend].sort((a, b) => a - b), 'de rang loopt op in de volgorde van SIGNALEN');
  assert.ok(RANG[''] > RANG.gezond, 'een regel zonder signaal hoort achter de gezonde te staan, niet ertussen');
});

test('5. een stukke bron meldt zich met naam en neemt de rest niet mee', () => {
  const uit = [], stil = [];
  bron('goed', () => [{ sig: 'gezond' }, { sig: 'actief' }], uit, stil);
  bron('stuk', () => { throw new Error('de bron viel om'); }, uit, stil);
  bron('ook-goed', () => [{ sig: 'incident' }], uit, stil);
  assert.equal(uit.length, 3, 'de werkende bronnen leveren gewoon door');
  assert.deepEqual(stil, ['stuk'], 'de stukke bron meldt zich met NAAM; stil verdwijnen is het gevaar');
  /* Waarom dat het zwaarst weegt: een beeld waaruit een bron is weggevallen
     ziet er compleet uit, en dan denkt iemand dat er niets speelt. */
  bron('leeg', () => null, uit, stil);
  assert.deepEqual(stil, ['stuk'], 'een bron die niets teruggeeft is geen stukke bron');
});
