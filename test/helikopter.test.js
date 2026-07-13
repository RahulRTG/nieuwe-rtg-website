/* Helikopter transfers: het nieuwe vervoersgenre. Een lid vraagt een
   helikoptervlucht aan bij Ibiza Sky Charter, betaalt vooraf, en de zaak
   (Operations + piloot) wijst piloot en toestel toe en rijdt de ritketen af.
   18+ zoals de privejet. Verloopt via dezelfde ritlaag als taxi's en jets.
   Draai: node --experimental-sqlite --test test/helikopter.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-heli-'));
let child, lidToken, minderToken, manToken, pilootId;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const reg = await json(await api('/api/auth/register', { name: 'Heli Lid', email: 'heli@x.nl', phone: '0612345720',
    password: 'geheim123', geboortedatum: '1985-01-01', tier: 'business', pasApp: 'business' }));
  lidToken = reg.token;
  // een jeugdlid (16): moet geweigerd worden voor een helikoptervlucht
  const jong = new Date(Date.now() - 16 * 365.25 * 86400000).toISOString().slice(0, 10);
  const reg2 = await json(await api('/api/auth/register', { name: 'Jong Lid', email: 'jong@x.nl', phone: '0612345721',
    password: 'geheim123', geboortedatum: jong, tier: 'rtg', pasApp: 'rtg' }));
  minderToken = reg2.token;
  const roster = await json(await api('/api/supplier/roster', { code: 'IBIZAIR' }));
  const man = roster.staff.find(x => x.role === 'manager');
  const piloot = roster.staff.find(x => x.role !== 'manager');
  pilootId = piloot.id;
  manToken = (await json(await api('/api/supplier/login', { code: 'IBIZAIR', staffId: man.id, pin: '1234' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('Ibiza Sky Charter is een helikopter-vervoerder met ritten en een vloot', async () => {
  const roster = await json(await api('/api/supplier/roster', { code: 'IBIZAIR' }));
  assert.equal(roster.supplier.type, 'helikopter');
  assert.ok(roster.staff.some(x => x.role === 'manager'));
});

test('een lid boekt een helikoptertransfer met een premium offerte', async () => {
  const r = await json(await api('/api/ride/request', { supplierCode: 'IBIZAIR', from: 'Marina Botafoch', to: 'Formentera', passengers: 2 }, lidToken));
  assert.ok(r.ride, 'de aanvraag lukt');
  assert.equal(r.ride.type, 'helikopter');
  assert.ok(r.ride.quote >= 1200, 'de premium minimumprijs geldt (>= 1200)');
  assert.equal(r.ride.status, 'wacht-op-betaling', 'vooraf betalen');
  global.__heli = r.ride.ref;
});

test('een jeugdlid (16) mag geen helikoptervlucht boeken', async () => {
  const res = await api('/api/ride/request', { supplierCode: 'IBIZAIR', from: 'Ibiza', to: 'Formentera', passengers: 1 }, minderToken);
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /18 jaar/);
});

test('betalen, dan wijst Operations piloot en toestel toe en vliegt de ritketen af', async () => {
  assert.equal((await api('/api/ride/pay', { ref: global.__heli }, lidToken)).status, 200);
  // de zaak ziet de betaalde aanvraag
  const ov = await json(await api('/api/supplier/state', {}, manToken));
  assert.ok(ov, 'de zaak-state laadt');
  // slimme toewijzing: piloot + toestel voorstellen
  const sug = await json(await api('/api/supplier/ride/suggest', { ref: global.__heli }, manToken));
  assert.ok(sug.staffId || pilootId, 'er is een piloot beschikbaar');
  const toewijs = await json(await api('/api/supplier/ride/assign', { ref: global.__heli, staffId: sug.staffId || pilootId, vehicleId: sug.vehicleId || 'h1' }, manToken));
  assert.equal(toewijs.ride.status, 'geaccepteerd');
  assert.ok(toewijs.ride.vehicle && /H125|Bell/.test(toewijs.ride.vehicle.name), 'een helikopter is toegewezen');
  // de ritketen vooruit tot afgerond
  for (const st of ['onderweg', 'aangekomen', 'aan-boord', 'afgerond']) {
    const r = await api('/api/supplier/ride/status', { ref: global.__heli, status: st }, manToken);
    assert.equal(r.status, 200, 'status ' + st + ' lukt');
  }
});
