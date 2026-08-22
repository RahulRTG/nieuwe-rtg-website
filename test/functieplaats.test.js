/* De plaats-as van de schakelkast: een functie per STAD of DORP dicht.

   Fijner dan het land, grover dan de persoon. De sleutel is de woonplaats die
   het lid bij registratie opgaf, genormaliseerd (plaatsNorm) aan BEIDE kanten:
   wat de eigenaar intikt ("Den  HAAG") matcht wat het lid invulde ("den haag"),
   hoe ze ook typten. Precies dat -- de normalisatie aan twee kanten -- is de
   plek waar dit stuk kan gaan liegen, dus daar staat een eigen assertie op.

   De schakel loopt via /api/boardroom/zet (alleen de eigenaar, techniek-inlog),
   dezelfde route als de land- en persoon-assen in test/boardroom.test.js.

   Draai los: node --test test/functieplaats.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const OWNER = 'plaats-owner@x.nl';

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, owner, zaanToken, adamToken;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-plaats-'));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: OWNER } });
  base = srv.base;
  owner = (await api(base, '/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' })).body.token;
  assert.ok(owner, 'de eigenaar logt in op het techniekbord');
  const u = Date.now().toString().slice(-8);
  // een lid uit Zaandam -- bewust met rommel-spelling, want zo typen mensen
  const zaan = await api(base, '/api/auth/register', { name: 'Lid Zaandam', email: 'z' + u + '@x.nl',
    phone: '061' + u, password: 'geheim123', geboortedatum: '1990-01-01', plaats: '  ZAANDAM ', tier: 'rtg', pasApp: 'rtg' });
  zaanToken = zaan.body.token;
  const adam = await api(base, '/api/auth/register', { name: 'Lid Amsterdam', email: 'a' + u + '@x.nl',
    phone: '062' + u, password: 'geheim123', geboortedatum: '1990-01-01', plaats: 'Amsterdam', tier: 'rtg', pasApp: 'rtg' });
  adamToken = adam.body.token;
  assert.ok(zaanToken && adamToken, 'beide leden bestaan');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een functie dicht voor een plaats raakt alleen de leden uit die plaats', async () => {
  // nulmeting: beide leden komen in de Salon
  assert.equal((await api(base, '/api/salon/promo', {}, zaanToken)).status, 200, 'nulmeting Zaandam');
  assert.equal((await api(base, '/api/salon/promo', {}, adamToken)).status, 200, 'nulmeting Amsterdam');

  // de eigenaar sluit de Salon voor Zaandam -- met wéér een andere spelling,
  // zodat de normalisatie aan de schakelkant hier echt bewezen wordt
  const zet = await api(base, '/api/boardroom/zet', { id: 'salon', plaats: 'zaandam ', aan: false }, owner);
  assert.equal(zet.status, 200);

  const dicht = await api(base, '/api/salon/promo', {}, zaanToken);
  assert.equal(dicht.status, 503, 'het Zaandamse lid staat voor een dichte deur');
  assert.equal(dicht.body.reden, 'plaats', 'en de reden zegt eerlijk: de plaats');
  assert.match(String(dicht.body.error || ''), /woonplaats/, 'in een zin die een mens begrijpt');

  assert.equal((await api(base, '/api/salon/promo', {}, adamToken)).status, 200,
    'het Amsterdamse lid merkt er niets van');

  // en het bord toont de beperking als plaatsUit op de functie
  const st = await api(base, '/api/boardroom/status', {}, owner);
  const salon = st.body.functies.flatMap(g => g.functies).find(f => f.id === 'salon');
  assert.deepEqual(salon.plaatsUit, ['zaandam'], 'het bord draagt de genormaliseerde plaats');
});

test('de beperking weghalen zet de plaats weer open', async () => {
  const weg = await api(base, '/api/boardroom/zet', { id: 'salon', plaats: 'Zaandam', aan: true }, owner);
  assert.equal(weg.status, 200);
  assert.equal((await api(base, '/api/salon/promo', {}, zaanToken)).status, 200, 'Zaandam is weer binnen');
});

test('de wachterknop: de automaat per functie uit en weer aan', async () => {
  const uit = await api(base, '/api/boardroom/wachter', { id: 'salon', wachter: false }, owner);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.wachter, false);
  const st = await api(base, '/api/boardroom/status', {}, owner);
  const salon = st.body.functies.flatMap(g => g.functies).find(f => f.id === 'salon');
  assert.equal(salon.wachter, false, 'het bord toont dat de automaat hier uit staat');
  const aan = await api(base, '/api/boardroom/wachter', { id: 'salon', wachter: true }, owner);
  assert.equal(aan.body.wachter, true);
});

test('niet de eigenaar? dan schakelt er niets', async () => {
  const r = await api(base, '/api/boardroom/zet', { id: 'salon', plaats: 'Zaandam', aan: false }, zaanToken);
  assert.ok([401, 403].includes(r.status), 'een gewoon lid komt niet bij de schakelkast (' + r.status + ')');
  assert.equal((await api(base, '/api/salon/promo', {}, zaanToken)).status, 200, 'en er is dus ook niets dichtgegaan');
});
