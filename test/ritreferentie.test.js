'use strict';
const metDekking = require('./lib/dekking');
const test = require('node:test'), assert = require('node:assert/strict');
const fixture = require('./lib/audit-rijen-fixture');
const schoon = (v, n) => String(v ?? '').slice(0, n);
const A = { tier: 'rtg', key: 'actor-a', codename: 'Anna' };
const B = { tier: 'rtg', key: 'actor-b', codename: 'Bram' };

// Alleen de randombron en externe effecten zijn testdoubles. Ritbetekenis,
// idem, geldboeking, duurzame bundel en SQLite-opslag zijn de echte modules.
function proef(t, reeks) {
  const p = fixture(t, { rides: [], live: {}, paySaldi: { 'lid:Anna': 100000, 'lid:Bram': 100000,
    'extern:start': -200000 }, payBoekingen: [], facturen: [] });
  const { db, save, bijeen } = p;
  let teller = 0, willekeur = 0;
  const saldi = () => db.data.paySaldi;
  const saldoVan = r => saldi()[r] || 0;
  const grootboek = () => db.data.payBoekingen;
  const { boekAsync } = require('../server/kern/pay/boeking')({ saldi, saldoVan, grootboek,
    payBoekingenVoegToe: b => grootboek().push(b), save, id: () => 'PB' + (++teller), schoon,
    nu: () => Date.now(), waardePoort: () => null, betalingenUit: false,
    geldModus: 'schaduw', schaduw: { spiegel() {} }, MIN_CENTEN: 1, MAX_CENTEN: 500000 });
  const pay = require('../server/kern/pay/zaakbetaling')(metDekking({ schoon,
    rekLid: c => 'lid:' + c, rekPartner: c => 'partner:' + c, saldoVan, boekAsync,
    metIdem: require('../server/lib/idem')({ d: () => db.data, save, bijeen, naam: 'payIdem', duurzaam: true }),
    zorgSaldo: async () => ({ ok: true }), seintje() {}, MIN_CENTEN: 1, MAX_CENTEN: 500000 }));
  const zaak = { code: 'TAXI', name: 'Testvervoerder', type: 'taxi', settings: {} };
  const ctx = { db, save, pay, crypto: { randomBytes: n => Buffer.alloc(n, reeks[Math.min(willekeur++, reeks.length - 1)]) },
    schoon, findSupplier: code => code === zaak.code ? zaak : null, optieAan: () => true,
    leeftijdVan: () => 35, geborenVan: () => '1991-01-01', liveCodename: s => s.codename,
    haversine: () => null, zorgMee: () => null, fooiUit: () => 0, pasTegoedToe: () => 0,
    ledenvoordeelVoor: () => 0, herstelTegoed() {}, verdienPunten() {}, pushLive() {},
    notifySupplier() {}, sseToSupplier() {}, sseToOffice() {},
    factuurVoorLid: f => { db.data.facturen.push(f); save(); } };
  db.capsVan = () => ['rides'];
  const ritten = require('../server/kern/lidacties/ritten')(ctx);
  const aanvraag = actor => ritten.vraagRitVoor(actor, { supplierCode: zaak.code, passengers: 2 });
  const betaal = (actor, rit) => ritten.betaalRitVoor(actor, { ref: rit.ref });
  return { ...p, ctx, aanvraag, betaal, willekeur: () => willekeur };
}

test('botsende randomuitgifte: twee verse ritten blijven twee betaalbare objecten', async t => {
  const p = proef(t, [1, 1, 2]);
  const eerste = p.aanvraag(A).ride;
  assert.equal((await p.betaal(A, eerste)).ok, true);
  const tweede = p.aanvraag(A).ride;
  const betaling = await p.betaal(A, tweede);
  assert.equal(betaling.ok, true, JSON.stringify(betaling));
  assert.notEqual(tweede.ref, eerste.ref, 'één ref mag geen twee objecten aanwijzen');
  assert.match(tweede.ref, /^RTG-R-[0-9A-F]{32}$/);
  assert.equal(p.lees('rides').filter(r => r.paid).length, 2);
  const boekingen = p.lees('payBoekingen');
  assert.equal(boekingen.length, 2);
  assert.deepEqual(new Set(boekingen.map(b => b.ref)), new Set([eerste.ref, tweede.ref]));
  assert.equal(p.lees('paySaldi')['lid:Anna'], 100000 - 2 * eerste.quote * 100);
  assert.equal(p.lees('paySaldi')['partner:TAXI'], 2 * eerste.quote * 100);
  assert.equal(Object.values(p.lees('paySaldi')).reduce((a, b) => a + b, 0), 0);
  assert.equal(p.lees('facturen').length, 2);
});

