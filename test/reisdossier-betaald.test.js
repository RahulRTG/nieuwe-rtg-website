/* K1 uit docs/domeinkaarten/travelos.md: een bevestigde reis heet in het
   reisdossier "bevestigd, nog niet betaald", en pas een geslaagde betaling
   (reisbureau.markeerBetaald) maakt er "betaald" van. Bevestigen zette de
   regel op 'paid', zodat een reis zonder betaling in de reistab als betaald
   stond. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakReisdossier } = require('../server/kern/lid/reisdossier');
const { maakReisbureau } = require('../server/kern/reisbureau');

function kluis() {
  const staat = {};
  return { staat, getMemberState: (id) => JSON.parse(JSON.stringify(staat[id] || {})), saveMemberState: (id, md) => { staat[id] = JSON.parse(JSON.stringify(md)); } };
}

test('bevestigen is nog niet betaald; betaald is een eigen stap', () => {
  const acc = kluis();
  const d = maakReisdossier({ accounts: acc }).reisdossier;
  d.zetAanvraag('user-7', { ref: 'RTG-R-1', bestemming: 'Lissabon', vertrek: '2026-12-01', personen: 2 });
  const na = d.bevestig('user-7', 'RTG-R-1').items[0];
  assert.notEqual(na.status, 'paid', 'bevestigd is niet betaald');
  assert.equal(na.status, 'open');
  assert.equal(na.label, 'Bevestigd, nog niet betaald');
  const betaald = d.betaald('user-7', 'RTG-R-1').items[0];
  assert.equal(betaald.status, 'paid');
  assert.equal(betaald.label, 'Betaald');
});

test('markeerBetaald zet het dossier van het lid op betaald, en alleen dat', () => {
  const acc = kluis();
  const db = { data: { reisAanvragen: [{ ref: 'RTG-R-2', status: 'bevestigd', customerKey: 'user-8' }] } };
  const rb = maakReisbureau({ db, save: () => {}, crypto, accounts: acc }).reisbureau;
  const d = maakReisdossier({ accounts: acc }).reisdossier;
  d.zetAanvraag('user-8', { ref: 'RTG-R-2', bestemming: 'Porto', vertrek: '2026-12-02', personen: 1 });
  d.bevestig('user-8', 'RTG-R-2');
  assert.equal(acc.staat[8].trip.items[0].status, 'open');
  assert.equal(rb.markeerBetaald('RTG-R-2', { at: 'nu', boeking: 'B1', centen: 1000 }).ok, true);
  assert.equal(acc.staat[8].trip.items[0].status, 'paid', 'na een geslaagde betaling heet de reis betaald');
});
