/* DE KYC-WACHTRIJ EN HET KYC-BESLUIT GAAN NIET DOOR ZONDER VASTSTAAND SPOOR.

   test/kycspoor.test.js bewijst dat het besluit een regel in het
   inzagejournaal achterlaat. Deze toets bewijst de andere helft van LAT.md
   regel 21: dat spoor kan WEIGEREN. Tot 18 oktober 2026 stond noteer() in een
   lege catch (STILSPOOR.json), dus een journaal dat niet kon schrijven liet de
   echte namen en e-mailadressen van de wachtrij gewoon zien, en het besluit
   over iemands identiteit werd genomen zonder dat ergens stond wie het nam.

   Een server die liegt (verraad `schrijf-verloren`): wat er in het geheugen
   staat werkt, maar geen duurzame commit wordt bevestigd. Het lid dat wacht,
   staat in het geheugen van datzelfde proces -- de opstelling meet dus de
   journaalgrens en niet een lege wachtrij.

   Draai los: node --test test/kycspoorvast.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAoHf3ZQAAAAASUVORK5CYII=';
const MAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kycvast-'));
let srv;
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: MAP, RTG_VERRAAD: 'schrijf-verloren' } }); });
test.after(() => { stop(srv && srv.child); try { fs.rmSync(MAP, { recursive: true, force: true }); } catch (e) {} });

test('zonder vaststaand journaal: geen namen uit de wachtrij en geen besluit', async () => {
  const u = String(Date.now()).slice(-8);
  const reg = await api('/api/auth/register', { name: 'Kyc Vast', email: 'kycvast' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, JSON.stringify(reg.body).slice(0, 160));
  await api('/api/verify/upload', { image: PNG }, reg.body.token);
  await api('/api/verify/selfie', { image: PNG }, reg.body.token);
  const office = await kantoorAlsPersoon(srv.base, 'RTG-OFFICE');
  assert.ok(office, 'een kantoormens op naam');

  const rij = await api('/api/office/verifications', {}, office);
  assert.equal(rij.status, 503, 'de wachtrij toont namen uit de kluis; zonder vaststaande regel hoort hij te weigeren');
  assert.equal(rij.body.pending, undefined, 'en er gaat geen naam mee');
  assert.ok(!JSON.stringify(rij.body).includes('kycvast' + u), 'ook niet verstopt in een ander veld');

  const id = reg.body.state && reg.body.state.user && reg.body.state.user.id;
  if (id != null) {
    const b = await api('/api/office/verify', { userId: id, decision: 'approve', faceMatch: true }, office);
    assert.equal(b.status, 503, 'een KYC-besluit zonder vaststaand spoor wordt niet genomen');
  }
});
