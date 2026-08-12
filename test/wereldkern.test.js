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
const { SIGNALEN, RANG, bron, betekenisVan, standVan, WOORD_ONBEKEND } = require('../server/kern/wereldkern');

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

/* ---------------------------------------------------------------------------
   LAAG 0 VAN HET COMMAND CANVAS: DE STAND (CANVAS.md).

   De enige belofte die hier iets waard is, is dat de stand nooit liegt. Dat is
   geen smaak maar een reeks harde gevallen, en die staan hieronder allemaal --
   inclusief het gevaarlijkste: alles ziet er goed uit, maar een bron zweeg. */

const woorden = { verstoord: 'Verstoord', aandacht: 'Druk', gezond: 'Operationeel' };
const R = (sig) => ({ sig });

test('6. de stand oordeelt over wat er ECHT staat, en verstoord overstemt de rest', () => {
  const stand = standVan(woorden);
  assert.equal(stand([], []).niveau, 'gezond', 'niets aan de hand is een uitkomst, geen leegte');
  assert.equal(stand([], []).woord, 'Operationeel', 'het woord komt van de wereld, niet van de kern');
  assert.equal(stand([R('gezond'), R('actief')], []).niveau, 'gezond');
  assert.equal(stand([R('actief'), R('aandacht')], []).niveau, 'aandacht');
  /* Een incident overstemt aandacht EN onbekend: bij iets stuks weet je iets
     ergers dan dat je iets niet weet, en dat hoort voor te gaan. */
  assert.equal(stand([R('aandacht'), R('incident')], ['agenda']).niveau, 'verstoord');
  assert.equal(stand([R('incident')], []).incident, 1, 'de cijfers dragen het woord en worden meegegeven');
});

test('7. DE STAND LIEGT NOOIT: een bron die zweeg maakt het beeld onbekend, niet groen', () => {
  /* DIT IS DE TOETS WAAR HET OM DRAAIT. Zonder deze regel toont een wereld
     waarvan de helft van de bronnen omviel doodleuk 'Operationeel', want wat er
     ophaalde zag er prima uit. Precies dat is de storing die zich als rust
     voordoet -- en dan mist iemand een vergadering. */
  const stand = standVan(woorden);
  const goed = [R('gezond'), R('actief')];
  assert.equal(stand(goed, []).niveau, 'gezond', 'zonder stille bron is dit gewoon gezond');
  const stil = stand(goed, ['agenda']);
  assert.equal(stil.niveau, 'onbekend', 'met een stille bron mag hier geen groen woord staan');
  assert.equal(stil.woord, WOORD_ONBEKEND);
  assert.equal(stil.reden, 'bron', 'het scherm moet kunnen zeggen WAAROM het onbekend is');

  /* De tweede vorm van niet-meten: een regel met een status die deze wereld
     niet kent. Die kreeg geen signaal, en zonder deze regel telt hij als
     "verder niets aan de hand". */
  const raar = stand([R('gezond'), { sig: '' }], []);
  assert.equal(raar.niveau, 'onbekend', 'een regel zonder signaal is een gat, geen rust');
  assert.equal(raar.ongemeten, 1);
  assert.equal(raar.reden, 'status', 'en een gat in de statussen is iets anders dan een stille bron');
});

test('8. een wereld benoemt zijn eigen stand -- behalve zijn eigen onwetendheid', () => {
  /* Waarom 'onbekend' NIET van de wereld is: wie zijn eigen onwetendheid mag
     benoemen, noemt hem vroeg of laat mooier. Dat is geen hypothese maar de
     reden dat deze poort er is. */
  assert.throws(() => standVan({ verstoord: 'X', aandacht: 'Y', gezond: 'Z', onbekend: 'Prima' }),
    /geen woord van de wereld/, 'een wereld die zijn onbekend zelf benoemt hoort te knallen');
  // en een half gevuld woordenboek valt stil op precies dat niveau; dus ook knallen
  assert.throws(() => standVan({ verstoord: 'X', aandacht: 'Y' }), /mist het woord voor "gezond"/);
  assert.throws(() => standVan({ verstoord: 'X', aandacht: 'Y', gezond: '  ' }), /mist het woord voor "gezond"/);
  assert.throws(() => standVan(null), /mist het woord voor "verstoord"/);
});

test('9. alle vier de werelden dragen een stand, en geen van vier rekent hem zelf uit', () => {
  /* De stand hoort bij de wereld en niet bij het scherm: zou elk scherm zelf
     beslissen wanneer iets 'Operationeel' heet, dan staat die regel op acht
     plekken en is de eerste die hem versoepelt niet te vinden (LAT.md regel 4). */
  for (const w of WERELDEN) {
    const s = bestand(w);
    assert.ok(/standVan\(/.test(s), w + ' hoort zijn stand via standVan te zetten');
    assert.ok(/stand: meetStand\(/.test(s), w + ' hoort de stand mee te sturen; een wereld zonder ' +
      'stand laat het scherm zelf oordelen, en dat is precies wat hier niet mag');
  }
});
