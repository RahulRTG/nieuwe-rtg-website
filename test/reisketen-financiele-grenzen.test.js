/* Echte lokale HTTP-/SQLite-geldproef. De onboarding, ontvangen overdracht,
   reisofferte, leveranciersverklaringen en Pay-ledger lopen door de bestaande
   server. Ondernemingen en leveranciersacceptatie zijn fictieve proefgegevens;
   dit is geen externe financiële of juridische acceptatie. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, keurLidGoed } = require('./helper');
const { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
let srv, x;
const MP = '/api/reisbureau/keten';
const SP = '/api/supplier/reisbureau/keten';
test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  x = await maakReisketenFixture(srv.base);
});
test.after(async () => { await stop(srv); });

async function nieuwLid(naam) {
  const r = goed(await x.api('/api/auth/register', { name: 'Financiële grens ' + naam,
    email: 'reis-geldgrens-' + naam + '@voorbeeld.test', phone: '0612345891',
    password: 'Geheim123!', geboortedatum: '1990-01-01', pasApp: 'rtg' }), 'ongekeurd lid');
  return { token: r.token, codenaam: r.state.user.codename };
}
const saldo = async lid => goed(await x.api('/api/pay/overzicht', {}, lid.token), 'eigen Pay-ledger');
async function ontvang(lid, centen, donor, merk) {
  goed(await x.api('/api/pay/stuur', { aan: lid.codenaam, centen,
    oms: 'Fictieve overdracht voor financiële grensproef', idem: 'grens-ontvang-' + merk }, donor.token), 'ontvangen tegoed');
  assert.equal((await saldo(lid)).saldo, centen);
}
async function keten(lid, merk) {
  const start = goed(await x.api(MP + '/start', { titel: 'Financiële grens ' + merk,
    bestemming: 'Ibiza', supplierCode: x.bureau.code, idem: 'grens-start-' + merk }, lid.token), 'aanvraag').reis;
  goed(await x.api(SP + '/offerte', x.offerte(start), x.bureau.token), 'offerte');
  let r = goed(await x.api(MP, { ref: start.ref }, lid.token), 'eigen offerte').reizen[0];
  r = goed(await x.api(MP + '/akkoord', { ref: r.ref, versie: r.versie,
    offerteHash: r.offerte.hash, idem: 'grens-akkoord-' + merk }, lid.token), 'akkoord').reis;
  for (const [onderdeel, provider] of [['hotel', x.hotel], ['transfer', x.transfer], ['fiets', x.fiets]]) {
    goed(await x.api('/api/supplier/reisbureau/opdracht/besluit', { ref: r.ref, versie: r.versie,
      onderdeel, besluit: 'accepteer', bewijsRef: 'LOKALE-TESTACCEPTATIE-' + merk + '-' + onderdeel,
      idem: 'grens-provider-' + merk + '-' + onderdeel }, provider.token), 'aanbiedersverklaring');
    r = goed(await x.api(MP, { ref: r.ref }, lid.token), 'actuele eigen reis').reizen[0];
  }
  assert.equal(r.status, 'bevestigd');
  return r;
}
async function klassiek(lid) {
  const r = goed(await x.api('/api/reisbureau/boek', { tripId: 'ibiza-jetset', personen: 1 }, lid.token), 'klassieke aanvraag').aanvraag;
  goed(await x.api('/api/office/reisbureau/besluit', { ref: r.ref, besluit: 'bevestigd' }, x.office), 'klassieke bevestiging');
  return r;
}
async function standaardPoortDicht(lid, merk) {
  const r = await x.api('/api/pay/stuur', { aan: x.reiziger.codenaam, centen: 1,
    idem: 'grens-controle-' + merk }, lid.token);
  assert.equal(r.status, 403, JSON.stringify(r.body));
  assert.equal(r.body.kyc, true, 'bestaande paspoortpoort weigert nieuw geld');
}

test('federatieve reis: lid met ingetrokken verificatie en tegoed kan de Pay-paspoortpoort niet omzeilen', async () => {
  const lid = await nieuwLid('keten');
  const userId = await keurLidGoed(srv.base, lid.token, lid.codenaam, '1990-01-01');
  await ontvang(lid, 80000, x.reiziger, 'keten');
  goed(await x.api('/api/office/verify', { userId, decision: 'reject' }, x.office), 'verificatie ingetrokken');
  await standaardPoortDicht(lid, 'keten');
  const reis = await keten(lid, 'ongekeurd');
  const voor = await saldo(lid);
  const betaling = await x.api(MP + '/betaal', { ref: reis.ref, versie: reis.versie,
    idem: 'grens-betaal-keten' }, lid.token);
  assert.equal(betaling.status, 403, 'een eigen reis is geen vrijstelling van Pay-KYC: ' + JSON.stringify(betaling.body));
  assert.equal(betaling.body.kyc, true);
  assert.deepEqual(await saldo(lid), voor, 'weigering schrijft geen geld');
});

test('klassieke reis: dezelfde paspoortpoort geldt vóór de eerste inning', async () => {
  const lid = await nieuwLid('klassiek');
  const userId = await keurLidGoed(srv.base, lid.token, lid.codenaam, '1990-01-01');
  await ontvang(lid, 220000, x.reiziger, 'klassiek');
  goed(await x.api('/api/office/verify', { userId, decision: 'reject' }, x.office), 'verificatie ingetrokken');
  await standaardPoortDicht(lid, 'klassiek');
  const reis = await klassiek(lid), voor = await saldo(lid);
  const betaling = await x.api('/api/reisbureau/betaal', { ref: reis.ref }, lid.token);
  assert.equal(betaling.status, 403, 'klassieke route heeft dezelfde Pay-grens: ' + JSON.stringify(betaling.body));
  assert.equal(betaling.body.kyc, true);
  assert.deepEqual(await saldo(lid), voor, 'weigering schrijft geen geld');
});

test('ingetrokken verificatie: reeds geboekte klassieke en federatieve uitkomsten blijven uitsluitend leesbaar', async () => {
  const lid = await nieuwLid('herstel');
  const userId = await keurLidGoed(srv.base, lid.token, lid.codenaam, '1990-01-01');
  await ontvang(lid, 300000, x.anderLid, 'herstel');
  const nieuw = await keten(lid, 'herstel'), oud = await klassiek(lid);
  const invoer = { ref: nieuw.ref, versie: nieuw.versie, idem: 'grens-betaal-herstel' };
  assert.equal(goed(await x.api(MP + '/betaal', invoer, lid.token), 'eerste keteninning').reis.betaling.status, 'betaald');
  goed(await x.api('/api/reisbureau/betaal', { ref: oud.ref }, lid.token), 'eerste klassieke inning');
  goed(await x.api('/api/office/verify', { userId, decision: 'reject' }, x.office), 'verificatie ingetrokken');
  await standaardPoortDicht(lid, 'herstel');
  const voor = await saldo(lid);
  assert.equal(voor.saldo, 0);
  assert.equal(goed(await x.api(MP + '/betaal', invoer, lid.token), 'bestaande ketenuitkomst').reis.betaling.status, 'betaald');
  assert.equal(goed(await x.api('/api/reisbureau/betaal', { ref: oud.ref }, lid.token), 'bestaande klassieke uitkomst').alBetaald, true);
  assert.deepEqual(await saldo(lid), voor, 'alleen bestaande uitkomst; geen tweede geldbeweging');
});
