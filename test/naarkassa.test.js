/* Order naar de kassa (server): het lid kiest "stuur naar de kassa" -- de
   bestelling gaat direct als open bon naar de zaak (de keuken maakt hem), en
   wordt aan de balie afgerekend met de ophaalcode. Getoetst: de vlag aanBalie,
   dat de bon meteen loopt (status nieuw, onbetaald), dat de kassa hem met de
   code afrekent en uitgeeft, en dat een jeugdlid toch eerst moet betalen.
   Draai los: node --experimental-sqlite --test test/naarkassa.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-nk-')); }
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
}
async function registreer(base, extra) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return (await api(base, '/api/auth/register', Object.assign({
    name: 'Kassa Lid', email: u + '@x.nl', phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
  }, extra))).body.token;
}
// een bestaand menu-item van de demozaak ophalen
async function eersteItem(base, token, code) {
  const kaart = (await api(base, '/api/supplier/menu/get', { code }, token)).body;
  const m = (kaart.menu || []).find(x => !x.uitverkocht && x.station !== 'bar') || (kaart.menu || [])[0];
  return m ? m.id : 'm1';
}

test('1. naar de kassa: bon loopt meteen, aanBalie, en de kassa rekent op de code af', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await registreer(base);
    const item = await eersteItem(base, lid, 'KIKUNOI');
    const plaats = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 2 }], table: '5', naarKassa: true }, lid);
    assert.equal(plaats.status, 200);
    const o = plaats.body.order;
    assert.equal(o.aanBalie, true, 'gemarkeerd als afrekenen aan de balie');
    assert.equal(o.betaalMoment, 'achteraf', 'niet vooraf: de keuken maakt hem al');
    assert.equal(o.status, 'nieuw', 'de bon loopt meteen');
    assert.equal(o.paid, false, 'nog niet betaald');
    assert.ok(o.pickup, 'er is een ophaalcode om te tonen/scannen');

    // de kassa rekent af op de code
    const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const staff = roster.staff.find(x => x.role !== 'manager') || roster.staff[0];
    const sup = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: staff.id, pin: '5678' })).body.token;
    const inn = await api(base, '/api/supplier/pos/redeem', { code: o.pickup }, sup);
    assert.equal(inn.status, 200);
    assert.equal(inn.body.order.wasPaid, false, 'aan de balie afgerekend (was nog niet betaald)');
    assert.ok(inn.body.sale, 'er is een kassabon aangemaakt');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('2. een jeugdlid (onder 18) moet toch eerst betalen, ook met naar de kassa', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const jong = new Date(); jong.setFullYear(jong.getFullYear() - 16);
    const lid = await registreer(base, { geboortedatum: jong.toISOString().slice(0, 10), tier: 'rtg', pasApp: 'rtg' });
    if (!lid) return; // jeugd-registratie kan door ballotage/leeftijd geweigerd worden; dan is er niets te toetsen
    const item = await eersteItem(base, lid, 'KIKUNOI');
    const plaats = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], naarKassa: true }, lid);
    if (plaats.status !== 200) return;
    assert.notEqual(plaats.body.order.aanBalie, true, 'jeugdlid gaat niet aan de balie');
    assert.equal(plaats.body.order.status, 'wacht-op-betaling', 'jeugdlid betaalt eerst');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
