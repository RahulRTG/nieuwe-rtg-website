/* De algemene pin: een pincode van het lid die prive-apps beschermt en
   waarmee de werk-apps op het OS openen. Getoetst: instellen, controleren,
   het slot tegen raden, wijzigen alleen met de oude pin, en de echte tanden:
   is de pin gezet, dan munt /api/account/start GEEN werksessie meer zonder
   geldige pin (het ene account = bevoegdheid, de pin = bewijs).
   Draai los: node --experimental-sqlite --test test/algpin.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
}

test('algemene pin: instellen, bewijzen, en de werk-app-poort', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pin-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const u = Date.now().toString(36);
    const lid = (await api(base, '/api/auth/register', { name: 'Pin Lid', email: u + '@x.nl', phone: '0611111112', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;

    // nog geen pin: status zegt dat eerlijk, en check is dan een no-op
    assert.equal((await api(base, '/api/pin/status', {}, lid)).body.gezet, false);
    assert.equal((await api(base, '/api/pin/check', { pin: '0000' }, lid)).body.gezet, false, 'zonder pin valt er niets te bewijzen');

    // instellen, fout bewijzen (401), goed bewijzen (200)
    assert.equal((await api(base, '/api/pin/zet', { pin: '246810' }, lid)).status, 200);
    assert.equal((await api(base, '/api/pin/zet', { pin: '13579' }, lid)).status, 401, 'wijzigen kan alleen met de oude pin');
    assert.equal((await api(base, '/api/pin/check', { pin: '111111' }, lid)).status, 401);
    assert.equal((await api(base, '/api/pin/check', { pin: '246810' }, lid)).status, 200);
    assert.equal((await api(base, '/api/pin/zet', { pin: '13579', oud: '246810' }, lid)).status, 200, 'met de oude pin wijzigt hij wel');

    // de tanden: personeelsrol koppelen en dan een werksessie proberen
    const staf = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body.staff;
    const wie = staf.find(x => x.role !== 'manager');
    assert.equal((await api(base, '/api/account/koppel', { soort: 'personeel', code: 'KIKUNOI', staffId: wie.id, pin: '5678' }, lid)).status, 200);
    const zonder = await api(base, '/api/account/start', { rol: 'personeel', code: 'KIKUNOI', staffId: wie.id }, lid);
    assert.equal(zonder.status, 401, 'pin gezet = geen werksessie zonder pin');
    assert.equal(zonder.body.pinNodig, true, 'de app weet dat hij om de pin moet vragen');
    const fout = await api(base, '/api/account/start', { rol: 'personeel', code: 'KIKUNOI', staffId: wie.id, pin: '999999' }, lid);
    assert.equal(fout.status, 401, 'een foute pin opent niets');
    const goed = await api(base, '/api/account/start', { rol: 'personeel', code: 'KIKUNOI', staffId: wie.id, pin: '13579' }, lid);
    assert.equal(goed.status, 200, 'bevoegdheid + pin = de werksessie');
    assert.ok(goed.body.token);
  } finally {
    await stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
