/* Integratietest: de functieschakelaars op de technische pagina schakelen echt
   gedrag. De eigenaar zet een functie uit -> de bijbehorende API geeft 503; weer
   aan -> de API werkt weer. Draait tegen een echte server in een tijdelijke map.
   Draai los: node --experimental-sqlite --test test/techniek-functies.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3800 + Math.floor(Math.random() * 80);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-func-'));
const OWNER = 'rahul@rtg.example'; // standaard-eigenaar (RTG_OWNER_EMAIL)
let child, techToken;

function post(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}

test.before(async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  // in demo-modus is het eigenaarsaccount (Rahul/Imran) al geseed; log daarmee in
  const login = await (await post('/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' })).json();
  assert.ok(login.token && login.eigenaar, 'de eigenaar kan inloggen op de technische pagina');
  techToken = login.token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('functie uit -> 503 op de bewaakte API; weer aan -> werkt', async () => {
  // een school aanmelden lukt normaal
  assert.equal((await post('/api/foundation/school/school/maak', { naam: 'Testschool', plaats: 'Utrecht' })).status, 200);

  // de eigenaar zet RTF School uit
  const uit = await (await post('/api/techniek/functie', { id: 'foundation-school', aan: false }, techToken)).json();
  assert.ok(uit.ok);
  assert.equal(uit.functies.flatMap(g => g.functies).find(f => f.id === 'foundation-school').aan, false);

  // nu geeft het schoolkanaal 503, met de functienaam erbij
  const r = await post('/api/foundation/school/school/maak', { naam: 'Nog een school' });
  assert.equal(r.status, 503);
  const j = await r.json();
  assert.equal(j.functie, 'foundation-school');

  // de rest van de onderwijs-app blijft gewoon werken (ander pad, niet dezelfde functie)
  assert.notEqual((await post('/api/foundation/gezin/maak', { gezinsnaam: 'Fam', naam: 'Ouder', pin: '1234' })).status, 503);

  // de eigenaar zet hem weer aan -> werkt weer
  await post('/api/techniek/functie', { id: 'foundation-school', aan: true }, techToken);
  assert.equal((await post('/api/foundation/school/school/maak', { naam: 'Derde school' })).status, 200);
});

test('alleen de eigenaar mag schakelen; techniek zelf blijft altijd bereikbaar', async () => {
  // zonder token: geen toegang tot de schakelaar
  assert.equal((await post('/api/techniek/functie', { id: 'betalen', aan: false })).status, 401);

  // zet het hele platform uit via "alles"
  await post('/api/techniek/functie', { alles: true, aan: false }, techToken);
  // een gewone API is nu dicht ...
  assert.equal((await post('/api/foundation/gezin/maak', { gezinsnaam: 'X', naam: 'Y', pin: '1234' })).status, 503);
  // ... maar de technische pagina blijft bereikbaar, zodat je alles weer aan kunt zetten
  assert.equal((await fetch(BASE + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + techToken } })).status, 200);
  // alles weer aan
  const weer = await (await post('/api/techniek/functie', { alles: true, aan: true }, techToken)).json();
  assert.ok(weer.functies.flatMap(g => g.functies).every(f => f.aan));
  assert.notEqual((await post('/api/foundation/gezin/maak', { gezinsnaam: 'Z', naam: 'W', pin: '1234' })).status, 503);
});
