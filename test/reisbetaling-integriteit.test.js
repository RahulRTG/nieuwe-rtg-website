'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { maakReisbureau } = require('../server/kern/reisbureau');
const { maakReisbetaling } = require('../server/kern/reisbureau-betaling');
const { startServer, stop, kantoorAlsPersoon, keurLidGoed } = require('./helper');

function opstelling(db, bank) {
  db = db || { writable: true, data: { reisAanvragen: [], partnerTrips: [{ id: 'reis-proef',
    title: 'Testreis', dest: 'Testbestemming', netto: 100, samenstelling: [
      { soort: 'verblijf', herkomst: 'partner', eigenaar: 'derde', ppCenten: 7000, wat: 'Hotel', leverancier: 'TEST-HOTEL' },
      { soort: 'vervoer', herkomst: 'partner', eigenaar: 'derde', ppCenten: 2000, wat: 'Transfer', leverancier: 'TEST-TRANSFER' },
      { soort: 'dienst', herkomst: 'rtg', eigenaar: 'rtg', ppCenten: 1000, wat: 'Begeleiding' }
    ] }] } };
  bank = bank || new Map();
  const save = () => {};
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save });
  const pay = { vrijgavePoort: { intern: () => null }, boekBekend: async args => {
    const boeking = bank.get(args.economischeSleutel);
    if (!boeking) return { status: 404, onbekend: true, code: 'PAY_BOEKING_ONBEKEND' };
    if (!['van', 'naar', 'centen', 'ref', 'soort'].every(k => args[k] === boeking[k]))
      return { status: 503, error: 'Afwijkend proefbewijs.' };
    return { ok: true, boeking };
  }, boekAsync: async args => {
    const oud = bank.get(args.economischeSleutel);
    if (oud) {
      for (const k of ['van', 'naar', 'centen', 'ref', 'soort']) assert.equal(args[k], oud[k]);
      return { ok: true, herhaald: true, boeking: oud };
    }
    const boeking = { ...args, id: 'PB-' + (bank.size + 1), at: '2026-11-11T10:00:00.000Z' };
    bank.set(args.economischeSleutel, boeking);
    return { ok: true, boeking };
  } };
  let betaling;
  const bureau = maakReisbureau({ db, save, crypto, bewerkCollectie,
    reisbetalingVan: () => betaling }).reisbureau;
  betaling = maakReisbetaling({ db, save, crypto, bewerkCollectie,
    payVan: () => pay, reisbureauVan: () => bureau }).reisbetaling;
  const sess = { key: 'klant-proef' };
  async function aanvraag() {
    const r = await bureau.boek(sess, 'Klant', { tripId: 'reis-proef', personen: 1 });
    assert.equal(r.ok, true);
    assert.equal(Object.hasOwn(r.aanvraag, 'prijsgrond'), false);
    await bureau.besluit(r.aanvraag.ref, 'bevestigd', 'Adviseur', 'Bevestigd voor de proef');
    return r.aanvraag.ref;
  }
  return { db, bank, pay, bureau, betaling, sess, aanvraag,
    betaal: ref => betaling.betaal(sess, 'Klant', ref, () => ({ ok: true })) };
}

test('betaling gebruikt de aangeboden prijs en eigenaren na cataloguswijziging of verwijdering', async () => {
  const x = opstelling(), ref = await x.aanvraag();
  x.db.data.partnerTrips[0].netto = 300;
  x.db.data.partnerTrips[0].samenstelling[0].ppCenten = 27000;
  x.db.data.partnerTrips[0].samenstelling[0].leverancier = 'ANDER-HOTEL';
  x.db.data.partnerTrips = [];
  const r = await x.betaal(ref);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.betaling.centen, 10000);
  assert.equal(x.betaling.rijenVan(ref)[0].relatie, 'TEST-HOTEL');
  assert.equal(x.bureau.mijn(x.sess.key)[0].prijs.totaal, 100);
  assert.equal(Object.hasOwn(x.bureau.mijn(x.sess.key)[0], 'inning'), false);
});

test('ontbrekende, gewijzigde of niet-aansluitende prijsgrond verplaatst geen geld', async () => {
  for (const vervals of [a => { delete a.prijsgrond; }, a => { a.prijsgrond.onderdelen[0].leverancier = 'ANDER'; },
    a => { a.prijs.totaal = 90; }, a => { a.personen = 2; }]) {
    const x = opstelling(), ref = await x.aanvraag();
    vervals(x.bureau.aanvraagVan(ref));
    const r = await x.betaal(ref);
    assert.equal(r.status, 409, JSON.stringify(r));
    assert.equal(x.bank.size, 0);
    assert.equal(x.betaling.rijenVan(ref).length, 0);
  }
});

