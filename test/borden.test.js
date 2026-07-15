/* Borden: het gedeelde werkbord. De zaak maakt borden met lijsten en kaarten,
   kiest per bord de collega's (leeg = hele team), en alleen bord-leden zien
   een besloten bord. Business Pass-leden hebben dezelfde motor voor eigen
   projecten; andere passen niet.
   Draai: node --experimental-sqlite --test test/borden.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bord-'));
let child, managerToken, staffToken, staffId, managerId, lidToken;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  const man = roster.staff.find(x => x.role === 'manager');
  const med = roster.staff.find(x => x.role !== 'manager') || roster.staff[0];
  managerId = man.id; staffId = med.id;
  managerToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' }))).token;
  staffToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: med.id, pin: '5678' }))).token;
  lidToken = (await json(await api('/api/login', { username: 'Rahul', password: 'Imran', tier: 'business' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let bordId, lijstId, kaartId;

test('bord maken: drie standaardlijsten, kaart erbij, bewerken en verplaatsen', async () => {
  const b = (await json(await api('/api/supplier/bord', { actie: 'maak', naam: 'Verbouwing terras' }, managerToken))).bord;
  bordId = b.id;
  assert.equal(b.lijsten.length, 3);
  lijstId = b.lijsten[0].id;
  const k = (await json(await api('/api/supplier/bord', { actie: 'kaart', id: bordId, lijstId, titel: 'Vergunning aanvragen' }, managerToken))).kaart;
  kaartId = k.id;
  await api('/api/supplier/bord', { actie: 'kaart-bewerk', id: bordId, kaartId, notitie: 'Bel de gemeente', due: '2026-08-01', leden: [staffId] }, managerToken);
  const naar = b.lijsten[1].id;
  const d = await json(await api('/api/supplier/bord', { actie: 'kaart-zet', id: bordId, kaartId, naarLijstId: naar }, managerToken));
  const l2 = d.bord.lijsten.find(l => l.id === naar);
  assert.equal(l2.kaarten[0].titel, 'Vergunning aanvragen');
  assert.equal(l2.kaarten[0].due, '2026-08-01');
  assert.deepEqual(l2.kaarten[0].leden, [staffId]);
});

test('groepen: een besloten bord zien alleen de gekozen collega’s (de manager altijd)', async () => {
  // bord alleen voor de manager: de medewerker ziet het niet meer
  await api('/api/supplier/bord', { actie: 'leden', id: bordId, leden: [managerId] }, managerToken);
  const vanStaff = await json(await api('/api/supplier/borden', {}, staffToken));
  assert.ok(!vanStaff.borden.find(x => x.id === bordId), 'besloten bord is onzichtbaar voor niet-leden');
  // en de medewerker mag er ook niets in doen
  assert.equal((await api('/api/supplier/bord', { actie: 'kaart', id: bordId, lijstId, titel: 'X' }, staffToken)).status, 403);
  // medewerker erbij: zichtbaar en bewerkbaar
  await api('/api/supplier/bord', { actie: 'leden', id: bordId, leden: [managerId, staffId] }, managerToken);
  const nu = await json(await api('/api/supplier/borden', {}, staffToken));
  assert.ok(nu.borden.find(x => x.id === bordId));
  assert.equal((await api('/api/supplier/bord', { actie: 'kaart', id: bordId, lijstId, titel: 'Terrasmeubels tellen' }, staffToken)).status, 200);
});

test('grenzen: lege namen geweigerd, lijst met kaarten niet weg, alleen manager verwijdert het bord', async () => {
  assert.equal((await api('/api/supplier/bord', { actie: 'maak', naam: '  ' }, managerToken)).status, 400);
  assert.equal((await api('/api/supplier/bord', { actie: 'lijst-bewerk', id: bordId, lijstId, weg: true }, managerToken)).status, 409);
  assert.equal((await api('/api/supplier/bord', { actie: 'weg', id: bordId }, staffToken)).status, 403);
  assert.equal((await api('/api/supplier/bord', { actie: 'weg', id: bordId }, managerToken)).status, 200);
});

test('Business Pass: eigen borden; andere passen krijgen nette uitleg', async () => {
  const b = (await json(await api('/api/member/bord', { actie: 'maak', naam: 'Mijn administratie' }, lidToken))).bord;
  const k = (await json(await api('/api/member/bord', { actie: 'kaart', id: b.id, lijstId: b.lijsten[0].id, titel: 'Btw-aangifte Q3' }, lidToken))).kaart;
  await api('/api/member/bord', { actie: 'kaart-bewerk', id: b.id, kaartId: k.id, klaar: true }, lidToken);
  const alles = await json(await api('/api/member/borden', {}, lidToken));
  assert.equal(alles.borden[0].lijsten[0].kaarten[0].klaar, true);
  const rtgToken = (await json(await api('/api/login', { tier: 'rtg' }))).token;
  assert.equal((await api('/api/member/borden', {}, rtgToken)).status, 403);
});
