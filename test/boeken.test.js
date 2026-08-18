/* RTG Boeken: de huisbibliotheek, de leesvoortgang die met je account
   meereist (en alleen die plek -- geen leesstatistieken), en de dichte
   poort zonder token.
   Draai los: node --test test/boeken.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-boeken-'));

function api(pad, body, tok) {
  return fetch(base + '/api/boeken' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || token) },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const r = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Leeslid', email: 'bk' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1985-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) });
  token = (await r.json()).token;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de huisbibliotheek staat klaar en een boek heeft echt tekst', async () => {
  const b = await api('/bieb');
  assert.equal(b.status, 200);
  assert.ok(b.body.boeken.length >= 5, 'een gevulde startplank');
  assert.ok(b.body.boeken.every(x => x.titel && x.woorden > 50), 'elke titel draagt een echt verhaal');
  const boek = await api('/boek', { id: 'haas' });
  assert.equal(boek.status, 200);
  assert.match(boek.body.tekst, /schildpad/i);
  assert.equal((await api('/boek', { id: 'bestaat-niet' })).status, 404);
});

test('2. de leesplek reist mee: zetten, teruglezen, en alleen de plek', async () => {
  const zet = await api('/lees', { boek: 'haas', plek: 0.42 });
  assert.equal(zet.status, 200);
  assert.equal(zet.body.plek, 0.42);
  await api('/lees', { boek: 'kluis:abc123', plek: 1 });
  const v = await api('/voortgang');
  assert.equal(v.body.voortgang.haas.plek, 0.42);
  assert.equal(v.body.voortgang['kluis:abc123'].plek, 1, 'ook een kluisboek heeft gewoon een plek');
  const sleutels = Object.keys(v.body.voortgang.haas);
  assert.deepEqual(sleutels.sort(), ['op', 'plek'], 'niet meer dan de plek en het moment -- geen statistieken');
});

test('3. nette grenzen: rare plekken geweigerd, en dicht zonder token', async () => {
  assert.equal((await api('/lees', { boek: 'haas', plek: 1.4 })).status, 400);
  assert.equal((await api('/lees', { boek: '', plek: 0.5 })).status, 400);
  assert.equal((await api('/bieb', {}, 'nep')).status, 401);
  assert.equal((await api('/lees', { boek: 'haas', plek: 0.5 }, 'nep')).status, 401);
});