test('gelijktijdige herhaling op twee instanties schrijft één geldprojectie en één uitkering per onderdeel', async () => {
  const x = opstelling(), ref = await x.aanvraag();
  const tweede = opstelling(x.db, x.bank);
  const r = await Promise.all([x.betaal(ref), x.betaal(ref), tweede.betaal(ref)]);
  for (const antwoord of r) assert.equal(antwoord.ok, true, JSON.stringify(antwoord));
  assert.equal(x.bank.size, 1);
  assert.equal(x.betaling.rijenVan(ref).length, 3);
  assert.equal(x.betaling.rijenVan(ref).reduce((n, g) => n + g.bedragCenten, 0), 10000);
  assert.equal(x.betaling.uitkeringenVan(ref).length, 2);
  assert.equal((await x.betaling.betaal({ key: 'andere-klant' }, 'Ander', ref)).status, 404);
});

test('onbekende betaaluitkomst blokkeert wijzigingen en herstelt via dezelfde geldidentiteit', async () => {
  const x = opstelling(), ref = await x.aanvraag(), boek = x.pay.boekAsync;
  let gestart, vrij;
  const begon = new Promise(r => { gestart = r; });
  const wacht = new Promise(r => { vrij = r; });
  x.pay.boekAsync = async args => { gestart(); await wacht; return boek(args); };
  const pending = x.betaal(ref);
  await begon;
  assert.equal((await x.bureau.vraagWijziging(x.sess.key, ref, { personen: 2 })).status, 409);
  assert.equal((await x.bureau.zegAf({ ref, doorLid: true, key: x.sess.key, reden: 'Niet meer reizen' })).status, 409);
  vrij();
  assert.equal((await pending).ok, true);
  assert.equal(x.bureau.aanvraagVan(ref).status, 'bevestigd');
  assert.equal((await x.bureau.vraagWijziging(x.sess.key, ref, { personen: 2 })).status, 409);
  const af = await x.bureau.zegAf({ ref, doorLid: true, key: x.sess.key, reden: 'Niet meer reizen' });
  assert.equal(af.ok, true);
  assert.equal(af.aanvraag.geld.stand, 'teruggaveKlaargezet');
  assert.equal(x.betaling.teruggavenVan(ref).length, 1);
});

test('herstart na boeking maar vóór antwoord boekt niet opnieuw en houdt oorspronkelijke prijs', async () => {
  const x = opstelling(), ref = await x.aanvraag(), boek = x.pay.boekAsync;
  x.pay.boekAsync = async args => { await boek(args); throw new Error('gesimuleerde procesuitval na ledgercommit'); };
  await assert.rejects(x.betaal(ref), /procesuitval/);
  assert.equal(x.bank.size, 1);
  assert.equal(x.betaling.rijenVan(ref).length, 0);
  assert.equal(x.bureau.aanvraagVan(ref).inning.stand, 'bezig');
  const herstart = opstelling(JSON.parse(JSON.stringify(x.db)), x.bank);
  herstart.db.data.partnerTrips[0].netto = 1000;
  const r = await herstart.betaal(ref);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(herstart.bank.size, 1);
  assert.equal(herstart.betaling.rijenVan(ref).length, 3);
  assert.equal(r.betaling.centen, 10000);
});

test('herstart na geldprojectie vóór betaalmarkering maakt geen dubbele uitkeringen', async () => {
  const x = opstelling(), ref = await x.aanvraag();
  x.bureau.markeerBetaald = async () => { throw new Error('gesimuleerde procesuitval na projectiecommit'); };
  await assert.rejects(x.betaal(ref), /projectiecommit/);
  assert.equal(x.betaling.rijenVan(ref).length, 3);
  const ids = x.betaling.rijenVan(ref).map(r => r.id);
  const herstart = opstelling(JSON.parse(JSON.stringify(x.db)), x.bank);
  assert.equal((await herstart.betaal(ref)).ok, true);
  assert.deepEqual(herstart.betaling.rijenVan(ref).map(r => r.id), ids);
  assert.equal(herstart.betaling.uitkeringenVan(ref).length, 2);
  assert.equal(herstart.bank.size, 1);
});

test('afwijkende betaalbon wordt niet als betaling of providerbevestiging opgeslagen', async () => {
  const x = opstelling(), ref = await x.aanvraag();
  x.pay.boekAsync = async args => ({ ok: true, boeking: { ...args, id: 'PB-verkeerd', centen: 1 } });
  assert.equal((await x.betaal(ref)).status, 502);
  assert.equal(x.betaling.rijenVan(ref).length, 0);
  assert.equal(x.bureau.aanvraagVan(ref).betaald, undefined);
  assert.equal(x.bureau.aanvraagVan(ref).inning.stand, 'bezig');
});

