'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { startServer, stop, elevateTier } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zaakregie-workos-'));
let srv, base, tech, beheer, werkruimte, andereWerkruimte, lidA, lidB, anderLidB, accountA, accountB;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function account(naam, nr) {
  const r = await api('/api/auth/register', { name: naam, email: 'zr' + nr + '@x.test',
    phone: '06123' + String(nr).padStart(5, '0'), password: 'geheim123',
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(r.status, 200);
  return r.body.token;
}

async function lidKoppel(token, naam, ruimte = werkruimte, beheerSleutel = beheer) {
  const a = await api('/api/bedrijf/lid/aanmeld', { werkruimte: ruimte, naam });
  assert.equal(a.status, 200);
  await api('/api/bedrijf/lid/besluit', { werkruimte: ruimte, beheerToken: beheerSleutel,
    lidId: a.body.lidId, akkoord: true });
  const k = await api('/api/bedrijf/lid/koppel', { werkruimte: ruimte, lidToken: a.body.lidToken }, token);
  assert.equal(k.status, 200);
  return { id: a.body.lidId, token: a.body.lidToken };
}

test('de gebruikte servicemachtiging-lezer maakt bij lezen geen opslag aan', () => {
  const db = { data: {} };
  const machtiging = require('../server/kern/service/machtiging')({ db, save() {}, crypto,
    zaken: { vind: () => null }, inzagelog: null });
  assert.deepEqual(machtiging.lijst({ mens: 'user-1' }), []);
  assert.equal(Object.hasOwn(db.data, 'serviceMachtigingen'), false);
});

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  const w = await api('/api/bedrijf/werkruimte/maak', { naam: 'Zaakregie Werkruimte' });
  werkruimte = w.body.werkruimte; beheer = w.body.beheerToken;
  await api('/api/techniek/tenant', { org: 'O-ZAAKREGIE', naam: 'Zaakregie Groep' }, tech);
  await api('/api/techniek/tenant/bind', { org: 'O-ZAAKREGIE', soort: 'werkruimte', code: werkruimte }, tech);
  const ander = await api('/api/bedrijf/werkruimte/maak', { naam: 'Andere Zaakregie Werkruimte' });
  andereWerkruimte = ander.body.werkruimte;
  await api('/api/techniek/tenant', { org: 'O-ZAAKREGIE-B', naam: 'Andere Zaakregie Groep' }, tech);
  await api('/api/techniek/tenant/bind', { org: 'O-ZAAKREGIE-B', soort: 'werkruimte',
    code: andereWerkruimte }, tech);
  accountA = await account('Account A', 1);
  accountB = await account('Account B', 2);
  const office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  await elevateTier(base, accountA, 'lifestyle', office);
  lidA = await lidKoppel(accountA, 'Account A');
  lidB = await lidKoppel(accountB, 'Account B');
  anderLidB = await lidKoppel(accountB, 'Account B andere tenant', andereWerkruimte, ander.body.beheerToken);
});

test.after(async () => {
  await stop(srv);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een eigen Service- en Bureauzaak krijgen context via de bestaande deuren', async () => {
  const service = await api('/api/service/open', { onderwerp: 'reis', titel: 'Mijn transfer wijzigen' }, accountA);
  const serviceView = await api('/api/bedrijf/zaakregie', { werkruimte, lidToken: lidA.token,
    domain: 'service', id: service.body.zaak.id }, accountA);
  assert.equal(serviceView.status, 200, JSON.stringify(serviceView.body));
  const s = serviceView.body.regiebeeld;
  assert.equal(s.source.id, service.body.zaak.id);
  assert.equal(s.context.context.tenant.id, 'O-ZAAKREGIE');
  assert.equal(s.context.context.workspace.id, werkruimte);
  assert.equal(s.context.grantsAuthority, false);
  assert.equal(s.actions.every(x => x.executable === false), true);

  const bureau = await api('/api/member/bureau/zaak/open', { titel: 'Privétransfer', domein: 'vervoer' }, accountA);
  const bureauView = await api('/api/bedrijf/zaakregie', { werkruimte, lidToken: lidA.token,
    domain: 'bureau', id: bureau.body.zaak.id }, accountA);
  assert.equal(bureauView.status, 200, JSON.stringify(bureauView.body));
  assert.equal(bureauView.body.regiebeeld.source.id, bureau.body.zaak.id);
  assert.equal(bureauView.body.regiebeeld.context.context.workspace.membershipRef, lidA.id);
});

