/* De satellietlaag: alles wat de app bruikbaar houdt op een trage verbinding
   met hoge vertraging (satelliet, buitengebied, traag mobiel). We toetsen:
   1. het piepkleine peil-endpoint /api/sat/ping (zonder inloggen);
   2. gzip op API-antwoorden (grote JSON wel, kleine niet: daar kost het meer
      dan het oplevert);
   3. gzip op de app-pagina's zelf (de CSP-nonce-handler);
   4. dat de gedeelde verbindingslaag met de satellietmodus geserveerd wordt.
   Draai los: node --experimental-sqlite --test test/satelliet.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sat-'));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('sat/ping: het kleinst mogelijke antwoord, zonder inloggen en zonder gzip-overhead', async () => {
  const r = await fetch(base + '/api/sat/ping');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-encoding'), null, 'te klein om te comprimeren');
  const tekst = await r.text();
  assert.ok(tekst.length < 80, 'een paar tientallen bytes, meer niet');
  const d = JSON.parse(tekst);
  assert.equal(d.ok, 1);
  assert.ok(Math.abs(d.t - Date.now()) < 60000, 'de servertijd loopt mee');
});

test('grote API-antwoorden gaan gecomprimeerd over de lijn, kleine niet', async () => {
  // klein: health blijft ongecomprimeerd
  const klein = await fetch(base + '/api/health', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(klein.headers.get('content-encoding'), null);
  // groot: de ledenstaat van een pas-login is vele kilobytes
  const login = await (await fetch(base + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' })
  })).json();
  const r = await fetch(base + '/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token, 'Accept-Encoding': 'gzip' },
    body: JSON.stringify({})
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-encoding'), 'gzip', 'de staat gaat gecomprimeerd over de lijn');
  const d = await r.json();
  assert.ok(d.state, 'en is na uitpakken gewoon leesbaar');
  // wie geen gzip aankan krijgt gewoon platte JSON
  const plat = await fetch(base + '/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token, 'Accept-Encoding': 'identity' },
    body: JSON.stringify({})
  });
  assert.equal(plat.headers.get('content-encoding'), null);
  assert.ok((await plat.json()).state);
});

test('de app-pagina\'s zelf gaan ook gecomprimeerd over de lijn', async () => {
  const r = await fetch(base + '/apps/app.html', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-encoding'), 'gzip');
  assert.match(r.headers.get('content-security-policy') || '', /nonce-/, 'de nonce-CSP blijft gewoon staan');
  assert.match(await r.text(), /<html/i, 'en de pagina is na uitpakken heel');
});

test('de verbindingslaag met de satellietmodus staat voor elke app klaar', async () => {
  const r = await fetch(base + '/shared/verbinding.js');
  assert.equal(r.status, 200);
  const js = await r.text();
  assert.match(js, /Satelliet/, 'de satellietmodus zit erin');
  assert.match(js, /rtg_sat/, 'met de auto\\/aan\\/uit-stand');
});