async function post(base, pad, body, token) {
  const res = await fetch(base + pad, { method: 'POST', headers: {
    'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) });
  return { status: res.status, body: await res.json() };
}

test('echte server: catalogusprijs verandert na aanvraag, klant betaalt geaccepteerde prijs éénmaal', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  try {
    const reg = await post(srv.base, '/api/auth/register', { name: 'Prijsgrond Proef',
      email: 'prijsgrond-proef@x.nl', phone: '0612345881', password: 'geheim123',
      geboortedatum: '1990-01-01', pasApp: 'rtg' });
    assert.equal(reg.status, 200, JSON.stringify(reg.body));
    const token = reg.body.token;
    await keurLidGoed(srv.base, token, reg.body.state.user.codename, '1990-01-01');
    assert.equal((await post(srv.base, '/api/pay/oplaad', { centen: 300000, idem: 'prijsgrond-op' }, token)).status, 200);
    const aanvraag = await post(srv.base, '/api/reisbureau/boek', { tripId: 'ibiza-jetset', personen: 1 }, token);
    assert.equal(aanvraag.status, 200);
    assert.equal(Object.hasOwn(aanvraag.body.aanvraag, 'prijsgrond'), false);
    const ref = aanvraag.body.aanvraag.ref;
    const office = await kantoorAlsPersoon(srv.base, 'RTG-OFFICE');
    assert.equal((await post(srv.base, '/api/office/reisbureau/besluit', { ref, besluit: 'bevestigd' }, office)).status, 200);
    assert.equal((await post(srv.base, '/api/office/reisaanbod/zet', { id: 'ibiza-jetset', netto: 2500 }, office)).status, 200);
    const betaling = await post(srv.base, '/api/reisbureau/betaal', { ref }, token);
    assert.equal(betaling.status, 200, JSON.stringify(betaling.body));
    assert.equal(betaling.body.betaling.centen, 220000);
    const retry = await post(srv.base, '/api/reisbureau/betaal', { ref }, token);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.alBetaald, true);
    const overzicht = await post(srv.base, '/api/pay/overzicht', {}, token);
    assert.equal(overzicht.body.saldo, 80000);
    assert.equal(overzicht.body.geschiedenis.filter(r => r.soort === 'reis').length, 1);
    assert.equal((await post(srv.base, '/api/reisbureau/wijzig', { ref, personen: 2 }, token)).status, 409);
  } finally { await stop(srv); }
});

test('twee echte SQLite-serverprocessen innen tegelijk één reis eenmaal en herstellen na herstart', async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisbetaling-processen-'));
  const env = { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE', RTG_DATA_DIR: map, RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '' };
  let eerste, tweede, herstart;
  try {
    eerste = await startServer({ env });
    const reg = await post(eerste.base, '/api/auth/register', { name: 'Proces Proef',
      email: 'reis-processen@x.nl', phone: '0612345882', password: 'geheim123',
      geboortedatum: '1990-01-01', pasApp: 'rtg' });
    assert.equal(reg.status, 200);
    const token = reg.body.token;
    await keurLidGoed(eerste.base, token, reg.body.state.user.codename, '1990-01-01');
    assert.equal((await post(eerste.base, '/api/pay/oplaad', { centen: 300000, idem: 'reis-processen-op' }, token)).status, 200);
    const aanvraag = await post(eerste.base, '/api/reisbureau/boek', { tripId: 'ibiza-jetset', personen: 1 }, token);
    const ref = aanvraag.body.aanvraag.ref;
    const office = await kantoorAlsPersoon(eerste.base, 'RTG-OFFICE');
    assert.equal((await post(eerste.base, '/api/office/reisbureau/besluit', { ref, besluit: 'bevestigd' }, office)).status, 200);
    tweede = await startServer({ env });
    const betaald = await Promise.all([post(eerste.base, '/api/reisbureau/betaal', { ref }, token),
      post(tweede.base, '/api/reisbureau/betaal', { ref }, token)]);
    for (const r of betaald) assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(betaald[0].body.betaling.boeking, betaald[1].body.betaling.boeking);
    await stop(tweede); tweede = null;
    await stop(eerste); eerste = null;
    herstart = await startServer({ env });
    const retry = await post(herstart.base, '/api/reisbureau/betaal', { ref }, token);
    assert.equal(retry.status, 200, JSON.stringify(retry));
    assert.equal(retry.body.alBetaald, true);
    const stand = await post(herstart.base, '/api/pay/overzicht', {}, token);
    assert.equal(stand.body.saldo, 80000);
    assert.equal(stand.body.geschiedenis.filter(r => r.soort === 'reis').length, 1);
    const terug = await post(herstart.base, '/api/office/reisbureau/terugboeking', { ref, reden: 'Testreis gaat niet door' }, office);
    assert.equal(terug.status, 200, JSON.stringify(terug));
    assert.equal(terug.body.centen, 220000, 'geen verdubbeling van de economische herkomstrijen');
    assert.equal(terug.body.teruggedraaid, 6);
  } finally {
    await stop(herstart); await stop(tweede); await stop(eerste);
    fs.rmSync(map, { recursive: true, force: true });
  }
});