test('account-, case- en tenantisolatie blijven fail-closed', async () => {
  const service = await api('/api/service/open', { onderwerp: 'betaling', titel: 'Mijn betaling controleren' }, accountA);

  const verkeerdeSessie = await api('/api/bedrijf/zaakregie', { werkruimte, lidToken: lidA.token,
    domain: 'service', id: service.body.zaak.id }, accountB);
  assert.equal(verkeerdeSessie.status, 403);
  assert.equal(verkeerdeSessie.body.code, 'ZAAKREGIE_MEMBERSHIP_MISMATCH');

  const vreemdeZaak = await api('/api/bedrijf/zaakregie', { werkruimte, lidToken: lidB.token,
    domain: 'service', id: service.body.zaak.id }, accountB);
  assert.equal(vreemdeZaak.status, 404);
  assert.equal(vreemdeZaak.body.code, 'ZAAKREGIE_CASE_NOT_FOUND');

  const andereTenant = await api('/api/bedrijf/zaakregie', { werkruimte: andereWerkruimte,
    lidToken: anderLidB.token, domain: 'service', id: service.body.zaak.id }, accountB);
  assert.equal(andereTenant.status, 404);
  assert.equal(andereTenant.body.code, 'ZAAKREGIE_CASE_NOT_FOUND');
  assert.doesNotMatch(JSON.stringify(andereTenant.body), /O-ZAAKREGIE|Mijn betaling/);

  await api('/api/techniek/tenant/bind', { org: 'O-ZAAKREGIE', soort: 'werkruimte',
    code: werkruimte, aan: false }, tech);
  const los = await api('/api/bedrijf/zaakregie', { werkruimte, lidToken: lidA.token,
    domain: 'service', id: service.body.zaak.id }, accountA);
  assert.equal(los.status, 403);
  assert.equal(los.body.code, 'ZAAKREGIE_CONTEXT_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(los.body), /Account A|Mijn betaling|O-ZAAKREGIE/);
  await api('/api/techniek/tenant/bind', { org: 'O-ZAAKREGIE', soort: 'werkruimte', code: werkruimte }, tech);

  const vreemdeEntiteit = await api('/api/bedrijf/zaakregie', { werkruimte, lidToken: lidA.token,
    domain: 'service', id: service.body.zaak.id, entiteit: 'NIET-MIJN-ENTITEIT' }, accountA);
  assert.equal(vreemdeEntiteit.status, 403);
  assert.equal(vreemdeEntiteit.body.code, 'ZAAKREGIE_CONTEXT_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(vreemdeEntiteit.body), /NIET-MIJN-ENTITEIT/);
});

test('een ingetrokken WorkOS-lidmaatschap sluit de projectie direct', async () => {
  const service = await api('/api/service/open', { onderwerp: 'account', titel: 'Mijn profiel controleren' }, accountA);
  const uit = await api('/api/bedrijf/lid/uit-dienst', { werkruimte, beheerToken: beheer,
    lidId: lidA.id, reden: 'Toegang ingetrokken' });
  assert.equal(uit.status, 200);

  const na = await api('/api/bedrijf/zaakregie', { werkruimte, lidToken: lidA.token,
    domain: 'service', id: service.body.zaak.id }, accountA);
  assert.equal(na.status, 403);
  assert.doesNotMatch(JSON.stringify(na.body), new RegExp(service.body.zaak.id));
});
