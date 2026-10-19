/* Een markt-deal is pas betaald als de betaling definitief is
   (server/kern/markt/handel/dealbetaal.js).

   dealBetaal riep de betaalnaad rechtstreeks aan en zette elke uitkomst die
   geen "betaald" was en geen clientSecret droeg OP BETAALD: een geweigerde,
   hangende of teruggeboekte betaling werd "Betaald via Apple Pay", de
   advertentie "verkocht", en de verkoper kreeg bericht dat hij kon leveren. Nu
   loopt het via de betaalwaarheid (soort markt-deal), en een afhandelaar zet de
   deal precies een keer op betaald, ook als de bevestiging later binnenkomt.
   Hier met de echte betaalwaarheid en een rail die de proef bestuurt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const maakDeal = require('../server/kern/markt/handel/deal');
const maakBetaalWaarheid = require('../server/kern/betaalwaarheid');

const KOPER = { soort: 'lid', id: 'k1', naam: 'Koper' };
const VERKOPER = { soort: 'lid', id: 'v1', naam: 'Verkoper' };

function wereld(stand) {
  const data = {};
  const rail = { stand, gemaakt: 0 };
  const betaal = {
    maakBetaling: async (o) => { rail.gemaakt++; return { id: 'p-' + o.referentie, status: rail.stand, aanbieder: 'simulatie', bedrag: o.bedrag, valuta: 'eur' }; },
    haalBetaling: async (a, id) => ({ id, status: rail.stand, aanbieder: 'simulatie' })
  };
  const betaalWaarheid = maakBetaalWaarheid({ d: () => data, save: () => {}, crypto, betaal });
  const ad = { id: 'ad1', titel: 'Fiets', prijs: 120, status: 'actief' };
  const markt = { chats: {} };
  const pk = (p) => (p && p.soort ? p.soort + '|' + p.id : '');
  const cid = 'ad1:' + pk(KOPER);
  markt.chats[cid] = { adId: 'ad1', adTitel: 'Fiets', koper: KOPER, verkoper: VERKOPER, berichten: [], at: 'x',
    deal: { bedrag: 120, status: 'samen', samen: true, gedeeld: {}, betaald: false,
      factuur: { nummer: 'SAL-2026-000001', bedrag: 120 } } };
  const seinen = [];
  const d = maakDeal({ db: { data }, save: () => {}, crypto, schoon: (v) => String(v || ''), notify: () => {}, betaal, betaalWaarheid,
    store: () => markt, nu: () => new Date().toISOString(), pk, vind: (id) => (id === 'ad1' ? ad : null),
    chatId: (a, k) => a + ':' + k, sein: (wie, m) => seinen.push({ wie: pk(wie), m }), SAMEN_VERS_MS: 60000 });
  return { d, cid, chat: markt.chats[cid], ad, seinen, rail, betaalWaarheid };
}
const naarVerkoper = (w) => w.seinen.filter((s) => s.wie === 'lid|v1' && /Betaald/.test(s.m.title));

for (const stand of ['geweigerd', 'teruggeboekt']) {
  test('een ' + stand + ' betaling zet de deal niet op betaald, de advertentie niet op verkocht, en meldt de verkoper niets', async () => {
    const w = wereld(stand);
    const r = await w.d.dealBetaal(w.cid, KOPER, 'apple-pay');
    assert.equal(r.status, 402, JSON.stringify(r));
    assert.match(r.error, /niet gelukt/);
    assert.equal(w.chat.deal.betaald, false);
    assert.notEqual(w.ad.status, 'verkocht');
    assert.equal(naarVerkoper(w).length, 0);
    assert.ok(!w.chat.berichten.some((b) => /Betaald via/.test(b.tekst)));
  });
}

test('een betaling die nog loopt, wacht: niet betaald en de verkoper levert nog niet', async () => {
  const w = wereld('open');
  const r = await w.d.dealBetaal(w.cid, KOPER, 'apple-pay');
  assert.equal(r.status, 402);
  assert.match(r.error, /wacht op bevestiging/);
  assert.equal(w.chat.deal.betaald, false);
  assert.equal(naarVerkoper(w).length, 0);
});

test('een bevestigde betaling zet de deal precies een keer op betaald, ook als de bevestiging later komt', async () => {
  const w = wereld('open');
  const r = await w.d.dealBetaal(w.cid, KOPER, 'apple-pay');
  w.rail.stand = 'betaald';
  const melding = { eventId: 'e1', aanbieder: 'simulatie', providerId: 'p-' + r.betalingId, referentie: r.betalingId, status: 'betaald', bedrag: 12000, valuta: 'eur' };
  await w.betaalWaarheid.providerMelding(melding);
  await w.betaalWaarheid.providerMelding(Object.assign({}, melding, { eventId: 'e2' }));
  assert.equal(w.chat.deal.betaald, true);
  assert.equal(w.ad.status, 'verkocht');
  assert.equal(naarVerkoper(w).length, 1, 'de verkoper hoort het een keer');
  assert.equal(w.chat.berichten.filter((b) => /Betaald via/.test(b.tekst)).length, 1);
});

test('meteen betaald: betaald, en nog eens betalen kan niet en kost niets', async () => {
  const w = wereld('betaald');
  const r = await w.d.dealBetaal(w.cid, KOPER, 'apple-pay');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.betaald, true);
  assert.equal(w.chat.deal.betaald, true);
  const nog = await w.d.dealBetaal(w.cid, KOPER, 'apple-pay');
  assert.equal(nog.status, 409);
  assert.equal(w.rail.gemaakt, 1);
  assert.equal(naarVerkoper(w).length, 1);
});
