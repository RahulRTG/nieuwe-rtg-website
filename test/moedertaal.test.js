/* De moedertaal van het personeel: wie bijvoorbeeld Spaans spreekt maar in
   een Nederlands systeem werkt, zet EEN keer zijn taal en ziet daarna zijn
   hele werkscherm, zijn bonnen en zijn taken in die taal. De taal hoort bij
   de persoon (staffId) en geldt in elke werk-app. Zonder AI-sleutel vangt
   het werkvloer-woordenboek (NL/EN naar ES) het op; met sleutel vertaalt
   Claude elke actieve wereldtaal volledig. Draai los:
   node --experimental-sqlite --test test/moedertaal.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, kok;
const OWNER = 'eigenaar@rtg.test';
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-moedertaal-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: OWNER, ANTHROPIC_API_KEY: '' } });
  base = srv.base;
  // de boardroom zet Spaans aan als wereldtaal (nl/en zijn de basis)
  const owner = (await api(base, '/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' })).body.token;
  await api(base, '/api/boardroom/taal', { code: 'es', aan: true }, owner);
  // een personeelslid in de horeca (Sal de Mar), ingelogd op eigen naam
  const roster = await api(base, '/api/supplier/roster', { code: 'KIKUNOI' });
  const staff = roster.body.staff.find(m => m.role === 'staff');
  kok = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: staff.id, pin: '5678' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. de moedertaal hoort bij de persoon: standaard Nederlands, dan Spaans gezet', async () => {
  const voor = await api(base, '/api/supplier/mijn/taal', {}, kok);
  assert.equal(voor.status, 200);
  assert.equal(voor.body.taal, 'nl', 'zonder keuze gewoon Nederlands');
  assert.ok(voor.body.talen.some(t => t.code === 'es'), 'Spaans staat in de kiezer (actieve wereldtalen)');
  const zet = await api(base, '/api/supplier/mijn/taal', { taal: 'es' }, kok);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.taal, 'es');
  assert.equal((await api(base, '/api/supplier/mijn/taal', {}, kok)).body.taal, 'es', 'en hij blijft staan');
  // een taal die niet aanstaat (of niet bestaat) ketst af
  assert.equal((await api(base, '/api/supplier/mijn/taal', { taal: 'xx' }, kok)).status, 400);
});

test('2. het hele UI-woordenboek in een keer naar de moedertaal (demo: werkvloer-Spaans)', async () => {
  const r = await api(base, '/api/supplier/vertaal/ui', {
    teksten: ['Tasks', 'Schedule', 'New order', 'Taken vandaag'], naar: 'es' }, kok);
  assert.equal(r.status, 200);
  assert.equal(r.body.naar, 'es');
  assert.match(r.body.teksten[0], /Tareas/i, 'Tasks wordt tareas');
  assert.match(r.body.teksten[1], /Horario/i, 'Schedule wordt horario');
  assert.match(r.body.teksten[2], /pedido/i, 'de bon-taal doet mee (order -> pedido)');
  assert.match(r.body.teksten[3], /hoy/i, 'en de Nederlandse bron ook (vandaag -> hoy)');
});

test('3. de bonnen en taken (losse regels) vertalen mee naar het Spaans', async () => {
  const r = await api(base, '/api/supplier/vertaal', { teksten: ['Koffie', 'Wijn', 'Kamer schoonmaken'], naar: 'es' }, kok);
  assert.equal(r.status, 200);
  assert.match(r.body.teksten[0], /Café/i, 'koffie op de bon wordt café');
  assert.match(r.body.teksten[1], /Vino/i, 'wijn wordt vino');
  assert.match(r.body.teksten[2], /Habitación limpiar|limpiar/i, 'de taak leest als Spaans');
});

test('4. Engels blijft gewoon werken via dezelfde weg (de bestaande terugval)', async () => {
  const r = await api(base, '/api/supplier/vertaal/ui', { teksten: ['wijn', 'koffie'], naar: 'en' }, kok);
  assert.equal(r.status, 200);
  assert.match(r.body.teksten[0], /wine/i);
  assert.match(r.body.teksten[1], /coffee/i);
});

test('5. terug naar Nederlands wist de keuze; zonder inloggen geen toegang', async () => {
  const terug = await api(base, '/api/supplier/mijn/taal', { taal: 'nl' }, kok);
  assert.equal(terug.body.taal, 'nl');
  assert.equal((await api(base, '/api/supplier/mijn/taal', {}, kok)).body.taal, 'nl');
  assert.equal((await api(base, '/api/supplier/mijn/taal', {})).status, 401, 'de poort blijft dicht');
  assert.equal((await api(base, '/api/supplier/vertaal/ui', { teksten: ['x'], naar: 'es' })).status, 401);
});
