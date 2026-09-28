/* THUIS: de reis is voorbij en de reiziger is terug -- kern/reisbureau-thuis.js
   (besluit C3, AUTONOMIE.md par. 2.5). Tegen een echte server, want dit zijn
   twee nieuwe routes.

   ZES BEWERINGEN, en ze kunnen alle zes zakken:

   1. een reis die nog moet vertrekken kan niet thuis zijn;
   2. een aanvraag die nog niet bevestigd is ook niet;
   3. het lid meldt zijn EIGEN vertrokken reis thuis, en het spoor zegt dat hij het was;
   4. een ander lid kan dat niet -- 404, zoals bij elke reis die niet van hem is;
   5. een tweede melding verandert niets (409, de reis is al thuis);
   6. het kantoor meldt hem ook, en het lid ziet niet wie in het kantoor dat deed.

   Draai: node --test test/reisbureau-thuis.test.js */
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
const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

let srv, base, lid, ander, office;
const mappen = [];

async function registreer(naam) {
  const u = Date.now().toString().slice(-7) + Math.floor(Math.random() * 90 + 10);
  const r = await api(base, '/api/auth/register', { name: naam, email: 't' + u + '@x.nl', phone: '06' + u.slice(-8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  assert.ok(r.body.token, 'registreren lukt');
  return r.body.token;
}
async function reis(vertrek, bevestig = true) {
  const cat = await api(base, '/api/reisbureau', {}, lid);
  const trips = cat.body.reizen;
  for (const t of trips) {
    const a = await api(base, '/api/reisbureau/boek', { tripId: t.id, personen: 1, vertrek }, lid);
    if (a.status !== 200) continue;
    const ref = a.body.aanvraag.ref;
    if (bevestig) {
      const ok = await api(base, '/api/office/reisbureau/besluit', { ref, besluit: 'bevestigd', bericht: 'Staat.' }, office);
      assert.equal(ok.body.aanvraag.status, 'bevestigd');
    }
    return ref;
  }
  throw new Error('geen reis te boeken');
}
const mijne = async (ref, tok) => (await api(base, '/api/reisbureau/mijn', {}, tok || lid)).body.aanvragen.find(a => a.ref === ref);

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-thuis-')); mappen.push(TMP);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = await registreer('Reiziger Thuis');
  ander = await registreer('Ander Lid');
  office = (await api(base, '/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(office);
});
test.after(() => {
  stop(srv && srv.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) { /* opruimen */ } }
});

test('1. een reis die nog moet vertrekken kan niet thuis zijn', async () => {
  const ref = await reis(dag(30));
  const r = await api(base, '/api/reisbureau/thuis', { ref }, lid);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /nog niet vertrokken/);
  assert.equal((await mijne(ref)).status, 'bevestigd');
});

test('2. een aanvraag die nog niet bevestigd is ook niet', async () => {
  const ref = await reis(dag(-10), false);
  const r = await api(base, '/api/reisbureau/thuis', { ref }, lid);
  assert.equal(r.status, 409);
  assert.equal((await mijne(ref)).status, 'aangevraagd');
});

test('3, 4 en 5. het lid meldt zijn eigen reis thuis, een ander niet, en twee keer is een keer', async () => {
  const ref = await reis(dag(-7));
  assert.equal((await api(base, '/api/reisbureau/thuis', { ref }, ander)).status, 404, 'een ander lid ziet deze reis niet');
  const r = await api(base, '/api/reisbureau/thuis', { ref }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const a = await mijne(ref);
  assert.equal(a.status, 'thuis');
  assert.equal(a.thuis.door, 'lid');
  assert.equal(a.geschiedenis.at(-1).wat, 'thuis');
  assert.equal(a.geschiedenis.at(-1).door, 'u');
  const nog = await api(base, '/api/reisbureau/thuis', { ref }, lid);
  assert.equal(nog.status, 409, 'een tweede melding is geen tweede thuiskomst');
  assert.equal((await mijne(ref)).geschiedenis.filter(g => g.wat === 'thuis').length, 1);
});

test('6. het kantoor meldt hem ook, en het lid ziet niet wie', async () => {
  const ref = await reis(dag(-3));
  const r = await api(base, '/api/office/reisbureau/thuis', { ref }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const a = await mijne(ref);
  assert.equal(a.status, 'thuis');
  assert.equal(a.thuis.door, 'reisbureau');
  assert.equal(a.geschiedenis.at(-1).door, 'het reisbureau', 'de naam van de medewerker blijft in het kantoor');
});
