'use strict';
/* Echte bestaande lifecycle-route en SQLite. Een lokale klokherstart laat de
   bestaande termijn verstrijken; geen verkorte termijn of nieuwe exitrol. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop } = require('./helper');
const { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tenantreis-lifecycle-'));
let srv, x, werkruimte, beheerToken, org;
const env = { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' };
test.before(async () => {
  srv = await startServer({ env }); x = await maakReisketenFixture(srv.base); org = x.bureau.org;
  goed(await x.api('/api/reisbureau/keten/start', { supplierCode: x.bureau.code,
    titel: 'Bewaarproef', bestemming: 'Lokale contractproef', idem: 'tenantreis-bewaar-start' }, x.reiziger.token), 'reis');
  const w = goed(await x.api('/api/bedrijf/werkruimte/maak', { naam: 'Werkruimte vertrekproef' }), 'werkruimte');
  werkruimte = w.werkruimte; beheerToken = w.beheerToken;
  goed(await x.api('/api/techniek/tenant/bind', { org, soort: 'werkruimte', code: werkruimte }, x.tech), 'binding');
  goed(await x.api('/api/techniek/tenant/levensloop', { org, naar: 'opzegging', reden: 'Lokale vertrekproef' }, x.tech), 'opzegging');
  goed(await x.api('/api/techniek/tenant/levensloop', { org, naar: 'bewaring', reden: 'Lokale bewaarfase', bewaardagen: 30 }, x.tech), 'bewaring');
  const u = goed(await x.api('/api/tenant/export', { werkruimte, beheerToken }), 'bestaande uitgang met geldige beheersessie');
  assert.equal(u.status, 'gedeeltelijk'); assert.equal(u.inhoud.reisarchief, undefined);
  assert.equal(u.inhoud.reisketenUitgang.volledigeTenantexport, false);
  await stop(srv); srv = null;
  srv = await startServer({ env: { ...env, RTG_KLOK: '+31d' } });
});
test.after(async () => { if (srv) await stop(srv); fs.rmSync(map, { recursive: true, force: true }); });
async function api(pad, body, token) {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
test('na echte bewaringstermijn weigert vernietiging niet-gedekte reisdata zonder nieuwe toegang of gedeeltelijke verwijdering', async () => {
  const login = goed(await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' }), 'nieuwe eigenaarsessie');
  const tech = login.token, kv = new DatabaseSync(path.join(map, 'store.db'), { readOnly: true });
  try {
    const snapshot = () => kv.prepare("SELECT key,val,ver,deleted FROM kv WHERE key IN ('werkruimtes','reisAanvragen','tenants') ORDER BY key").all();
    const voor = snapshot();
    const r = await api('/api/techniek/tenant/vernietig', { org }, tech);
    assert.equal(r.status, 409); assert.match(r.body.error, /federatieve reishistorie/);
    assert.deepEqual(snapshot(), voor, 'geen verwijdering, nieuwe termijn of lifecyclewijziging');
    const stand = goed(await api('/api/techniek/tenant/levensloop', { org }, tech), 'blijvende bewaring');
    assert.equal(stand.levensloop.stand, 'bewaring'); assert.deepEqual(stand.levensloop.mag, []);
    assert.equal((await api('/api/tenant/export', { werkruimte, beheerToken })).status, 403,
      'de na 31 dagen verlopen beheersessie wordt niet door de vernietigingsblokkade hersteld');
    assert.notEqual((await api('/api/supplier/reisbureau/keten', { vorm: 'uitvoer' }, x.bureau.token)).status, 200,
      'de blokkade herleeft geen oude persoonlijke reisexport');
  } finally { kv.close(); }
});
