/* Geen mockbackend: afzonderlijke Node-server, echte accountpoorten, echte
   transactionele SQLite-collecties en Pay-grootboek. De vijf ondernemingen,
   toelatingscontroles en leveringsverklaringen blijven fictieve proefdata;
   dit is dus GEEN externe acceptatie of productiekwalificatie. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisketen-http-'));
let srv, x, rtgReis, partnerReis;
const env = { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' };
test.before(async () => { srv = await startServer({ env }); x = await maakReisketenFixture(() => srv.base); });
test.after(async () => { await stop(srv); fs.rmSync(map, { recursive: true, force: true }); });
const MP = '/api/reisbureau/keten';
const OP = '/api/office/reisbureau/keten';
const SP = '/api/supplier/reisbureau/keten';
const DP = '/api/supplier/reisbureau/opdracht/besluit';
const lees = async ref => goed(await x.api(MP, { ref }, x.reiziger.token), 'lid leest').reizen[0];

test('persoonlijke actoren, geen gedeelde werkplek of tenant uit de aanvraag als bevoegdheid', async () => {
  assert.equal((await x.api(MP)).status, 401);
  assert.equal((await x.api(OP, {}, x.gedeeld)).status, 403);
  assert.equal((await x.api(SP, {}, x.bureau.gedeeldeManager)).status, 403);
  assert.equal((await x.api(SP, {}, x.hotel.token)).status, 403, 'hotel wordt niet door bodyvelden een reisbureau');
  rtgReis = goed(await x.api(MP + '/start', { titel: 'RTG ketenproef', bestemming: 'Ibiza',
    org: x.bureau.org, actorRef: 'user-999', idem: 'rtg-http-start' }, x.reiziger.token), 'RTG aanvraag').reis;
  assert.equal(rtgReis.verkoper.naam, 'RTG Travel');
  partnerReis = goed(await x.api(MP + '/start', { titel: 'Onafhankelijke ketenproef', bestemming: 'Ibiza',
    supplierCode: x.bureau.code, idem: 'partner-http-start' }, x.reiziger.token), 'partneraanvraag').reis;
  assert.equal(partnerReis.verkoper.naam, x.bureau.naam);
  assert.deepEqual(goed(await x.api(OP, { ref: partnerReis.ref }, x.office), 'RTG isolatie').reizen, []);
  assert.deepEqual(goed(await x.api(SP, { ref: partnerReis.ref }, x.anderBureau.token), 'concurrent isolatie').reizen, []);
  assert.deepEqual(goed(await x.api(MP, { ref: partnerReis.ref }, x.anderLid.token), 'lid isolatie').reizen, []);
  for (const pad of ['/api/office/reisbureau', '/api/office/state']) {
    const legacy = goed(await x.api(pad, {}, x.office), 'oude lezer');
    assert.equal(JSON.stringify(legacy).includes(partnerReis.ref), false, pad + ' lekt geen partnerreis');
  }
  const offerte = x.offerte(partnerReis);
  assert.equal((await x.api(OP + '/offerte', offerte, x.office)).status, 404);
  assert.equal((await x.api(SP + '/offerte', offerte, x.anderBureau.token)).status, 404);
});

async function doorloop(reis, pad, token) {
  const offerte = x.offerte(reis);
  const aangeboden = goed(await x.api(pad + '/offerte', offerte, token), 'offerte').reis;
  assert.equal(aangeboden.offerte.totaalCenten, 80000);
  assert.equal(goed(await x.api(pad + '/offerte', offerte, token), 'offerte retry').herhaald, true);
  assert.equal((await x.api(pad + '/offerte', { ...offerte, voorwaarden: 'Andere tekst' }, token)).status, 409);
  const gezien = await lees(reis.ref);
  assert.equal(Object.hasOwn(gezien.offerte.onderdelen[0], 'verschuldigdCenten'), false);
  assert.equal(JSON.stringify(gezien).includes('actorRef'), false);
  assert.equal((await x.api(MP + '/akkoord', { ref: reis.ref, versie: gezien.versie,
    offerteHash: gezien.offerte.hash, idem: 'ander-lid-akkoord' }, x.anderLid.token)).status, 404);
  let actueel = goed(await x.api(MP + '/akkoord', { ref: reis.ref, versie: gezien.versie,
    offerteHash: gezien.offerte.hash, idem: 'akkoord-' + reis.ref }, x.reiziger.token), 'akkoord').reis;
  assert.equal((await x.api(MP + '/betaal', { ref: reis.ref, versie: actueel.versie,
    idem: 'te-vroege-betaling' }, x.reiziger.token)).status, 409);
  assert.equal((await x.api(DP, { ref: reis.ref, versie: actueel.versie, onderdeel: 'hotel',
    besluit: 'accepteer', bewijsRef: 'TEST-NIET-EIGEN', idem: 'vreemde-aanbieder' }, x.transfer.token)).status, 404);
  for (const [id, actor] of [['hotel', x.hotel], ['transfer', x.transfer], ['fiets', x.fiets]]) {
    const eigen = goed(await x.api('/api/supplier/reisbureau/opdrachten', {}, actor.token), 'opdrachten').reizen.find(a => a.ref === reis.ref);
    assert.deepEqual(eigen.opdrachten.map(p => p.id), [id]);
    assert.equal(Object.hasOwn(eigen, 'codenaam'), false);
    assert.equal(Object.hasOwn(eigen, 'offerte'), false);
    const b = { ref: reis.ref, versie: actueel.versie, onderdeel: id, besluit: 'accepteer',
      bewijsRef: 'LOKALE-TESTACCEPTATIE-' + id, idem: 'acceptatie-' + id + '-' + reis.ref };
    const aanvaard = goed(await x.api(DP, b, actor.token), 'eigen aanbieder accepteert').reis;
    assert.equal(goed(await x.api(DP, b, actor.token), 'acceptatie retry').herhaald, true);
    actueel = await lees(reis.ref);
    assert.equal(aanvaard.versie, actueel.versie);
  }
  assert.equal(actueel.status, 'bevestigd');
  assert.equal((await x.api(DP, { ref: reis.ref, versie: actueel.versie, onderdeel: 'hotel',
    besluit: 'lever', bewijsRef: 'TE-VROEG', idem: 'lever-te-vroeg' }, x.hotel.token)).status, 409);
  const betaal = { ref: reis.ref, versie: actueel.versie, idem: 'betaal-' + reis.ref };
  const betalingen = await Promise.all([x.api(MP + '/betaal', betaal, x.reiziger.token), x.api(MP + '/betaal', betaal, x.reiziger.token)]);
  for (const b of betalingen) assert.equal(goed(b, 'gelijktijdige inning').reis.betaling.status, 'betaald');
  actueel = await lees(reis.ref);
  for (const [id, actor] of [['hotel', x.hotel], ['transfer', x.transfer], ['fiets', x.fiets]]) {
    goed(await x.api(DP, { ref: reis.ref, versie: actueel.versie, onderdeel: id,
      besluit: 'lever', bewijsRef: 'LOKALE-TESTLEVERING-' + id,
      idem: 'levering-' + id + '-' + reis.ref }, actor.token), 'eigen leveringsverklaring');
    actueel = await lees(reis.ref);
  }
  assert.equal(actueel.status, 'geleverd');
  assert.equal(actueel.operationeelBewezen, false);
  assert.equal(actueel.directBoekbaarBewezen, false);
  const eind = goed(await x.api(pad, { ref: reis.ref }, token), 'verkoper aansluiting').reizen[0];
  assert.equal(eind.aansluiting.ontvangenCenten, 80000);
  assert.equal(eind.aansluiting.verschuldigdCenten, 70000);
  assert.equal(eind.aansluiting.settlement, 'niet-gekwalificeerd');
  assert.ok(eind.gebeurtenissen.every(g => /^user-\d+$/.test(g.actorRef)));
  const afsluiting = await x.api(pad + '/afronden', { ref: reis.ref, versie: actueel.versie,
    idem: 'afronden-' + reis.ref }, token);
  assert.equal(afsluiting.status, 409);
  assert.match(afsluiting.body.error, /settlement/);
  return actueel;
}

test('RTG: aanvraag, offerte, klantakkoord, drie eigen aanbieders, één echte ledgerinning en leveringsverklaring', async () => {
  rtgReis = await doorloop(rtgReis, OP, x.office);
});
test('onafhankelijk bureau: dezelfde contractketen met eigen verkoper en eigen geldrekening', async () => {
  partnerReis = await doorloop(partnerReis, SP, x.bureau.token);
  const geld = goed(await x.api('/api/pay/overzicht', {}, x.reiziger.token), 'ledger');
  assert.equal(geld.saldo, 140000);
  const reizen = geld.geschiedenis.filter(r => r.soort === 'reisbetaling');
  assert.equal(reizen.length, 2, 'gelijktijdige retries zijn geen dubbele boekingen');
  assert.deepEqual(reizen.map(r => r.tegen).sort(), ['rtg:reisbureau', 'zaak ' + x.bureau.code].sort());
  assert.ok(reizen.every(r => r.centen === -80000));
  assert.equal(goed(await x.api('/api/supplier/pay/overzicht', {}, x.bureau.token), 'eigen bureaurekening').saldo, 80000);
  assert.equal(goed(await x.api('/api/supplier/pay/overzicht', {}, x.anderBureau.token), 'concurrentrekening').saldo, 0);
  assert.equal(goed(await x.api('/api/pay/overzicht', {}, x.anderLid.token), 'ander lid').saldo, 300000);
});

test('herstart bewaart eigendom, geld en replay; geen oude RTG-mutator kan partnercontract wijzigen', async () => {
  await stop(srv);
  srv = await startServer({ env });
  const actueel = await lees(partnerReis.ref);
  assert.equal(actueel.status, 'geleverd');
  assert.equal(actueel.betaling.centen, 80000);
  const retry = goed(await x.api(MP + '/betaal', { ref: actueel.ref, versie: actueel.versie,
    idem: 'betaal-' + actueel.ref }, x.reiziger.token), 'herstart betaalretry');
  assert.equal(retry.reis.betaling.status, 'betaald');
  assert.deepEqual(goed(await x.api(OP, { ref: actueel.ref }, x.office), 'RTG geen partnerinzage').reizen, []);
  for (const pad of ['/api/office/reisbureau/besluit', '/api/office/reisbureau/afzeggen', '/api/office/reisbureau/thuis']) {
    assert.equal((await x.api(pad, { ref: actueel.ref, besluit: 'bevestigd', reden: 'Geen bevoegdheid' }, x.office)).status, 404);
  }
  assert.equal(goed(await x.api('/api/pay/overzicht', {}, x.reiziger.token), 'saldo na herstart').saldo, 140000);
  assert.equal((await lees(partnerReis.ref)).versie, actueel.versie);
});

test('expliciete transportheader cachet geen oude offerte en omzeilt geen actuele tenantintrekking', async () => {
  const tech = goed(await x.api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' }), 'techniek na herstart').token;
  const nieuw = goed(await x.api(MP + '/start', { titel: 'Headerherhaling', bestemming: 'Ibiza',
    supplierCode: x.bureau.code, idem: 'header-http-start' }, x.reiziger.token), 'headeraanvraag').reis;
  const header = { 'Idempotency-Key': 'herhaalde-reisketen-lezer' };
  const eerste = goed(await x.api(SP, { ref: nieuw.ref }, x.bureau.token, header), 'eerste lezing').reizen[0];
  assert.equal(eerste.offerte, null);
  const aangeboden = goed(await x.api(SP + '/offerte', x.offerte(nieuw), x.bureau.token), 'offerteren').reis;
  const tweede = goed(await x.api(SP, { ref: nieuw.ref }, x.bureau.token, header), 'verse lezing').reizen[0];
  assert.equal(tweede.versie, aangeboden.versie);
  assert.equal(tweede.offerte.hash, aangeboden.offerte.hash);
  goed(await x.api('/api/techniek/tenant', { org: x.bureau.org, actief: false }, tech), 'tenantintrekking');
  assert.equal((await x.api(SP, { ref: nieuw.ref }, x.bureau.token, header)).status, 403,
    'dezelfde header bevat geen oude toegangsbevoegdheid');
  assert.equal((await x.api(SP + '/offerte', x.offerte(tweede), x.bureau.token, header)).status, 403);
});
