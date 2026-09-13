/* HET AANVOERCONTRACT -- en vooral: wat een bron NIET mag meeleveren.

   server/kern/knelpunt/aanvoer.js zegt wat een BRON minimaal moet leveren om
   een manier te heten. De vorm ervan is niet gekozen maar gemeten: 
   AANVOERVORM.json legt de vijf terreinen naast elkaar en vindt 0 velden in
   alle terreinen, onder twee verschillende domeinlijsten. Daarom is dit een
   afspraak over etiketten en geen objecttype met verplichte velden.

   DE SCHERPSTE TOETSEN ZIJN 5 EN 6. De laag krijgt de mens niet -- niet als
   afspraak maar in de handtekening -- en dat is wat een geschiktheidstoets hier
   structureel onmogelijk maakt in plaats van verboden. Zakt toets 6, dan is dat
   niet een regel die is overtreden maar een deur die is opengezet.

   Draai los: node --test test/aanvoer.test.js
   De vormmeting: npm run aanvoervorm */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { maakAanvoer, keur, ETIKETTEN, VERPLICHT, MENSVELDEN } = require('../server/kern/knelpunt/aanvoer');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'server', 'kern', 'knelpunt', 'aanvoer.js'), 'utf8');

const GOED = { terrein: 'werk', wat: 'Keukenhulp bij een partner', ingang: '/api/rtf/vacatures',
  dektNiet: 'Een vacature is nog geen inkomen.' };

test('1. een volledige manier komt erdoor en draagt de herkomst van de LAAG', () => {
  const a = maakAanvoer({ werkbron: () => [GOED] });
  const uit = a.manieren({ id: 'v1', wat: 'werk hebben' });
  assert.equal(uit.manieren.length, 1);
  assert.equal(uit.manieren[0].herkomst, 'werkbron',
    'de herkomst komt niet van de laag; dan kan een bron zich voordoen als een andere');
  assert.equal(uit.manieren[0].beschikbaarheid, null,
    'een bron die geen aantal noemt, hoort null te krijgen en geen verzonnen getal');
});

test('2. een bron die zijn eigen herkomst opschrijft, krijgt die niet', () => {
  const a = maakAanvoer({ echt: () => [Object.assign({}, GOED, { herkomst: 'iemand-anders' })] });
  const uit = a.manieren({});
  /* `herkomst` staat in ETIKETTEN, dus hij valt niet af als onbekend etiket --
     hij wordt OVERSCHREVEN. Dat is het punt. */
  assert.equal(uit.manieren.length, 1);
  assert.equal(uit.manieren[0].herkomst, 'echt');
});

test('3. dektNiet is verplicht -- de duurste van de vijf', () => {
  /* openingen-kaart.js: de gevaarlijkste lezer is niet degene die een leegte
     voor een gat aanziet, maar degene die aanbod leest als "dit is geregeld". */
  const zonder = Object.assign({}, GOED); delete zonder.dektNiet;
  const a = maakAanvoer({ b: () => [zonder] });
  const uit = a.manieren({});
  assert.equal(uit.manieren.length, 0);
  assert.match(uit.geweigerd[0].reden, /ontbreekt: dektNiet/);
  assert.ok(VERPLICHT.includes('dektNiet'));
});

test('4. een ingang is een pad en nooit een handeling', () => {
  const a = maakAanvoer({
    url: () => [Object.assign({}, GOED, { ingang: 'https://voorbeeld.nl/vacature' })],
    werkwoord: () => [Object.assign({}, GOED, { ingang: 'solliciteer' })]
  });
  const uit = a.manieren({});
  assert.equal(uit.manieren.length, 0);
  assert.equal(uit.geweigerd.length, 2);
  for (const g of uit.geweigerd) assert.match(g.reden, /ingang is geen pad/);
});

