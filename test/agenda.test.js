/* Tests voor de persoonlijke AI-agenda (kern/agenda.js): leden en leveranciers
   hebben een eigen agenda; de AI zet gewone taal om naar datum + tijd; de telling
   voedt de ballon-badge. Draai: npm test */
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
function morgen() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

let srv, base, lid, sup;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-agenda-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Agenda Lid', email: 'a' + u + '@x.nl', phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  sup = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. een lid plant een afspraak en de telling loopt op', async () => {
  let r = (await api(base, '/api/agenda/mijn-lijst', {}, lid)).body;
  assert.equal(r.telling, 0, 'nog niets gepland');
  r = (await api(base, '/api/agenda/toevoegen', { titel: 'Tandarts', datum: morgen(), tijd: '09:30' }, lid)).body;
  assert.equal(r.items.length, 1);
  assert.equal(r.telling, 1, 'de badge telt EGn aankomende afspraak');
  assert.equal(r.items[0].tijd, '09:30');
});

test('2. de AI zet gewone taal om naar een datum (zonder Claude via de parser)', async () => {
  const r = (await api(base, '/api/agenda/ai', { opdracht: 'lunch met Sofia morgen om 13u' }, lid)).body;
  assert.equal(r.gedaan, true, 'de AI plande het in');
  const nieuw = r.items.find(i => /Sofia|lunch/i.test(i.titel));
  assert.ok(nieuw, 'de afspraak staat in de agenda');
  assert.equal(nieuw.datum, morgen(), 'morgen correct uitgerekend');
  assert.equal(nieuw.tijd, '13:00', 'om 13u -> 13:00');
});

test('3. de AI weigert netjes als er geen datum in zit', async () => {
  const r = (await api(base, '/api/agenda/ai', { opdracht: 'iets doen ergens ooit' }, lid)).body;
  assert.ok(!r.gedaan, 'niets ingepland');
  assert.ok(/datum/i.test(r.antwoord), 'vraagt om een datum');
});

test('4. verwijderen werkt en de telling daalt', async () => {
  let r = (await api(base, '/api/agenda/mijn-lijst', {}, lid)).body;
  const eerste = r.items[0];
  const voor = r.telling;
  r = (await api(base, '/api/agenda/verwijder', { id: eerste.id }, lid)).body;
  assert.ok(r.telling < voor, 'de telling daalde na verwijderen');
});

test('5. een leverancier heeft een eigen agenda, los van het lid', async () => {
  let r = (await api(base, '/api/supplier/agenda/lijst', {}, sup)).body;
  assert.equal(r.items.length, 0, 'de leverancier-agenda is leeg (niet die van het lid)');
  r = (await api(base, '/api/supplier/agenda/ai', { opdracht: 'teamoverleg vrijdag om 10u' }, sup)).body;
  assert.equal(r.gedaan, true);
  assert.ok(r.items.some(i => /teamoverleg/i.test(i.titel) && i.tijd === '10:00'), 'leverancier plande zijn overleg');
  // het lid ziet dit niet
  const lidLijst = (await api(base, '/api/agenda/mijn-lijst', {}, lid)).body;
  assert.ok(!lidLijst.items.some(i => /teamoverleg/i.test(i.titel)), 'agendas zijn gescheiden');
});
