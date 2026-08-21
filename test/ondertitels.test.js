/* WAT EEN ONDERTITELREGEL IS, STAAT OP EEN PLEK -- en deze toets bewaakt dat.

   server/kern/ondertitels.js is vandaag ontstaan omdat het Theater hetzelfde
   ondertitelspoor kreeg als een clip. De makkelijke weg was die twintig regels
   validatie overschrijven; twee kopieen lopen binnen een jaar uiteen, en dan
   verschilt wat een kijker te zien krijgt per app zonder dat iemand dat besloot
   (LAT.md regel 4).

   Deze toets doet twee dingen. Hij legt de regels vast (wat vervalt, wat blijft,
   in welke volgorde), en hij rekent af dat de twee gebruikers ECHT die ene bron
   gebruiken -- want een gedeelde module waar niemand meer heen wijst, is geen
   gedeelde waarheid maar een dood bestand.

   Draai los: node --test test/ondertitels.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { schoonCues, CUES_MAX, CUE_TEKST } = require('../server/kern/ondertitels');

const WORTEL = path.join(__dirname, '..');

test('een lijst wordt op tijd gesorteerd, en afgerond op een tiende', () => {
  const uit = schoonCues([
    { van: 4.44, tot: 6, tekst: 'later' },
    { van: 1, tot: 2.06, tekst: 'eerder' }
  ], 10);
  assert.deepEqual(uit, [{ van: 1, tot: 2.1, tekst: 'eerder' }, { van: 4.4, tot: 6, tekst: 'later' }]);
});

test('een onmogelijke regel VERVALT en laat de rest staan', () => {
  /* Bewust geen harde weigering van de hele lijst: een maker die tachtig regels
     plakt met een typefout in regel veertig, verliest anders zijn hele werk. */
  const uit = schoonCues([
    { van: 1, tot: 2, tekst: 'goed' },
    { van: 5, tot: 5, tekst: 'nul lang' },
    { van: 9, tot: 3, tekst: 'eind voor begin' },
    { van: -1, tot: 2, tekst: 'voor het begin' },
    { van: 8, tot: 99, tekst: 'na het eind' },
    { van: 3, tot: 4, tekst: '' },
    { van: 6, tot: 7, tekst: 'ook goed' }
  ], 10);
  assert.deepEqual(uit.map(c => c.tekst), ['goed', 'ook goed']);
});

test('zonder duur wordt er niet op tijd begrensd', () => {
  // een thuis-video meldt zijn eigen duur en mag die op nul laten staan
  assert.equal(schoonCues([{ van: 0, tot: 99999, tekst: 'lang' }], 0).length, 1);
  assert.equal(schoonCues([{ van: 0, tot: 99999, tekst: 'lang' }], 60).length, 0);
});

test('de grenzen zijn echt grenzen: 200 regels en 120 tekens', () => {
  const veel = Array.from({ length: CUES_MAX + 50 }, (_, i) => ({ van: i, tot: i + 0.5, tekst: 'r' + i }));
  assert.equal(schoonCues(veel, 1000).length, CUES_MAX);
  const lang = schoonCues([{ van: 0, tot: 1, tekst: 'x'.repeat(CUE_TEKST + 40) }], 10);
  assert.equal(lang[0].tekst.length, CUE_TEKST);
});

test('geen lijst is geen lege lijst: dat verschil moet blijven', () => {
  /* null betekent "dit is geen ondertitellijst" en levert bij de aanroeper een
     400 op; een LEGE lijst is een geldig antwoord dat het spoor wist. Wie die
     twee gelijk maakt, laat een maker zijn ondertitels niet meer intrekken. */
  assert.equal(schoonCues(undefined, 10), null);
  assert.equal(schoonCues('0:01 tekst', 10), null);
  assert.deepEqual(schoonCues([], 10), []);
});

test('een cue draagt geen HTML de speler in', () => {
  const uit = schoonCues([{ van: 0, tot: 1, tekst: '<img src=x onerror=alert(1)>hallo' }], 10);
  assert.doesNotMatch(uit[0].tekst, /[<>]/);
});

test('DE TWEE GEBRUIKERS WIJZEN ECHT HIERHEEN (anders is dit een dood bestand)', () => {
  const leest = (rel) => fs.readFileSync(path.join(WORTEL, rel), 'utf8');
  for (const rel of ['server/kern/clips-studio.js', 'server/kern/theater/video.js']) {
    const bron = leest(rel);
    assert.match(bron, /require\(['"][^'"]*ondertitels['"]\)/, rel + ' haalt de cue-regels niet uit de gedeelde module');
    assert.match(bron, /schoonCues\(/, rel + ' gebruikt schoonCues() niet');
    assert.doesNotMatch(bron, /CUES_MAX\s*=\s*\d/, rel + ' heeft weer een eigen grens gekregen');
  }
});
