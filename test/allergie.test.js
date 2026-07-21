/* Allergieveiligheid bij het bestellen (server): staat er een allergeen in het
   gedeelde zorgprofiel van het lid dat botst met een gerecht, dan houdt de
   /api/order-route dat gerecht tegen (409, met allergieBotsing). Het lid kan
   het bewust doorzetten met allergieAkkoord. Zonder delen-toestemming reist het
   profiel niet mee en wordt er niets tegengehouden (privacy by design).
   Omdat de menukaart, de kassa EN Rahul allemaal dezelfde /api/order roepen,
   weigeren die allemaal automatisch hetzelfde botsende gerecht.
   Draai los: node --experimental-sqlite --test test/allergie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-alg-')); }
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
}
async function registreer(base) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return (await api(base, '/api/auth/register', {
    name: 'Allergie Lid', email: u + '@x.nl', phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
  })).body.token;
}
// vind een gerecht (geen bar) met een bepaald allergeen en eentje zonder
async function menuVan(base, token, code) {
  const kaart = (await api(base, '/api/supplier/menu/get', { code }, token)).body;
  return kaart.menu || [];
}

test('1. botsend gerecht wordt tegengehouden, doorzetten mag met allergieAkkoord', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await registreer(base);
    const menu = await menuVan(base, lid, 'KIKUNOI');
    const metVis = menu.find(m => (m.allergens || []).includes('vis') && m.station !== 'bar');
    const zonder = menu.find(m => !(m.allergens || []).length && m.station !== 'bar');
    assert.ok(metVis && zonder, 'demozaak heeft een gerecht met vis en eentje zonder allergenen');

    // zorgprofiel met visallergie, en delen aan (anders reist het niet mee)
    const zet = await api(base, '/api/zorgprofiel/zet', { allergenen: ['vis'], delen: true }, lid);
    assert.equal(zet.status, 200);

    // bestellen van het visgerecht botst: 409 met de botsers erbij
    const bots = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: metVis.id, qty: 1 }] }, lid);
    assert.equal(bots.status, 409, 'het botsende gerecht wordt geweigerd');
    assert.ok(Array.isArray(bots.body.allergieBotsing), 'de botsers reizen mee');
    assert.equal(bots.body.allergieBotsing[0].id, metVis.id);
    assert.ok(bots.body.allergieBotsing[0].allergenen.includes('vis'));

    // een gerecht zonder botsend allergeen mag gewoon
    const ok = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: zonder.id, qty: 1 }] }, lid);
    assert.equal(ok.status, 200, 'een veilig gerecht gaat gewoon door');

    // bewust doorzetten: met allergieAkkoord mag het toch
    const toch = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: metVis.id, qty: 1 }], allergieAkkoord: true }, lid);
    assert.equal(toch.status, 200, 'met bewuste bevestiging mag het alsnog');
    assert.equal(toch.body.order.allergieAkkoord, true);
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('2. zonder delen-toestemming reist het profiel niet mee en wordt niets tegengehouden', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await registreer(base);
    const menu = await menuVan(base, lid, 'KIKUNOI');
    const metVis = menu.find(m => (m.allergens || []).includes('vis') && m.station !== 'bar');
    assert.ok(metVis, 'demozaak heeft een visgerecht');

    // wel een visallergie, maar delen staat uit: privacy by design, niets reist mee
    await api(base, '/api/zorgprofiel/zet', { allergenen: ['vis'], delen: false }, lid);
    const res = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: metVis.id, qty: 1 }] }, lid);
    assert.equal(res.status, 200, 'zonder delen wordt er niets geblokkeerd');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
