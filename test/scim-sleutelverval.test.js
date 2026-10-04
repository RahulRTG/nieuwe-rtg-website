/* De SCIM-sleutel vervalt (CODECREDENTIALS.json, identity.scim_bearer_sleutel;
   server/scim/sleutels.js, migratie 11).

   Een sleutel met de volledige provisioning- en uitdienstmacht over een tenant
   geldt standaard 90 dagen, nooit langer dan 365, en een rij van voor de
   kolom vervalt op de legacydatum. Wat hier moet kunnen zakken:
   1. draaien zet een vervaldatum (standaard en gekozen), een ongeldige telling
      wordt geweigerd;
   2. een verlopen sleutel opent de SCIM-deur niet meer;
   3. een legacyrij (vervalt_at leeg) werkt tot LEGACY_TOT en niet langer;
   4. over HTTP: de eigenaar krijgt de vervaldatum mee, een ongeldige telling is
      400, en het antwoord gaat geen cache in.

   MUTATIES (LAT.md regel 2), elk gedraaid en gezakt:
   - vanSleutel(): de regel `if (!(Date.parse(vervaltVan(r)) > Date.now()))` weg -> toets 2 en 3 zakken
   - geldigheid(): de bovengrens weg -> toets 1 en 4 zakken
   - vervaltVan(): `|| LEGACY_TOT` weg (leeg = nooit) -> toets 3 zakt

   Draai los: node --test test/scim-sleutelverval.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scimverval-'));
process.env.RTG_DATA_DIR = TMP;
const accounts = require('../server/accounts');
accounts.init();
const scim = require('../server/scim');
const S = require('../server/accounts/state');
const { startServer, stop } = require('./helper');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
const DAG = 86400000;
const zet = (org, waarde) => S.db.prepare('UPDATE scim_sleutels SET vervalt_at = ? WHERE org = ?').run(waarde, org);

test('1. draaien zet een vervaldatum, en een ongeldige telling wordt geweigerd', () => {
  const t0 = Date.now();
  const s = scim.sleutels.draai('verval-a');
  assert.ok(Math.abs(Date.parse(s.vervalt) - (t0 + 90 * DAG)) < 60000, 'standaard 90 dagen');
  const k = scim.sleutels.draai('verval-a', { dagen: 30 });
  assert.ok(Math.abs(Date.parse(k.vervalt) - (t0 + 30 * DAG)) < 60000);
  for (const fout of [0, 366, 2.5, 'lang'])
    assert.throws(() => scim.sleutels.draai('verval-a', { dagen: fout }), e => e.status === 400, 'dagen ' + fout);
  assert.equal(scim.sleutels.vanSleutel(k.sleutel), 'verval-a', 'de ongeldige pogingen lieten de sleutel staan');
  const st = scim.sleutels.stand('verval-a');
  assert.equal(st.vervalt_at, k.vervalt);
  assert.equal(st.legacy, false);
  assert.equal(st.doel, 'scim-provisioning');
});

test('2. een verlopen sleutel opent de SCIM-deur niet meer', () => {
  const s = scim.sleutels.draai('verval-b', { dagen: 1 });
  assert.equal(scim.sleutels.vanSleutel(s.sleutel), 'verval-b');
  zet('verval-b', new Date(Date.now() - 1000).toISOString());
  assert.equal(scim.sleutels.vanSleutel(s.sleutel), null);
});

test('3. een rij van voor de kolom werkt tot de legacydatum en niet langer', () => {
  const s = scim.sleutels.draai('verval-c');
  zet('verval-c', null);
  const st = scim.sleutels.stand('verval-c');
  assert.equal(st.legacy, true);
  assert.equal(st.vervalt_at, scim.sleutels.LEGACY_TOT);
  const echt = Date.now;
  try {
    Date.now = () => Date.parse(scim.sleutels.LEGACY_TOT) - DAG;
    assert.equal(scim.sleutels.vanSleutel(s.sleutel), 'verval-c', 'een werkende IdP breekt niet vandaag');
    Date.now = () => Date.parse(scim.sleutels.LEGACY_TOT) + 1000;
    assert.equal(scim.sleutels.vanSleutel(s.sleutel), null, 'maar niet na de legacydatum');
  } finally { Date.now = echt; }
});

test('4. over HTTP: de vervaldatum gaat mee, een ongeldige telling is 400, en er komt niets in een cache', async () => {
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scimverval-srv-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: DIR, RTG_OWNER_EMAIL: '' } });
  const post = (pad, body, tok) => fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body || {}) })
    .then(async x => ({ status: x.status, koppen: x.headers, body: await x.json().catch(() => ({})) }));
  try {
    const eig = (await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
    assert.ok(eig);
    assert.equal((await post('/api/techniek/sso', { org: 'verval', naam: 'Verval BV', issuer: 'https://idp.verval.test',
      clientId: 'c', domeinen: ['verval.test'], actief: true }, eig)).status, 200);
    assert.equal((await post('/api/techniek/sso/scimsleutel', { org: 'verval', dagen: 999 }, eig)).status, 400);
    const r = await post('/api/techniek/sso/scimsleutel', { org: 'verval', dagen: 60 }, eig);
    assert.equal(r.status, 200);
    assert.match(r.koppen.get('cache-control') || '', /no-store/);
    assert.ok(Date.parse(r.body.vervalt) <= Date.now() + 61 * DAG, 'de vervaldatum gaat mee');
    const deur = await fetch(srv.base + '/api/scim/v2/Users', { headers: { authorization: 'Bearer ' + r.body.sleutel } });
    assert.equal(deur.status, 200, 'de sleutel opent de SCIM-deur');
  } finally { stop(srv.child); try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) {} }
});
