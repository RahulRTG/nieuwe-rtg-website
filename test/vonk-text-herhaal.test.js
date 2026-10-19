/* DE VONK-BALK GEEFT ZIJN HERHAALSLEUTEL DOOR (19 oktober 2026).

   public/shared/connection-communication.js stuurt per opgesteld bericht een
   sleutel mee naar /api/connection/vonk/text, maar die route gaf hem niet door
   aan de Connection-kern: na een crash maakte dezelfde herhaling een tweede
   bericht. Binnen een proces vangt een geheugenlaag de herhaling al op; daarom
   herstart deze toets de server op dezelfde datamap. Zakt zonder het
   doorgeven in server/routes/vonk.js. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, stopNet, kantoorAlsPersoon } = require('./helper');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const MAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vonk-text-'));
const ENV = { SMTP_URL: '', RTG_DATA_DIR: MAP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' };
let srv;
test.after(() => { stop(srv && srv.child); try { fs.rmSync(MAP, { recursive: true, force: true }); } catch (e) {} });
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
let seq = 0;
async function lid(office) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const token = (await api('/api/auth/register', { name: 'Vonklid ' + seq, email: 'vt' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })).body.token;
  let codename = (await api('/api/state', {}, token)).body.state.user.codename;
  await api('/api/verify/upload', { image: PNG }, token);
  await api('/api/verify/selfie', { image: PNG }, token);
  const mij = ((await api('/api/office/verifications', {}, office)).body.pending || []).find(p => p.codename === codename);
  await api('/api/office/verify', { userId: mij.id, decision: 'approve', faceMatch: true, geslacht: 'v' }, office);
  return { token };
}
const profiel = (stad, lat, lng, extra) => ({ over: 'Zee en boeken.', stad, lat, lng, leeftijdMin: 25, leeftijdMax: 60, maxKm: 100, interesses: ['sushi', extra] });

test('dezelfde sleutel op /api/connection/vonk/text is na een herstart hetzelfde bericht', async () => {
  srv = await startServer({ env: ENV });
  const office = await kantoorAlsPersoon(srv.base, 'RTG-OFFICE');
  const A = await lid(office), B = await lid(office);
  await api('/api/vonk/profiel', profiel('Sant Antoni', 38.98, 1.30, 'zeilen'), A.token);
  await api('/api/vonk/profiel', profiel('Cala Jondal', 38.88, 1.37, 'jazz'), B.token);
  const b = (await api('/api/vonk/selectie', {}, A.token)).body.mensen.find(m => (m.gemeen || []).includes('sushi'));
  await api('/api/vonk/like', { codenaam: b.codenaam }, A.token);
  const a = (await api('/api/vonk/selectie', {}, B.token)).body.mensen.find(m => (m.gemeen || []).includes('sushi'));
  const match = (await api('/api/vonk/like', { codenaam: a.codenaam }, B.token)).body;
  assert.equal(match.match, true);
  const lijf = { id: match.id, text: 'Zie je zaterdag?', idem: 'toets-vonk-text-1' };
  assert.equal((await api('/api/connection/vonk/text', lijf, A.token)).status, 200);
  await stopNet(srv.child, 15000);
  srv = await startServer({ env: ENV });
  assert.equal((await api('/api/connection/vonk/text', lijf, A.token)).status, 200);
  const s = (await api('/api/connection/vonk/status', { id: match.id }, B.token)).body;
  assert.equal((s.messages || []).filter(m => m.text === 'Zie je zaterdag?').length, 1, 'een bericht, ook na de herstart');
});