test('5. de laag krijgt de mens niet -- dat staat in de handtekening', () => {
  /* Niet een regel om te onthouden maar een vorm die het onmogelijk maakt.
     Een tweede argument erbij is een BESLUIT, en deze toets dwingt dat af. */
  assert.match(bron, /function manieren\(voorwaarde\) \{/,
    'manieren() heeft een tweede argument gekregen; dan kan er een mens in');
  assert.match(bron, /fn\(voorwaarde\)/, 'de bron krijgt meer dan de randvoorwaarde mee');
  assert.doesNotMatch(bron, /require\(.*accounts|kluis|codenaamVan/,
    'deze laag raakt de identiteitskluis aan');
});

test('6. een manier die een gegeven over de mens draagt, wordt GEWEIGERD', () => {
  /* Geweigerd en niet gefilterd: de bouwer van die bron hoort het te zien in
     plaats van dat het stil wordt weggepoetst. */
  for (const veld of ['codenaam', 'leeftijd', 'postcode', 'score', 'geschikt']) {
    const a = maakAanvoer({ b: () => [Object.assign({}, GOED, { [veld]: 'x' })] });
    const uit = a.manieren({});
    assert.equal(uit.manieren.length, 0, veld + ' kwam er gewoon doorheen');
    assert.match(uit.geweigerd[0].reden, /draagt een gegeven over de mens/);
  }
  assert.ok(MENSVELDEN.includes('bsn') && MENSVELDEN.includes('profielId'));
});

test('7. niets hebben is een uitslag en geen stilte', () => {
  /* Zonder deze regel is een bron die stuk is niet te onderscheiden van een
     bron die leeg is -- dezelfde fout als `if (!a.key) return`. */
  const a = maakAanvoer({ leeg: () => [], kapot: () => { throw new Error('boem'); } });
  const uit = a.manieren({});
  assert.deepEqual(uit.manieren, []);
  assert.equal(uit.geenBron.length, 1);
  assert.equal(uit.geenBron[0].herkomst, 'leeg');
  assert.equal(uit.geweigerd.length, 1, 'een kapotte bron laat geen spoor na');
  assert.match(uit.geweigerd[0].reden, /bron-brak/);
});

test('8. een kapotte bron neemt de andere niet mee', () => {
  const a = maakAanvoer({ kapot: () => { throw new Error('boem'); }, goed: () => [GOED] });
  const uit = a.manieren({});
  assert.equal(uit.manieren.length, 1, 'de goede bron is weggevallen nadat de andere brak');
});

test('9. er wordt niet gesorteerd -- een rangorde is een oordeel', () => {
  const a = maakAanvoer({
    een: () => [Object.assign({}, GOED, { wat: 'A' }), Object.assign({}, GOED, { wat: 'B' })],
    twee: () => [Object.assign({}, GOED, { terrein: 'opvang', wat: 'C' })]
  });
  const uit = a.manieren({});
  assert.deepEqual(uit.manieren.map((m) => m.wat), ['A', 'B', 'C'],
    'de volgorde is veranderd; dan wordt er ergens gewogen');
  /* Op het GEDRAG en niet op het woord: `score` en `rangorde` staan in
     MENSVELDEN, juist om ze te weigeren. Een woordtoets zou die lijst
     verbieden. */
  assert.doesNotMatch(bron, /\.sort\(/, 'er wordt gesorteerd in de aanvoerlaag');
});

test('10. de etiketlijst is gesloten en bevroren', () => {
  assert.deepEqual(ETIKETTEN, ['terrein', 'wat', 'ingang', 'dektNiet', 'herkomst', 'beschikbaarheid']);
  assert.ok(Object.isFrozen(ETIKETTEN) && Object.isFrozen(VERPLICHT) && Object.isFrozen(MENSVELDEN));
  const a = maakAanvoer({ b: () => [Object.assign({}, GOED, { prijs: 12 })] });
  assert.match(a.manieren({}).geweigerd[0].reden, /etiket onbekend: prijs/);
});

test('11. de vormmeting draagt de conclusie, en die is niet overgetypt', () => {
  /* De reden dat dit een afspraak over etiketten is en geen objecttype, staat
     in een MEETUITSLAG en niet in een mening. Verandert die uitslag, dan hoort
     dit contract te worden heroverwogen -- vandaar deze koppeling. */
  const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'AANVOERVORM.json'), 'utf8'));
  assert.equal(j.geenGedeeldeVorm, true,
    'AANVOERVORM.json vindt nu WEL een gedeelde vorm; dan is de keuze voor etiketten niet meer gedekt');
  assert.equal(j.ruim.inAlleTerreinen.length, 0);
  assert.equal(j.smal.inAlleTerreinen.length, 0);
  assert.ok(j.stempel && j.stempel.commit, 'de meting draagt geen commit en is dus niet na te lopen');
  assert.match(keur(GOED, 'x').ok ? 'ok' : 'nee', /ok/);
});
