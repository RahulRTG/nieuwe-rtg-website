/* Het Thuisarchief van RTG Theater: de maker bewaart de video op het eigen
   apparaat; RTG bewaart alleen titel en affiche. Kijken loopt rechtstreeks
   (WebRTC-datakanaal) van maker naar kijker; de server is puur doorgeefluik
   voor de signalering en heeft de bytes nooit. Draai los:
   node --experimental-sqlite --test test/theater-thuis.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office, maker, kijker, videoId;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-thuis-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Lid ' + seq, email: 'h' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  return reg.body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  maker = await lid(); kijker = await lid();
  const aan = await api('/api/theater/kanaal/aanmeld', { naam: 'Thuisatelier', genre: 'ambacht' }, maker);
  await api('/api/office/theater/beslis', { id: aan.body.kanaal.id, besluit: 'goedgekeurd' }, office);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een thuis-video bestaat bij ons alleen als titel en affiche, nooit als bytes', async () => {
  const kaart = await api('/api/theater/video/maak', { titel: 'Avondlicht', bewaring: 'thuis', duurS: 42, mbGeschat: 180 }, maker);
  assert.equal(kaart.status, 200);
  videoId = kaart.body.id;
  const zaal = await api('/api/theater/zaal', {}, kijker);
  const v = (zaal.body.nieuw || []).find(x => x.id === videoId);
  assert.ok(v, 'de kaart staat in de zaal');
  assert.equal(v.bewaring, 'thuis');
  assert.equal(v.online, false, 'zonder de maker erbij is het werk offline');
  const kijk = await fetch(base + '/api/theater/kijk/' + videoId + '?token=' + encodeURIComponent(kijker));
  assert.equal(kijk.status, 404, 'de server heeft de bytes niet en kan ze dus ook nooit geven');
  const dicht = await api('/api/theater/signaal', { id: videoId, kind: 'vraag' }, kijker);
  assert.equal(dicht.status, 409, 'zonder de maker online is er niets op te vragen');
  const mediaMap = path.join(TMP, 'theater');
  assert.ok(!fs.existsSync(mediaMap) || !fs.readdirSync(mediaMap).some(f => f.startsWith(videoId)),
    'er staat niets van deze video op onze schijf');
});

test('2. de aanwezigheid van de maker zet het werk online (en verloopt vanzelf)', async () => {
  const aanw = await api('/api/theater/thuis/aanwezig', { ids: [videoId] }, maker);
  assert.equal(aanw.status, 200);
  const zaal = await api('/api/theater/zaal', {}, kijker);
  assert.equal(zaal.body.nieuw.find(x => x.id === videoId).online, true, 'de maker is er: het werk is te bekijken');
  const vreemd = await api('/api/theater/thuis/aanwezig', { ids: [videoId] }, kijker);
  assert.equal((vreemd.body.geaccepteerd || []).length, 0, 'alleen de maker zelf kan zijn werk aanbieden');
});

test('3. de signalering is een puur doorgeefluik tussen kijker en maker', async () => {
  const vraag = await api('/api/theater/signaal', { id: videoId, kind: 'vraag' }, kijker);
  assert.equal(vraag.status, 200, 'de kijker klopt aan bij de maker (nu die online is)');
  const zonderDoel = await api('/api/theater/signaal', { id: videoId, kind: 'offer', payload: { sdp: 'x' } }, maker);
  assert.equal(zonderDoel.status, 400, 'de maker antwoordt altijd gericht aan een kijker');
  const onbekend = await api('/api/theater/signaal', { id: 'nep', kind: 'vraag' }, kijker);
  assert.equal(onbekend.status, 404);
  const gek = await api('/api/theater/signaal', { id: videoId, kind: 'hack' }, kijker);
  assert.equal(gek.status, 400, 'alleen de vaste signaalsoorten');
});

test('4. verwijderen van een thuis-video is alleen de kaart weghalen', async () => {
  const weg = await api('/api/theater/verwijder', { id: videoId }, maker);
  assert.equal(weg.status, 200);
  const zaal = await api('/api/theater/zaal', {}, kijker);
  assert.ok(!(zaal.body.nieuw || []).some(x => x.id === videoId));
});
