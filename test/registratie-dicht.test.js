/* REGISTRATIE DICHT -- server/accounts/registratie.js (RTG_REGISTRATIE_DICHT).

   Wat hier vastligt, en het kan allemaal zakken:
   1. met de vlag aan weigert de ACCOUNTLAAG zelf (createUser en createUserSync):
      503, code REGISTRATIE_DICHT, en er komt geen rij in `users` bij. Daar lopen
      registreren, de SSO-binnenkomst en SCIM alle drie doorheen;
   2. op een echte server met de vlag aan: /api/auth/register geeft 503 met de
      reden, het adres bestaat daarna niet (inloggen ermee faalt), en een
      bestaand account logt gewoon in, vraagt een herstel aan en komt bij het
      techniekbord;
   3. op een echte server ZONDER de vlag werkt registreren zoals voorheen, en de
      handmatige zekering op het techniekbord sluit hem met reden `zekering`;
   4. een met de hand getrokken zekering houdt geen `tot` van een eerdere
      noodrem over, en dooft dus niet vanzelf.

   Mutaties, met de hand nagetrokken: de regel `registratie.eisOpen()` uit
   createUser gehaald -> toets 1 zakt; de vroege controle in de route weggehaald
   -> toets 2 houdt (de accountlaag vangt hem) maar de reden blijft `besluit`;
   `z.tot = null` uit de spring-tak van knoppen.js -> toets 4 zakt.

   Draai: node --test test/registratie-dicht.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');

const VLAG = 'RTG_REGISTRATIE_DICHT';

test('1. de accountlaag weigert zelf, voor elke schrijfactie', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regdicht-acc-'));
  const oud = { dir: process.env.RTG_DATA_DIR, env: process.env.NODE_ENV, vlag: process.env[VLAG] };
  process.env.RTG_DATA_DIR = TMP; process.env.NODE_ENV = 'test';
  try {
    const accounts = require('../server/accounts');
    accounts.init();
    const voor = accounts.count();
    process.env[VLAG] = '1';
    assert.equal(accounts.registratieDicht(), true);
    await assert.rejects(accounts.createUser({ email: 'dicht@voorbeeld.test', password: 'geheim1234', tier: 'rtg', realName: 'Proef' }),
      e => e.code === 'REGISTRATIE_DICHT' && e.status === 503);
    assert.throws(() => accounts.createUserSync({ email: 'dicht2@voorbeeld.test', password: 'geheim1234', tier: 'rtg', realName: 'Proef' }),
      e => e.code === 'REGISTRATIE_DICHT');
    assert.equal(accounts.count(), voor, 'er is geen account bijgekomen');
    assert.equal(accounts.findByLogin('dicht@voorbeeld.test'), null);
    delete process.env[VLAG];
    assert.equal(accounts.registratieDicht(), false);
    const u = await accounts.createUser({ email: 'open@voorbeeld.test', password: 'geheim1234', tier: 'rtg', realName: 'Proef' });
    assert.ok(u && u.id, 'met de vlag uit werkt aanmaken weer');
    assert.equal(accounts.count(), voor + 1);
  } finally {
    if (oud.vlag === undefined) delete process.env[VLAG]; else process.env[VLAG] = oud.vlag;
    if (oud.dir === undefined) delete process.env.RTG_DATA_DIR; else process.env.RTG_DATA_DIR = oud.dir;
    if (oud.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oud.env;
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ }
  }
});

async function post(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const nieuw = () => {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return { name: 'Dicht ' + u, email: 'regdicht-' + u + '@x.nl', password: 'geheim1234', geboortedatum: '1990-01-01', pasApp: 'rtg' };
};
const EIGENAAR = { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' };

test('2 en 3. op een echte server: dicht met de vlag, open zonder, en de zekering', async (t) => {
  const { startServer, stop } = require('./helper');

  await t.test('2. vlag aan: registreren geweigerd, bestaande accounts werken', async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regdicht-aan-'));
    const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, [VLAG]: '1' } });
    try {
      const n = nieuw();
      const r = await post(srv.base, '/api/auth/register', n);
      assert.equal(r.status, 503, JSON.stringify(r.body));
      assert.equal(r.body.code, 'REGISTRATIE_DICHT');
      assert.equal(r.body.reden, 'besluit');
      assert.ok(!r.body.token, 'geen sessie');
      const l = await post(srv.base, '/api/auth/login', { login: n.email, password: n.password, pasApp: 'rtg' });
      assert.ok(!l.body.token && l.status >= 400, 'het adres bestaat niet: ' + l.status);

      const eig = await post(srv.base, '/api/auth/login', EIGENAAR);
      assert.ok(eig.body.token, 'een bestaand account logt in: ' + JSON.stringify(eig.body).slice(0, 120));
      const h = await post(srv.base, '/api/auth/forgot', { email: EIGENAAR.login });
      assert.equal(h.status, 200, 'wachtwoordherstel blijft open');
      const bord = await fetch(srv.base + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + eig.body.token } });
      assert.equal(bord.status, 200, 'de eigenaar komt bij het techniekbord');
    } finally { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } }
  });

  await t.test('3. vlag uit: registreren werkt, en de zekering sluit hem met de hand', async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regdicht-uit-'));
    const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, [VLAG]: '' } });
    try {
      const r = await post(srv.base, '/api/auth/register', nieuw());
      assert.ok(r.body.token, 'registreren werkt: ' + JSON.stringify(r.body).slice(0, 120));
      const eig = (await post(srv.base, '/api/auth/login', EIGENAAR)).body.token;
      const z = await post(srv.base, '/api/techniek/zekering', { id: 'registratie', actie: 'spring', reden: 'proef' }, eig);
      assert.equal(z.status, 200, JSON.stringify(z.body));
      const d = await post(srv.base, '/api/auth/register', nieuw());
      assert.equal(d.status, 503);
      assert.equal(d.body.reden, 'zekering');
      await post(srv.base, '/api/techniek/zekering', { id: 'registratie', actie: 'reset' }, eig);
      assert.ok((await post(srv.base, '/api/auth/register', nieuw())).body.token, 'na de reset weer open');
    } finally { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } }
  });
});

test('4. een handmatige zekering erft geen einde van een eerdere noodrem', () => {
  const routes = {};
  const app = { post: (pad, ...fns) => { routes[pad] = fns[fns.length - 1]; } };
  const zekeringen = { registratie: { naam: 'Nieuwe registraties', aan: true, tot: Date.now() - 1000 } };
  require('../server/routes/techniek/knoppen')({ app, kern: {}, accounts: {}, staat: () => ({ zekeringen }),
    save: () => {}, log: {}, beveilig: null, techAuth: null, eigenaarAlleen: null });
  let uit = null;
  routes['/api/techniek/zekering']({ body: { id: 'registratie', actie: 'spring', reden: 'besluit eigenaar' } },
    { json: (b) => { uit = b; }, status() { return this; } });
  assert.equal(uit.ok, true);
  const z = zekeringen.registratie;
  assert.equal(z.tot, null, 'geen oud einde');
  assert.equal(require('../server/techniek').zekeringGesprongen(z), true, 'hij blijft eruit');
});
