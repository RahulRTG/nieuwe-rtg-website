/* RTG contentbescherming, de DRM-route (kern/drm.js): Encrypted Media
   Extensions met een Clear Key-licentie die RTG zelf bedient. Draai: npm test */
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
const isB64url = s => typeof s === 'string' && s.length > 0 && /^[A-Za-z0-9_-]+$/.test(s);

let srv, base, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-drm-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Kijker', email: 'k' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
});
test.after(() => stop(srv && srv.child));

test('1. capability: RTG bedient Clear Key en herkent de grote sleutelsystemen; alleen na inlog', async () => {
  assert.equal((await api(base, '/api/drm/capability', {}, null)).status, 401);
  const c = await api(base, '/api/drm/capability', {}, lid);
  assert.equal(c.status, 200);
  assert.ok(c.body.keySystems.includes('org.w3.clearkey'), 'Clear Key hoort erbij');
  assert.equal(c.body.aanbevolen, 'org.w3.clearkey');
  for (const ks of ['com.widevine.alpha', 'com.microsoft.playready', 'com.apple.fps'])
    assert.ok(c.body.keySystems.includes(ks), ks + ' wordt herkend');
});

test('2. de Clear Key-licentie: een lid krijgt een JWK-set voor de content; stabiel per content', async () => {
  const r = await api(base, '/api/drm/key', { contentId: 'theater:v123' }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.type, 'temporary', 'een tijdelijke licentie');
  assert.ok(Array.isArray(r.body.keys) && r.body.keys.length === 1, 'een sleutel in de set');
  const k = r.body.keys[0];
  assert.equal(k.kty, 'oct', 'een symmetrische sleutel');
  assert.ok(isB64url(k.k) && isB64url(k.kid), 'k en kid zijn base64url');
  // dezelfde content geeft dezelfde sleutel terug
  const r2 = await api(base, '/api/drm/key', { contentId: 'theater:v123' }, lid);
  assert.equal(r2.body.keys[0].k, k.k, 'de sleutel is stabiel per content');
  // andere content geeft een andere sleutel
  const r3 = await api(base, '/api/drm/key', { contentId: 'theater:anders' }, lid);
  assert.notEqual(r3.body.keys[0].k, k.k, 'andere content, andere sleutel');
});

test('3. de licentie volgt de gevraagde key-id uit het CDM-verzoek', async () => {
  const r = await api(base, '/api/drm/key', { contentId: 'podium:live', kids: ['AbC_123-xyz'] }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.keys[0].kid, 'AbC_123-xyz', 'de kid uit het verzoek komt terug');
});

test('4. zonder content of zonder inlog geen sleutel', async () => {
  assert.equal((await api(base, '/api/drm/key', { contentId: '' }, lid)).status, 400);
  assert.equal((await api(base, '/api/drm/key', { contentId: 'x' }, null)).status, 401);
});

test('5. de client mag zijn sleutelsystemen melden (telemetrie)', async () => {
  const r = await api(base, '/api/drm/report', { keySystems: ['org.w3.clearkey'], eme: true }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});
