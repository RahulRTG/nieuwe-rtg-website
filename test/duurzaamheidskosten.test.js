/* DE KOSTENMETING VAN DE DUURZAME COMMIT -- het oordeel, los van twee servers.

   De ronde zelf start twee servers en duurt minuten; daar komt niemand met een
   mutatie bij. Wat hier wordt getoetst is de enige manier waarop deze proef kan
   liegen: als de machine tijdens de tweede ronde toevallig drukker was, gaat
   ALLES omhoog en leest dat als de prijs van de commit. De controlegroep is de
   test daarop, en die regel hoort te kunnen zakken (LAT.md, regel 10).

   Draai los: node --test test/duurzaamheidskosten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { pct, oordeel, ROUTES } = require('../scripts/duurzaamheidskosten');

test('een duurzame route die duidelijk trager is dan de controle telt als meting', () => {
  const o = oordeel(2.01, 1.03);
  assert.equal(o.blind, false);
  assert.equal(o.reden, null);
});

test('beweegt de controle even hard mee, dan is er niets over de commit gemeten', () => {
  /* Dit is de kern. Zonder deze regel zou een drukke machine als "de duurzame
     commit kost 3x" in het register belanden -- een getal dat eruitziet als een
     feit en niets meet. */
  assert.equal(oordeel(1.4, 1.4).blind, true);
  assert.equal(oordeel(1.4, 1.9).blind, true);
  assert.match(oordeel(1.4, 1.9).reden, /controlegroep/);
});

test('en zonder een van beide getallen oordeelt hij niet', () => {
  assert.equal(oordeel(null, 1.0).blind, true);
  assert.equal(oordeel(2.0, null).blind, true);
  assert.match(oordeel(2.0, null).reden, /controlegroep/);
});

test('er staat echt een controlegroep in de routelijst', () => {
  /* Een proef met alleen duurzame routes heeft geen ijklijn en kan de regel
     hierboven nooit stellen. Wie de lijst opschoont, komt hier langs. */
  assert.ok(ROUTES.some(r => r.duurzaam), 'zonder duurzame route valt er niets te meten');
  assert.ok(ROUTES.some(r => !r.duurzaam), 'zonder controlegroep is elk verschil ruis');
});

test('de percentiel-rekenaar gebruikt de ruwe waarden, geen buckets', () => {
  const rij = [10, 1, 5, 2, 3, 4, 6, 7, 8, 9];
  assert.equal(pct(rij, 0.5), 6);
  assert.equal(pct(rij, 0.99), 10);
  assert.equal(pct([], 0.5), null, 'zonder metingen geen getal, en zeker geen nul');
  assert.equal(pct([42], 0.99), 42);
});
