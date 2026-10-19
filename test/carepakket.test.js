/* Een herstelpakket is pas betaald als beide zaken betaald zijn
   (server/kern/care/pakketbetaal.js).

   /api/care/pakket/betaal zette pakket en behandeling op paid zonder dat er
   geld bewoog. Besluit van de eigenaar (19 oktober 2026, optie c): de
   pakketprijs wordt naar verhouding van de losse prijzen over de zorgaanbieder
   en het hotel verdeeld, beide leveren evenredig in, RTG legt niets bij; de
   afronding valt bij het hotel. Twee boekingen via RTG Pay, elk met een eigen
   sleutel; het pakket is pas betaald als beide gelukt zijn. Hier met een
   betaalnaad die de proef zelf bestuurt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const maakCare = require('../server/kern/care');

function wereld(antwoord) {
  const db = { data: { suppliers: [{ code: 'HOSHI', rooms: [{ price: 300 }, { price: 420 }] }] } };
  const naad = { aanroepen: [], betaald: new Map(), antwoord };
  const betaalZaak = async (o) => {
    naad.aanroepen.push(o);
    if (o.idem && naad.betaald.has(o.idem)) return Object.assign({}, naad.betaald.get(o.idem), { herhaald: true });
    const r = await naad.antwoord(o);
    if (r.ok && o.idem) naad.betaald.set(o.idem, r);
    return r;
  };
  const care = maakCare({ db, save: () => {}, crypto, schoon: (v, n) => String(v == null ? '' : v).slice(0, n || 200),
    notify: () => {}, zorgVoor: () => null, zorgMee: () => null, metingVanBehandelaar: () => null, betaalZaak });
  const sess = { key: 'user-1', tier: 'rtg' };
  const datum = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const boek = () => care.carePakketBoek(sess, 'Codenaam', { pakketId: 'herstel', datum, tijd: '11:00' }).pakket;
  return { care, sess, boek, naad, db };
}
const ok = async (o) => ({ ok: true, betaaldCenten: o.centen, boeking: 'PB-' + o.idem });
const opgeslagen = (w, ref) => w.db.data.carePakketBoekingen.find((x) => x.ref === ref);

test('de verdeling telt exact op tot de pakketprijs, naar verhouding van de losse prijzen, met de afronding bij het hotel', async () => {
  const w = wereld(ok);
  const pb = w.boek();
  const r = await w.care.carePakketBetaal(w.sess, pb.ref);
  assert.equal(r.ok, true, JSON.stringify(r));
  const v = opgeslagen(w, pb.ref).verdeling;
  /* herstel: hot stone 135 euro, 2 nachten van de goedkoopste kamer (300) = 600 euro; pakket 995 */
  assert.equal(v.losseZorgCenten, 13500);
  assert.equal(v.losseHotelCenten, 60000);
  assert.equal(v.zorgCenten + v.hotelCenten, 99500, 'exact de pakketprijs');
  assert.equal(v.zorgCenten, Math.floor(99500 * 13500 / 73500), 'naar verhouding, naar beneden afgerond');
  assert.equal(v.afronding, 'hotel');
  assert.match(v.besluit, /19 oktober 2026/);
  const zorg = w.naad.aanroepen.find((a) => a.idem === 'carepakket:' + pb.ref + ':zorg');
  const hotel = w.naad.aanroepen.find((a) => a.idem === 'carepakket:' + pb.ref + ':hotel');
  assert.equal(zorg.supplierCode, 'ZENITH');
  assert.equal(zorg.centen, v.zorgCenten);
  assert.equal(hotel.supplierCode, 'HOSHI');
  assert.equal(hotel.centen, v.hotelCenten);
});

test('beide boekingen precies een keer, ook bij twee tikken tegelijk en nog een tik daarna', async () => {
  const w = wereld(async (o) => { await new Promise((r) => setTimeout(r, 15)); return ok(o); });
  const pb = w.boek();
  const [x, y] = await Promise.all([w.care.carePakketBetaal(w.sess, pb.ref), w.care.carePakketBetaal(w.sess, pb.ref)]);
  const nog = await w.care.carePakketBetaal(w.sess, pb.ref);
  assert.ok(x.ok && y.ok, JSON.stringify([x, y]));
  assert.equal(nog.status, 409);
  assert.equal(w.naad.betaald.size, 2, 'twee betalingen: zorg en hotel');
  const p = opgeslagen(w, pb.ref);
  assert.equal(p.paid, true);
  assert.equal(p.status, 'geboekt');
  const bk = w.care.careMijn('user-1').boekingen.find((b) => b.ref === p.careRef);
  assert.equal(bk.paid, true, 'de behandeling van het pakket staat betaald');
});

test('een weigering bij de tweede boeking laat het pakket onbetaald, eerlijk deels betaald', async () => {
  const w = wereld(async (o) => (o.supplierCode === 'HOSHI'
    ? { status: 402, error: 'De betaling is niet gelukt. Er is niets afgeschreven en niets bijgeschreven.' } : ok(o)));
  const pb = w.boek();
  const r = await w.care.carePakketBetaal(w.sess, pb.ref);
  assert.equal(r.status, 402);
  assert.match(r.error, /deels betaald/);
  const p = opgeslagen(w, pb.ref);
  assert.equal(p.paid, false);
  assert.equal(p.status, 'deels-betaald');
  assert.equal(w.care.careMijn('user-1').boekingen.find((b) => b.ref === p.careRef).paid, false);
});

test('na de eerste boeking een crash, daarna een herhaling die afrondt zonder dubbele betaling', async () => {
  let hotelOk = false;
  const w = wereld(async (o) => (o.supplierCode === 'HOSHI' && !hotelOk ? { status: 502, error: 'De betaling gaf geen uitsluitsel.' } : ok(o)));
  const pb = w.boek();
  await w.care.carePakketBetaal(w.sess, pb.ref);
  hotelOk = true;
  /* de "crash": alles wat in het geheugen liep is weg, de opgeslagen boeking blijft */
  const p0 = opgeslagen(w, pb.ref);
  delete p0.betalingen;
  const r = await w.care.carePakketBetaal(w.sess, pb.ref);
  assert.equal(r.ok, true, JSON.stringify(r));
  const zorgen = w.naad.aanroepen.filter((a) => a.idem === 'carepakket:' + pb.ref + ':zorg');
  assert.ok(zorgen.length >= 1);
  assert.equal([...w.naad.betaald.keys()].filter((k) => k.endsWith(':zorg')).length, 1, 'de zorg is een keer betaald');
  assert.equal(w.naad.betaald.size, 2);
  assert.equal(opgeslagen(w, pb.ref).paid, true);
});

test('een ander lid kan het pakket niet betalen of zien', async () => {
  const w = wereld(ok);
  const pb = w.boek();
  const r = await w.care.carePakketBetaal({ key: 'user-2', tier: 'rtg' }, pb.ref);
  assert.equal(r.status, 404);
  assert.equal(w.naad.aanroepen.length, 0, 'er bewoog niets');
  assert.equal(w.care.carePakketMijn('user-2').pakketten.length, 0);
});
