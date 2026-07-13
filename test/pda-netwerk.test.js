/* Personeelsnetwerk + service-uitmuntendheid.
   1) PDA's van verschillende zaken praten met elkaar, maar alleen na wederzijdse
      toestemming (manager vraagt, andere manager keurt goed); daarna mag al het
      personeel in die aparte ruimte berichten sturen.
   2) De gast vraagt zelf om aandacht; het personeel ziet dat als prioriteit en
      handelt het af. Te lang stille tafels komen als 'traag' terug.
   Draai: node --experimental-sqlite --test test/pda-netwerk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-net-'));
let child, lidToken, kikMan, kikBal, ponMan, ponBal, hosMan;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();
async function login(code, rol, pin) {
  const roster = await json(await api('/api/supplier/roster', { code }));
  const s = roster.staff.find(x => rol === 'manager' ? x.role === 'manager' : x.role !== 'manager');
  return (await json(await api('/api/supplier/login', { code, staffId: s.id, pin }))).token;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const reg = await json(await api('/api/auth/register', { name: 'Gast Lid', email: 'net@x.nl', phone: '0612345730',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' }));
  lidToken = reg.token;
  kikMan = await login('KIKUNOI', 'manager', '1234'); kikBal = await login('KIKUNOI', 'staff', '5678');
  ponMan = await login('PONTO', 'manager', '1234'); ponBal = await login('PONTO', 'staff', '5678');
  hosMan = await login('HOSHI', 'manager', '1234');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('personeel kan pas verbinden na wederzijdse toestemming van de zaken', async () => {
  // personeel (geen manager) mag de zaak niet verbinden
  assert.equal((await api('/api/supplier/net/verzoek', { code: 'PONTO' }, kikBal)).status, 403);
  // de manager vraagt aan; nog niet verbonden
  const v = await json(await api('/api/supplier/net/verzoek', { code: 'PONTO' }, kikMan));
  assert.equal(v.status, 'wacht');
  // zolang PONTO niet akkoord is, kan er niet worden gepraat
  assert.equal((await api('/api/supplier/net/bericht', { code: 'PONTO', tekst: 'hallo' }, kikBal)).status, 403);
  // de PONTO-manager keurt goed
  const b = await json(await api('/api/supplier/net/beslis', { code: 'KIKUNOI', actie: 'akkoord' }, ponMan));
  assert.equal(b.status, 'akkoord');
  const lijst = await json(await api('/api/supplier/net/lijst', {}, kikMan));
  assert.ok(lijst.verbindingen.some(x => x.code === 'PONTO' && x.status === 'akkoord'));
});

test('verbonden personeel praat in de aparte netwerkruimte; niet-verbonden niet', async () => {
  // baliemedewerker van KIKUNOI stuurt een bericht naar PONTO
  assert.equal((await api('/api/supplier/net/bericht', { code: 'PONTO', tekst: 'Kunnen jullie een taxi regelen voor tafel 4?' }, kikBal)).status, 200);
  // PONTO ziet het gesprek
  const g = await json(await api('/api/supplier/net/gesprek', { code: 'KIKUNOI' }, ponBal));
  assert.ok(g.berichten.some(m => /taxi regelen/.test(m.tekst) && m.code === 'KIKUNOI'));
  // met een niet-verbonden zaak (HOSHI) kan niet worden gepraat
  assert.equal((await api('/api/supplier/net/bericht', { code: 'HOSHI', tekst: 'hoi' }, kikBal)).status, 403);
});

test('de gast vraagt zelf om aandacht; het personeel ziet en handelt het af', async () => {
  assert.equal((await api('/api/aandacht', { supplierCode: 'KIKUNOI', table: 'Tafel 5', reden: 'rekening' }, lidToken)).status, 200);
  const ov = await json(await api('/api/supplier/aandacht', {}, kikBal));
  assert.ok(Array.isArray(ov.traagTafels), 'de trage-tafels-lijst is er');
  const a = ov.aandacht.find(x => x.tafel === 'Tafel 5');
  assert.ok(a, 'het aandacht-verzoek staat op het scherm');
  assert.match(a.reden, /rekening/i);
  // afhandelen: van het scherm af
  assert.equal((await api('/api/supplier/aandacht/klaar', { id: a.id }, kikBal)).status, 200);
  const na = await json(await api('/api/supplier/aandacht', {}, kikBal));
  assert.ok(!na.aandacht.some(x => x.id === a.id), 'afgehandeld verzoek is weg');
});
