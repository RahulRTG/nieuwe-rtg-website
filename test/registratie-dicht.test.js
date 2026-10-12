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
      noodrem over, en dooft dus niet vanzelf;
   5. de vlag faalt DICHT: alleen leeg en een expliciete 0 zijn open, elke
      andere waarde (true, yes, ja, 01, `1 # commentaar`) is dicht, en een
      waarde die geen 0 of 1 is geeft een configuratiewaarschuwing;
   6. besluit en zekering samen: het antwoord noemt ze ALLEBEI, met een `hoe`,
      zodat een reset van de zekering niet leest als heropenen; en
      /api/techniek/status toont het besluit alleen-lezen naast de zekering;
   7. het eigenaarsscript maakt het eigenaarsaccount OOK met de vlag aan, langs
      de gevel -- en die weg is van geen enkele route te bereiken (niets in
      server/ buiten server/accounts/ laadt accounts/users zelf);
   8. SSO geeft bij een dichte registratie de reden door in plaats van een
      kale 401.

   Mutaties, met de hand nagetrokken: de regel `registratie.eisOpen()` uit
   createUser gehaald -> toets 1 zakt; de vroege controle in de route weggehaald
   -> toets 2 houdt (de accountlaag vangt hem) maar de reden blijft `besluit`;
   `z.tot = null` uit de spring-tak van knoppen.js -> toets 4 zakt. De
   meetbare staan in MUTATIES.json (fail-open lezen, een reden laten vallen).

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
      assert.deepEqual(r.body.reden, ['besluit']);
      assert.match(String(r.body.hoe), /RTG_REGISTRATIE_DICHT/, 'de weigering zegt dat het een instelling is');
      assert.ok(!r.body.token, 'geen sessie');
      const l = await post(srv.base, '/api/auth/login', { login: n.email, password: n.password, pasApp: 'rtg' });
      assert.ok(!l.body.token && l.status >= 400, 'het adres bestaat niet: ' + l.status);

      const eig = await post(srv.base, '/api/auth/login', EIGENAAR);
      assert.ok(eig.body.token, 'een bestaand account logt in: ' + JSON.stringify(eig.body).slice(0, 120));
      const h = await post(srv.base, '/api/auth/forgot', { email: EIGENAAR.login });
      assert.equal(h.status, 200, 'wachtwoordherstel blijft open');
      const bord = await fetch(srv.base + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + eig.body.token } });
      assert.equal(bord.status, 200, 'de eigenaar komt bij het techniekbord');
      const st = await bord.json();
      assert.equal(st.registratie.dicht, true, 'het bord ziet het besluit');
      assert.equal(st.registratie.wijzigbaarHier, false);
      assert.deepEqual(st.registratie.paden.map(p => p.pad), ['/api/auth/register', '/api/sso/terug en /api/sso/saml/acs', '/api/scim/v2/Users']);
      const fuse = st.zekeringen.find(z => z.id === 'registratie');
      assert.deepEqual(fuse.dekt, ['/api/auth/register'], 'de zekering zegt dat hij alleen de route dekt');
      assert.match(fuse.uitleg, /SCIM vallen er NIET onder/);

      /* 6. besluit EN zekering: allebei in het antwoord, en na de reset nog dicht */
      const z = await post(srv.base, '/api/techniek/zekering', { id: 'registratie', actie: 'spring', reden: 'proef' }, eig.body.token);
      assert.equal(z.status, 200);
      const beide = await post(srv.base, '/api/auth/register', nieuw());
      assert.equal(beide.status, 503);
      assert.deepEqual(beide.body.reden, ['besluit', 'zekering']);
      await post(srv.base, '/api/techniek/zekering', { id: 'registratie', actie: 'reset' }, eig.body.token);
      const naReset = await post(srv.base, '/api/auth/register', nieuw());
      assert.equal(naReset.status, 503, 'een reset van de zekering heropent niets');
      assert.deepEqual(naReset.body.reden, ['besluit']);
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
      assert.deepEqual(d.body.reden, ['zekering']);
      assert.match(String(d.body.hoe), /FUSE-REG/);
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

