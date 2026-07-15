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
let child, hkToken, managerToken, hkId, managerId;

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
  const man = roster.staff.find(x => x.role === 'manager');
  hkId = hk.id; managerId = man.id;
  const pin = hk.role === 'manager' ? '1234' : '5678';
  hkToken = (await json(await api('/api/supplier/login', { code: 'HOSHI', staffId: hk.id, pin }))).token;
  managerToken = (await json(await api('/api/supplier/login', { code: 'HOSHI', staffId: man.id, pin: '1234' }))).token;
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

test('bellen: alleen ingeklokte collega’s zijn bereikbaar', async () => {
  // de manager is nog niet ingeklokt: bellen wordt netjes geweigerd
  const dicht = await api('/api/staff/bel', { staffId: managerId }, hkToken);
  assert.equal(dicht.status, 409);
  // de manager klokt in via de app en is dan bereikbaar
  await api('/api/staff/clock', {}, managerToken);
  const open = await api('/api/staff/bel', { staffId: managerId }, hkToken);
  assert.equal(open.status, 200);
  // jezelf bellen kan niet; het antwoord-kanaal werkt
  assert.equal((await api('/api/staff/bel', { staffId: hkId }, hkToken)).status, 400);
  assert.equal((await api('/api/staff/bel/antwoord', { vanId: hkId, akkoord: true }, managerToken)).status, 200);
});

test('urenoverzicht: de zaak ziet precies wie wanneer en hoelang werkt (alleen management)', async () => {
  // de medewerker klokt in; het overzicht toont beide stempels
  await api('/api/staff/clock', {}, hkToken);
  const o = await json(await api('/api/staff/klok/overzicht', {}, managerToken));
  const rijHk = o.rows.find(r => r.id === hkId);
  const rijMan = o.rows.find(r => r.id === managerId);
  assert.ok(rijHk.binnen && rijHk.laatsteIn, 'de medewerker staat als binnen met een stempel');
  assert.ok(rijMan.binnen, 'de manager staat als binnen');
  assert.ok(typeof rijHk.vandaagUren === 'number' && typeof rijHk.weekUren === 'number');
  // een gewone medewerker mag het overzicht niet zien
  assert.equal((await api('/api/staff/klok/overzicht', {}, hkToken)).status, 403);
  // uitklokken: het overzicht volgt direct
  await api('/api/staff/clock', {}, hkToken);
  const o2 = await json(await api('/api/staff/klok/overzicht', {}, managerToken));
  assert.equal(o2.rows.find(r => r.id === hkId).binnen, false);
  assert.ok(o2.rows.find(r => r.id === hkId).laatsteUit, 'de uit-stempel staat erbij');
});
