/* Aanwezigheid (server): elke receptie/entree telt hoeveel mensen er binnen zijn
   en de verdeling man/vrouw. Alleen geaggregeerd -- nooit per persoon. Getoetst:
   optellen en aftrekken per groep, het totaal, niet onder nul, de teller legen,
   en dat het alleen met een leverancier-login mag.
   Draai los: node --experimental-sqlite --test test/aanwezig.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aw-')); }
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
}

test('1. tellen: op- en aftellen per groep, totaal, niet onder nul, en legen', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const staff = roster.staff.find(x => x.role !== 'manager') || roster.staff[0];
    const sup = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: staff.id, pin: '5678' })).body.token;
    assert.ok(sup, 'leverancier ingelogd');

    let r = await api(base, '/api/supplier/aanwezig', {}, sup);
    assert.deepEqual({ m: r.body.aanwezig.man, v: r.body.aanwezig.vrouw, o: r.body.aanwezig.onbekend, b: r.body.aanwezig.binnen }, { m: 0, v: 0, o: 0, b: 0 }, 'begint op nul');

    for (let i = 0; i < 3; i++) await api(base, '/api/supplier/aanwezig/pas', { groep: 'man', delta: 1 }, sup);
    for (let i = 0; i < 2; i++) await api(base, '/api/supplier/aanwezig/pas', { groep: 'vrouw', delta: 1 }, sup);
    r = await api(base, '/api/supplier/aanwezig/pas', { groep: 'onbekend', delta: 1 }, sup);
    assert.equal(r.body.aanwezig.man, 3);
    assert.equal(r.body.aanwezig.vrouw, 2);
    assert.equal(r.body.aanwezig.onbekend, 1);
    assert.equal(r.body.aanwezig.binnen, 6, 'totaal binnen = 6');

    r = await api(base, '/api/supplier/aanwezig/pas', { groep: 'man', delta: -1 }, sup);
    assert.equal(r.body.aanwezig.man, 2, 'man weer af');
    assert.equal(r.body.aanwezig.binnen, 5);

    // niet onder nul
    for (let i = 0; i < 5; i++) r = await api(base, '/api/supplier/aanwezig/pas', { groep: 'onbekend', delta: -1 }, sup);
    assert.equal(r.body.aanwezig.onbekend, 0, 'blijft op nul, niet negatief');

    // ongeldige groep
    const fout = await api(base, '/api/supplier/aanwezig/pas', { groep: 'x', delta: 1 }, sup);
    assert.equal(fout.status, 400);

    // legen
    r = await api(base, '/api/supplier/aanwezig/leeg', {}, sup);
    assert.equal(r.body.aanwezig.binnen, 0, 'na legen is alles nul');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('2. zonder leverancier-login mag het niet', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    assert.equal((await api(base, '/api/supplier/aanwezig', {}, null)).status, 401);
    assert.equal((await api(base, '/api/supplier/aanwezig/pas', { groep: 'man', delta: 1 }, null)).status, 401);
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
