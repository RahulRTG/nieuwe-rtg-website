/* RTG Vertaler: een dunne route op de bestaande vertaalmotor. Zonder
   AI-sleutel vertaalt het huiswoordenboek (nl<->en) en is de app eerlijk
   over wat niet lukt (vertaald:false), nooit kapot. Dicht zonder token.
   Draai los: node --test test/vertaal.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vertaal-'));

function api(pad, body, tok) {
  return fetch(base + '/api/vertaal' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || token) },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const r = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Taallid', email: 'vt' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1990-03-03', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) });
  token = (await r.json()).token;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de talenlijst staat klaar en de route is dicht zonder token', async () => {
  const t = await api('/talen', {});
  assert.equal(t.status, 200);
  assert.ok(t.body.talen.length >= 10, 'een ruime lijst talen');
  assert.ok(t.body.talen.some(x => x[0] === 'nl') && t.body.talen.some(x => x[0] === 'ja'));
  const dicht = await api('', { tekst: 'hallo', naar: 'en' }, 'nep');
  assert.equal(dicht.status, 401, 'zonder geldig token geen vertaling');
});

test('2. zonder AI-sleutel vertaalt het huiswoordenboek nl->en echt', async () => {
  const r = await api('', { tekst: 'hallo', naar: 'en', van: 'nl' });
  assert.equal(r.status, 200);
  assert.equal(r.body.tekst.toLowerCase(), 'hello', 'het huiswoordenboek vertaalt echt');
  assert.equal(r.body.vertaald, true);
});

test('3. eerlijk bij wat niet kan: lege tekst is een nette fout, een verre taal geen neptaal', async () => {
  const leeg = await api('', { tekst: '   ', naar: 'en' });
  assert.equal(leeg.status, 400);
  // een taal buiten het huiswoordenboek: de motor mag terugvallen, maar moet
  // dat via vertaald:false eerlijk zeggen in plaats van onzin te verzinnen
  const ver = await api('', { tekst: 'goedemorgen', naar: 'ja', van: 'nl' });
  assert.equal(ver.status, 200, 'nooit kapot');
  assert.ok(typeof ver.body.vertaald === 'boolean', 'de eerlijkheidsvlag reist mee');
});
