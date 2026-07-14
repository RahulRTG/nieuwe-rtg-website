/* 5-sterren autoverkoop bovenop het verhuurbedrijf: een exclusieve showroom,
   proefrit op afspraak, kopen met bod + inruil + concierge-aflevering, en een
   digitaal koopcontract. Draai: npm test */
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

let srv, base, dealer, lid;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-av-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'ISLAREN' } });
  base = srv.base;
  dealer = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Auto Lid', email: 'a' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. de zaak heeft een verkoopafdeling met showroom (demo)', async () => {
  const o = await api(base, '/api/supplier/verkoop/overzicht', {}, dealer);
  assert.equal(o.status, 200);
  assert.equal(o.body.aan, true);
  assert.ok(o.body.showroom.length >= 4, 'gevulde showroom');
});

test('2. het lid ziet de showroom, VIP eerst, met aanbevelingen', async () => {
  const s = await api(base, '/api/verkoop/showroom', {}, lid);
  assert.ok(s.body.autos.length >= 4);
  assert.equal(s.body.autos[0].vip, true, 'een exclusief stuk staat bovenaan');
  assert.ok(s.body.aanbevolen.length >= 1, 'slimme aanbevelingen');
  // filter op elektrisch
  const el = await api(base, '/api/verkoop/showroom', { brandstof: 'Elektrisch' }, lid);
  assert.ok(el.body.autos.every(a => a.brandstof === 'Elektrisch'), 'filter werkt');
});

test('3. proefrit aanvragen, de zaak plant hem in en rondt af', async () => {
  const sr = await api(base, '/api/verkoop/showroom', {}, lid);
  const auto = sr.body.autos[0];
  const pr = await api(base, '/api/verkoop/proefrit', { supplierCode: auto.supplierCode, autoId: auto.id, wens: 'Graag zaterdag' }, lid);
  assert.equal(pr.status, 200);
  const ref = pr.body.deal.ref;
  const plan = await api(base, '/api/supplier/verkoop/deal', { ref, actie: 'plan', moment: 'za 10:00' }, dealer);
  assert.equal(plan.body.status, 'ingepland');
  const gereden = await api(base, '/api/supplier/verkoop/deal', { ref, actie: 'gereden' }, dealer);
  assert.equal(gereden.body.status, 'gereden');
});

test('4. kopen met bod + inruil + concierge, contract tekenen en afleveren', async () => {
  const sr = await api(base, '/api/verkoop/showroom', {}, lid);
  const golf = sr.body.autos.find(a => /Golf/.test(a.naam)) || sr.body.autos[sr.body.autos.length - 1];
  const koop = await api(base, '/api/verkoop/koop', { supplierCode: golf.supplierCode, autoId: golf.id,
    bod: golf.prijs - 1500, inruil: { merk: 'Seat', model: 'Ibiza', jaar: 2016, km: 120000 }, concierge: true, adres: 'Villa 3, Ibiza' }, lid);
  assert.equal(koop.status, 200);
  const ref = koop.body.deal.ref;
  assert.ok(koop.body.deal.contract.includes('koopovereenkomst'), 'er is een koopcontract');
  // de auto is nu gereserveerd, niet meer in de vrije showroom
  const sr2 = await api(base, '/api/verkoop/showroom', {}, lid);
  assert.ok(!sr2.body.autos.some(a => a.id === golf.id), 'gekozen auto is gereserveerd');
  // de zaak aanvaardt met een tegenbod en taxeert de inruil
  const aanv = await api(base, '/api/supplier/verkoop/deal', { ref, actie: 'aanvaard', prijs: golf.prijs - 1000, taxatie: 4500 }, dealer);
  assert.equal(aanv.body.status, 'aanvaard');
  // tekenen kan pas na aanvaarden
  const teken = await api(base, '/api/verkoop/teken', { ref, naam: 'Auto Lid' }, lid);
  assert.equal(teken.body.status, 'getekend');
  // afleveren
  const afg = await api(base, '/api/supplier/verkoop/deal', { ref, actie: 'afgeleverd' }, dealer);
  assert.equal(afg.body.status, 'afgeleverd');
  // en de auto is verkocht
  const mijn = await api(base, '/api/verkoop/mijn', {}, lid);
  assert.equal(mijn.body.deals.find(d => d.ref === ref).status, 'afgeleverd');
});

test('5. de zaak voegt een auto toe aan de showroom', async () => {
  const add = await api(base, '/api/supplier/verkoop/auto', { merk: 'Audi', model: 'RS6 Avant', jaar: 2023, km: 15000, prijs: 129000, brandstof: 'Benzine', vip: true }, dealer);
  assert.equal(add.status, 200);
  const o = await api(base, '/api/supplier/verkoop/overzicht', {}, dealer);
  assert.ok(o.body.showroom.some(a => /RS6/.test(a.naam)), 'de nieuwe auto staat in de showroom');
});
