/* DE HANDHAVER OP DE BASISLIJN VAN DE NORM.

   scripts/normbasis.js legt NORM.json van deze tak naast die van main en
   weigert een meter die LOSSER staat zonder reden. De vergelijking staat daar
   los van git en los van bestanden, juist zodat hij hier met verzonnen invoer
   te ijken is: een toets die de toevallige stand van de repo leest, meet of het
   vandaag goed gaat en niet of de zeef werkt.

   Draai los: node --experimental-sqlite --test test/normbasis.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { vergelijk, gedekt } = require('../scripts/normbasis.js');

const METERS = [
  { sleutel: 'ongedekt', richting: 'omlaag' },
  { sleutel: 'dekkingPct', richting: 'omhoog' }
];

test('een hogere teller op een omlaag-meter is LOSSER, een lagere is strakker', () => {
  const losser = vergelijk({ meters: { ongedekt: 1158 } }, { meters: { ongedekt: 1284 } }, METERS);
  assert.deepEqual(losser.losser, [{ sleutel: 'ongedekt', basis: 1158, nu: 1284 }],
    'de sprong van 15 augustus hoort als verruiming gezien te worden');
  assert.equal(losser.strakker.length, 0);

  const strakker = vergelijk({ meters: { ongedekt: 1284 } }, { meters: { ongedekt: 1192 } }, METERS);
  assert.equal(strakker.losser.length, 0, 'strakker is geen verruiming');
  assert.deepEqual(strakker.strakker, [{ sleutel: 'ongedekt', basis: 1284, nu: 1192 }]);
});

test('en op een omhoog-meter ligt het precies andersom', () => {
  const r = vergelijk({ meters: { dekkingPct: 75 } }, { meters: { dekkingPct: 71 } }, METERS);
  assert.deepEqual(r.losser, [{ sleutel: 'dekkingPct', basis: 75, nu: 71 }],
    'minder dekking is een verruiming, ook al is het getal lager');
});

test('gelijk is geen beweging, en een nieuwe meter is geen verruiming', () => {
  const gelijk = vergelijk({ meters: { ongedekt: 10 } }, { meters: { ongedekt: 10 } }, METERS);
  assert.deepEqual([gelijk.losser, gelijk.strakker, gelijk.nieuw], [[], [], []]);
  const vers = vergelijk({ meters: {} }, { meters: { ongedekt: 7 } }, METERS);
  assert.deepEqual(vers.nieuw, [{ sleutel: 'ongedekt', nu: 7 }]);
  assert.equal(vers.losser.length, 0, 'een meter die main nog niet kende is geen verlaagde lat');
});

/* DE WRINGER, en dit is waar de regel echt over gaat. Een notitie dekt alleen
   de VERPLAATSING die hij noemt -- niet de meter in het algemeen.

   De eerste versie van `gedekt()` vroeg alleen of er ergens een notitie stond
   die de meter noemde, en dat maakte de hele keuring tandeloos: NORM.json draagt
   zestig notities uit twee weken, waarvan er vijf `endpointsZonderTest` noemen,
   dus dekte een notitie van 4 augustus elke verlaging van vandaag. Dit is
   gevonden doordat de tegenproef groen bleef op een verzonnen verlaging zonder
   reden -- de meter zag niet wat hij hoorde te zien. */
test('een reden dekt alleen de verplaatsing die hij noemt', () => {
  const reden = 'De contactpin voegt acht namen aan de kern toe; minder kan niet zonder de functie te halveren.';
  const notities = [{ datum: '2026-08-18', meter: 'kernBreedte 1405 -> 1413', reden }];
  assert.equal(gedekt('kernBreedte', notities, 1413), true, 'de genoemde verplaatsing is gedekt');
  assert.equal(gedekt('kernBreedte', notities, 1500), false,
    'DIT IS DE HELE REGEL: een oude notitie over dezelfde meter dekt een nieuwe verlaging niet');
  assert.equal(gedekt('keuringOmvang', notities, 1413), false, 'een andere meter niet');
  assert.equal(gedekt('kernBreedte', [{ meter: 'kernBreedte 1405 -> 1413', reden: 'moest' }], 1413), false,
    'een reden van vier tekens legt niets uit');
  assert.equal(gedekt('kernBreedte', [], 1413), false, 'geen notities is geen dekking');
  assert.equal(gedekt('kernBreedte', undefined, 1413), false, 'een ontbrekend veld ook niet');
});

test('het getal in de notitie moet los staan, niet toevallig in een ander getal zitten', () => {
  /* Anders zou "kernBreedte 141 -> 1413" ook een verlaging naar 14 dekken, en
     een cijferreeks die ergens in een ander getal voorkomt is geen vermelding. */
  const notities = [{ datum: '2026-08-18', meter: 'kernBreedte 1405 -> 1413',
    reden: 'Een reden die lang genoeg is om als uitleg te tellen bij deze meter.' }];
  assert.equal(gedekt('kernBreedte', notities, 141), false, '141 zit IN 1413 maar staat er niet');
  assert.equal(gedekt('kernBreedte', notities, 14), false, 'en 14 al helemaal niet');
});

/* Twee notities over dezelfde meter uit twee rondes: de nieuwste dekt, de oude
   niet. Zo staat de echte NORM.json er ook bij. */
test('van twee notities over dezelfde meter dekt alleen die met de juiste waarde', () => {
  const notities = [
    { meter: 'endpointsZonderTest 622 -> 781', reden: 'Een ronde in augustus, met een uitleg die lang genoeg is.' },
    { meter: 'endpointsZonderTest 1158 -> 1284', reden: 'Main was ver doorgelopen; opnieuw gemeten op de nieuwe basislijn.' }
  ];
  assert.equal(gedekt('endpointsZonderTest', notities, 1284), true);
  assert.equal(gedekt('endpointsZonderTest', notities, 781), true);
  assert.equal(gedekt('endpointsZonderTest', notities, 1300), false, 'een derde verlaging staat er niet bij');
});

/* De echte NORM.json erbij gehaald, want de vorm waar deze keuring op leunt moet
   wel de vorm zijn die er staat. Niet de INHOUD toetsen -- dat doet norm.js --
   maar dat `notities` bestaat en draagt wat `gedekt()` erin zoekt. */
test('de echte NORM.json draagt notities in de vorm waar deze keuring op leunt', () => {
  const norm = require('../NORM.json');
  assert.ok(Array.isArray(norm.notities) && norm.notities.length > 0, 'NORM.json draagt notities');
  const eerste = norm.notities[0];
  for (const veld of ['datum', 'meter', 'reden']) {
    assert.ok(typeof eerste[veld] === 'string' && eerste[veld].length,
      'een notitie draagt een ' + veld + '; zonder dat veld dekt geen enkele reden nog iets');
  }
});
