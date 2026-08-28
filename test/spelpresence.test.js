/* Wie er NU is, van je vrienden en je klasgenoten. Vijf regels, en vier ervan
   zijn er om iets te voorkomen -- dus staan ze hier alle vijf als toets, met de
   fout erbij die ze tegenhouden. De laag bewaart niets: hij leest de levende
   lijst van open live-verbindingen, dus is hij met stubs precies na te spelen.

   Draai los: node --test test/spelpresence.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakPresence = require('../server/kern/spellen/presence');

/* Een presence-laag met precies deze verbonden sleutels. De opt-out
   ("onzichtbaar spelen") woont in dezelfde module -- het is dezelfde vraag: wie
   is er te zien -- dus die wordt hier NIET gestubd maar echt gezet, via de
   opslag die de laag zelf gebruikt. Een stub zou de regel toetsen die de toets
   zelf heeft geschreven. */
function metOpen(sleutels, extra = {}) {
  const db = { spellen: {} };
  const laag = maakPresence(Object.assign({
    S: () => db.spellen,
    save() {},
    sseClients: sleutels.map(k => ({ key: k })),
    isGeblokkeerd: () => false,
    codenaamVan: (k) => 'CN-' + k,
    lidBoardUit: () => false
  }, extra));
  // wie zich onzichtbaar zet, doet dat via de gewone weg
  for (const k of (extra.verborgen || [])) laag.spelZichtbaarZet(k, false);
  return laag;
}
const namen = (r) => r.online.map(o => o.codenaam).sort();

test('alleen wie een open verbinding heeft telt als aanwezig', () => {
  const { spelOnline } = metOpen(['anna', 'boris']);
  const r = spelOnline('ik', ['anna', 'boris', 'chris']);
  assert.deepEqual(namen(r), ['CN-anna', 'CN-boris']);
  assert.equal(r.aantal, 2);
});

test('de stand gaat over codenamen, niet over echte namen of sleutels alleen', () => {
  const { spelOnline } = metOpen(['anna']);
  const r = spelOnline('ik', ['anna']);
  assert.equal(r.online[0].codenaam, 'CN-anna', 'de codenaam gaat mee naar het scherm van een ander');
  assert.equal(r.online[0].key, 'anna', 'en de sleutel, want daarmee nodig je iemand uit');
});

test('er is geen "laatst gezien": aanwezigheid is aan of niet aan', () => {
  /* Een tijdstempel zou opslag vragen die deze laag niet heeft, en het is het
     patroon dat CLAUDE.md verbiedt -- "hij was drie minuten geleden nog online
     en antwoordt niet" zet druk op iemand die gewoon iets anders doet. */
  const { spelOnline } = metOpen(['anna']);
  const r = spelOnline('ik', ['anna']);
  const velden = Object.keys(r.online[0]).sort();
  assert.deepEqual(velden, ['codenaam', 'key'], 'er hoort niets bij te staan over wanneer of hoe lang');
  assert.equal(JSON.stringify(r).includes('at'), false, 'ook geen tijdstempel elders in het antwoord');
});

test('geblokkeerd is weg, en dat is geen zichtbaarheid maar afwezigheid', () => {
  // anders is "is hij online" een achterdeur om te zien of iemand er is
  const { spelOnline } = metOpen(['anna', 'boris'], {
    isGeblokkeerd: (mij, ander) => ander === 'boris'
  });
  assert.deepEqual(namen(spelOnline('ik', ['anna', 'boris'])), ['CN-anna']);
});

test('wie de functie "spelen" heeft uitgezet telt als offline', () => {
  /* Niet uit netheid maar uit correctheid: zo iemand krijgt op
     /api/member/spel een 403, maar houdt wel een open stream vanuit elke
     andere app. Zonder deze regel nodig je iemand uit die dat verzoek
     gegarandeerd niet kan aannemen. */
  const gezien = [];
  const { spelOnline } = metOpen(['anna', 'boris'], {
    lidBoardUit: (key, functie) => { gezien.push(functie); return key === 'boris'; }
  });
  assert.deepEqual(namen(spelOnline('ik', ['anna', 'boris'])), ['CN-anna']);
  assert.deepEqual([...new Set(gezien)], ['spelen'],
    'het moet om precies dat functie-id gaan; een ander id zou de poort niet dekken');
});

test('jezelf sta je niet in je eigen lijst', () => {
  const { spelOnline } = metOpen(['ik', 'anna']);
  assert.deepEqual(namen(spelOnline('ik', ['ik', 'anna'])), ['CN-anna']);
});

test('een profiel zonder boardroom (RTF) valt terug op "niet uitgezet"', () => {
  // die functie kun je daar niet omzetten, dus een uitzondering uit lidBoardUit
  // mag geen vriend laten verdwijnen
  const { spelOnline } = metOpen(['rtf:gezin:kind'], {
    lidBoardUit: () => { throw new Error('geen boardroom voor dit profiel'); }
  });
  assert.deepEqual(namen(spelOnline('ik', ['rtf:gezin:kind'])), ['CN-rtf:gezin:kind']);
});

test('zonder live-laag is de lijst leeg en niet stuk', () => {
  // een stand of een toets zonder SSE hoort geen uitzondering te geven
  const { spelOnline } = maakPresence({
    sseClients: [], isGeblokkeerd: () => false, codenaamVan: (k) => k, lidBoardUit: () => false
  });
  assert.deepEqual(spelOnline('ik', ['anna']), { online: [], aantal: 0, stand: 'nu' });
});

test('een rare vriendenlijst geeft geen uitzondering', () => {
  const { spelOnline } = metOpen(['anna']);
  for (const raar of [null, undefined, 'anna', 42, {}])
    assert.deepEqual(spelOnline('ik', raar).online, [], 'geen lijst hoort leeg terug te geven: ' + JSON.stringify(raar));
});

/* ---------- onzichtbaar spelen: de aparte opt-out ---------- */

test('wie zichzelf onzichtbaar zet komt in niemands stand', () => {
  /* Dit staat NAAST het uitzetten van de hele functie "spelen": "ik speel wel
     maar hoef niet gezien te worden" is iets anders dan "ik speel niet". */
  const { spelOnline } = metOpen(['anna', 'boris'], { verborgen: ['boris'] });
  assert.deepEqual(namen(spelOnline('ik', ['anna', 'boris'])), ['CN-anna']);
});

test('onzichtbaar werkt EEN kant op: je ziet anderen nog gewoon', () => {
  /* Iemand blinderen omdat hij niet gezien wil worden is een ruil, en dat is
     precies de druk die hier niet hoort. */
  const { spelOnline } = metOpen(['anna', 'ik'], { verborgen: ['ik'] });
  assert.deepEqual(namen(spelOnline('ik', ['anna'])), ['CN-anna'],
    'wie zich verbergt hoort zelf niet blind te worden');
});

/* ---------- de kring: vrienden en klasgenoten door elkaar ---------- */

test('dezelfde persoon telt maar een keer, ook als hij vriend EN klasgenoot is', () => {
  // de kring komt als twee lijsten achter elkaar binnen; dubbel tellen zou
  // "3 vrienden zijn er nu" laten zeggen terwijl het er twee zijn
  const { spelOnline } = metOpen(['anna', 'boris']);
  const r = spelOnline('ik', ['anna', 'boris', 'anna']);
  assert.equal(r.aantal, 2);
  assert.deepEqual(namen(r), ['CN-anna', 'CN-boris']);
});
