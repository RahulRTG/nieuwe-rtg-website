/* Storten via de kaart loopt via de betaalwaarheid (server/kern/bank/stortwaarheid.js).

   Twee fouten, allebei gevonden bij de voltooiproef van de bank
   (scripts/lib/voltooi/bank.js):
   1. een door de bank GEWEIGERDE storting meldde "De betaling wacht op
      bevestiging" -- het lid wachtte op geld dat nooit kwam;
   2. storten riep een kale betaal.maakBetaling aan (MONEY-012): er werd niets
      vastgelegd voor de aanroep, en een storting die LATER bevestigde (webhook,
      veegronde) werd nooit bijgeschreven.
   Hier met de echte betaalwaarheid en een rail die de proef zelf bestuurt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const maakOverboeken = require('../server/kern/bank/overboeken');
const maakBetaalWaarheid = require('../server/kern/betaalwaarheid');

function bank(stand, aanbieder) {
  const data = {};
  const rail = { stand, aanbieder: aanbieder || 'simulatie', gemaakt: 0 };
  const betaal = {
    maakBetaling: async (o) => { rail.gemaakt++; return { id: 'p-' + o.referentie, status: rail.stand, aanbieder: rail.aanbieder, bedrag: o.bedrag, valuta: 'eur' }; },
    haalBetaling: async (a, id) => { if (rail.haalFout) throw new Error('geen stand'); return { id, status: rail.stand, aanbieder: rail.aanbieder }; }
  };
  const betaalWaarheid = maakBetaalWaarheid({ d: () => data, save: () => {}, crypto, betaal });
  const boeken = [];
  const saldo = {};
  const boek = (b) => { boeken.unshift(Object.assign({ id: 'B' + (boeken.length + 1) }, b)); saldo[b.naar] = (saldo[b.naar] || 0) + b.centen; return { ok: true, boeking: boeken[0] }; };
  const ctx = {
    crypto, nu: () => 1, d: () => data, save: () => {}, bijeen: (f) => f(), betaal, betaalWaarheid,
    rekMeta: (iban) => (iban === 'NL00RTG0001' ? { iban, codenaam: 'Codenaam' } : null),
    saldoVan: (iban) => saldo[iban] || 0, grootboek: () => boeken, boek, boekAsync: async (b) => boek(b),
    bankregie: { bankClearing: () => ({ kaart: true, eigen: false }) },
    metIdem: async (s, a, werk) => werk(), seintje: () => {}
  };
  return { storten: maakOverboeken(ctx).bankStorten, boeken, rail, betaalWaarheid, data };
}
const stort = (b, idem) => b.storten({ iban: 'NL00RTG0001', centen: 1000, codenaam: 'Codenaam', idem: idem || 'k' });

for (const [aanbieder, stand] of [['simulatie', 'geweigerd'], ['simulatie', 'teruggeboekt'], ['mollie', 'failed'], ['mollie', 'canceled']]) {
  test('een ' + stand + ' storting (' + aanbieder + ') zegt dat er niets is gebeurd, niet dat het wacht', async () => {
    const b = bank(stand, aanbieder);
    const r = await stort(b);
    assert.equal(r.status, 402);
    assert.match(r.error, /niet gelukt/);
    assert.match(r.error, /niets afgeschreven/);
    assert.doesNotMatch(r.error, /wacht/);
    assert.equal(b.boeken.length, 0, 'er is niets bijgeschreven');
  });
}

test('een storting die werkelijk nog loopt, wacht op bevestiging', async () => {
  const b = bank('open');
  const r = await stort(b);
  assert.equal(r.status, 402);
  assert.match(r.error, /wacht op bevestiging/);
  assert.equal(b.boeken.length, 0);
});

test('een goedgekeurde storting staat in de betaalwaarheid en wordt een keer bijgeschreven', async () => {
  const b = bank('betaald');
  const r = await stort(b);
  assert.equal(r.ok, true);
  assert.ok(r.betalingId && /^BW-/.test(r.betalingId), 'de storting draagt het id van haar betaling');
  const w = b.betaalWaarheid.van(r.betalingId);
  assert.equal(w.soort, 'bank-stort');
  assert.equal(w.status, 'BEVESTIGD');
  assert.ok(w.afgehandeldAt);
  assert.equal(b.boeken.length, 1);
  assert.equal(b.boeken[0].ref, r.betalingId);
});

test('een storting die LATER bevestigt (webhook), wordt dan precies een keer bijgeschreven', async () => {
  const b = bank('open');
  const r = await stort(b);
  assert.equal(r.status, 402);
  assert.equal(b.boeken.length, 0);
  b.rail.stand = 'betaald';
  const melding = { eventId: 'sim-1', aanbieder: 'simulatie', providerId: 'p-' + r.betalingId, referentie: r.betalingId, status: 'betaald', bedrag: 1000, valuta: 'eur' };
  await b.betaalWaarheid.providerMelding(melding);
  await b.betaalWaarheid.providerMelding(Object.assign({}, melding, { eventId: 'sim-2' }));
  assert.equal(b.boeken.length, 1, 'bijgeschreven, en een herhaalde melding schrijft niet nog eens bij');
  assert.equal(b.boeken[0].centen, 1000);
});

test('dezelfde storting nog eens terwijl de bank hangt: de wachtzin, geen 502 en geen tweede betaling', async () => {
  const b = bank('open');
  const eerste = await stort(b, 'hangt');
  assert.equal(eerste.status, 402);
  b.rail.haalFout = true;
  const nogeens = await stort(b, 'hangt');
  assert.equal(nogeens.status, 402, JSON.stringify(nogeens));
  assert.match(nogeens.error, /wacht op bevestiging/);
  assert.equal(b.rail.gemaakt, 1, 'geen tweede betaling bij de rail');
});
