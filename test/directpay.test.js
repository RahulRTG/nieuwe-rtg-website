/* Rechtstreeks betalen van klant naar leverancier, met Face ID, via de AI en de
   Salon. Het lid betaalt zelf of rekent een betaalverzoek van de partner af; het
   geld gaat rechtstreeks naar de leverancier (ontvangst-teller). Veilig: bedrag
   begrensd, idempotent (geen dubbele afschrijving), verzoek op codenaam.
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

let srv, base, winkel, lid, codename;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dp-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'MAISON' } });
  base = srv.base;
  winkel = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Betaal Lid', email: 'p' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. het lid betaalt een leverancier rechtstreeks; de ontvangst-teller loopt op', async () => {
  const r = await api(base, '/api/betaal/direct', { supplierCode: 'MAISON', bedrag: 45, omschrijving: 'Styling-advies', bron: 'salon' }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.betaling.bedrag, 4500, 'bedrag in centen');
  codename = r.body.betaling.codename;
  const ont = await api(base, '/api/supplier/ontvangsten', {}, winkel);
  assert.equal(ont.body.som, 4500, 'de leverancier ontving het geld rechtstreeks');
  assert.equal(ont.body.aantal, 1);
});

test('2. idempotent: dezelfde idem-sleutel schrijft niet dubbel af', async () => {
  const idem = 'once-' + Date.now();
  const a = await api(base, '/api/betaal/direct', { supplierCode: 'MAISON', bedrag: 20, idem }, lid);
  const b = await api(base, '/api/betaal/direct', { supplierCode: 'MAISON', bedrag: 20, idem }, lid);
  assert.equal(a.body.betaling.ref, b.body.betaling.ref, 'zelfde betaling terug');
  const ont = await api(base, '/api/supplier/ontvangsten', {}, winkel);
  assert.equal(ont.body.som, 4500 + 2000, 'maar een keer geteld');
});

test('3. een te laag bedrag wordt geweigerd', async () => {
  const r = await api(base, '/api/betaal/direct', { supplierCode: 'MAISON', bedrag: 0.2 }, lid);
  assert.equal(r.status, 400);
});

test('4. de partner stuurt een betaalverzoek op codenaam; het lid ziet het en betaalt', async () => {
  const mk = await api(base, '/api/supplier/betaalverzoek', { codename, bedrag: 120, omschrijving: 'Zijden jurk' }, winkel);
  assert.equal(mk.status, 200);
  const ref = mk.body.verzoek.ref;
  const lijst = await api(base, '/api/betaal/verzoeken', {}, lid);
  assert.ok(lijst.body.verzoeken.some(v => v.ref === ref), 'het verzoek staat klaar voor het lid');
  const pay = await api(base, '/api/betaal/verzoek/pay', { ref }, lid);
  assert.equal(pay.status, 200);
  assert.equal(pay.body.betaling.bedrag, 12000);
  const ont = await api(base, '/api/supplier/ontvangsten', {}, winkel);
  assert.equal(ont.body.som, 6500 + 12000, 'het verzoekbedrag kwam er rechtstreeks bij');
  // een betaald verzoek staat niet meer open
  const lijst2 = await api(base, '/api/betaal/verzoeken', {}, lid);
  assert.ok(!lijst2.body.verzoeken.some(v => v.ref === ref), 'niet meer open');
});

test('5. een betaalverzoek twee keer afrekenen kan niet dubbel', async () => {
  const mk = await api(base, '/api/supplier/betaalverzoek', { codename, bedrag: 30 }, winkel);
  const ref = mk.body.verzoek.ref;
  await api(base, '/api/betaal/verzoek/pay', { ref }, lid);
  const tweede = await api(base, '/api/betaal/verzoek/pay', { ref }, lid);
  assert.equal(tweede.status, 200, 'tweede keer geeft de bestaande betaling terug');
  const ont = await api(base, '/api/supplier/ontvangsten', {}, winkel);
  assert.equal(ont.body.som, 18500 + 3000, 'maar een keer bijgeteld');
});

test('6. de betaalgeschiedenis van het lid toont de betalingen', async () => {
  const mijn = await api(base, '/api/betaal/mijn', {}, lid);
  assert.ok(mijn.body.betalingen.length >= 3, 'het lid ziet zijn eigen betalingen');
  assert.ok(mijn.body.betalingen.every(b => b.supplierName === 'Maison Solène'));
});
