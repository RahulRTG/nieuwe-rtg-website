/* RTG Memo: de memo-flow door de Bestanden-kluis (map Memo's, upload,
   lijst, prullenbak) en de eerlijke Rahul-samenvatting van het transcript
   -- zonder AI-sleutel een demo die zegt wat hij is, nooit neptekst.
   Draai los: node --experimental-sqlite --test test/memo.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-memo-'));

function api(pad, body, tok) {
  return fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || token) },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
// een klein nep-audiobestand: de kluis kijkt naar het mime-type, niet de inhoud
const WEBM = 'data:audio/webm;base64,' + Buffer.from('rtg-memo-demo-audio').toString('base64');

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const r = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Memolid', email: 'mm' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1988-02-02', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' }) });
  token = (await r.json()).token;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de memo-flow leeft in de kluis: map, upload, lijst en prullenbak', async () => {
  const map = await api('/api/bestanden/map', { naam: "Memo's" });
  assert.equal(map.status, 200);
  const up = await api('/api/bestanden/upload', { naam: 'memo-2026-07-27-0930.webm', map: map.body.id, dataUrl: WEBM });
  assert.equal(up.status, 200);
  let l = await api('/api/bestanden/mijn');
  const memo = l.body.items.find(x => x.id === up.body.id);
  assert.ok(memo && memo.map === map.body.id && memo.mime === 'audio/webm', 'de memo staat als gewoon bestand in de map');
  const haal = await api('/api/bestanden/haal', { id: up.body.id });
  assert.match(haal.body.dataUrl, /^data:audio\/webm;base64,/, 'afspelen haalt de audio gewoon uit de kluis');
  // weggooien is prullenbak, geen zwart gat
  await api('/api/bestanden/weg', { id: up.body.id });
  l = await api('/api/bestanden/mijn');
  assert.equal(l.body.items.find(x => x.id === up.body.id).weg, true);
});

test('2. de samenvatting is eerlijk zonder sleutel en de route is dicht zonder token', async () => {
  const r = await api('/api/memo/samenvat', { transcript: 'morgen de aannemer bellen over de kozijnen en het schilderwerk inplannen voor september' });
  assert.equal(r.status, 200);
  assert.equal(r.body.ai, false, 'zonder sleutel zegt de app eerlijk dat het geen AI is');
  assert.match(r.body.samenvatting, /Lokale samenvatting/, 'zonder AI blijft een eerlijke lokale samenvatting beschikbaar');
  assert.equal(r.body.bron, 'extractief');
  assert.equal(r.body.modus, 'handmatig');
  assert.match(r.body.samenvatting, /13 woorden/, 'en telt de woorden echt');
  const dicht = await api('/api/memo/samenvat', { transcript: 'x' }, 'nep');
  assert.equal(dicht.status, 401);
});

test('3. zonder transcript is er niets te vatten: een nette fout, geen verzinsel', async () => {
  const leeg = await api('/api/memo/samenvat', { transcript: '   ' });
  assert.equal(leeg.status, 400);
  assert.match(leeg.body.error, /transcript/i);
});
