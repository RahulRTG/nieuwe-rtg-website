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

let srv, base, lid, office;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mall-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-MALL-1' } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Shop', email: 's' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  lid = { token: reg.body.token };
  const login = await api(base, '/api/office/login', { code: 'KANTOOR-MALL-1' });
  office = login.body.token;
});
test.after(() => stop(srv && srv.child));

test('1. de mall toont etages met boutieks; alleen na inlog', async () => {
  assert.equal((await api(base, '/api/mall', {}, null)).status, 401);
  const r = await api(base, '/api/mall', {}, lid.token);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.etages) && r.body.etages.length >= 3, 'er zijn meerdere etages');
  const ids = r.body.etages.map(e => e.id);
  for (const id of ['eigen', 'mode', 'sieraden', 'leer']) assert.ok(ids.includes(id), 'etage ' + id + ' is gevuld');
  assert.equal(ids[0], 'eigen', 'het RTG eigen-merk staat vooraan');
  const boutieks = r.body.etages.flatMap(e => e.boutieks);
  assert.ok(boutieks.every(b => b.code && b.naam && b.tagline), 'elke boutique heeft naam en tagline');
  assert.ok(boutieks.some(b => b.vanaf > 0), 'ten minste een boutique toont een vanaf-prijs');
});

test('1b. het RTG eigen-merk heeft een catalogus en is direct te bestellen', async () => {
  const cat = await api(base, '/api/mall/eigen', {}, lid.token);
  assert.equal(cat.status, 200);
  assert.ok(cat.body.producten.length >= 5, 'de vaste hardware staat erin');
  assert.ok(cat.body.producten.some(p => p.slug === 'zaakdoos'), 'de Zaakdoos hoort erbij');
  const best = await api(base, '/api/mall/bestel', { slug: 'rtg-pda', naam: 'Sam', email: 'sam@x.nl', aantal: 2 }, lid.token);
  assert.equal(best.status, 200);
  assert.equal(best.body.bestelling.aantal, 2);
  assert.equal(best.body.bestelling.prijs.valuta, 'EUR');
  // zonder e-mail mag het niet, en een dubbele open bestelling wordt geweigerd
  assert.equal((await api(base, '/api/mall/bestel', { slug: 'rtg-pda', naam: 'Sam' }, lid.token)).status, 400);
  assert.equal((await api(base, '/api/mall/bestel', { slug: 'rtg-pda', naam: 'Sam', email: 'sam@x.nl' }, lid.token)).status, 409);
  assert.equal((await api(base, '/api/mall/bestel', { slug: 'bestaat-niet', naam: 'Sam', email: 'sam@x.nl' }, lid.token)).status, 400);
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

test('1c. de etage Van het land: een boerderij met producten, direct te bestellen', async () => {
  const r = await api(base, '/api/mall', {}, lid.token);
  const land = r.body.etages.find(e => e.id === 'land');
  assert.ok(land, 'de etage Van het land is gevuld');
  const hoeve = land.boutieks.find(b => b.code === 'HOEVE' && b.kind === 'farm');
  assert.ok(hoeve, 'de demo-boerderij staat erop');
  const cat = await api(base, '/api/mall/land', { code: 'HOEVE' }, lid.token);
  assert.equal(cat.status, 200);
  assert.ok(cat.body.producten.length >= 2, 'de boerderij heeft producten te koop');
  const olie = cat.body.producten.find(p => /Olijfolie/.test(p.naam));
  const voor = olie.voorraad;
  const best = await api(base, '/api/mall/land-bestel', { code: 'HOEVE', productId: olie.id, naam: 'Sam', email: 'sam@x.nl', aantal: 2 }, lid.token);
  assert.equal(best.status, 200);
  assert.equal(best.body.bestelling.restVoorraad, voor - 2, 'de voorraad daalt');
  // meer bestellen dan er is, kan niet (het groentepakket heeft weinig voorraad)
  const pakket = cat.body.producten.find(p => /Groentepakket/.test(p.naam));
  assert.equal((await api(base, '/api/mall/land-bestel', { code: 'HOEVE', productId: pakket.id, naam: 'Sam', email: 'sam@x.nl', aantal: pakket.voorraad + 5 }, lid.token)).status, 409);
});

test('4. de gids toont alle leveranciers per genre, met een diepe link', async () => {
  const r = await api(base, '/api/mall', {}, lid.token);
  assert.ok(Array.isArray(r.body.gids) && r.body.gids.length >= 5, 'de gids groepeert per genre');
  const rest = r.body.gids.find(g => g.type === 'restaurant');
  assert.ok(rest && rest.leveranciers.length >= 1, 'restaurants staan in de gids');
  assert.equal(rest.pagina, '/apps/foodcourt.html', 'de gids wijst naar de Food Court');
  assert.equal(rest.boekbaar, true, 'restaurants zijn boekbaar via een pagina');
  const hotel = r.body.gids.find(g => g.type === 'hotel');
  assert.equal(hotel.pagina, '/apps/hotels.html', 'hotels wijzen naar Verblijven');
  const bar = r.body.gids.find(g => g.type === 'bar');
  assert.equal(bar.pagina, '/apps/uitgaan.html', 'bars wijzen naar Uitgaan');
});

test('5. het kantoor kan een leverancier verbergen; die valt uit de gids', async () => {
  assert.ok(office, 'het kantoor is ingelogd');
  const beheer = await api(base, '/api/office/mall', {}, office);
  assert.equal(beheer.status, 200);
  assert.ok(beheer.body.leveranciers.length >= 3, 'het kantoor ziet de mall-partners');
  // pak een restaurant en verberg het
  const rst = beheer.body.leveranciers.find(l => l.type === 'restaurant');
  assert.ok(rst, 'er is een restaurant om te verbergen');
  const zet = await api(base, '/api/office/mall/zet', { code: rst.code, patch: { verborgen: true } }, office);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.leverancier.verborgen, true);
  // het lid ziet het niet meer in de gids
  const na = await api(base, '/api/mall', {}, lid.token);
  const rest = na.body.gids.find(g => g.type === 'restaurant');
  assert.ok(!rest || !rest.leveranciers.some(l => l.code === rst.code), 'de verborgen partner is weg uit de gids');
  // weer tonen
  const terug = await api(base, '/api/office/mall/zet', { code: rst.code, patch: { verborgen: false } }, office);
  assert.equal(terug.body.leverancier.verborgen, false);
  // zonder office-inlog is beheer dicht
  assert.equal((await api(base, '/api/office/mall', {}, null)).status, 401);
});

test('6. het kantoor verplaatst een retail-boutique naar een andere etage', async () => {
  const zet = await api(base, '/api/office/mall/zet', { code: 'ORFEVRE', patch: { etage: 'wonen', tagline: 'Test tagline' } }, office);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.leverancier.etage, 'wonen');
  const r = await api(base, '/api/mall', {}, lid.token);
  const wonen = r.body.etages.find(e => e.id === 'wonen');
  assert.ok(wonen && wonen.boutieks.some(b => b.code === 'ORFEVRE'), 'de boutique staat nu op de wonen-etage');
  // terug naar sieraden
  await api(base, '/api/office/mall/zet', { code: 'ORFEVRE', patch: { etage: 'sieraden' } }, office);
});

test('3. verlanglijst werkt vanuit de mall-boutique', async () => {
  const cat = await api(base, '/api/retail/catalogus', { supplierCode: 'CUIRHUIS' }, lid.token);
  const tas = cat.body.artikelen.find(a => a.naam === 'Weekendtas');
  assert.ok(tas, 'de weekendtas staat in de catalogus');
  const wl = await api(base, '/api/retail/wishlist', { supplierCode: 'CUIRHUIS', artikelId: tas.id }, lid.token);
  assert.equal(wl.status, 200);
  assert.equal(wl.body.wishlist, true, 'het stuk staat nu op de verlanglijst');
});