test('gelijktijdige betaling en latere retry hebben samen één financieel effect', async t => {
  const p = proef(t, [3]), rit = p.aanvraag(A).ride;
  const uit = await Promise.all([p.betaal(A, rit), p.betaal(A, rit)]);
  assert.equal(uit.filter(r => r.ok).length, 1);
  assert.equal(uit.filter(r => r.status === 409).length, 1);
  const herhaling = await p.betaal(A, rit);
  assert.equal(herhaling.status, 409);
  assert.equal(p.lees('payBoekingen').length, 1);
  assert.equal(p.lees('facturen').length, 1);
  assert.equal(p.lees('rides')[0].paid, true);
  assert.equal(p.lees('paySaldi')['lid:Anna'], 100000 - rit.quote * 100);
});

test('andere actor kan een bekende ritref niet betalen; eigen botsende aanvraag blijft onafhankelijk', async t => {
  const p = proef(t, [4, 4, 5]), a = p.aanvraag(A).ride;
  assert.equal((await p.betaal(B, a)).status, 404);
  assert.equal(p.lees('payBoekingen').length, 0);
  const b = p.aanvraag(B).ride;
  assert.notEqual(a.ref, b.ref);
  assert.equal((await p.betaal(A, a)).ok, true);
  assert.equal((await p.betaal(B, b)).ok, true);
  assert.equal(p.lees('payBoekingen').length, 2);
  for (const actor of ['Anna', 'Bram'])
    assert.equal(p.lees('paySaldi')['lid:' + actor], 100000 - a.quote * 100);
});

test('herhaald botsende randombron weigert begrensd zonder tweede rit of boeking', t => {
  const p = proef(t, [6]), eerste = p.aanvraag(A).ride;
  const voor = p.persistentieStand(), geweigerd = p.aanvraag(A);
  assert.equal(geweigerd.status, 503);
  assert.equal(geweigerd.ride, undefined);
  assert.equal(p.willekeur(), 9, 'één succesvolle en maximaal acht botsende pogingen');
  assert.equal(p.persistentieStand(), voor);
  assert.deepEqual(p.lees('rides').map(r => r.ref), [eerste.ref]);
  assert.equal(p.lees('payBoekingen').length, 0);
});

test('bestaande korte referenties houden hun betaal- en retrybetekenis', async t => {
  const p = proef(t, [7]), rit = p.aanvraag(A).ride;
  rit.ref = 'RTG-R-ABC123'; p.save();
  assert.equal((await p.betaal(A, rit)).ok, true);
  assert.equal((await p.betaal(A, rit)).status, 409);
  assert.equal(p.lees('rides')[0].ref, 'RTG-R-ABC123');
  assert.equal(p.lees('payBoekingen')[0].ref, 'RTG-R-ABC123');
  assert.equal(p.lees('payBoekingen').length, 1);
});

test('tickettransfer deelt dezelfde referentiepoort en eigenaarsgrens als ritten', async t => {
  const p = proef(t, [8, 8, 9]), rit = p.aanvraag(A).ride;
  const routes = new Map(), zaak = p.ctx.findSupplier('TAXI');
  zaak.transfer = { aan: true, prijs: 23 };
  const ticket = { ref: 'TICKET-A', kind: 'ticket', customerKey: A.key, paid: true,
    supplierCode: zaak.code, datum: '2100-01-01', tijd: '12:00', personen: 2,
    service: { name: 'Bezoek' } };
  require('../server/routes/member/kopen/tickets')({ ...p.ctx,
    app: { post: (pad, ...handlers) => routes.set(pad, handlers.at(-1)) },
    auth() {}, boekingMetRef: ref => ref === ticket.ref ? ticket : null });
  const aanvraag = actor => {
    let resultaat, status = 200;
    const res = { status(v) { status = v; return this; }, json(v) { resultaat = v; } };
    routes.get('/api/transfer/aanvraag')({ session: actor, body: { ticketRef: ticket.ref } }, res);
    return { status, body: resultaat };
  };
  assert.equal(aanvraag(B).status, 404);
  assert.equal(p.lees('rides').length, 1);
  const transfer = aanvraag(A);
  assert.equal(transfer.status, 200);
  assert.notEqual(transfer.body.ride.ref, rit.ref);
  assert.equal((await p.betaal(A, rit)).ok, true);
  assert.equal((await p.betaal(A, transfer.body.ride)).ok, true);
  assert.equal(p.lees('payBoekingen').length, 2);
  assert.equal(p.lees('rides').filter(r => r.paid).length, 2);
  assert.equal(aanvraag(A).status, 409, 'één ticket krijgt geen tweede actieve transfer');
});