test('5. de vlag faalt dicht: alleen leeg en 0 zijn open', () => {
  const r = require('../server/accounts/registratie');
  /* [waarde, dicht, waarschuwing] */
  const tabel = [
    [undefined, false, false], ['', false, false], ['   ', false, false],
    ['0', false, false], [' 0 ', false, false], ['0 # open sinds #587', false, false],
    ['1', true, false], [' 1 ', true, false], ['1 # dicht tot #587', true, false],
    ['true', true, true], ['TRUE', true, true], ['yes', true, true], ['on', true, true],
    ['ja', true, true], ['01', true, true], ['false', true, true], ['nee', true, true],
    ['#1', true, true], ['00', true, true], ['2', true, true]
  ];
  for (const [w, dicht, waarsch] of tabel) {
    const env = w === undefined ? {} : { [VLAG]: w };
    assert.equal(r.dicht(env), dicht, JSON.stringify(w) + ' hoort ' + (dicht ? 'dicht' : 'open') + ' te zijn');
    assert.equal(r.onbekend(env), waarsch, JSON.stringify(w) + ': waarschuwing ' + waarsch);
    const ws = []; r.keur(env, ws);
    assert.equal(ws.length, waarsch ? 1 : 0);
  }
  /* en via de echte configuratiekeuring, die bij het opstarten logt */
  const config = require('../server/config');
  const v = config.valideer({ [VLAG]: 'true' });
  assert.ok(v.waarschuwingen.some(w => w.startsWith(VLAG + '="true"') && /DICHT/.test(w)), 'config.valideer waarschuwt');
  assert.ok(!config.valideer({ [VLAG]: '1' }).waarschuwingen.some(w => w.startsWith(VLAG)), '1 is bekend');
  /* en de accountlaag leest dezelfde regel */
  const oud = process.env[VLAG];
  try {
    process.env[VLAG] = 'true';
    assert.throws(() => r.eisOpen(), e => e.code === 'REGISTRATIE_DICHT' && /RTG_REGISTRATIE_DICHT/.test(e.hoe));
  } finally { if (oud === undefined) delete process.env[VLAG]; else process.env[VLAG] = oud; }
});

test('6b. de weigering noemt alle redenen die gelden', () => {
  const r = require('../server/accounts/registratie');
  assert.equal(r.weigering(false, {}), null);
  assert.deepEqual(r.weigering(true, {}).reden, ['zekering']);
  assert.deepEqual(r.weigering(false, { [VLAG]: '1' }).reden, ['besluit']);
  const beide = r.weigering(true, { [VLAG]: 'ja' });
  assert.deepEqual(beide.reden, ['besluit', 'zekering']);
  assert.match(beide.hoe, /RTG_REGISTRATIE_DICHT/);
  assert.match(beide.hoe, /FUSE-REG/);
});

test('7. het eigenaarsscript maakt het eigenaarsaccount ook met de vlag aan', () => {
  const { execFileSync } = require('node:child_process');
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regdicht-eig-'));
  try {
    let tekst = '', code = 0;
    try {
      tekst = execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'eigenaar-aanmaken.js'),
        '--maak', '--naam=Proef Eigenaar', '--geboren=1990-01-31'], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, RTG_DATA_DIR: TMP, NODE_ENV: '', DATABASE_URL: '', PG_URL: '', [VLAG]: '1' }
      });
    } catch (e) { code = e.status == null ? 1 : e.status; tekst = String(e.stdout || '') + String(e.stderr || ''); }
    assert.equal(code, 0, tekst);
    assert.match(tekst, /AANGEMAAKT/);
    assert.match(tekst, /geldt niet voor dit eigenaarsscript/);
    assert.doesNotMatch(tekst, /tweede schrijver/);
  } finally { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } }
});

test('7b. de ongegrendelde schrijver is van geen route te bereiken', () => {
  const ROOT = path.join(__dirname, '..');
  const accounts = require('../server/accounts');
  const users = require('../server/accounts/users');
  assert.notEqual(accounts.createUser, users.createUser, 'de gevel draagt de gegrendelde createUser');
  assert.notEqual(accounts.createUserSync, users.createUserSync);
  const laadtUsers = /require\(\s*['"][^'"]*accounts\/users(\.js)?['"]\s*\)/;
  const buiten = [];
  const loop = (dir) => {
    for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, n.name);
      if (n.isDirectory()) { if (n.name !== 'node_modules' && n.name !== 'data') loop(f); continue; }
      if (!/\.js$/.test(n.name)) continue;
      const rel = path.relative(ROOT, f).split(path.sep).join('/');
      if (rel.startsWith('server/accounts/')) continue;
      if (laadtUsers.test(fs.readFileSync(f, 'utf8'))) buiten.push(rel);
    }
  };
  loop(path.join(ROOT, 'server')); loop(path.join(ROOT, 'scripts'));
  assert.deepEqual(buiten, ['scripts/eigenaar-aanmaken.js'],
    'alleen het offline eigenaarsscript mag de grendel omzeilen; gevonden: ' + buiten.join(', '));
});

test('8. SSO noemt een dichte registratie in plaats van een kale 401', () => {
  const { foutAntwoord } = require('../server/sso/binnenkomst');
  const r = require('../server/accounts/registratie');
  const oud = process.env[VLAG];
  let fout;
  try { process.env[VLAG] = '1'; try { r.eisOpen(); } catch (e) { fout = e; } }
  finally { if (oud === undefined) delete process.env[VLAG]; else process.env[VLAG] = oud; }
  const a = foutAntwoord(fout);
  assert.equal(a.status, 503);
  assert.equal(a.code, 'REGISTRATIE_DICHT');
  assert.match(a.bericht, /registraties zijn gesloten/);
  assert.equal(foutAntwoord(new Error('verkeerd domein')).status, 401, 'een gewone weigering blijft een 401');
});
