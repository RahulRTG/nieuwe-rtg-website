/* De Zaakdoos end-to-end: een cloudserver en een doos-kastje ernaast.
   1. Online is de doos een doorgeefluik (inloggen via de doos raakt de cloud)
      en haalt hij een verse datakloon binnen.
   2. De cloud valt weg: de doos schakelt naar lokaal, de zaak logt gewoon in
      en werkt door (overschot melden op het keukenscherm), het journaal telt.
   3. De cloud komt terug op dezelfde poort: de doos speelt het journaal na en
      de actie staat daarna echt in de cloud.
   Draai los: node --experimental-sqlite --test test/zaakdoos.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, vrijePoort, stop } = require('./helper');

const SLEUTEL = 'doos-test-sleutel-1234';
const TMP_CLOUD = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doos-cloud-'));
const TMP_DOOS = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doos-box-'));

let cloudPort, cloudChild, doos;
const cloudBase = () => 'http://127.0.0.1:' + cloudPort;

function startCloud() {
  cloudChild = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, NODE_ENV: 'test', PORT: String(cloudPort), RTG_DATA_DIR: TMP_CLOUD, SMTP_URL: '', RTG_DOOS_SLEUTEL: SLEUTEL },
    stdio: ['ignore', 'ignore', 'inherit']
  });
}
async function wachtOp(pad, base, keur, pogingen = 100) {
  for (let i = 0; i < pogingen; i++) {
    try {
      const r = await fetch(base + pad, { headers: { 'X-Forwarded-Proto': 'https' } });
      if (r.ok) { const d = await r.json(); if (!keur || keur(d)) return d; }
    } catch (e) { /* nog niet op */ }
    await new Promise(res => setTimeout(res, 200));
  }
  throw new Error('kwam niet op: ' + pad);
}
function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  cloudPort = await vrijePoort();
  startCloud();
  await wachtOp('/api/health', cloudBase());
  doos = await startServer({ env: {
    RTG_DATA_DIR: TMP_DOOS, SMTP_URL: '',
    RTG_DOOS_CLOUD: cloudBase(), RTG_DOOS_SLEUTEL: SLEUTEL,
    RTG_DOOS_USER: 'rahul', RTG_DOOS_WACHTWOORD: 'Imran',
    RTG_DOOS_NETWERK: '1', RTG_DOOS_NAAM: 'testdoos'
  } });
});
test.after(() => {
  stop(doos && doos.child);
  if (cloudChild) try { cloudChild.kill('SIGKILL'); } catch (e) {}
  for (const t of [TMP_CLOUD, TMP_DOOS]) try { fs.rmSync(t, { recursive: true, force: true }); } catch (e) {}
});

let itemId; // een gerecht uit het cloudmenu, voor de overschot-melding

test('online: de doos is een doorgeefluik en haalt de datakloon binnen', async () => {
  const st = await wachtOp('/api/doos/status', doos.base, d => d.modus === 'cloud');
  assert.equal(st.doos, true);
  // inloggen via de doos raakt de cloud (doorgeefluik)
  const login = await api(doos.base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  assert.equal(login.status, 200, 'de zaak logt in via de doos');
  const state = (await api(doos.base, '/api/supplier/state', {}, login.body.token)).body.state;
  assert.ok(state && state.supplier, 'de zaakstaat komt via de doos uit de cloud');
  itemId = (state.menu && state.menu[0] && state.menu[0].id) || null;
  assert.ok(itemId, 'het menu is er (nodig voor de keuken-actie straks)');
  // de kloon is (of komt) binnen
  await wachtOp('/api/doos/status', doos.base, d => d.laatsteKloon > 0, 150);
  // en de kloon-route zelf is dicht zonder sleutel
  const dicht = await fetch(cloudBase() + '/api/doos/kloon');
  assert.equal(dicht.status, 403);
});

test('het meetstation: de vloot meldt lijnmetingen, alleen met de sleutel', async () => {
  // de doos meldt vanzelf (eerste tik); en het endpoint zelf is dicht zonder sleutel
  const dicht = await fetch(cloudBase() + '/api/doos/meting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doos: 'x', rtt: 1 }) });
  assert.equal(dicht.status, 403);
  const open = await fetch(cloudBase() + '/api/doos/meting', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': SLEUTEL },
    body: JSON.stringify({ doos: 'beachclub-sol', rtt: 340, modus: 'cloud', journaal: 0 })
  });
  assert.equal(open.status, 200);
  assert.ok((await open.json()).ok, 'de meting is geland op de vlootkaart');
});

test('de lijn valt weg: de zaak werkt lokaal door en het journaal telt mee', async () => {
  cloudChild.kill('SIGKILL');
  await new Promise(r => setTimeout(r, 300));
  // het eerstvolgende verzoek merkt het en valt door naar lokaal: inloggen
  // lukt gewoon, op de kloon-data van de doos zelf
  let login;
  for (let i = 0; i < 10; i++) {
    login = await api(doos.base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
    if (login.status === 200) break;
    await new Promise(r => setTimeout(r, 500));
  }
  assert.equal(login.status, 200, 'inloggen op de doos zelf, zonder cloud');
  const st = await wachtOp('/api/doos/status', doos.base, d => d.modus === 'lokaal');
  assert.equal(st.modus, 'lokaal');
  // het keukenscherm meldt een overschot; dat werkt lokaal en komt in het journaal
  const over = await api(doos.base, '/api/supplier/overschot', { op: 'erbij', itemId, qty: 2 }, login.body.token);
  assert.equal(over.status, 200, 'de keuken-actie lukt lokaal');
  const na = await wachtOp('/api/doos/status', doos.base, d => d.journaal >= 1);
  assert.ok(na.journaal >= 1, 'de actie staat in het journaal');
  // en de zaakstaat op de doos toont hem meteen
  const state = (await api(doos.base, '/api/supplier/state', {}, login.body.token)).body.state;
  assert.ok((state.overschot || []).some(o => o.itemId === itemId), 'het overschot staat op het lokale scherm');
});

test('de lijn komt terug: het journaal wordt nagespeeld en de cloud kent de actie', async () => {
  startCloud(); // zelfde poort, zelfde data
  await wachtOp('/api/health', cloudBase());
  // de doos merkt het (pinger elke 10s), speelt na en wordt weer doorgeefluik
  const st = await wachtOp('/api/doos/status', doos.base, d => d.modus === 'cloud' && d.journaal === 0, 200);
  assert.equal(st.journaal, 0, 'het journaal is leeg nagespeeld');
  // rechtstreeks op de cloud controleren dat de keuken-actie er echt staat
  const login = await api(cloudBase(), '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  const state = (await api(cloudBase(), '/api/supplier/state', {}, login.body.token)).body.state;
  assert.ok((state.overschot || []).some(o => o.itemId === itemId && o.qty === 2), 'de overschot-melding staat in de cloud');
});
