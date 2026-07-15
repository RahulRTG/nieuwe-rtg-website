/* De belastingtool van elke zaak + meerdere groothandels per zaak.
   Draai: node --experimental-sqlite --test test/belasting-groothandels.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bg-'));
let child, managerToken, lidToken;

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
  managerToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' }))).token;
  lidToken = (await json(await api('/api/login', { username: 'Rahul', password: 'Imran' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('belastingtool: elke zaak rekent hetzelfde als de Business Pass-tool', async () => {
  const zaak = await json(await api('/api/supplier/belasting', { winst: 60000, land: 'NL' }, managerToken));
  const lid = await json(await api('/api/member/zzp', { winst: 60000, land: 'NL' }, lidToken));
  assert.equal(zaak.belasting, lid.belasting, 'een motor, overal hetzelfde antwoord');
  assert.equal(zaak.netto, lid.netto);
  // zonder land-parameter pakt de zaak het eigen land (Ibiza -> Spanje)
  const eigen = await json(await api('/api/supplier/belasting', { winst: 60000 }, managerToken));
  assert.equal(eigen.land, 'ES');
  // en lege winst wordt netjes geweigerd
  assert.equal((await api('/api/supplier/belasting', {}, managerToken)).status, 400);
});

test('meerdere groothandels: koppelen als lijst, loskoppelen, voorstel kiest er een', async () => {
  const k1 = await json(await api('/api/supplier/agent/koppel', { groothandelCode: 'MERCABIZA' }, managerToken));
  assert.equal(k1.agent.partners.length, 1);
  assert.equal(k1.agent.partnerCode, 'MERCABIZA'); // compat: eerste blijft de weergave-partner
  // nogmaals koppelen dupliceert niet
  const k2 = await json(await api('/api/supplier/agent/koppel', { groothandelCode: 'MERCABIZA' }, managerToken));
  assert.equal(k2.agent.partners.length, 1);
  // het voorstel komt van een van de gekoppelde groothandels
  const v = await json(await api('/api/supplier/agent/voorstel', {}, managerToken));
  assert.equal(v.voorstel.groothandelCode, 'MERCABIZA');
  // loskoppelen: zonder groothandels een nette uitleg
  await api('/api/supplier/agent/koppel', { groothandelCode: 'MERCABIZA', weg: true }, managerToken);
  const leeg = await json(await api('/api/supplier/agent', {}, managerToken));
  assert.equal(leeg.agent.partners.length, 0);
  assert.equal((await api('/api/supplier/agent/voorstel', {}, managerToken)).status, 409);
});
