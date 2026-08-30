/* ============================================================================
   DE HORECAWERELD -- een open rekening op een tafel.

   Zesenveertig horecaroutes stonden op 404, en twintig zeggen hetzelfde: "Deze
   rekening kennen we niet." De rekening is het scharnier van dit domein --
   bestellen, korting, splitsen, fooi, afrekenen en de bon hangen er allemaal
   aan.

   DIT IS GEEN NIEUWE KETEN. De gastfamilie liep de gastenkant al af (zaak geeft
   een QR uit, gast scant, gast schuift aan) en bij dat aanschuiven ONTSTAAT een
   rekening. Alleen kwam het id nergens terecht: de familie levert `sleutel` en
   verder niets. Twee oproepen erbij, twintig routes eruit.

   EEN DING DAT RADEN NIET HAD OPGELEVERD: het veld heet aan de gastenkant
   `sleutel` en aan de zaakkant `rekeningId`. Twee namen voor twee
   gezichtspunten op dezelfde rekening, en alleen de bron zegt welke waar hoort
   (server/routes/supplier/horeca/rekening.js, rekVan).
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { zetHorecaKlaar } = require('../scripts/lib/wereld-horeca');

test('zonder gastsleutel of zaaksessie bouwt de wereld niets, met de reden', async () => {
  const u = await zetHorecaKlaar({ post: async () => ({ status: 200, data: {} }), sleutels: {}, tokens: {} });
  assert.equal(u.klaar, false);
  assert.match(u.reden, /ontbreekt/);
  assert.deepEqual(u.extra, {});
});

test('het rekening-id gaat mee onder de naam die de ZAAKkant leest', async () => {
  const u = await zetHorecaKlaar({
    post: async () => ({ status: 200, data: { ok: true, rekening: { id: 'REK-1' } } }),
    sleutels: { gast: { sleutel: 'S1' } }, tokens: { supplier: 'T' }
  });
  assert.equal(u.extra.rekeningId, 'REK-1',
    'rekVan() leest req.body.rekeningId; de gastenkant noemt hetzelfde ding `sleutel`');
  assert.equal(u.klaar, true);
});

test('geen rekening-id terug betekent NIET klaar, met de reden erbij', async () => {
  const u = await zetHorecaKlaar({
    post: async () => ({ status: 200, data: { ok: true } }),
    sleutels: { gast: { sleutel: 'S1' } }, tokens: { supplier: 'T' }
  });
  assert.equal(u.klaar, false);
  assert.ok(u.reden && u.reden.length > 20);
  assert.deepEqual(u.extra, {}, 'zonder id hoort er niets meegestuurd te worden');
});

test('de wereld loopt niet om als de deur stukgaat', async () => {
  const u = await zetHorecaKlaar({
    post: async () => { throw new Error('stuk'); },
    sleutels: { gast: { sleutel: 'S1' } }, tokens: { supplier: 'T' }
  });
  assert.equal(u.klaar, false);
  assert.ok(u.stappen.length > 0, 'een mislukte stap hoort zichtbaar te zijn');
});
