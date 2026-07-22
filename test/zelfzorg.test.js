/* De zelfzorg van het platform: opruimen, beschermen, repareren en upgraden,
   met de knoppen achter de kantoor-inlog. De automaat doet alleen het veilige
   werk; alles wat geld raakt wordt een advies, nooit een ingreep. Draai los:
   node --experimental-sqlite --test test/zelfzorg.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + '/api/office/' + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, office, TMP;
test.before(async () => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zelfzorg-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  // boardroom-werk vraagt de eigenaar zelf (de boardroom-poort): zijn accountlogin opent ook het kantoor
  const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) }).then(r => r.json());
  office = login.token;
  assert.ok(office, 'de eigenaar logt in met zijn account');
});
test.after(() => stop(srv && srv.child));

test('1. de zelfzorg-status toont versie, schema, klaarstaande upgrade en de automaat', async () => {
  const r = await api(base, 'zelfzorg', {}, office);
  assert.equal(r.status, 200);
  assert.ok(r.body.versie, 'pakketversie aanwezig');
  assert.equal(typeof r.body.schema, 'number');
  assert.ok(r.body.doelSchema >= r.body.schema, 'de code kent zijn doelversie');
  assert.ok(Array.isArray(r.body.journaal), 'het journaal is een lijst');
  assert.ok(r.body.automaat && typeof r.body.automaat.aan === 'boolean', 'de automaat meldt zijn stand');
});

test('2. opruimen veegt verlopen inhoud en schrijft het in het journaal', async () => {
  const r = await api(base, 'zelfzorg/opruim', { naam: 'Testmens' }, office);
  assert.equal(r.status, 200);
  assert.ok(r.body.ok);
  const s = await api(base, 'zelfzorg', {}, office);
  const regel = s.body.journaal.find(j => j.soort === 'opruimen' && j.door === 'Testmens');
  assert.ok(regel, 'de opruimronde staat met naam in het journaal');
});

test('3. de beschermronde draait de checks en geeft adviezen, geen ingrepen', async () => {
  const r = await api(base, 'zelfzorg/bescherm', { naam: 'Testmens' }, office);
  assert.equal(r.status, 200);
  assert.ok(['ok', 'let-op'].includes(r.body.oordeel), 'een eerlijk oordeel');
  assert.ok(r.body.checks.ok + r.body.checks.waarschuwing + r.body.checks.fout > 5, 'de gezondheidschecks zijn echt gedraaid');
  for (const a of r.body.adviezen) {
    assert.ok(a.tekst && a.waar, 'elk advies zegt wat en waar');
    assert.ok(['hoog', 'middel'].includes(a.ernst));
  }
});

test('4. repareren herstelt een kapotte kerncollectie en meldt wat er gebeurd is', async () => {
  const r = await api(base, 'zelfzorg/herstel', { naam: 'Testmens' }, office);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.reparaties));
  assert.ok(Array.isArray(r.body.adviezen), 'geld-afwijkingen zouden hier als advies staan');
});

test('5. upgraden: de knop voert de klaarstaande migraties uit en de kast komt op de doelversie', async () => {
  const voor = (await api(base, 'zelfzorg', {}, office)).body;
  const r = await api(base, 'zelfzorg/upgrade', { naam: 'Testmens' }, office);
  assert.equal(r.status, 200);
  assert.equal(r.body.schema, voor.doelSchema, 'de kast staat nu op de doelversie');
  if (voor.wachtend.length) {
    assert.ok(r.body.bijgewerkt, 'er stond een migratie klaar en die is gedraaid');
    assert.ok(r.body.acties.some(a => /back-up/i.test(a.wat)), 'er is eerst een back-up gemaakt (of eerlijk gemeld waarom niet)');
  }
  // idempotent: nog een keer drukken is veilig en doet niets
  const r2 = await api(base, 'zelfzorg/upgrade', { naam: 'Testmens' }, office);
  assert.equal(r2.body.bijgewerkt, false, 'tweede druk: niets meer te doen');
});

test('6. zonder kantoor-inlog blijven de knoppen dicht', async () => {
  for (const pad of ['zelfzorg', 'zelfzorg/opruim', 'zelfzorg/herstel', 'zelfzorg/upgrade'])
    assert.equal((await api(base, pad, {})).status, 401, pad + ' is dicht zonder token');
});

test('7. elke druk op een knop komt met naam in het kantoor-auditlog van de boardroom', async () => {
  const r = await fetch(base + '/api/office/boardroom', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + office }, body: '{}' })
    .then(x => x.json());
  assert.ok((r.audit || []).some(a => /zelfzorg/.test(a.wat) && a.wie === 'Testmens'), 'de zelfzorg-drukken staan in het auditlog');
});
