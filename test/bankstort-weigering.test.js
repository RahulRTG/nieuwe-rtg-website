/* Een geweigerde storting is AF, niet onderweg (server/kern/bank/overboeken.js).

   Gevonden door de voltooiproef van de bank (scripts/lib/voltooi/bank.js): de
   simulatiebank weigerde een storting, en het lid kreeg "De betaling wacht op
   bevestiging." -- het wachtte dus op geld dat nooit kwam. Dezelfde fout die
   RTG Pay al had en kwijt is (kern/pay/opladen.js). Een betaling die werkelijk
   nog loopt, blijft wel "wacht op bevestiging" heten. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const maakOverboeken = require('../server/kern/bank/overboeken');

function bank(betaalStatus, aanbieder) {
  const geboekt = [];
  const ctx = {
    crypto, nu: () => 1, d: () => ({}), save: () => {}, bijeen: (f) => f(),
    rekMeta: (iban) => (iban === 'NL00RTG0001' ? { iban, codenaam: 'Codenaam' } : null),
    saldoVan: () => geboekt.reduce((s, b) => s + b.centen, 0),
    boekAsync: async (b) => { geboekt.push(b); return { ok: true, boeking: { id: 'B' + geboekt.length } }; },
    bankregie: { bankClearing: () => ({ kaart: true, eigen: false }) },
    betaal: { maakBetaling: async () => ({ id: 'p1', status: betaalStatus, aanbieder }) },
    metIdem: async (s, a, werk) => werk(),
    seintje: () => {}
  };
  return { storten: maakOverboeken(ctx).bankStorten, geboekt };
}

for (const [aanbieder, stand] of [['simulatie', 'geweigerd'], ['simulatie', 'teruggeboekt'], ['mollie', 'failed'], ['mollie', 'canceled']]) {
  test('een ' + stand + ' storting (' + aanbieder + ') zegt dat er niets is gebeurd, niet dat het wacht', async () => {
    const { storten, geboekt } = bank(stand, aanbieder);
    const r = await storten({ iban: 'NL00RTG0001', centen: 1000, codenaam: 'Codenaam', idem: 'k' });
    assert.equal(r.status, 402);
    assert.match(r.error, /niet gelukt/);
    assert.match(r.error, /niets afgeschreven/);
    assert.doesNotMatch(r.error, /wacht/);
    assert.equal(geboekt.length, 0, 'er is niets bijgeschreven');
  });
}

test('een storting die werkelijk nog loopt, wacht op bevestiging', async () => {
  const { storten, geboekt } = bank('open', 'simulatie');
  const r = await storten({ iban: 'NL00RTG0001', centen: 1000, codenaam: 'Codenaam', idem: 'k' });
  assert.equal(r.status, 402);
  assert.match(r.error, /wacht op bevestiging/);
  assert.equal(geboekt.length, 0);
});

test('een goedgekeurde storting wordt bijgeschreven', async () => {
  const { storten, geboekt } = bank('betaald', 'simulatie');
  const r = await storten({ iban: 'NL00RTG0001', centen: 1000, codenaam: 'Codenaam', idem: 'k' });
  assert.equal(r.ok, true);
  assert.equal(geboekt.length, 1);
});
