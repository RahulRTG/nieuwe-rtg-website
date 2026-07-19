/* De RTG Mall (kern/mall.js): de luxe shoppingmall in de leden-app. De mall
   stelt zich samen uit de retail-partners, verdeeld over etages; de
   demo-boutieks vullen de etages, en elke boutique opent haar catalogus.
   Draai: npm test */
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
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mall-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Shop', email: 's' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  lid = { token: reg.body.token };
});
test.after(() => stop(srv && srv.child));

test('1. de mall toont etages met boutieks; alleen na inlog', async () => {
  assert.equal((await api(base, '/api/mall', {}, null)).status, 401);
  const r = await api(base, '/api/mall', {}, lid.token);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.etages) && r.body.etages.length >= 2, 'er zijn meerdere etages');
  const ids = r.body.etages.map(e => e.id);
  for (const id of ['mode', 'sieraden', 'leer']) assert.ok(ids.includes(id), 'etage ' + id + ' is gevuld');
  const boutieks = r.body.etages.flatMap(e => e.boutieks);
  assert.ok(boutieks.every(b => b.code && b.naam && b.tagline), 'elke boutique heeft naam en tagline');
  assert.ok(boutieks.some(b => b.vanaf > 0), 'ten minste een boutique toont een vanaf-prijs');
});

test('2. een boutique uit de mall opent haar catalogus met ledenprijzen', async () => {
  const r = await api(base, '/api/mall', {}, lid.token);
  const sieraden = r.body.etages.find(e => e.id === 'sieraden');
  const orfevre = sieraden.boutieks.find(b => b.code === 'ORFEVRE');
  assert.ok(orfevre, 'Maison Orfevre staat op de sieraden-etage');
  const cat = await api(base, '/api/retail/catalogus', { supplierCode: 'ORFEVRE' }, lid.token);
  assert.equal(cat.status, 200);
  assert.ok(cat.body.artikelen.length >= 2, 'de boutique heeft artikelen');
  assert.ok(cat.body.artikelen.every(a => a.publiekePrijs > 0), 'met een prijs');
});

test('3. verlanglijst werkt vanuit de mall-boutique', async () => {
  const cat = await api(base, '/api/retail/catalogus', { supplierCode: 'CUIRHUIS' }, lid.token);
  const tas = cat.body.artikelen.find(a => a.naam === 'Weekendtas');
  assert.ok(tas, 'de weekendtas staat in de catalogus');
  const wl = await api(base, '/api/retail/wishlist', { supplierCode: 'CUIRHUIS', artikelId: tas.id }, lid.token);
  assert.equal(wl.status, 200);
  assert.equal(wl.body.wishlist, true, 'het stuk staat nu op de verlanglijst');
});
