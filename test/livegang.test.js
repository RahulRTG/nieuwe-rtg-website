/* De livegang: in productie start het platform schoon en op slot.
   - geen demozaken in de catalogus, geen demopersoneel, geen voorbeeldposts
   - de demo-inlog is dicht (leden en zaken)
   - de rate-limiter staat aan
   Draai: node --experimental-sqlite --test test/livegang.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-live-'));

async function api(pad, body) {
  return fetch(BASE + pad, {
    method: 'POST',
    // productie stuurt http door naar https; achter de proxy telt dit header-bewijs
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' },
    body: JSON.stringify(body || {})
  });
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: {
    NODE_ENV: 'production', RTG_DATA_DIR: TMP, SMTP_URL: '',
    RTG_ENC_KEY: 'k'.repeat(64), RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl',
    OFFICE_CODE: 'GEHEIME-CODE-123'
  } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('productie start schoon: geen demozaken, geen demopersoneel, geen voorbeeldposts', async () => {
  // de demozaak bestaat niet (en heeft dus ook geen roster)
  assert.equal((await api('/api/supplier/roster', { code: 'KIKUNOI' })).status, 404);
  assert.equal((await api('/api/supplier/roster', { code: 'VORA' })).status, 404);
  // een gast ziet een lege Salon (geen geseede verhalen) en lege catalogus
  const gast = await (await api('/api/login', { tier: 'guest' })).json();
  const state = gast.state;
  assert.equal((state.posts || []).filter(p => typeof p.id === 'number' && p.id <= 6).length, 0, 'geen voorbeeldposts');
  assert.equal((state.suppliers || []).length, 0, 'geen demozaken in de catalogus');
});

test('productie is op slot: demo-inloggen zijn dicht, de backoffice-code is niet de demo-waarde', async () => {
  // demo-inlog voor leden en zaken is dicht
  assert.equal((await api('/api/login', { username: 'Rahul', password: 'Imran' })).status, 403);
  assert.equal((await api('/api/supplier/login', { username: 'Rahul', password: 'Imran' })).status, 403);
  // de demo-backoffice-code werkt niet; de echte (uit de omgeving) wel
  assert.equal((await api('/api/office/login', { code: 'RTG-OFFICE' })).status, 401);
  assert.equal((await api('/api/office/login', { code: 'GEHEIME-CODE-123' })).status, 200);
});

test('de rate-limiter staat aan in productie (429 boven de grens)', async () => {
  let laatste = 200;
  for (let i = 0; i < 320; i++) {
    const r = await api('/api/reviews', { supplierCode: 'X' });
    laatste = r.status;
    if (laatste === 429) break;
  }
  assert.equal(laatste, 429, 'boven de 300 verzoeken per minuut komt een nette 429');
});
