/* De housekeeper-flow: kamerstatus in een tik per stap, en de nieuwe
   vrijgave voor vroege check-in (de overschot-techniek voor het hotel):
   alleen een schone kamer kan vrij, en elke andere status haalt de
   vrijgave vanzelf weg.
   Draai: node --experimental-sqlite --test test/housekeeping.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-hk-'));
let child, hkToken;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = await json(await api('/api/supplier/roster', { code: 'HOSHI' }));
  const hk = roster.staff.find(x => x.role !== 'manager') || roster.staff[0];
  const pin = hk.role === 'manager' ? '1234' : '5678';
  hkToken = (await json(await api('/api/supplier/login', { code: 'HOSHI', staffId: hk.id, pin }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('kamerflow: vuil -> bezig -> schoon, een tik per stap', async () => {
  for (const status of ['vuil', 'bezig', 'schoon']) {
    const r = await json(await api('/api/supplier/room/hk', { id: 'r1', status }, hkToken));
    assert.equal(r.rooms.find(x => x.id === 'r1').hk.status, status);
  }
});

test('vroege check-in: alleen een schone kamer kan vrij, en de receptie ziet het', async () => {
  // r1 is schoon (vorige test): vrijgeven lukt
  const v = await json(await api('/api/supplier/room/vrij', { id: 'r1' }, hkToken));
  const r1 = v.rooms.find(x => x.id === 'r1');
  assert.ok(r1.vroegVrij && r1.vroegVrij.door, 'vrijgegeven met naam van de housekeeper');
  // de hele zaak ziet het in de state (receptie, hotel-app, PDA)
  const st = await json(await api('/api/supplier/state', {}, hkToken));
  assert.ok(st.state.rooms.find(x => x.id === 'r1').vroegVrij);
  // een vuile kamer vrijgeven wordt geweigerd
  await api('/api/supplier/room/hk', { id: 'r2', status: 'vuil' }, hkToken);
  assert.equal((await api('/api/supplier/room/vrij', { id: 'r2' }, hkToken)).status, 409);
});

test('de vrijgave verdwijnt vanzelf zodra de kamer niet meer schoon is (check-out)', async () => {
  const r = await json(await api('/api/supplier/room/hk', { id: 'r1', status: 'vuil' }, hkToken));
  assert.equal(r.rooms.find(x => x.id === 'r1').vroegVrij, undefined);
});

test('intrekken kan ook met de hand, en een onbekende kamer wordt geweigerd', async () => {
  await api('/api/supplier/room/hk', { id: 'r1', status: 'schoon' }, hkToken);
  await api('/api/supplier/room/vrij', { id: 'r1' }, hkToken);
  const weg = await json(await api('/api/supplier/room/vrij', { id: 'r1', op: false }, hkToken));
  assert.equal(weg.rooms.find(x => x.id === 'r1').vroegVrij, undefined);
  assert.equal((await api('/api/supplier/room/vrij', { id: 'nee' }, hkToken)).status, 404);
});
