/* Het gerechtenmenu op het keukenscherm: recept, bereidingswijze, allergenen
   met vervangers en een dranksuggestie per gerecht, plus de 86-melding
   (uitverkocht) die het bestellen per direct blokkeert.
   Draai: node --experimental-sqlite --test test/gerechtkennis.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kennis-'));
let child, lidToken, kokToken, managerToken;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const reg = await json(await api('/api/auth/register', { name: 'Kennis Lid', email: 'kennis@x.nl', phone: '0612345688',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' }));
  lidToken = reg.token;
  const roster = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  const kok = roster.staff.find(x => x.role !== 'manager');
  const man = roster.staff.find(x => x.role === 'manager');
  kokToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: kok.id, pin: '5678' }))).token;
  managerToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('kennis: elke soort geeft tekst en wordt daarna uit de cache geserveerd', async () => {
  for (const soort of ['recept', 'bereiding', 'allergenen', 'pairing']) {
    const d = await json(await api('/api/supplier/menu/kennis', { itemId: 'm1', soort }, kokToken));
    assert.ok(d.ok, soort + ' hoort te lukken');
    assert.ok(d.tekst && d.tekst.length > 20, soort + ' hoort echte tekst te geven');
  }
  const weer = await json(await api('/api/supplier/menu/kennis', { itemId: 'm1', soort: 'bereiding' }, kokToken));
  assert.equal(weer.cached, true);
});

test('kennis: allergenen noemen het allergeen met een volwaardige vervanger', async () => {
  // m2 (Pulpo a la brasa) heeft allergeen vis; de fallback rekent met ALT_IDEE
  const d = await json(await api('/api/supplier/menu/kennis', { itemId: 'm2', soort: 'allergenen' }, kokToken));
  assert.ok(/vis/i.test(d.tekst), d.tekst);
  assert.ok(/vervang|dashi|zonder vis/i.test(d.tekst), d.tekst);
});

test('kennis: een onbekende soort of onbekend gerecht wordt geweigerd', async () => {
  assert.equal((await api('/api/supplier/menu/kennis', { itemId: 'm1', soort: 'horoscoop' }, kokToken)).status, 400);
  assert.equal((await api('/api/supplier/menu/kennis', { itemId: 'bestaat-niet', soort: 'recept' }, kokToken)).status, 404);
});

test('kaart bewerken: vuurplan-minuten, 86 en de opgebouwde kennis overleven het opslaan', async () => {
  // de chef zet een eigen bereidingstijd en de kok heeft al kennis opgebouwd (vorige tests)
  const st = await json(await api('/api/supplier/state', {}, managerToken));
  const menu = st.state.menu.map(m => m.id === 'm2' ? { ...m, prepMin: 25, sectie: 'warm' } : m);
  const opgeslagen = await json(await api('/api/supplier/menu', { menu }, managerToken));
  const m2 = opgeslagen.menu.find(x => x.id === 'm2');
  assert.equal(m2.prepMin, 25);                       // het vuurplan rekent nu met 25 min
  const m1 = opgeslagen.menu.find(x => x.id === 'm1');
  assert.ok(m1.kennis && m1.kennis.bereiding, 'de opgebouwde kennis blijft op het gerecht staan');
  // alleen het management mag de kaart bewerken
  assert.equal((await api('/api/supplier/menu', { menu }, kokToken)).status, 403);
});

test('86: uitverkocht melden blokkeert het bestellen; opheffen maakt het weer vrij', async () => {
  // de kok meldt 86 op de gazpacho
  const zet = await json(await api('/api/supplier/menu/86', { itemId: 'm1', op: true }, kokToken));
  assert.equal(zet.uitverkocht, true);
  // het lid ziet het op de kaart en kan niet bestellen
  const kaart = await json(await api('/api/supplier/menu/get', { code: 'KIKUNOI' }, lidToken));
  assert.equal(kaart.menu.find(x => x.id === 'm1').uitverkocht, true);
  const weiger = await api('/api/order', { supplierCode: 'KIKUNOI', items: [{ id: 'm1', qty: 1 }] }, lidToken);
  assert.equal(weiger.status, 409);
  assert.ok(/uitverkocht|86/.test((await json(weiger)).error));
  // 86 opheffen en de bestelling loopt weer
  await api('/api/supplier/menu/86', { itemId: 'm1', op: false }, kokToken);
  const ok = await api('/api/order', { supplierCode: 'KIKUNOI', items: [{ id: 'm1', qty: 1 }] }, lidToken);
  assert.equal(ok.status, 200);
});
