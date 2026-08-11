/* De maandfactuur betalen uit het eigen RTG Pay-saldo (/api/pay/saldo,
   kern/factuursaldo.js): de derde betaalweg naast kaart en munten. De
   afschrijving loopt via pay.huisIn (autolaad inbegrepen, idempotent) en de
   afwikkeling via DEZELFDE settleFactuur als de kaart- en muntweg -- de
   factuur gaat pas op betaald als het hele bedrag er is, en een tweede
   poging kaatst af.
   Draai los: node --experimental-sqlite --test test/factuursaldo.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-factuursaldo-'));
let srv, base, lid, factuur, bedragCenten;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const invoicesVan = async () => ((await api('/api/state', {}, lid)).body.state || {}).invoices || [];

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' } });
  base = srv.base;
  const reg = await api('/api/auth/register', { name: 'Saldo Lid', email: 'saldo@x.nl', phone: '0655544332',
    password: 'geheim123', geboortedatum: '1985-03-03', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'het lid is ingelogd');
  // Een gratis RTG-lid toont eenmalig zijn paspoort voor het RTG Pay gebruikt
  // (de payGate). Echte preconditie; de minimale schone PNG passeert de scanner.
  const PNG = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString('base64');
  await api('/api/verify/upload', { image: PNG }, lid);
  await api('/api/verify/selfie', { image: PNG }, lid);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. er staat een open maandfactuur klaar', async () => {
  const open = (await invoicesVan()).filter(i => i.status === 'open');
  assert.ok(open.length >= 1, 'het nieuwe lid heeft een open factuur');
  factuur = open[0];
  bedragCenten = Math.round((factuur.bijdrage || 0) * 100);
  assert.ok(bedragCenten > 0, 'de maandbijdrage is een echt bedrag');
});

test('2. betalen uit saldo: lege wallet laadt bij, exact het bedrag gaat eraf', async () => {
  const r = await api('/api/pay/saldo', { invoiceId: factuur.id }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.betaald, bedragCenten);
  // de wallet was leeg: de autolaad (stappen van 10 euro) dekt het bedrag
  assert.ok(r.body.bijgeladen >= bedragCenten, 'de autolaad dekte het bedrag');
  const o = await api('/api/pay/overzicht', {}, lid);
  assert.equal(o.body.saldo, r.body.bijgeladen - bedragCenten, 'het saldo klopt op de cent');
});

test('3. de factuur staat op betaald, langs de gedeelde afwikkeling', async () => {
  const inv = (await invoicesVan()).find(i => i.id === factuur.id);
  assert.ok(inv, 'de factuur bestaat nog');
  assert.equal(inv.status, 'paid');
});

test('4. een tweede poging op dezelfde factuur kaatst af', async () => {
  const r = await api('/api/pay/saldo', { invoiceId: factuur.id }, lid);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /al betaald/i);
});

test('5. een onbestaande factuur is een nette 404', async () => {
  const r = await api('/api/pay/saldo', { invoiceId: 'RTG-0000-XXXX' }, lid);
  assert.equal(r.status, 404);
});

test('6. zonder inlog komt er niets door de deur', async () => {
  const r = await api('/api/pay/saldo', { invoiceId: factuur.id });
  assert.equal(r.status, 401);
});
