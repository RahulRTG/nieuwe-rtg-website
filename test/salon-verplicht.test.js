/* De Salon is verplicht: elke leverancier doet marketing, producten en folders
   via De Salon. Een partner zonder compleet profiel (bio + foto) wordt niet aan
   leden getoond en kan niets publiceren. Folders zijn een eigen berichttype, en
   elke partner heeft een publieke Salon-etalage. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const FOTO = 'data:image/jpeg;base64,' + Buffer.from('demo-salon-foto').toString('base64');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, brand, lid, office;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-salon-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
  brand = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Salon Lid', email: 's' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  lid = reg.body.token;
});
test.after(() => stop(srv && srv.child));

test('1. geseede partners hebben een compleet Salon-profiel en zijn zichtbaar', async () => {
  const st = await api(base, '/api/supplier/salon/status', {}, brand);
  assert.equal(st.body.compleet, true, 'het demo-modehuis is compleet (bio + foto geseed)');
  const dir = await api(base, '/api/suppliers', { city: 'Ibiza' }, lid);
  assert.ok(dir.body.suppliers.length >= 1, 'zichtbare partners in de directory');
  assert.ok(dir.body.suppliers.every(s => s.code), 'directory geeft partners terug');
});

test('2. een partner zonder profiel wordt niet getoond en kan niet publiceren', async () => {
  // maak het profiel onvolledig door de bio te wissen
  await api(base, '/api/supplier/salon/bio', { bio: '' }, brand);
  const st = await api(base, '/api/supplier/salon/status', {}, brand);
  assert.equal(st.body.compleet, false, 'zonder bio is het profiel onvolledig');
  // niet meer in de directory
  const dir = await api(base, '/api/suppliers', { city: 'Ibiza' }, lid);
  assert.ok(!dir.body.suppliers.some(s => s.code === 'KIKUNOI'), 'onvolledige partner is verborgen');
  // publiceren mag niet
  const post = await api(base, '/api/supplier/salon/post', { text: 'Marketingbericht' }, brand);
  assert.equal(post.status, 409, 'publiceren zonder profiel wordt geweigerd');
});

test('3. profiel invullen (bio + foto) maakt de partner weer zichtbaar', async () => {
  const bio = await api(base, '/api/supplier/salon/bio', { bio: 'Fijn dineren met een verrassend seizoensmenu.', foto: FOTO }, brand);
  assert.equal(bio.body.compleet, true, 'met bio + foto is het profiel compleet');
  const dir = await api(base, '/api/suppliers', { city: 'Ibiza' }, lid);
  assert.ok(dir.body.suppliers.some(s => s.code === 'KIKUNOI'), 'weer zichtbaar in de directory');
});

test('4. een folder plaatsen (digitale brochure met foto en producten)', async () => {
  const r = await api(base, '/api/supplier/salon/folder', {
    titel: 'Zomerkaart', tekst: 'Onze zomerse hoogtepunten',
    fotos: [FOTO],
    items: [{ naam: 'Tonijn tataki', prijs: 24, tekst: 'met sesam' }, { naam: 'Zeebaars', prijs: 32 }]
  }, brand);
  assert.equal(r.status, 200, 'de folder is geplaatst');
  // de folder verschijnt in de leden-Salon (via /api/state) met titel en items
  const st = await api(base, '/api/state', {}, lid);
  const folderPost = (st.body.state.posts || []).find(p => p.folder && p.folder.titel === 'Zomerkaart');
  assert.ok(folderPost, 'de folder staat in de Salon-tijdlijn van het lid');
  assert.equal(folderPost.folder.items.length, 2, 'de producten staan erin');
});

test('5. de publieke Salon-etalage toont bio, folders en de volgknop', async () => {
  const p = await api(base, '/api/salon/profiel', { code: 'KIKUNOI' }, lid);
  assert.equal(p.status, 200);
  assert.ok(p.body.partner.bio.length >= 15, 'de bio staat op de etalage');
  assert.ok(p.body.items.some(x => x.soort === 'folder'), 'de folder staat op de etalage');
  // volgen werkt vanaf de etalage
  const volg = await api(base, '/api/salon/volg', { code: 'KIKUNOI' }, lid);
  assert.equal(volg.body.volgIk, true);
});

test('6. RTG-kantoor ziet de nalevingslijst', async () => {
  const n = await api(base, '/api/office/salon-naleving', {}, office);
  assert.equal(n.status, 200);
  assert.ok(n.body.totaal >= 1 && typeof n.body.compleet === 'number', 'telling van complete profielen');
  assert.ok(Array.isArray(n.body.partners), 'lijst van partners met naleving');
});
