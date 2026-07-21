/* Tafelticket: de bonnen van dezelfde tafel op EEN gezegeld ticket, en in EEN
   keer afrekenen aan de kassa. Getoetst: het samenvoegen (uitsplitsing per gast
   + totaal + zegel), en de ingebouwde beveiliging: een verkeerd/gemanipuleerd
   zegel wordt geweigerd, een gewijzigde rekening (extra ronde) wordt geweigerd,
   en na afrekenen staat er niets meer open (geen dubbel afrekenen). Bonnen van
   een andere tafel of andere zaak komen er nooit in.
   Draai los: node --experimental-sqlite --test test/tafelticket.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tt-')); }
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
}
async function registreer(base) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return (await api(base, '/api/auth/register', {
    name: 'Tafel Lid', email: u + '@x.nl', phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
  })).body.token;
}
async function eersteItem(base, token, code) {
  const kaart = (await api(base, '/api/supplier/menu/get', { code }, token)).body;
  const m = (kaart.menu || []).find(x => !x.uitverkocht && x.station !== 'bar') || (kaart.menu || [])[0];
  return m ? m.id : 'm1';
}
async function zaakInlog(base, code) {
  const roster = (await api(base, '/api/supplier/roster', { code })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  const tokMgr = (await api(base, '/api/supplier/login', { code, staffId: mgr.id, pin: '1234' })).body.token;
  await api(base, '/api/supplier/settings', { code, opties: { betaalVooraf: false } }, tokMgr);
  // vloerpersoneel voor de kassa/bediening (pin 5678)
  const st = roster.staff.find(x => x.role !== 'manager') || mgr;
  const tokStaff = (await api(base, '/api/supplier/login', { code, staffId: st.id, pin: st.role === 'manager' ? '1234' : '5678' })).body.token;
  return tokStaff;
}

test('1. bonnen van dezelfde tafel op een ticket, en in een keer afrekenen', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const zaak = await zaakInlog(base, 'KIKUNOI');
    const a = await registreer(base), b = await registreer(base);
    const item = await eersteItem(base, a, 'KIKUNOI');
    // twee gasten aan tafel 7, en eentje aan tafel 5 (die mag er nooit in)
    const o1 = (await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], table: '7' }, a)).body.order;
    const o2 = (await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 2 }], table: '7' }, b)).body.order;
    await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], table: '5' }, a);

    // het ticket voor tafel 7: twee bonnen, twee gasten, opgeteld, met zegel
    const t = await api(base, '/api/supplier/tafelticket', { table: '7' }, zaak);
    assert.equal(t.status, 200);
    const tk = t.body.ticket;
    assert.equal(tk.aantalBonnen, 2, 'beide bonnen van tafel 7');
    assert.equal(tk.aantalGasten, 2, 'twee gasten');
    assert.equal(tk.subtotaal, o1.total + o2.total, 'het totaal klopt');
    assert.ok(tk.zegel && typeof tk.zegel === 'string', 'er is een zegel');
    assert.equal(Object.keys(tk.perGast).length, 2, 'uitsplitsing per gast');

    // beveiliging 1: een gemanipuleerd zegel wordt geweigerd
    const nep = await api(base, '/api/supplier/tafelticket/afrekenen', { table: '7', zegel: tk.zegel + 'x', at: tk.at }, zaak);
    assert.equal(nep.status, 409, 'gemanipuleerd zegel geweigerd');

    // beveiliging 2: rekening gewijzigd (extra ronde erbij) -> oud zegel klopt niet meer
    await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], table: '7' }, a);
    const oud = await api(base, '/api/supplier/tafelticket/afrekenen', { table: '7', zegel: tk.zegel, at: tk.at }, zaak);
    assert.equal(oud.status, 409, 'afrekenen op een verouderd totaal geweigerd');

    // vers ticket ophalen (nu 3 bonnen) en correct afrekenen
    const t2 = (await api(base, '/api/supplier/tafelticket', { table: '7' }, zaak)).body.ticket;
    assert.equal(t2.aantalBonnen, 3);
    const af = await api(base, '/api/supplier/tafelticket/afrekenen', { table: '7', zegel: t2.zegel, at: t2.at, method: 'contant' }, zaak);
    assert.equal(af.status, 200, 'met het verse zegel lukt afrekenen');
    assert.equal(af.body.aantalBonnen, 3);
    assert.ok(af.body.sale, 'een gebundelde kassabon');

    // na afrekenen: niets meer open, en niet nog eens afrekenen
    const leeg = await api(base, '/api/supplier/tafelticket', { table: '7' }, zaak);
    assert.equal(leeg.status, 404, 'geen open bonnen meer aan tafel 7');
    // de bonnen van het lid staan nu op betaald
    const mijnA = (await api(base, '/api/orders/mine', {}, a)).body.orders.filter(o => o.table === '7');
    assert.ok(mijnA.length && mijnA.every(o => o.paid), 'de tafel-7-bonnen van het lid zijn betaald');
    // de bon aan tafel 5 loopt gewoon nog (niet meegenomen)
    const t5 = (await api(base, '/api/orders/mine', {}, a)).body.orders.find(o => o.table === '5');
    assert.ok(t5 && !t5.paid, 'de andere tafel bleef onaangeroerd');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('2. een lege tafel geeft geen ticket, en een andere zaak ziet deze bonnen niet', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const kiku = await zaakInlog(base, 'KIKUNOI');
    const lid = await registreer(base);
    const item = await eersteItem(base, lid, 'KIKUNOI');
    await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], table: '7' }, lid);

    // lege tafel: geen ticket
    const leeg = await api(base, '/api/supplier/tafelticket', { table: '99' }, kiku);
    assert.equal(leeg.status, 404);

    // een andere zaak ziet de bonnen van KIKUNOI niet aan haar eigen tafel 7
    const vora = await zaakInlog(base, 'VORA');
    const ander = await api(base, '/api/supplier/tafelticket', { table: '7' }, vora);
    assert.equal(ander.status, 404, 'geen bonnen bij de andere zaak');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
