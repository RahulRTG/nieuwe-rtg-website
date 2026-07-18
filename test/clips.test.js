/* RTG Clips: korte verticale video's die alleen op het toestel van de maker
   staan (OPFS). De server bewaart enkel de kaart (titel, duur, affiche) en
   relayeert signalen; de feed is een eindige dagselectie zonder oneindige
   scroll. Draai los: node --experimental-sqlite --test test/clips.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, maker, kijker, office, clipId;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-clips-'));
const POSTER = 'data:image/jpeg;base64,/9j/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  return (await api('/api/auth/register', { name: naam, email: 'clip' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1993-03-03', geslacht: 'x', tier: 'rtg', pasApp: 'rtg' })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  maker = await lid('Maker'); kijker = await lid('Kijker');
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(maker && kijker && office, 'maker, kijker en kantoor zijn ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. maken: alleen de kaart naar RTG; de duur is begrensd op 60 seconden', async () => {
  assert.equal((await api('/api/clips/maak', { titel: '', duurS: 10 }, maker)).status, 400, 'zonder titel niet');
  assert.equal((await api('/api/clips/maak', { titel: 'Te lang', duurS: 90 }, maker)).status, 400, 'langer dan 60s niet');
  const r = await api('/api/clips/maak', { titel: 'Zonsondergang haven', duurS: 30, mbGeschat: 5, poster: POSTER }, maker);
  assert.equal(r.status, 200);
  clipId = r.body.id;
  assert.ok(clipId, 'de kaart heeft een id; het beeld zelf komt nooit bij RTG');
});

test('2. de feed: eindige dagselectie met een expliciet einde, maker online', async () => {
  const r = await api('/api/clips/feed', {}, kijker);
  assert.equal(r.status, 200);
  const c = r.body.clips.find(x => x.id === clipId);
  assert.ok(c, 'de kijker ziet de clip in de dagselectie');
  assert.equal(c.online, true, 'de maker is net actief, dus online');
  assert.equal(c.volgIk, false);
  assert.ok(r.body.einde, 'de feed heeft een expliciet einde (geen oneindige scroll)');
  assert.ok(r.body.clips.length <= 25, 'de dagselectie is begrensd');
});

test('3. volgen: gevolgde makers staan voortaan bovenaan de selectie', async () => {
  const v = await api('/api/clips/volg', { id: clipId, aan: true }, kijker);
  assert.equal(v.status, 200);
  const r = await api('/api/clips/feed', {}, kijker);
  assert.equal(r.body.clips.find(x => x.id === clipId).volgIk, true);
  assert.equal((await api('/api/clips/volg', { id: clipId }, maker)).status, 400, 'uzelf volgen hoeft niet');
});

test('4. het signaal-doorgeefluik: kijker vraagt, regels bewaakt', async () => {
  assert.equal((await api('/api/clips/signaal', { id: clipId, kind: 'vraag' }, kijker)).status, 200,
    'de vraag gaat door naar de maker (SSE)');
  assert.equal((await api('/api/clips/signaal', { id: clipId, kind: 'raar' }, kijker)).status, 400, 'onbekend signaal niet');
  assert.equal((await api('/api/clips/signaal', { id: clipId, kind: 'offer' }, maker)).status, 400,
    'de maker antwoordt altijd gericht aan een kijker');
});

test('5. reacties en melden; kantoor ziet de melding en kan de kaart weghalen', async () => {
  const re = await api('/api/clips/reactie', { id: clipId, tekst: 'Prachtig licht!' }, kijker);
  assert.equal(re.status, 200);
  assert.equal((await api('/api/clips/reacties', { id: clipId }, kijker)).body.reacties.length, 1);
  assert.equal((await api('/api/clips/meld', { id: clipId, reden: 'test' }, kijker)).status, 200);
  const lijst = await api('/api/office/clips', {}, office);
  assert.ok(lijst.body.meldingen.some(m => m.clipId === clipId), 'de melding ligt bij kantoor');
  // weghalen door een ander lid kan niet; door kantoor wel
  assert.equal((await api('/api/clips/weg', { id: clipId }, kijker)).status, 404);
  assert.equal((await api('/api/office/clips/verwijder', { id: clipId }, office)).status, 200);
  const na = await api('/api/clips/feed', {}, kijker);
  assert.ok(!na.body.clips.some(x => x.id === clipId), 'de kaart is weg; het beeld stond toch al alleen bij de maker');
});
