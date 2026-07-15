/* De AI-bedrijfsagent: vaste leverancier koppelen, inkoopvoorstellen met
   goedkeuring door de gemachtigde (pas dan een echte bestelling bij de
   groothandel), automatisch een voorstel na de MEP-voorspelling, en het
   AI-weekrooster dat na vaststelling het echte rooster stuurt.
   Draai: node --experimental-sqlite --test test/agent.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-agent-'));
let child, managerToken, kokToken;

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
  const kok = roster.staff.find(x => x.role !== 'manager');
  managerToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' }))).token;
  kokToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: kok.id, pin: '5678' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('koppelen: alleen de gemachtigde koppelt de vaste leverancier', async () => {
  assert.equal((await api('/api/supplier/agent/koppel', { groothandelCode: 'MERCABIZA' }, kokToken)).status, 403);
  const r = await json(await api('/api/supplier/agent/koppel', { groothandelCode: 'MERCABIZA', auto: false }, managerToken));
  assert.equal(r.agent.partnerCode, 'MERCABIZA');
  assert.equal(r.agent.partnerNaam, 'Mercabiza Groothandel');
});

test('voorstel en goedkeuring: pas na akkoord van de gemachtigde wordt er echt besteld', async () => {
  // de kok vraagt een voorstel aan; dat mag, maar bestellen kan hij niet
  const v = await json(await api('/api/supplier/agent/voorstel', {}, kokToken));
  assert.equal(v.voorstel.status, 'wacht-op-goedkeuring');
  assert.equal((await api('/api/supplier/agent/beslis', { id: v.voorstel.id, actie: 'akkoord' }, kokToken)).status, 403);
  // de gemachtigde past de regels aan (eigen keuze uit de markt) en keurt goed
  const markt = await json(await api('/api/supplier/inkoop/markt', {}, managerToken));
  const gh = markt.groothandels.find(x => x.code === 'MERCABIZA');
  const p = gh.producten[0];
  const ok = await json(await api('/api/supplier/agent/beslis', { id: v.voorstel.id, actie: 'akkoord', regels: [{ productId: p.id, aantal: 4 }] }, managerToken));
  assert.equal(ok.voorstel.status, 'besteld');
  assert.ok(ok.order && ok.order.ref, 'er ligt een echte bestelling bij de groothandel');
  // de bestelling staat bij de eigen inkoop
  const mijn = await json(await api('/api/supplier/inkoop/mijn', {}, managerToken));
  assert.ok(mijn.bestellingen.some(b => b.ref === ok.order.ref));
  // een behandeld voorstel kan niet nog een keer
  assert.equal((await api('/api/supplier/agent/beslis', { id: v.voorstel.id, actie: 'akkoord' }, managerToken)).status, 409);
});

test('automatisch inkopen: na de MEP-voorspelling ligt er een voorstel klaar', async () => {
  await api('/api/supplier/agent/koppel', { groothandelCode: 'MERCABIZA', auto: true }, managerToken);
  const voor = (await json(await api('/api/supplier/agent', {}, managerToken))).agent.voorstellen.length;
  const mep = await api('/api/supplier/mep/daily', { day: 'vandaag' }, managerToken);
  assert.equal(mep.status, 200);
  const na = (await json(await api('/api/supplier/agent', {}, managerToken))).agent.voorstellen;
  assert.equal(na.length, voor + 1);
  assert.equal(na[0].status, 'wacht-op-goedkeuring');
  assert.ok(/AI-agent/.test(na[0].door), 'het voorstel komt van de agent zelf');
});

test('AI-weekrooster: voorstel, vaststellen en het echte rooster volgt het plan', async () => {
  assert.equal((await api('/api/supplier/rooster/voorstel', {}, kokToken)).status, 403);
  const r = await json(await api('/api/supplier/rooster/voorstel', {}, managerToken));
  assert.equal(r.rooster.days.length, 7);
  assert.equal(r.rooster.status, 'voorstel');
  const ok = await json(await api('/api/supplier/rooster/beslis', { actie: 'akkoord' }, managerToken));
  assert.equal(ok.rooster.status, 'vast');
  // het rooster in de PDA volgt nu het vastgestelde plan
  const schema = await json(await api('/api/supplier/schedule', {}, managerToken));
  const dag0 = ok.rooster.days[0];
  for (const m of dag0.staff) {
    const rij = schema.days[0].staff.find(x => x.id === m.id);
    assert.equal(rij.shift, m.shift, m.name + ' volgt het vastgestelde rooster');
  }
});
