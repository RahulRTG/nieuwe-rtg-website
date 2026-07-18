/* RTG Vonk: dating op codenaam met de Salon-veiligheidslat. 18+ met een
   geverifieerd paspoort, een eindige dagselectie die wederzijds bij de
   wensen past, wederzijdse like = match + chatlijn + automatisch een tafel
   rond het geografische midden, EUR 10 p.p. vooraf (EUR 5 RTG, EUR 5 zaak),
   en blokkeren + melden met backoffice-opvolging. Draai los:
   node --experimental-sqlite --test test/vonk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vonk-'));
let srv, base, office, A, B;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function nieuwLid(verifieer = true) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Vonklid ' + seq, email: 'v' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const token = reg.body.token;
  let st = await api('/api/state', {}, token);
  let codename = st.body.state.user.codename;
  if (verifieer) {
    await api('/api/verify/upload', { image: PNG }, token);
    await api('/api/verify/selfie', { image: PNG }, token);
    const pend = await api('/api/office/verifications', {}, office);
    const mij = (pend.body.pending || []).find(p => p.codename === codename);
    await api('/api/office/verify', { userId: mij.id, decision: 'approve', faceMatch: true, geslacht: 'v' }, office);
    // bij goedkeuring kan de kluis een nieuwe (passende) codenaam uitgeven
    st = await api('/api/state', {}, token);
    codename = st.body.state.user.codename;
  }
  return { token, codename };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  A = await nieuwLid(); B = await nieuwLid();
  assert.ok(office && A.token && B.token, 'backoffice en twee geverifieerde leden');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de poort: zonder geverifieerd paspoort geen Vonk; met wel', async () => {
  const los = await nieuwLid(false);
  const dicht = await api('/api/vonk/profiel', { over: 'hoi' }, los.token);
  assert.equal(dicht.status, 403, 'zonder KYC blijft de deur dicht');
  const open = await api('/api/vonk/profiel', { over: 'Zeezeiler, altijd in voor sushi.', stad: 'Sant Antoni',
    lat: 38.98, lng: 1.30, leeftijdMin: 25, leeftijdMax: 60, maxKm: 100, interesses: ['zeilen', 'sushi'] }, A.token);
  assert.equal(open.status, 200);
  assert.equal(open.body.profiel.stad, 'Sant Antoni', 'alleen de stad, nooit een adres');
});

test('2. de dagselectie is wederzijds passend en eindig', async () => {
  await api('/api/vonk/profiel', { over: 'Jazz en de zee.', stad: 'Cala Jondal', lat: 38.88, lng: 1.37,
    leeftijdMin: 25, leeftijdMax: 60, maxKm: 100, interesses: ['sushi', 'jazz'] }, B.token);
  const s = await api('/api/vonk/selectie', {}, A.token);
  assert.equal(s.status, 200);
  assert.ok(s.body.mensen.length <= 6, 'een eindige dagselectie, geen oneindige stroom');
  // Vonk toont gids-codenamen (nooit echte namen); de test praat dus op die naam
  const b = s.body.mensen.find(m => (m.gemeen || []).includes('sushi'));
  assert.ok(b, 'B staat in de selectie van A (wederzijds passend)');
  B.vonkNaam = b.codenaam;
  assert.deepEqual(b.gemeen, ['sushi'], 'gedeelde interesses zichtbaar');
  assert.ok(!('geslacht' in b), 'wensen van de ander blijven prive');
});

test('3. wederzijdse like = match + automatisch een tafel rond het midden', async () => {
  const l1 = await api('/api/vonk/like', { codenaam: B.vonkNaam }, A.token);
  assert.equal(l1.status, 200, 'like op de getoonde codenaam werkt');
  assert.equal(l1.body.match, false, 'een kant is nog geen match');
  const sB = await api('/api/vonk/selectie', {}, B.token);
  const aInB = sB.body.mensen.find(m => (m.gemeen || []).includes('sushi'));
  assert.ok(aInB, 'A staat in de selectie van B');
  const l2 = await api('/api/vonk/like', { codenaam: aInB.codenaam }, B.token);
  assert.equal(l2.body.match, true, 'wederzijds: een vonk');
  assert.ok(l2.body.tafel && l2.body.tafel.supplierName, 'er staat automatisch een tafel klaar');
  assert.equal(l2.body.tafel.prijsPP, 10, 'EUR 10 p.p.');
  assert.equal(l2.body.tafel.rtgDeel, 5, 'waarvan EUR 5 voor RTG');
  // de chatlijn is open (en alleen voor de twee zelf)
  const c = await api('/api/vonk/bericht', { id: l2.body.id, tekst: 'Zin in!' }, A.token);
  assert.equal(c.status, 200);
  const derde = await nieuwLid();
  const inbreker = await api('/api/vonk/bericht', { id: l2.body.id, tekst: 'hoi' }, derde.token);
  assert.equal(inbreker.status, 404, 'een derde komt de chat niet in');
});

test('4. beide betalen EUR 10 vooraf; dan pas staat de reservering vast', async () => {
  const mijnA = await api('/api/vonk/mijn', {}, A.token);
  const m = mijnA.body.matches[0];
  assert.equal(m.status, 'wacht-op-betaling');
  await api('/api/pay/oplaad', { centen: 2000 }, A.token);
  await api('/api/pay/oplaad', { centen: 2000 }, B.token);
  const b1 = await api('/api/vonk/betaal', { id: m.id }, A.token);
  assert.equal(b1.status, 200);
  assert.notEqual(b1.body.status2, 'bevestigd', 'een kant betaald is nog niet vast');
  const b2 = await api('/api/vonk/betaal', { id: m.id }, B.token);
  assert.equal(b2.body.status2, 'bevestigd', 'allebei betaald: de date staat');
  const na = await api('/api/vonk/mijn', {}, A.token);
  assert.equal(na.body.matches[0].status, 'bevestigd');
});

test('5. blokkeren en melden: Salon-niveau opvolging bij de backoffice', async () => {
  const blok = await api('/api/vonk/blokkeer', { codenaam: B.vonkNaam, meld: 'ongepast bericht' }, A.token);
  assert.equal(blok.status, 200);
  const s = await api('/api/vonk/selectie', {}, A.token);
  assert.ok(!s.body.mensen.some(m => m.codenaam === B.vonkNaam), 'geblokkeerd = nooit meer in de selectie');
  const meldingen = await api('/api/office/vonk/meldingen', {}, office);
  assert.ok(meldingen.body.meldingen.some(x => x.over === B.vonkNaam && x.reden === 'ongepast bericht'), 'de melding ligt bij kantoor');
  // en een gast komt er sowieso niet in
  const gast = (await api('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  assert.equal((await api('/api/vonk/selectie', {}, gast)).status, 403, 'de gratis app heeft geen Vonk');
});
