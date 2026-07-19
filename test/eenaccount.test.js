/* Een account voor alles: mensen registreren zich EEN keer; personeel, zaak
   en kantoor zijn daarna koppelingen aan dat ene account (na bewijs van de
   bestaande werk-inlog) en accStart munt exact dezelfde sessies als de losse
   logins. Draai los: node --experimental-sqlite --test test/eenaccount.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-1acc-'));
let srv, base, lid, staffId, staffNaam, staffPin;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api('/api/auth/register', { name: 'Sleutellid', email: 'sl' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const staff = (roster.body.staff || []).find(s => s.role !== 'manager') || roster.body.staff[0];
  staffId = staff.id; staffNaam = staff.name;
  staffPin = staff.role === 'manager' ? '1234' : '5678';
  assert.ok(lid && staffId, 'lid geregistreerd en een personeelslid gevonden');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een anonieme gast heeft geen sleutelbos; een echt account begint leeg', async () => {
  const gast = (await api('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  assert.equal((await api('/api/account/rollen', {}, gast)).status, 403, 'eerst een echt account maken');
  const leeg = await api('/api/account/rollen', {}, lid);
  assert.equal(leeg.status, 200);
  assert.deepEqual(leeg.body.rollen, [], 'nog niets gekoppeld');
});

test('2. personeel koppelen bewijst eerst de eigen PIN; daarna staat de rol op de bos', async () => {
  const fout = await api('/api/account/koppel', { soort: 'personeel', code: 'KIKUNOI', staffId, pin: '0000' }, lid);
  assert.equal(fout.status, 401, 'zonder juiste PIN geen koppeling');
  const goed = await api('/api/account/koppel', { soort: 'personeel', code: 'KIKUNOI', staffId, pin: staffPin }, lid);
  assert.equal(goed.status, 200, 'met de juiste PIN wel: ' + JSON.stringify(goed.body).slice(0, 120));
  assert.ok(goed.body.rollen.some(r => r.rol === 'personeel' && r.code === 'KIKUNOI' && r.naam === staffNaam));
});

test('3. met het ene account de PDA in: dezelfde sessie als de losse personeelslogin', async () => {
  const s = await api('/api/account/start', { rol: 'personeel', code: 'KIKUNOI', staffId }, lid);
  assert.equal(s.status, 200);
  assert.ok(s.body.token, 'er is een werk-token gemunt');
  const st = await api('/api/supplier/state', {}, s.body.token);
  assert.equal(st.status, 200, 'het token werkt op de zaak-API');
  assert.equal(st.body.state.supplier.code, 'KIKUNOI');
});

test('4. de zaak en het kantoor koppelen met hun eigen inlog, en starten', async () => {
  const z = await api('/api/account/koppel', { soort: 'zaak', username: 'rahul', password: 'Imran' }, lid);
  assert.equal(z.status, 200, 'de bedrijfsinlog bewijst de zaak-rol');
  const zs = await api('/api/account/start', { rol: 'zaak' }, lid);
  assert.equal((await api('/api/supplier/state', {}, zs.body.token)).status, 200, 'de zaak-sessie werkt');
  const kFout = await api('/api/account/koppel', { soort: 'kantoor', code: 'FOUT' }, lid);
  assert.equal(kFout.status, 401);
  const k = await api('/api/account/koppel', { soort: 'kantoor', code: 'RTG-OFFICE' }, lid);
  assert.equal(k.status, 200, 'de backoffice-code bewijst de kantoor-rol');
  const ks = await api('/api/account/start', { rol: 'kantoor' }, lid);
  const bord = await api('/api/office/boardroom', {}, ks.body.token);
  assert.equal(bord.status, 200, 'de kantoor-sessie werkt op de boardroom');
});

test('5. ontkoppelen sluit de deur weer, en de AI-stuur blijft van de sleutelbos af', async () => {
  await api('/api/account/ontkoppel', { rol: 'kantoor' }, lid);
  const s = await api('/api/account/start', { rol: 'kantoor' }, lid);
  assert.equal(s.status, 404, 'na ontkoppelen start er niets meer');
  const ai = await api('/api/member/doe', { pad: '/api/account/start', body: { rol: 'zaak' } }, lid);
  assert.equal(ai.status, 403, 'het AI-stuur mag de sleutelbos niet bedienen');
});
