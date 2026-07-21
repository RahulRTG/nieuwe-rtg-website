/* 114 wereldtalen: het register telt er 114, en de app kan in ELKE actieve
   taal draaien. Het publieke /api/vertaal/ui vertaalt het UI-woordenboek van
   een pagina in een keer naar een actieve wereldtaal (shared/i18n.js haalt
   hem op en past hem toe); niet-actieve talen vallen veilig terug. Zonder
   AI-sleutel vangt het woordenboek het op (Spaans als demo); met sleutel
   vertaalt Claude elke taal volledig. Draai los:
   node --experimental-sqlite --test test/talen114.test.js */
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

let srv, base, owner;
const OWNER = 'eigenaar@rtg.test';
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-talen114-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: OWNER, ANTHROPIC_API_KEY: '' } });
  base = srv.base;
  owner = (await api(base, '/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. het register telt 114 wereldtalen, elk met een eigen endoniem', async () => {
  const alles = await api(base, '/api/boardroom/talen', {}, owner);
  assert.equal(alles.status, 200);
  assert.ok(alles.body.talen.length >= 114, 'minstens 114 talen (nu: ' + alles.body.talen.length + ')');
  for (const code of ['jv', 'su', 'or', 'as', 'tt'])
    assert.ok(alles.body.talen.some(t => t.code === code), code + ' staat in het register');
  const dubbel = alles.body.talen.map(t => t.code).filter((c, i, a) => a.indexOf(c) !== i);
  assert.equal(dubbel.length, 0, 'geen dubbele taalcodes');
});

test('2. de hele app-UI in een actieve wereldtaal: /api/vertaal/ui vertaalt het paginawoordenboek', async () => {
  assert.equal((await api(base, '/api/boardroom/taal', { code: 'es', aan: true }, owner)).status, 200);
  const r = await api(base, '/api/vertaal/ui', { naar: 'es', teksten: ['Tasks', 'Schedule', 'wijn'] });
  assert.equal(r.status, 200);
  assert.equal(r.body.naar, 'es');
  assert.match(r.body.teksten[0], /Tareas/i, 'de UI-tekst wordt echt Spaans');
  assert.match(r.body.teksten[1], /Horario/i);
  assert.match(r.body.teksten[2], /vino/i);
});

test('3. een taal die de boardroom NIET aanzette valt veilig terug (tekst blijft heel)', async () => {
  const r = await api(base, '/api/vertaal/ui', { naar: 'jv', teksten: ['wijn'] });
  assert.equal(r.status, 200);
  assert.equal(r.body.naar, 'nl', 'niet-actief: terug naar de basistaal');
  assert.equal(r.body.teksten[0], 'wijn', 'en de tekst komt onbeschadigd terug');
});

test('4. de grens: maximaal 400 teksten per aanroep, langere lijsten worden afgekapt', async () => {
  const veel = Array.from({ length: 500 }, (_, i) => 'tekst ' + i);
  const r = await api(base, '/api/vertaal/ui', { naar: 'es', teksten: veel });
  assert.equal(r.status, 200);
  assert.equal(r.body.teksten.length, 400, 'de server bewaakt zijn eigen grens');
});

test('5. elke net toegevoegde taal is aan te zetten en meteen kiesbaar in de apps', async () => {
  assert.equal((await api(base, '/api/boardroom/taal', { code: 'jv', aan: true }, owner)).status, 200);
  const pub = await api(base, '/api/talen', {});
  assert.ok(pub.body.talen.some(t => t.code === 'jv' && t.naam === 'Basa Jawa'), 'Javaans staat in de kiezer');
});
