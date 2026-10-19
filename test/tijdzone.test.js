/* DE KLOK VAN HET HUIS (server/kern/tijdzone.js).

   De server draait in productie in een UTC-container. Alles wat het uur, de
   weekdag of "vandaag" van een Date leest met `getHours()` en zijn broers,
   krijgt daar UTC -- en zegt om 19:30 in Amsterdam "Goedemiddag", of om half
   een 's nachts dat het nog gisteren is. De helpers hieronder lezen de zone
   van het huis (Europe/Amsterdam) of een meegegeven zone. Elke toets zet een
   vast UTC-moment waarop de servertijd het fout heeft.

   Draai los: node --test test/tijdzone.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');
const tz = require('../server/kern/tijdzone');

const WORTEL = path.join(__dirname, '..');
const Z = s => new Date(s);

test('het huis staat in Amsterdam', () => {
  assert.equal(tz.HUIS_ZONE, 'Europe/Amsterdam');
});

test('17:30 UTC in de zomer is 19:30 in het huis', () => {
  const h = tz.huis(Z('2026-07-15T17:30:00Z'));
  assert.equal(h.uur, 19);
  assert.equal(h.hhmm, '19:30');
  assert.equal(tz.uurIn(Z('2026-07-15T17:30:00Z')), 19);
  assert.equal(tz.hhmmIn(Z('2026-07-15T17:30:00Z')), '19:30');
});

test('23:30 UTC is in Amsterdam al de volgende dag', () => {
  const t = Z('2026-07-15T23:30:00Z'); // woensdag UTC, donderdag 01:30 lokaal
  assert.equal(tz.datumIn(t), '2026-07-16');
  assert.equal(tz.weekdagIn(t), 4);
  assert.equal(tz.uurIn(t), 1);
  assert.equal(tz.huis(t).dagVanMaand, 16);
});

test('oudejaarsavond 23:30 UTC is in Amsterdam al het nieuwe jaar', () => {
  const t = Z('2026-12-31T23:30:00Z');
  assert.equal(tz.jaarIn(t), 2027);
  assert.equal(tz.maandIn(t), 1);
});

test('de rand van de zomertijd: 29 maart en 25 oktober 2026', () => {
  // voorjaar: om 01:00 UTC springt Amsterdam van 02:00 naar 03:00
  assert.equal(tz.hhmmIn(Z('2026-03-29T00:30:00Z')), '01:30');
  assert.equal(tz.hhmmIn(Z('2026-03-29T01:30:00Z')), '03:30');
  // najaar: om 01:00 UTC valt Amsterdam van 03:00 terug naar 02:00
  assert.equal(tz.hhmmIn(Z('2026-10-25T00:30:00Z')), '02:30');
  assert.equal(tz.hhmmIn(Z('2026-10-25T01:30:00Z')), '02:30');
});

test('een andere zone gaat voor het huis', () => {
  const t = Z('2026-07-15T17:30:00Z');
  assert.equal(tz.uurIn(t, 'Asia/Tokyo'), 2);
  assert.equal(tz.datumIn(t, 'Asia/Tokyo'), '2026-07-16');
  assert.equal(tz.uurIn(t, 'UTC'), 17);
});

test('een getal of ISO-tekst wordt gelezen; niets is nu', () => {
  assert.equal(tz.uurIn(Date.parse('2026-01-10T11:00:00Z')), 12);
  assert.equal(tz.uurIn('2026-01-10T11:00:00Z'), 12);
  assert.equal(typeof tz.uurIn(), 'number');
});

test('kalenderrekenen: plusDagen en weekdagVan over de jaar- en zomertijdgrens', () => {
  assert.equal(tz.plusDagen('2026-12-31', 1), '2027-01-01');
  assert.equal(tz.plusDagen('2026-03-01', -1), '2026-02-28');
  assert.equal(tz.plusDagen('2026-10-24', 2), '2026-10-26');
  assert.equal(tz.weekdagVan('2026-10-19'), 1); // maandag
  assert.equal(tz.weekdagVan('2026-10-25'), 0); // zondag
});

test('middernacht in het huis, ook op de dagen van 23 en 25 uur', () => {
  assert.equal(tz.middernacht('2026-07-01').toISOString(), '2026-06-30T22:00:00.000Z');
  assert.equal(tz.middernacht('2026-01-01').toISOString(), '2025-12-31T23:00:00.000Z');
  assert.equal(tz.middernacht('2026-03-29').toISOString(), '2026-03-28T23:00:00.000Z');
  assert.equal(tz.middernacht('2026-10-25').toISOString(), '2026-10-24T22:00:00.000Z');
  assert.equal(tz.middernacht('2026-10-26').toISOString(), '2026-10-25T23:00:00.000Z');
});

test('zonder moment volgt hij RTG_KLOK, ook in een UTC-proces', () => {
  const uit = execFileSync(process.execPath, ['-e',
    "const t=require('./server/kern/tijdzone');process.stdout.write(t.datumIn()+' '+t.hhmmIn())"],
  { encoding: 'utf8', cwd: WORTEL, env: { ...process.env, TZ: 'UTC', RTG_KLOK: '2026-07-15T23:30:00Z', NODE_ENV: 'test' } });
  // de klok loopt door vanaf het gezette moment; de minuut kan dus net verspringen
  assert.match(uit, /^2026-07-16 01:3\d$/);
});

test('moment: een klokuur op een datum in het huis, ook op de zomertijdranden', () => {
  assert.equal(tz.moment('2026-07-15', 19 * 60 + 30).toISOString(), '2026-07-15T17:30:00.000Z');
  // 02:30 bestaat niet op 29 maart: de wandklok springt naar 03:30
  assert.equal(tz.moment('2026-03-29', 150).toISOString(), '2026-03-29T01:30:00.000Z');
  assert.equal(tz.moment('2026-07-15', 0, 'Asia/Tokyo').toISOString(), '2026-07-14T15:00:00.000Z');
});

test('zaakZoneOfHuis: de zone van de zaak, en anders het huis in plaats van UTC', () => {
  assert.equal(tz.zaakZoneOfHuis({ tijdzone: 'Europe/Madrid' }), 'Europe/Madrid');
  assert.equal(tz.zaakZoneOfHuis({ country: 'PT' }), 'Europe/Lisbon');
  assert.equal(tz.zaakZoneOfHuis({}), 'Europe/Amsterdam');
  assert.equal(tz.zaakZoneOfHuis(null), 'Europe/Amsterdam');
});

test('datumVan: de dag van een opgeslagen tijdstip in het huis; leeg is null en nooit vandaag', () => {
  assert.equal(tz.datumVan('2026-07-15T23:30:00Z'), '2026-07-16');
  assert.equal(tz.datumVan(Date.parse('2026-07-15T21:00:00Z')), '2026-07-15');
  assert.equal(tz.datumVan(undefined), null);
  assert.equal(tz.datumVan(''), null);
  assert.equal(tz.datumVan('rommel'), null);
});
