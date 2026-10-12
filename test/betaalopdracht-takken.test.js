/* ============================================================================
   DE BETAALOPDRACHT (server/kern/betaalopdracht/index.js), DE RANDEN.

   test/betaalopdracht.test.js meet de hoofdlijn met een neprail. Hier wat
   daar niet langs komt: maak() met ontbrekende velden en de standaarden,
   de weigering van een leeg bedrag of een opdracht zonder boeking, dubbel
   registreren van een teruggang of afwikkeling, een soort zonder teruggang,
   de afwikkelhaak die gooit, een fout teruggeeft, ok:false zegt of ontbreekt,
   een geweigerde statusovergang en de klacht zonder logger (naar
   console.warn). De klok en de rail zijn nep; niets wacht echt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const maakBetaalopdrachten = require('../server/kern/betaalopdracht');

function opzet(extra) {
  const db = { data: {} };
  const klok = { t: 5000 };
  const klachten = [];
  const rail = { antwoord: () => ({ id: 'RAIL-1', status: 'paid' }) };
  const op = maakBetaalopdrachten(Object.assign({
    d: () => db.data, save: () => {}, crypto, nu: () => klok.t,
    log: { warn: (b, g) => klachten.push([b, g]) },
    railInzenden: async o => rail.antwoord(o)
  }, extra || {}));
  return { op, db, klok, klachten, rail };
}
const basis = { ledgerRef: 'BB-1', centen: 1250 };

test('maak vult de standaarden in en publiek toont ze', () => {
  const { op, db } = opzet();
  const o = op.maak(basis);
  assert.match(o.id, /^BO[0-9A-F]{12}$/);
  assert.deepEqual([o.soort, o.rail, o.valuta, o.bron, o.bestemming, o.begunstigde, o.oms],
    ['uitbetaling', 'betaalnaad', 'eur', null, null, '', '']);
  assert.equal(o.idemSleutel, 'opdracht:BB-1');
  assert.equal(o.tariefCenten, 0);
  assert.equal(o.afwikkelingNodig, false);
  assert.equal(o.volgendeAt, 5000);
  const p = op.publiek(o);
  assert.deepEqual([p.economicIntentId, p.settlementId, p.claimId, p.settlementRef, p.laatsteFout, p.klaarAt, p.verschil],
    [null, null, null, null, null, null, null]);
  assert.equal(p.misschienVerstuurd, false);
  assert.equal(p.idemSleutel, undefined, 'de sleutel hoort niet in het publieke beeld');
  assert.equal(db.data.betaalOpdrachten.length, 1);
});

test('maak met alle velden, een negatief tarief wordt nul en de oms wordt ingekort', () => {
  const { op } = opzet();
  const o = op.maak({ soort: 'sepa-uit', rail: 'sepa', centen: '99.6', valuta: 'usd', bron: 'NL01', bestemming: 'NL02',
    begunstigde: 'Kikunoi', oms: 'x'.repeat(300), ledgerRef: 'BB-2', tariefCenten: -50, tariefRef: 'T1',
    idemSleutel: 'eigen', economicIntentId: 'EI', settlementId: 'S', claimId: 'C' });
  assert.equal(o.centen, 100);
  assert.equal(o.oms.length, 200);
  assert.equal(o.tariefCenten, 0);
  assert.equal(o.idemSleutel, 'eigen');
  assert.deepEqual([op.publiek(o).economicIntentId, op.publiek(o).claimId], ['EI', 'C']);
  const t = op.maak({ ledgerRef: 'BB-3', centen: 10, tariefCenten: '12.4' });
  assert.equal(t.tariefCenten, 12);
});

test('maak weigert een bedrag van nul, onzin of zonder boeking', () => {
  const { op, db } = opzet();
  assert.throws(() => op.maak({ ledgerRef: 'BB', centen: 0 }), /positief bedrag/);
  assert.throws(() => op.maak({ ledgerRef: 'BB', centen: 'abc' }), /positief bedrag/);
  assert.throws(() => op.maak({ centen: 10 }), /ledgerRef ontbreekt/);
  assert.equal(db.data.betaalOpdrachten, undefined, 'er is niets vastgelegd');
});

test('dezelfde idem-sleutel geeft de bestaande opdracht terug, met een klacht', () => {
  const { op, klachten } = opzet();
  const a = op.maak(basis);
  const b = op.maak(Object.assign({}, basis, { centen: 9999 }));
  assert.equal(b.id, a.id);
  assert.equal(b.hergebruikt, true);
  assert.equal(b.centen, 1250);
  assert.equal(klachten.length, 1);
  assert.match(klachten[0][0], /twee keer aangeboden/);
});

test('een teruggang en een afwikkeling moeten functies zijn en een keer bestaan', () => {
  const { op } = opzet();
  assert.throws(() => op.registreerTeruggang('x', 'geen'), /is een functie/);
  op.registreerTeruggang('x', async () => ({ ok: true }));
  assert.throws(() => op.registreerTeruggang('x', async () => ({ ok: true })), /staat al een teruggang/);
  assert.throws(() => op.registreerAfwikkeling('x', null), /is een functie/);
  op.registreerAfwikkeling('x', async () => ({ ok: true }));
  assert.throws(() => op.registreerAfwikkeling('x', async () => ({ ok: true })), /staat al een afwikkeling/);
});

test('een soort zonder teruggang wordt niet gegokt: de opdracht blijft MISLUKT', async () => {
  const { op, rail, klachten } = opzet({ maxPogingen: 1 });
  rail.antwoord = () => { throw Object.assign(new Error('rail dicht'), { nietVerstuurd: true }); };
  const o = op.maak(Object.assign({ soort: 'onbekend-soort' }, basis));
  const r = await op.dienIn(o.id);
  assert.equal(r.status, 'MISLUKT');
  assert.match(o.terugboekFout, /geen teruggang geregistreerd/);
  assert.ok(klachten.some(k => /TERUGBOEKING MISLUKT/.test(k[0])));
  assert.equal(op.openstaand().zonderTerugboeking, 1);
});

test('een definitieve rail met een afwikkelhaak die slaagt, sluit de opdracht helemaal', async () => {
  const { op, klok } = opzet();
  const gezien = [];
  op.registreerAfwikkeling('payout', async o => { gezien.push(o.id); return { ok: true }; });
  const o = op.maak(Object.assign({ soort: 'payout' }, basis));
  assert.equal(o.afwikkelingNodig, true);
  klok.t = 6000;
  const r = await op.dienIn(o);
  assert.equal(r.status, 'AFGEWIKKELD');
  assert.equal(r.afwikkelingVerwerktAt, 6000);
  assert.equal(r.klaarAt, 6000);
  assert.deepEqual(gezien, [o.id]);
  assert.equal(op.openstaand().zonderAfwikkeling, 0);
});

test('een afwikkelhaak die gooit, faalt, ok:false zegt of ontbreekt: zichtbaar onafgewerkt', async () => {
  const gevallen = [
    ['gooit', async () => { throw new Error('claim-db weg'); }, /claim-db weg/],
    ['fout', async () => ({ error: 'ledger weigert' }), /ledger weigert/],
    ['nee', async () => ({ ok: false }), /afwikkelhaak ontbreekt/],
    ['leeg', async () => null, /afwikkelhaak ontbreekt/]
  ];
  for (const [soort, haak, fout] of gevallen) {
    const { op, klachten } = opzet();
    op.registreerAfwikkeling(soort, haak);
    const o = op.maak(Object.assign({ soort }, basis));
    const r = await op.dienIn(o);
    assert.equal(r.status, 'AFGEWIKKELD', soort);
    assert.match(r.afwikkelFout, fout, soort);
    assert.equal(r.afwikkelingVerwerktAt, null);
    assert.ok(klachten.some(k => /interne finalisatie niet/.test(k[0])), soort);
    assert.equal(op.openstaand().zonderAfwikkeling, 1, soort);
  }
});

test('de ronde herstelt een afwikkeling die eerder niet lukte', async () => {
  const { op } = opzet();
  let lukt = false;
  op.registreerAfwikkeling('payout', async () => (lukt ? { ok: true } : { error: 'nog niet' }));
  const o = op.maak(Object.assign({ soort: 'payout' }, basis));
  await op.dienIn(o);
  assert.equal(o.afwikkelFout, 'nog niet');
  lukt = true;
  await op.ronde();
  assert.equal(o.afwikkelFout, null);
  assert.equal(typeof o.afwikkelingVerwerktAt, 'number');
});

test('bevestig met een webhook na de inzending: de haak draait, en faalt hij dan gooit bevestig', async () => {
  const { op, rail } = opzet();
  rail.antwoord = () => ({ id: 'RAIL-9', status: 'ingepland' });
  op.registreerAfwikkeling('payout', async () => ({ error: 'stuk' }));
  const o = op.maak(Object.assign({ soort: 'payout' }, basis));
  assert.equal((await op.dienIn(o)).status, 'INGEDIEND');
  await assert.rejects(op.bevestig({ settlementRef: 'RAIL-9' }), e => e.code === 'PAYOUT_AFHANDELING_MISLUKT');
  assert.equal(o.status, 'AFGEWIKKELD');
});

test('een geweigerde statusovergang verandert niets en wordt geklaagd', async () => {
  const { op, klachten } = opzet();
  op.registreerTeruggang('uitbetaling', async () => ({ ok: true, boeking: { id: 'T' } }));
  const o = op.maak(basis);
  await op.dienIn(o);
  assert.equal(o.status, 'AFGEWIKKELD');
  const r = await op.bevestig({ id: o.id, gelukt: false, reden: 'te laat' });
  assert.equal(r.status, 'AFGEWIKKELD', 'een afgewikkelde opdracht wordt niet alsnog mislukt');
  assert.ok(klachten.some(k => k[0] === 'geweigerde statusovergang' && k[1].naar === 'MISLUKT'));
});

test('zonder logger gaat een klacht naar console.warn; standaard backoff en pogingen', () => {
  const oud = console.warn;
  const gezien = [];
  console.warn = (...a) => gezien.push(a);
  try {
    const db = { data: {} };
    const op = maakBetaalopdrachten({ d: () => db.data, save: () => {}, crypto, nu: () => 1,
      railInzenden: async () => ({}), maxPogingen: 'veel', backoffMs: [] });
    op.maak(basis);
    op.maak(basis);
    assert.equal(gezien.length, 1);
    assert.match(gezien[0][0], /^\[betaalopdracht\] dezelfde economische handeling/);
    const met = maakBetaalopdrachten({ d: () => db.data, save: () => {}, crypto, nu: () => 1, log: {},
      railInzenden: async () => ({}) });
    met.maak(basis);
    assert.equal(gezien.length, 2, 'een logger zonder warn valt ook terug op console');
  } finally { console.warn = oud; }
});

test('de standaard backoff wacht dertig seconden na de eerste mislukte poging', async () => {
  const { op, rail, klok } = opzet({ backoffMs: undefined });
  rail.antwoord = () => { throw Object.assign(new Error('weg'), { nietVerstuurd: true }); };
  const o = op.maak(basis);
  await op.dienIn(o);
  assert.equal(o.status, 'GEBOEKT');
  assert.equal(o.volgendeAt, klok.t + 30000);
  assert.equal(o.misschienVerstuurd, undefined);
});

test('zonder opties bestaat de module wel, en STATUS staat ook op de export', () => {
  const op = maakBetaalopdrachten();
  assert.equal(op.STATUS.ONBEKEND, 'ONBEKEND');
  assert.equal(maakBetaalopdrachten.STATUS, op.STATUS);
});

test('opgeven met een geregistreerde teruggang boekt terug; een tweede bevestiging verandert niets', async () => {
  const { op, rail } = opzet({ maxPogingen: 1 });
  const terug = [];
  op.registreerTeruggang('sepa-uit', async o => { terug.push(o.id); return { ok: true, boeking: { id: 'TB-1' } }; });
  rail.antwoord = () => { throw Object.assign(new Error('rail dicht'), { nietVerstuurd: true }); };
  const o = op.maak(Object.assign({ soort: 'sepa-uit' }, basis));
  const r = await op.dienIn(o);
  assert.equal(r.status, 'TERUGGEBOEKT');
  assert.equal(o.terugboekRef, 'TB-1');
  assert.deepEqual(terug, [o.id]);
  const nog = await op.bevestig({ id: o.id, gelukt: false });
  assert.equal(nog.status, 'TERUGGEBOEKT');
  assert.equal(terug.length, 1, 'niet twee keer teruggeboekt');
  const b = op.maak({ ledgerRef: 'BB-9', centen: 5, soort: 'sepa-uit' });
  rail.antwoord = () => ({ id: 'R', status: 'ingepland' });
  await op.dienIn(b);
  assert.equal((await op.bevestig({ id: b.id })).status, 'AFGEWIKKELD');
  assert.equal((await op.bevestig({ id: b.id, settlementRef: 'R' })).status, 'AFGEWIKKELD', 'een herhaalde webhook is geen fout');
});
