/* Een zorgboeking is pas betaald als er geld bewoog (server/kern/care/leden.js, careBetaal).

   Gevonden door FoundationOS bij link:foundationzorg: /api/care/betaal zette de
   boeking op paid=true en "geboekt" zonder dat er een cent bewoog -- geen RTG
   Pay, geen betaalnaad, geen betaalwaarheid -- terwijl het scherm "Betalen"
   zegt. Nu betaalt het lid de zorgaanbieder via RTG Pay (pay.betaalZaak, de
   vaste weg van het huis voor een lid dat een zaak betaalt); een tekort laadt
   de wallet bij via de betaalwaarheid, en dus via elke provider. De sleutel
   hangt aan de boeking: een herhaling voor dezelfde boeking is dezelfde
   betaling. Hier met een betaalnaad die de proef zelf bestuurt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const maakCare = require('../server/kern/care');

function wereld(antwoord) {
  const db = { data: {} };
  const naad = { aanroepen: [], betaald: new Map(), antwoord };
  const betaalZaak = async (o) => {
    naad.aanroepen.push(o);
    if (o.idem && naad.betaald.has(o.idem)) return Object.assign({}, naad.betaald.get(o.idem), { herhaald: true });
    const r = await naad.antwoord(o);
    if (r.ok && o.idem) naad.betaald.set(o.idem, r);
    return r;
  };
  const punten = [];
  const care = maakCare({ db, save: () => {}, crypto, schoon: (v, n) => String(v == null ? '' : v).slice(0, n || 200),
    notify: () => {}, zorgVoor: () => null, zorgMee: () => null, metingVanBehandelaar: () => null, betaalZaak });
  const sess = { key: 'user-1', tier: 'rtg' };
  const datum = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const boek = (tijd) => care.careBoek(sess, 'Codenaam', { aanbiederId: 'zenith', behandelingId: 'zt1', datum, tijd: tijd || '10:00' }).boeking;
  const verdien = (...a) => punten.push(a);
  return { care, sess, boek, naad, punten, verdien, db };
}
const ok = async (o) => ({ ok: true, betaaldCenten: o.centen, boeking: 'PB-' + o.ref });

test('zonder bevestigde betaling blijft de boeking onbetaald, met de zin van RTG Pay', async () => {
  const w = wereld(async () => ({ status: 402, error: 'De betaling wacht op bevestiging.' }));
  const bk = w.boek();
  const r = await w.care.careBetaal(w.sess, bk.ref, w.verdien);
  assert.equal(r.status, 402);
  assert.match(r.error, /wacht op bevestiging/);
  const nu = w.care.careMijn('user-1').boekingen.find((x) => x.ref === bk.ref);
  assert.equal(nu.paid, false, 'niet betaald');
  assert.equal(nu.status, 'wacht-op-betaling');
  assert.equal(w.punten.length, 0, 'geen punten voor een betaling die er niet is');
});

test('een geweigerde betaling laat de boeking eerlijk onbetaald', async () => {
  const w = wereld(async () => ({ status: 402, error: 'De betaling is niet gelukt. Er is niets afgeschreven en niets bijgeschreven.' }));
  const bk = w.boek();
  const r = await w.care.careBetaal(w.sess, bk.ref, w.verdien);
  assert.equal(r.status, 402);
  assert.match(r.error, /niet gelukt/);
  assert.equal(w.care.careMijn('user-1').boekingen.find((x) => x.ref === bk.ref).paid, false);
});

test('met een bevestigde betaling is de boeking precies een keer betaald, aan de zorgaanbieder', async () => {
  const w = wereld(ok);
  const bk = w.boek();
  const r = await w.care.careBetaal(w.sess, bk.ref, w.verdien);
  assert.equal(r.ok, true);
  assert.equal(r.boeking.paid, true);
  assert.equal(r.boeking.status, 'geboekt');
  assert.equal(w.naad.aanroepen.length, 1);
  const a = w.naad.aanroepen[0];
  assert.equal(a.supplierCode, 'ZENITH', 'het geld gaat naar de zaak van de aanbieder');
  assert.equal(a.centen, 9500, 'de prijs in centen');
  assert.equal(a.codenaam, 'Codenaam', 'van het lid, op codenaam');
  assert.equal(a.ref, bk.ref);
  assert.equal(w.punten.length, 1);
});

test('een herhaling betaalt niet dubbel: nog eens betalen zegt "al betaald", ook tegelijk', async () => {
  const w = wereld(async (o) => { await new Promise((r) => setTimeout(r, 20)); return ok(o); });
  const bk = w.boek();
  const [x, y] = await Promise.all([w.care.careBetaal(w.sess, bk.ref, w.verdien), w.care.careBetaal(w.sess, bk.ref, w.verdien)]);
  const nog = await w.care.careBetaal(w.sess, bk.ref, w.verdien);
  assert.ok(x.ok && y.ok, JSON.stringify([x, y]));
  assert.equal(nog.status, 409);
  assert.equal(new Set(w.naad.aanroepen.map((a) => a.idem)).size, 1, 'een sleutel per boeking');
  assert.equal(w.naad.betaald.size, 1, 'een betaling');
  assert.equal(w.punten.length, 1, 'een keer punten');
});

test('na een crash tussen betaling en vastlegging betaalt dezelfde boeking niet opnieuw', async () => {
  const w = wereld(ok);
  const bk = w.boek();
  await w.care.careBetaal(w.sess, bk.ref, w.verdien);
  /* de vastlegging van de boeking ging verloren, de betaling niet */
  const opgeslagen = w.db.data.careBoekingen.find((x) => x.ref === bk.ref);
  opgeslagen.paid = false; opgeslagen.status = 'wacht-op-betaling'; delete opgeslagen.paidAt;
  const r = await w.care.careBetaal(w.sess, bk.ref, w.verdien);
  assert.equal(r.ok, true);
  assert.equal(r.boeking.paid, true);
  assert.equal(w.naad.betaald.size, 1, 'RTG Pay herkende de herhaling: geen tweede betaling');
});
