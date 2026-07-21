/* "De rekening" (betalen na het eten): een zaak die achteraf laat betalen laat
   het lid tijdens het bezoek meerdere rondes bestellen; aan het eind worden alle
   lopende bonnen als een rekening opgeteld en in een keer afgerekend, met een
   fooi over het geheel. Getoetst: /api/rekening telt de open bonnen op, en
   /api/rekening/betaal zet ze allemaal op betaald met de fooi op de rekening.
   Aan-de-balie-bonnen tellen niet mee (die gaan langs de kassa).
   Draai los: node --experimental-sqlite --test test/rekening.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rek-')); }
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
}
async function registreer(base) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return (await api(base, '/api/auth/register', {
    name: 'Rekening Lid', email: u + '@x.nl', phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
  })).body.token;
}
async function eersteItem(base, token, code) {
  const kaart = (await api(base, '/api/supplier/menu/get', { code }, token)).body;
  const m = (kaart.menu || []).find(x => !x.uitverkocht && x.station !== 'bar') || (kaart.menu || [])[0];
  return m ? m.id : 'm1';
}
// zet de zaak op "achteraf betalen" via de eigenaar/manager
async function zetAchteraf(base, code) {
  const roster = (await api(base, '/api/supplier/roster', { code })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  const tok = (await api(base, '/api/supplier/login', { code, staffId: mgr.id, pin: '1234' })).body.token;
  await api(base, '/api/supplier/settings', { code, opties: { betaalVooraf: false } }, tok);
  return tok;
}

test('1. twee rondes lopen; de rekening telt ze op en rekent in een keer af', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    await zetAchteraf(base, 'KIKUNOI');
    const lid = await registreer(base);
    const item = await eersteItem(base, lid, 'KIKUNOI');

    // eerste ronde
    const r1 = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], table: '7' }, lid);
    assert.equal(r1.status, 200);
    assert.equal(r1.body.order.betaalMoment, 'achteraf', 'de zaak laat achteraf betalen');
    assert.equal(r1.body.order.paid, false);
    // tweede ronde
    const r2 = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 2 }], table: '7' }, lid);
    assert.equal(r2.status, 200);
    const som = r1.body.order.total + r2.body.order.total;

    // de rekening opvragen: beide bonnen erin, opgeteld
    const rek = await api(base, '/api/rekening', { supplierCode: 'KIKUNOI' }, lid);
    assert.equal(rek.status, 200);
    assert.equal(rek.body.rekening.aantal, 2, 'beide lopende bonnen staan op de rekening');
    assert.equal(rek.body.rekening.subtotaal, som, 'het totaal klopt');

    // in een keer afrekenen met fooi
    const bet = await api(base, '/api/rekening/betaal', { supplierCode: 'KIKUNOI', fooi: 5 }, lid);
    assert.equal(bet.status, 200);
    assert.equal(bet.body.rekening.aantal, 2);
    assert.equal(bet.body.rekening.subtotaal, som);
    assert.equal(bet.body.rekening.fooi, 5, 'de fooi zit op de rekening');
    assert.equal(bet.body.rekening.betaald, som + 5);

    // beide bonnen staan nu op betaald; er staat geen rekening meer open
    const mijn = (await api(base, '/api/orders/mine', {}, lid)).body.orders;
    const bijZaak = mijn.filter(o => o.supplierCode === 'KIKUNOI');
    assert.ok(bijZaak.length >= 2 && bijZaak.every(o => o.paid), 'alle bonnen bij de zaak zijn betaald');
    const rek2 = await api(base, '/api/rekening', { supplierCode: 'KIKUNOI' }, lid);
    assert.equal(rek2.body.rekening.aantal, 0, 'geen open rekening meer');
    // nogmaals betalen kan niet: er staat niets open
    const nogmaals = await api(base, '/api/rekening/betaal', { supplierCode: 'KIKUNOI' }, lid);
    assert.equal(nogmaals.status, 404);
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('2. een aan-de-balie-bon telt niet mee in de rekening (die gaat langs de kassa)', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    await zetAchteraf(base, 'KIKUNOI');
    const lid = await registreer(base);
    const item = await eersteItem(base, lid, 'KIKUNOI');
    // een gewone achteraf-bon en een aan-de-balie-bon
    await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }] }, lid);
    await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], naarKassa: true }, lid);
    const rek = await api(base, '/api/rekening', { supplierCode: 'KIKUNOI' }, lid);
    assert.equal(rek.body.rekening.aantal, 1, 'alleen de gewone achteraf-bon staat op de rekening');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
