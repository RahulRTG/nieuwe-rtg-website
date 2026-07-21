/* De App-Bibliotheek: 20.000 professionele apps in de Mall, elk rond de
   duizend euro winkelwaarde, voor leden inbegrepen (prijs 0). De catalogus
   wordt deterministisch samengesteld; alleen installaties worden bewaard.
   Draai los: node --experimental-sqlite --test test/appbieb.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appbieb-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api(base, '/api/auth/register', { name: 'App Liefhebber', email: 'apps@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'lid-registratie geeft een token');
});
test.after(() => stop(srv && srv.child));

test('1. de bibliotheek telt exact 20.000 apps, verdeeld over 20 categorieën', async () => {
  const r = await api(base, '/api/mall/apps', {}, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.totaal, 20000);
  assert.equal(r.body.categorieen.length, 20);
  assert.equal(r.body.categorieen.reduce((n, c) => n + c.aantal, 0), 20000);
});

test('2. elke app kost in de winkel rond de duizend euro; voor leden altijd 0', async () => {
  const p1 = await api(base, '/api/mall/apps/catalogus', { pagina: 1 }, lid);
  const p417 = await api(base, '/api/mall/apps/catalogus', { pagina: 417 }, lid);
  for (const a of [...p1.body.items, ...p417.body.items]) {
    assert.ok(a.winkelwaardeCenten >= 75000 && a.winkelwaardeCenten <= 130000, a.naam + ': winkelwaarde rond de duizend euro (nu ' + a.winkelwaardeCenten + ')');
    assert.equal(a.ledenprijsCenten, 0, 'inbegrepen bij de pas');
  }
  // de totale winkelwaarde klopt met "20.000 x ~duizend euro"
  const o = await api(base, '/api/mall/apps', {}, lid);
  assert.ok(o.body.totaleWinkelwaardeCenten > 20000 * 90000 && o.body.totaleWinkelwaardeCenten < 20000 * 110000,
    'totale winkelwaarde rond de 20 miljoen euro (nu ' + o.body.totaleWinkelwaardeCenten + ')');
});

test('3. de catalogus is deterministisch en gepagineerd: dezelfde pagina geeft dezelfde apps', async () => {
  const a = await api(base, '/api/mall/apps/catalogus', { categorie: 'ontwerp', pagina: 3 }, lid);
  const b = await api(base, '/api/mall/apps/catalogus', { categorie: 'ontwerp', pagina: 3 }, lid);
  assert.deepEqual(a.body.items.map(x => x.id), b.body.items.map(x => x.id));
  assert.equal(a.body.totaal, 1000, 'een categorie telt duizend apps');
  for (const x of a.body.items) assert.equal(x.categorie, 'ontwerp');
});

test('4. zoeken op naam vindt apps, ook binnen een categorie', async () => {
  const r = await api(base, '/api/mall/apps/catalogus', { zoek: 'atlas' }, lid);
  assert.ok(r.body.totaal > 0, 'de zoekterm vindt apps');
  for (const a of r.body.items) assert.match(a.naam.toLowerCase(), /atlas/);
  const rc = await api(base, '/api/mall/apps/catalogus', { zoek: 'atlas', categorie: 'juridisch' }, lid);
  for (const a of rc.body.items) assert.equal(a.categorie, 'juridisch');
});

test('5. installeren en verwijderen: idempotent, bewaard per lid, met een harde grens', async () => {
  const eerste = (await api(base, '/api/mall/apps/catalogus', { categorie: 'data', pagina: 1 }, lid)).body.items[0];
  const r1 = await api(base, '/api/mall/apps/installeer', { id: eerste.id }, lid);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.aantal, 1);
  const r2 = await api(base, '/api/mall/apps/installeer', { id: eerste.id }, lid);
  assert.ok(r2.body.alGeinstalleerd, 'twee keer drukken installeert niet dubbel');
  const mijn = await api(base, '/api/mall/apps/mijn', {}, lid);
  assert.equal(mijn.body.apps.length, 1);
  assert.equal(mijn.body.apps[0].id, eerste.id);
  const weg = await api(base, '/api/mall/apps/weg', { id: eerste.id }, lid);
  assert.equal(weg.body.aantal, 0);
  assert.equal((await api(base, '/api/mall/apps/installeer', { id: 'app-99999' }, lid)).status, 404, 'buiten de bibliotheek bestaat niets');
});

test('6. zonder inlog blijft de bibliotheek dicht', async () => {
  assert.equal((await api(base, '/api/mall/apps', {})).status, 401);
  assert.equal((await api(base, '/api/mall/apps/installeer', { id: 'app-1' })).status, 401);
});
