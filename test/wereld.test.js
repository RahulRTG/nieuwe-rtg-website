/* De wereld van het kantoor: alles in het veld als bolletje (groen = oke,
   oranje = uit, rood = storing), met reset- en hulpknoppen die als opdracht
   bij de doos landen. Plus de 9+-veiligheidsronde: het auditlog (wie deed
   wat), de sleutelwacht met lockout na brute force, en de extra
   security-headers. Draai los:
   node --experimental-sqlite --test test/wereld.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const SLEUTEL = 'wereld-test-sleutel-1234';
let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wereld-'));

const api = (pad, body) => fetch(base + '/api/office/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const meet = (body, sleutel) => fetch(base + '/api/doos/meting', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': sleutel === undefined ? SLEUTEL : sleutel },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'WERELD-KEURING-1', RTG_DOOS_SLEUTEL: SLEUTEL } });
  base = srv.base;
  // wereld-acties zijn boardroom-besluiten: de eigenaar logt in met zijn account
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })
  });
  token = (await login.json()).token;
  assert.ok(token, 'het kantoor logt in');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de wereld: bolletjes per doos en functie, met de juiste kleuren', async () => {
  // twee dozen melden zich: een gezonde (met plek) en een met de lijn eruit
  assert.equal((await meet({ doos: 'beachclub-sol', rtt: 340, modus: 'cloud', journaal: 0, plek: { lat: 38.98, lon: 1.3 } })).status, 200);
  assert.equal((await meet({ doos: 'strandtent-west', rtt: 0, modus: 'lokaal', journaal: 4 })).status, 200);
  // en een functie gaat bewust uit via het schakelbord
  const alle = (await api('boardroom')).body.functies.flatMap(g => g.functies);
  const fx = alle[0];
  assert.ok((await api('boardroom/schakel', { functie: fx.id, aan: false, naam: 'Keurmeester' })).body.ok);

  const w = await api('wereld');
  assert.equal(w.status, 200);
  const items = w.body.items;
  const sol = items.find(i => i.id === 'doos:beachclub-sol');
  assert.equal(sol.status, 'groen', 'een gezonde doos is groen');
  assert.deepEqual(sol.plek, { lat: 38.98, lon: 1.3 }, 'de plek staat op de kaart');
  assert.ok(!sol.acties.includes('reset'), 'groen heeft geen reset-knop');
  const west = items.find(i => i.id === 'doos:strandtent-west');
  assert.equal(west.status, 'rood', 'lijn weg is een storing: rood');
  assert.ok(west.acties.includes('reset') && west.acties.includes('hulp'), 'rood krijgt de knoppen');
  const fbol = items.find(i => i.id === 'functie:' + fx.id);
  assert.equal(fbol.status, 'oranje', 'een bewust uitgezette functie is oranje');
  assert.ok(items.some(i => i.id === 'systeem:cloud' && i.status === 'groen'), 'het huis zelf staat er ook op');
  assert.ok(w.body.telling.rood >= 1 && w.body.telling.groen >= 2 && w.body.telling.oranje >= 1, 'de telling klopt');
  await api('boardroom/schakel', { functie: fx.id, aan: true, naam: 'Keurmeester' }); // netjes terug
});

test('de wereldknop: reset wordt een opdracht die de doos bij zijn melding ophaalt', async () => {
  const r = await api('wereld/actie', { id: 'doos:strandtent-west', actie: 'reset', naam: 'Keurmeester' });
  assert.equal(r.status, 200);
  assert.equal((await api('wereld/actie', { id: 'doos:strandtent-west', actie: 'reset' })).status, 409, 'niet dubbel dezelfde opdracht');
  assert.equal((await api('wereld/actie', { id: 'doos:bestaat-niet', actie: 'reset' })).status, 404);
  // de doos meldt zich: de opdracht komt mee, precies een keer
  const m1 = await meet({ doos: 'strandtent-west', rtt: 250, modus: 'cloud', journaal: 0 });
  assert.equal(m1.body.opdracht, 'reset', 'de opdracht reist mee met de meting');
  const m2 = await meet({ doos: 'strandtent-west', rtt: 250, modus: 'cloud', journaal: 0 });
  assert.equal(m2.body.opdracht, undefined, 'daarna is hij afgehandeld');
});

test('het auditlog: elke schakeling en wereldknop is terug te lezen, met naam', async () => {
  const b = await api('boardroom');
  assert.ok(Array.isArray(b.body.audit) && b.body.audit.length >= 2, 'het logboek staat in de boardroom');
  assert.ok(b.body.audit.some(a => a.wie === 'Keurmeester' && /reset voor doos strandtent-west/.test(a.wat)), 'de wereldknop staat erin');
  assert.ok(b.body.audit.some(a => a.wie === 'Keurmeester' && /AAN gezet|UIT gezet/.test(a.wat)), 'de schakeling staat erin met naam');
  // en de Veiligheid-groep telt mee op het statsbord
  const s = await api('stats');
  const veilig = s.body.stats.find(g => g.groep === 'Veiligheid');
  assert.ok(veilig, 'het statsbord heeft een Veiligheid-groep');
  assert.ok(veilig.items.find(i => i[0] === 'Audit-regels (24u)')[1] >= 2);
});

test('9+-headers: COOP, CORP en dichtgezette browser-API-rechten op elk antwoord', async () => {
  const r = await fetch(base + '/api/sat/ping');
  assert.equal(r.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(r.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(r.headers.get('x-permitted-cross-domain-policies'), 'none');
  assert.match(r.headers.get('permissions-policy') || '', /payment=\(\)/);
});

test('de sleutelwacht: na acht verkeerde sleutels gaat de deur een kwartier dicht', async () => {
  for (let i = 0; i < 8; i++) {
    assert.equal((await meet({ doos: 'x', rtt: 1 }, 'helemaal-verkeerde-sleutel')).status, 403);
  }
  assert.equal((await meet({ doos: 'x', rtt: 1 }, 'helemaal-verkeerde-sleutel')).status, 429, 'de negende ketst op de lockout');
  assert.equal((await meet({ doos: 'beachclub-sol', rtt: 300 })).status, 429, 'ook een juiste sleutel komt er dan niet meer in');
  // en de afketsers tellen mee op het Veiligheid-bord
  const s = await api('stats');
  const veilig = s.body.stats.find(g => g.groep === 'Veiligheid');
  assert.ok(veilig.items.find(i => i[0] === 'Sleutel-afketsers (24u)')[1] >= 8);
});
