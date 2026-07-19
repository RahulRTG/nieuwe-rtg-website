/* Villa's & fincas als volwaardig verblijf-genre: net als een appartement
   draait een villa op verblijven met datums, een receptiebord, de
   check-in/check-out-keten en slimme deuren. Deze test bewaakt dat het
   villa-genre (demo Casa Lunara) diezelfde keten doorloopt.
   Draai los: node --experimental-sqlite --test test/villa.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, villa, kamer;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-villa-'));
const dagPlus = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await api('login', { tier: 'rtg' })).body.token;
  const roster = await api('supplier/roster', { code: 'LUNARA' });
  const manager = (roster.body.staff || []).find(x => x.role === 'manager');
  const login = await api('supplier/login', { code: 'LUNARA', staffId: manager.id, pin: '1234' });
  villa = login.body.token;
  const st = login.body.state || {};
  assert.equal((st.supplier || {}).type, 'villa', 'Casa Lunara is een villa-genre');
  kamer = ((st.supplier || {}).rooms || st.rooms || [])[0];
  assert.ok(lid && villa && kamer, 'het lid en de villamanager zijn binnen en er is een verblijf');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let vid;

test('1. een villa is boekbaar met datums, net als een appartement', async () => {
  const r = await api('verblijf', { supplierCode: 'LUNARA', roomId: kamer.id, aankomst: dagPlus(1), vertrek: dagPlus(4), personen: 4 }, lid);
  assert.equal(r.status, 200);
  vid = r.body.verblijf.id;
  assert.equal(r.body.verblijf.nachten, 3);
  assert.equal(r.body.verblijf.totaal, Math.round(kamer.price * 3 * 100) / 100, 'nachten maal prijs');
  assert.equal(r.body.verblijf.status, 'aangevraagd');
});

test('2. het receptiebord van de villa toont de aanvraag en bevestigt hem', async () => {
  const bord = (await api('supplier/receptie', {}, villa)).body;
  assert.ok(Array.isArray(bord.aanvragen) && bord.aanvragen.some(v => v.id === vid), 'de aanvraag staat op het bord');
  assert.equal((await api('supplier/verblijf/beslis', { id: vid, actie: 'bevestig' }, villa)).status, 200);
});

test('3. inchecken zet de gast in-huis op het receptiebord van de villa', async () => {
  assert.equal((await api('supplier/verblijf/checkin', { id: vid }, villa)).status, 200);
  const bord = (await api('supplier/receptie', {}, villa)).body;
  assert.ok((bord.inHuis || []).some(v => v.id === vid), 'de gast staat als in-huis op het bord');
});

test('4. de villa heeft slimme deuren die op afstand open kunnen', async () => {
  const st = (await api('supplier/state', {}, villa)).body.state || {};
  const deur = (st.doors || [])[0];
  assert.ok(deur, 'de villa heeft ten minste een deur');
  const r = await api('supplier/door/toggle', { id: deur.id }, villa);
  assert.equal(r.status, 200);
});
