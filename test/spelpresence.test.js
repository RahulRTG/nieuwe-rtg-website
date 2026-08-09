/* Wie van je vrienden er NU is. Vier regels, en drie ervan zijn er om iets te
   voorkomen -- dus staan ze hier alle vier als toets, met de fout erbij die ze
   tegenhouden. De laag bewaart niets: hij leest de levende lijst van open
   live-verbindingen, dus is hij met stubs precies na te spelen.

   Draai los: node --experimental-sqlite --test test/spelpresence.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakPresence = require('../server/kern/spellen/presence');

// een presence-laag met precies deze verbonden sleutels
function metOpen(sleutels, extra = {}) {
  return maakPresence(Object.assign({
    sseClients: sleutels.map(k => ({ key: k })),
    isGeblokkeerd: () => false,
    codenaamVan: (k) => 'CN-' + k,
    lidBoardUit: () => false
  }, extra));
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
