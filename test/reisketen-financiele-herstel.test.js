/* Negatieve kernproeven met gesimuleerde Pay-uitval en seriële testopslag.
   Echte HTTP-/SQLite-dekking staat in reisketen-financiele-grenzen.test.js.
   Een ingetrokken Pay-poort blokkeert nieuw geld, niet het lezen van een
   oorspronkelijk, exact passend ontvangstbewijs. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakReisbureau } = require('../server/kern/reisbureau');
const { maakReisbetaling } = require('../server/kern/reisbureau-betaling');
const { offerte } = require('../server/kern/reisbureau-ketencontract');
const kopie = value => structuredClone(value);
const nu = () => '2026-11-11T10:00:00.000Z';
const dicht = () => ({ ok: false, status: 403, kyc: true, error: 'Gesimuleerde bestaande paspoortpoort gesloten.' });
const mag = () => ({ ok: true });

function betaalbron() {
  const boekingen = new Map(), pogingen = [], lezingen = [];
  const opties = { fout: null, onzeker: false };
  const pay = {
    // De bestaande vrijgavepoort retourneert null bij een open capability.
    vrijgavePoort: { intern: () => null },
    rekLid: code => 'lid:' + code, rekPartner: code => 'partner:' + code,
    boekAsync: async b => {
      pogingen.push(kopie(b));
      if (opties.fout === 'voor') throw new Error('Gesimuleerde uitval vóór ledgercommit');
      const eerder = boekingen.get(b.economischeSleutel);
      const boeking = eerder || { ...b, id: 'PB-TEST-' + (boekingen.size + 1), at: nu() };
      if (!eerder) boekingen.set(b.economischeSleutel, boeking);
      if (opties.fout === 'na') throw new Error('Gesimuleerde antwoorduitval ná ledgercommit');
      return { ok: true, boeking: kopie(boeking), herhaald: !!eerder };
    },
    boekBekend: async b => {
      lezingen.push(kopie(b));
      if (opties.onzeker) return { status: 503, error: 'Gesimuleerde onbereikbare ontvangstbron.' };
      const boeking = boekingen.get(b.economischeSleutel);
      if (!boeking) return { status: 404, onbekend: true, code: 'PAY_BOEKING_ONBEKEND' };
      if (!['van', 'naar', 'centen', 'ref', 'soort'].every(k => boeking[k] === b[k]))
        return { status: 503, error: 'Gesimuleerde afwijkende ontvangstidentiteit.' };
      return { ok: true, boeking: kopie(boeking), herhaald: true };
    }
  };
  return { pay, boekingen, pogingen, lezingen, opties };
}

async function klassiek() {
  const bank = betaalbron();
  const db = { writable: true, data: { reisAanvragen: [], partnerTrips: [{ id: 'grens-reis',
    title: 'Grensproef', dest: 'Proefbestemming', netto: 100, samenstelling: [
      { soort: 'dienst', herkomst: 'rtg', eigenaar: 'rtg', ppCenten: 10000, wat: 'Proefdienst' }
    ] }] } };
  const save = () => {};
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save });
  let betaling;
  const rb = maakReisbureau({ db, save, crypto, bewerkCollectie,
    reisbetalingVan: () => betaling }).reisbureau;
  betaling = maakReisbetaling({ db, save, crypto, bewerkCollectie,
    payVan: () => bank.pay, reisbureauVan: () => rb }).reisbetaling;
  const sess = { key: 'user-19' };
  const aanvraag = await rb.boek(sess, 'Grensreiziger', { tripId: 'grens-reis', personen: 1 });
  assert.equal(aanvraag.ok, true);
  const ref = aanvraag.aanvraag.ref;
  assert.equal((await rb.besluit(ref, 'bevestigd', 'Adviseur', 'Uitsluitend lokale testbevestiging')).ok, true);
  return { ...bank, betaal: poort => betaling.betaal(sess, 'Grensreiziger', ref, poort),
    rij: () => kopie(rb.aanvraagVan(ref)), betaald: () => !!rb.aanvraagVan(ref).betaald,
    claim: () => rb.aanvraagVan(ref).inning || null };
}

async function federatief() {
  const bank = betaalbron(), actor = { actorRef: 'user-19' };
  const provider = { supplierCode: 'HOTEL', org: 'ORG-HOTEL', naam: 'Proefhotel' };
  const verkoper = { org: 'ORG-BUREAU', supplierCode: 'BUREAU', naam: 'Proefbureau' };
  const o = offerte({ valuta: 'EUR', geldigTot: '2026-11-12T10:00:00.000Z', voorwaarden: 'Fictieve testafspraak.',
    rollen: { hoedanigheid: 'touroperator', contractpartij: 'Proefbureau', factureert: 'Proefbureau', aansprakelijk: 'Fictieve testverklaring.' },
    onderdelen: [{ id: 'verblijf', wat: 'Proefverblijf', soort: 'verblijf', productRef: 'TEST',
      supplierCode: 'HOTEL', centen: 10000, verschuldigdCenten: 8000 }] }, verkoper, 0, () => provider, nu());
  assert.equal(o.ok, true);
  let a = { ref: 'RTG-R-HERSTEL', customerKey: actor.actorRef, titel: 'Grensproef', status: 'bevestigd',
    keten: { versie: 1, verkoper, offerte: o.offerte, akkoord: { offerteHash: o.offerte.hash },
      leveringen: [], gebeurtenissen: [], betaling: null } };
  const O = { schrijf: async werk => { const lijst = [kopie(a)], r = werk(lijst); a = lijst[0]; return kopie(r); },
    gebeurtenis: (reis, soort, actorRef) => { reis.keten.versie++; reis.keten.gebeurtenissen.push({ soort, actorRef, at: nu() }); } };
  const kern = require('../server/kern/reisbureau-ketenbetaling')({ O, payVan: () => bank.pay,
    toegang: { ontvanger: () => verkoper, leverancier: () => provider }, nu });
  return { ...bank, betaal: poort => kern.betaal(actor, 'Grensreiziger',
    { ref: a.ref, versie: a.keten.versie, idem: 'financiele-herstel-proef' }, poort),
    rij: () => kopie(a), betaald: () => a.keten.betaling && a.keten.betaling.status === 'betaald',
    claim: () => a.keten.betaling };
}

for (const [naam, maak] of [['klassiek', klassiek], ['federatief', federatief]]) {
  test(naam + ': gesloten of ontbrekende Pay-poort creëert geen eerste claim of geldbeweging', async () => {
    for (const poort of [dicht, undefined]) {
      const x = await maak(), voor = x.rij();
      const r = await x.betaal(poort);
      assert.equal(r.status, poort ? 403 : 503, JSON.stringify(r));
      assert.equal(x.pogingen.length, 0);
      assert.equal(x.lezingen.length, 0);
      assert.equal(x.claim(), null);
      assert.deepEqual(x.rij(), voor);
    }
  });

  test(naam + ': gesloten of ontbrekende huisvrijgave blokkeert nieuwe inning ondanks geldige persoonlijke toegang', async () => {
    for (const poort of [() => ({ status: 503, error: 'Gesimuleerde bestaande vrijgave gesloten.',
      code: 'VRIJGAVE_DICHT', capability: 'geld.intern_saldo' }), undefined]) {
      const x = await maak(), voor = x.rij();
      if (poort) x.pay.vrijgavePoort.intern = poort;
      else delete x.pay.vrijgavePoort;
      const r = await x.betaal(mag);
      assert.equal(r.status, 503, JSON.stringify(r));
      assert.equal(x.pogingen.length, 0);
      assert.equal(x.claim(), null);
      assert.deepEqual(x.rij(), voor);
    }
  });

  test(naam + ': bestaande claim zonder ledgerbewijs vraagt actuele Pay-poort vóór een nieuwe inning', async () => {
    const x = await maak(); x.opties.fout = 'voor';
    await x.betaal(mag).catch(() => null);
    assert.ok(x.claim()); assert.equal(x.boekingen.size, 0);
    x.opties.fout = null;
    let controles = 0;
    const r = await x.betaal(() => { controles++; return dicht(); });
    assert.equal(r.status, 403, JSON.stringify(r));
    assert.equal(controles, 1);
    assert.equal(x.lezingen.length, 1, 'eerst de oorspronkelijke economische sleutel lezen');
    assert.equal(x.pogingen.length, 1, 'geen tweede boekopdracht zonder actuele bevoegdheid');
    assert.equal(x.boekingen.size, 0);
  });

  test(naam + ': read-only herstel na ledgercommit blijft mogelijk zonder nieuwe financiële bevoegdheid', async () => {
    const x = await maak(); x.opties.fout = 'na';
    await x.betaal(mag).catch(() => null);
    assert.equal(x.boekingen.size, 1); assert.ok(x.claim());
    x.opties.fout = null;
    x.pay.vrijgavePoort.intern = () => { assert.fail('een bestaande ontvangst lezen vraagt geen nieuwe huisvrijgave'); };
    const r = await x.betaal(() => { assert.fail('een bestaande ontvangst lezen vraagt geen bevoegdheid voor nieuw geld'); });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(x.betaald(), true);
    assert.equal(x.pogingen.length, 1);
    assert.equal(x.lezingen.length, 1);
    assert.equal(x.boekingen.size, 1);
  });

  test(naam + ': canoniek afwezige ontvangst omzeilt de inmiddels gesloten huisvrijgave niet', async () => {
    const x = await maak(); x.opties.fout = 'voor';
    await x.betaal(mag).catch(() => null);
    assert.ok(x.claim()); assert.equal(x.boekingen.size, 0);
    x.opties.fout = null;
    x.pay.vrijgavePoort.intern = () => ({ status: 503, error: 'Gesimuleerde vrijgave ingetrokken.',
      code: 'VRIJGAVE_DICHT', capability: 'geld.intern_saldo' });
    const r = await x.betaal(mag);
    assert.equal(r.status, 503, JSON.stringify(r));
    assert.equal(x.lezingen.length, 1);
    assert.equal(x.pogingen.length, 1, 'een bestaande claim verleent geen vrijgave voor een nog ontbrekende betaling');
    assert.equal(x.boekingen.size, 0);
  });

  test(naam + ': onbereikbare ontvangstbron wordt niet als afwezigheid behandeld', async () => {
    const x = await maak(); x.opties.fout = 'voor';
    await x.betaal(mag).catch(() => null);
    x.opties.fout = null; x.opties.onzeker = true;
    const r = await x.betaal(() => { assert.fail('onzekerheid mag geen nieuwe inning voorbereiden'); });
    assert.equal(r.status, 503, JSON.stringify(r));
    assert.equal(x.pogingen.length, 1);
    assert.equal(x.boekingen.size, 0);
    assert.ok(x.claim(), 'onzekere claim blijft voor herstel bewaard');
  });
}
