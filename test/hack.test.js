/* Hack-test: een adversariële penetratietest die bewijst dat het platform bekende
   aanvallen afslaat. Geen exploit die MOET slagen -- juist een regressie-hek dat
   de bestaande verdediging vastlegt: auth-dwang, rol-scheiding, cross-tenant (IDOR),
   injectie, prototype-pollution, security-headers, path-traversal en brute-force.
   Draai: node --experimental-sqlite --test test/hack.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-hack-'));
let lidToken, supKik, supStaff, pontoStaffId;

async function api(pad, body, token, headers) {
  const h = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(headers || {}) };
  return fetch(BASE + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const reg = await json(await api('/api/auth/register', { name: 'Hack Tester', email: 'hack@x.nl',
    phone: '0612340000', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' }));
  lidToken = reg.token;
  const kik = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  supKik = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: kik.staff.find(s => s.role === 'manager').id, pin: '1234' }))).token;
  supStaff = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: kik.staff.find(s => s.role !== 'manager').id, pin: '5678' }))).token;
  const pon = await json(await api('/api/supplier/roster', { code: 'PONTO' }));
  pontoStaffId = pon.staff.find(s => s.role !== 'manager').id;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('zonder token komt niemand bij beschermde endpoints', async () => {
  assert.equal((await api('/api/state', {})).status, 401, 'lid-endpoint eist een token');
  assert.equal((await api('/api/supplier/state', {})).status, 401, 'leverancier-endpoint eist een token');
  assert.equal((await api('/api/office/ontmoetingen', {})).status, 401, 'kantoor-endpoint eist een token');
});

test('een verzonnen of geknoeid token wordt geweigerd (401), niet uitgevoerd', async () => {
  for (const t of ['deadbeef', 'a'.repeat(64), lidToken + 'x', 'null']) {
    assert.equal((await api('/api/supplier/state', {}, t)).status, 401, 'fout token -> 401 (' + t.slice(0, 8) + ')');
  }
});

test('rol-scheiding: een token van de ene rol opent niet de app van een andere', async () => {
  assert.equal((await api('/api/supplier/state', {}, lidToken)).status, 401, 'lid-token opent geen leverancier-app');
  assert.equal((await api('/api/state', {}, supKik)).status, 401, 'leverancier-token opent geen lid-app');
  // een medewerker (geen manager) mag geen manager-actie uitvoeren
  assert.equal((await api('/api/supplier/staff/add', { name: 'Indringer', role: 'manager' }, supStaff)).status, 403,
    'een medewerker kan geen personeel (laat staan een manager) toevoegen');
  // een gewoon lid komt niet bij de eigenaar-only technische laag
  assert.ok((await api('/api/techniek/zekering', { id: 'x', aan: false }, lidToken)).status >= 400,
    'een lid-token krijgt geen toegang tot de eigenaar-laag');
});

test('IDOR: leverancier A kan het personeel van leverancier B niet aanraken', async () => {
  // KIKUNOI-manager probeert een PONTO-medewerker te verwijderen
  await api('/api/supplier/staff/remove', { staffId: pontoStaffId }, supKik);
  const pon = await json(await api('/api/supplier/roster', { code: 'PONTO' }));
  assert.ok(pon.staff.some(s => s.id === pontoStaffId),
    'de PONTO-medewerker staat er nog: cross-tenant verwijderen is geblokkeerd');
});

test('injectie in de inlog geeft geen toegang en geen crash', async () => {
  assert.equal((await api('/api/auth/login', { login: "admin' OR '1'='1", password: 'x' })).status, 401,
    'een SQL-achtige injectie logt niet in');
  const obj = await api('/api/auth/login', { login: { $ne: null }, password: { $ne: null } });
  assert.ok(obj.status === 400 || obj.status === 401, 'object-injectie wordt geweigerd, niet uitgevoerd (' + obj.status + ')');
  const inj = await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: '1 OR 1=1', pin: '1234' }));
  assert.ok(!inj.token, 'injectie in het staffId levert geen sessie op');
});

test('prototype-pollution via de body omzeilt de auth niet en laat de server staan', async () => {
  // rauwe JSON zodat de __proto__-sleutel echt in de body zit
  const r = await fetch(BASE + '/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: '{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"pwned":true}},"lang":"nl"}' });
  assert.equal(r.status, 401, 'de pollution-payload omzeilt de auth niet');
  // de server draait nog en een verse, legitieme aanvraag gedraagt zich normaal
  assert.equal((await fetch(BASE + '/api/health')).status, 200, 'de server staat nog overeind na de pollution-poging');
  assert.equal((await api('/api/state', { lang: 'nl' })).status, 401, 'er is geen globale auth-bypass ontstaan');
});

test('security-headers staan op elk antwoord', async () => {
  const r = await fetch(BASE + '/api/health');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff', 'geen MIME-sniffing');
  assert.equal(r.headers.get('x-frame-options'), 'DENY', 'geen clickjacking (framing verboden)');
  const csp = r.headers.get('content-security-policy') || '';
  assert.match(csp, /frame-ancestors 'none'/, 'CSP verbiedt framing');
  assert.match(csp, /object-src 'none'/, 'CSP verbiedt plug-ins/objecten');
});

test('path-traversal haalt geen serverbestanden op', async () => {
  for (const p of ['/apps/%2e%2e/%2e%2e/server/server.js', '/apps/..%2f..%2fserver%2fserver.js', '/static/../../server/db.js']) {
    const r = await fetch(BASE + p);
    const body = r.status === 200 ? await r.text() : '';
    assert.ok(!body.includes('supplierAuth') && !body.includes('module.exports'),
      'geen serverbroncode gelekt via ' + p);
  }
});

test('brute-force op de inlog wordt na te veel pogingen op slot gezet (429)', async () => {
  let zag429 = false;
  for (let i = 0; i < 12 && !zag429; i++) {
    if ((await api('/api/auth/login', { login: 'brute@x.nl', password: 'fout' + i })).status === 429) zag429 = true;
  }
  assert.ok(zag429, 'na te veel mislukte pogingen komt er een 429-slot (brute-force-rem)');
});
