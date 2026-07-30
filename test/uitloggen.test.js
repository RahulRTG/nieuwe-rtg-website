/* UITLOGGEN MOET ECHT UITLOGGEN.

   Gevonden in aanvalsronde 2 (scripts/aanval.js, punt 14), en het is het soort
   gat dat je alleen vindt door het te DOEN in plaats van te lezen:

     POST /api/logout  ->  { ok: true }
     POST /api/state   ->  200, gewoon nog ingelogd

   De oorzaak zat in een aanname. Sessietokens van echte leden zijn staatloos
   ondertekend (HMAC), dus er is server-side niets om weg te gooien. De
   uitlog-route liep alleen over de `sessions`-map -- die dekt de demo-sessies,
   maar een echt ledenaccount komt via accounts.verifyToken binnen en staat daar
   helemaal niet in. Voor elk gewoon lid deed uitloggen dus niets, dertig dagen
   lang, terwijl het scherm "u bent uitgelogd" zei.

   Op een geleende laptop of een gedeelde computer is dat precies het moment
   waarop iemand denkt veilig te zijn. Daarom staat deze test er.

   Draai los: node --experimental-sqlite --test test/uitloggen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitlog-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function nieuwLid(n) {
  const u = (Date.now() + n).toString().slice(-9);
  const r = await api('/api/auth/register', { name: 'Uitlog' + n, email: 'ul' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  return r.body.token;
}

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. na uitloggen is het token dood', async () => {
  const t = await nieuwLid(1);
  assert.ok(t, 'lid geregistreerd');
  assert.equal((await api('/api/state', {}, t)).status, 200, 'voor het uitloggen werkt het');

  const uit = await api('/api/logout', {}, t);
  assert.equal(uit.status, 200, 'uitloggen lukt');

  const na = await api('/api/state', {}, t);
  assert.equal(na.status, 401, 'en daarna is dezelfde sleutel niets meer waard');
});

test('2. uitloggen raakt alleen dat token, niet het account', async () => {
  const t = await nieuwLid(2);
  await api('/api/logout', {}, t);
  // opnieuw inloggen hoort gewoon te kunnen: we trekken een SLEUTEL in, geen account
  const opnieuw = await api('/api/auth/login', { login: 'ul' + (Date.now() + 2).toString().slice(-9) + '@x.nl', password: 'geheim12345' });
  assert.notEqual(opnieuw.status, 500, 'de inlogroute blijft gewoon werken na een intrekking');
});

test('3. twee apparaten: het ene uitloggen laat het andere staan', async () => {
  /* Dit is waarom er een LIJST van ingetrokken tokens is en niet een teller per
     account: wie op zijn telefoon uitlogt, hoort niet van zijn laptop te vliegen. */
  const u = Date.now().toString().slice(-9);
  const reg = await api('/api/auth/register', { name: 'Twee Apparaten', email: 'tw' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const telefoon = reg.body.token;
  const laptop = (await api('/api/auth/login', { login: 'tw' + u + '@x.nl', password: 'geheim12345' })).body.token;
  assert.ok(laptop && laptop !== telefoon, 'twee verschillende sleutels');

  await api('/api/logout', {}, telefoon);
  assert.equal((await api('/api/state', {}, telefoon)).status, 401, 'de telefoon is uitgelogd');
  assert.equal((await api('/api/state', {}, laptop)).status, 200, 'de laptop blijft ingelogd');
});

test('4. een ingetrokken token blijft dood, ook bij herhaald proberen', async () => {
  const t = await nieuwLid(4);
  await api('/api/logout', {}, t);
  for (let i = 0; i < 3; i++)
    assert.equal((await api('/api/state', {}, t)).status, 401, 'poging ' + (i + 1) + ' blijft geweigerd');
});
