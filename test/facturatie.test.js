/* De centrale facturatielaag (kern/facturatie.js): bij elke verkoop krijgt zowel
   de verkoper als de koper automatisch dezelfde factuur in de app; de PDF is te
   downloaden; en de AI-factuurtool maakt in gewone taal een factuur. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token, raw) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => raw ? { status: r.status, buf: Buffer.from(await r.arrayBuffer()), ct: r.headers.get('content-type') } : ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, sup, lid, codenaam;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-fact-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
  sup = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Koper', email: 'k' + u + '@x.nl', phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  codenaam = (await api(base, '/api/state', {}, lid)).body.state.user.codename;
});
test.after(() => stop(srv && srv.child));

test('1. een kassaverkoop op codenaam factureert automatisch beide partijen', async () => {
  const sale = await api(base, '/api/supplier/pos/sale', { total: 24.20, method: 'pin', codenaam, items: [{ name: 'Ramen', qty: 2, price: 12.10 }] }, sup);
  assert.equal(sale.status, 200);
  // verkoper ziet de factuur als "verkocht"
  const supF = (await api(base, '/api/supplier/facturen/mijn', {}, sup)).body;
  assert.ok(supF.verkocht.length >= 1, 'de zaak heeft een verkoopfactuur');
  const f = supF.verkocht[0];
  assert.ok(/^RTG-\d{4}-\d{6}$/.test(f.nummer), 'net factuurnummer');
  assert.ok(Math.abs(f.totaal - 24.20) < 0.01, 'totaal klopt');
  assert.ok(f.btwBedrag > 0, 'btw is teruggerekend');
  // koper (lid) ziet dezelfde factuur
  const lidF = (await api(base, '/api/facturen/mijn', {}, lid)).body;
  assert.equal(lidF.telling, 1, 'het lid heeft EGn factuur ontvangen');
  assert.equal(lidF.facturen[0].nummer, f.nummer, 'beide partijen zien hetzelfde factuurnummer');
});

test('2. de factuur is als PDF te downloaden door beide partijen', async () => {
  const supF = (await api(base, '/api/supplier/facturen/mijn', {}, sup)).body;
  const id = supF.verkocht[0].id;
  const p1 = await api(base, '/api/supplier/facturen/pdf', { id }, sup, true);
  assert.equal(p1.ct, 'application/pdf');
  assert.ok(p1.buf.slice(0, 5).toString() === '%PDF-', 'geldige PDF voor de verkoper');
  const p2 = await api(base, '/api/facturen/pdf', { id }, lid, true);
  assert.ok(p2.buf.slice(0, 5).toString() === '%PDF-', 'geldige PDF voor de koper');
});

test('3. een anonieme kassaverkoop factureert alleen de zaak (geen lid gekoppeld)', async () => {
  const voor = (await api(base, '/api/facturen/mijn', {}, lid)).body.telling;
  await api(base, '/api/supplier/pos/sale', { total: 8, method: 'contant', desc: 'Koffie' }, sup);
  const na = (await api(base, '/api/facturen/mijn', {}, lid)).body.telling;
  assert.equal(na, voor, 'het lid krijgt niets bij een anonieme verkoop');
  const supF = (await api(base, '/api/supplier/facturen/mijn', {}, sup)).body;
  assert.ok(supF.verkocht.some(f => f.koper === 'Kasklant'), 'de zaak heeft wel een bon (Kasklant)');
});

test('4. de AI-factuurtool maakt in gewone taal een dienstfactuur', async () => {
  const r = await api(base, '/api/supplier/facturen/ai', { opdracht: 'maak een factuur voor ' + codenaam + ', 3 uur advies a 90 euro' }, sup);
  assert.equal(r.status, 200);
  assert.equal(r.body.gedaan, true, 'de AI maakte de factuur');
  // die komt binnen bij het lid
  const lidF = (await api(base, '/api/facturen/mijn', {}, lid)).body;
  assert.ok(lidF.facturen.some(f => f.totaal >= 90), 'het lid ontving de dienstfactuur');
});

test('5. de AI beantwoordt een vraag over de facturen', async () => {
  const r = await api(base, '/api/supplier/facturen/ai', { opdracht: 'hoeveel heb ik gefactureerd?' }, sup);
  assert.ok(/factuur|omzet|EUR/i.test(r.body.antwoord), 'geeft een zinnig antwoord met cijfers');
});
