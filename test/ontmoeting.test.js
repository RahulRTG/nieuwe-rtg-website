/* Salon-ontmoetingen: twee wederzijdse connecties die vlakbij elkaar zijn zetten
   de functie zelf aan, krijgen een voorstel, kiezen een activiteit (bij verschil
   wint de vrouw, anders de rustigste), tekenen een veiligheidscontract en
   RTG-kantoor kijkt live mee. Voorwaarde: 18+ met geverifieerd paspoort.
   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, office;
let seq = 0;

// een geverifieerd, meerderjarig lid met geslacht uit het paspoort
async function nieuwLid(geslacht, geboren, verifieer = true) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api(base, '/api/auth/register', {
    name: 'Lid ' + seq, email: 'o' + u + '@x.nl', phone: '06' + u, password: 'geheim123',
    geboortedatum: geboren || '1990-05-05', geslacht, tier: 'business', pasApp: 'business'
  });
  const token = reg.body.token;
  const st = await api(base, '/api/state', {}, token);
  const codename = st.body.state.user.codename;
  // paspoort + selfie uploaden zodat het lid in de verificatie-wachtrij komt
  await api(base, '/api/verify/upload', { image: PNG }, token);
  await api(base, '/api/verify/selfie', { image: PNG }, token);
  const pend = await api(base, '/api/office/verifications', {}, office);
  const mij = (pend.body.pending || []).find(p => p.codename === codename);
  const key = 'user-' + mij.id;
  if (verifieer) await api(base, '/api/office/verify', { userId: mij.id, decision: 'approve', faceMatch: true, geslacht }, office);
  return { token, codename, key, id: mij.id };
}

// twee leden aan elkaar verbinden (vrienden in De Salon)
async function verbind(a, b) {
  const zoek = await api(base, '/api/member/find', { q: b.codename }, a.token);
  const gevonden = (zoek.body.results || []).find(r => r.key === b.key);
  assert.ok(gevonden, 'de andere codenaam is vindbaar');
  await api(base, '/api/member/connect', { key: b.key }, a.token);
  await api(base, '/api/member/connect/respond', { key: a.key, action: 'accept' }, b.token);
}

// beiden aanzetten en vlakbij elkaar positie geven; geeft het voorstel terug
async function inDeBuurt(a, b) {
  await api(base, '/api/ontmoeten/aan', { aan: true }, a.token);
  await api(base, '/api/ontmoeten/aan', { aan: true }, b.token);
  await api(base, '/api/ontmoeten/hier', { lat: 38.9088, lng: 1.4329 }, b.token);
  const r = await api(base, '/api/ontmoeten/hier', { lat: 38.9089, lng: 1.4330 }, a.token);
  const st = r.body.state;
  return (st.voorstellen || [])[0];
}

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ontmoet-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' } });
  base = srv.base;
  office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. zonder geverifieerd paspoort kan de functie niet aan', async () => {
  const groen = await nieuwLid('v', '1990-05-05', false); // niet geverifieerd
  const r = await api(base, '/api/ontmoeten/aan', { aan: true }, groen.token);
  assert.equal(r.status, 403, 'aanzetten wordt geweigerd zonder geverifieerd paspoort');
  const st = await api(base, '/api/ontmoeten/state', {}, groen.token);
  assert.equal(st.body.mag, false);
  assert.equal(st.body.aan, false);
});

test('2. minderjarig (onder 18) mag niet meedoen', async () => {
  const jong = await nieuwLid('m', '2010-01-01'); // 16 in 2026
  const r = await api(base, '/api/ontmoeten/aan', { aan: true }, jong.token);
  assert.equal(r.status, 403, 'onder 18 wordt geweigerd');
});

test('3. twee verbonden, nabije leden krijgen allebei een voorstel', async () => {
  const vrouw = await nieuwLid('v');
  const man = await nieuwLid('m');
  await verbind(vrouw, man);
  const voorstel = await inDeBuurt(vrouw, man);
  assert.ok(voorstel, 'de vrouw ziet een voorstel');
  assert.equal(voorstel.met, man.codename, 'het voorstel is met de connectie');
  const stMan = await api(base, '/api/ontmoeten/state', {}, man.token);
  assert.ok((stMan.body.voorstellen || []).some(v => v.id === voorstel.id), 'de man ziet hetzelfde voorstel');
});

test('4. bij verschil wint de keuze van de vrouw', async () => {
  const vrouw = await nieuwLid('v');
  const man = await nieuwLid('m');
  await verbind(vrouw, man);
  const voorstel = await inDeBuurt(vrouw, man);
  // de vrouw kiest wandelen, de man jetset -> naar de vrouw = wandelen
  await api(base, '/api/ontmoeten/kies', { voorstelId: voorstel.id, keuze: 'wandelen' }, vrouw.token);
  const r = await api(base, '/api/ontmoeten/kies', { voorstelId: voorstel.id, keuze: 'jetset' }, man.token);
  assert.equal(r.body.status, 'gematcht');
  assert.equal(r.body.activiteit, 'wandelen', 'de vrouw haar keuze wint');
  assert.ok(r.body.dateId, 'er is een afspraak aangemaakt');
});

test('5. gelijke keuze zonder vrouw valt terug op de rustigste', async () => {
  const a = await nieuwLid('m');
  const b = await nieuwLid('m');
  await verbind(a, b);
  const voorstel = await inDeBuurt(a, b);
  await api(base, '/api/ontmoeten/kies', { voorstelId: voorstel.id, keuze: 'jetset' }, a.token);
  const r = await api(base, '/api/ontmoeten/kies', { voorstelId: voorstel.id, keuze: 'borrelen' }, b.token);
  assert.equal(r.body.status, 'gematcht');
  assert.equal(r.body.activiteit, 'borrelen', 'borrelen is rustiger dan jetset en wint');
});

test('6. contract tekenen start de afspraak en RTG-kantoor kijkt mee', async () => {
  const vrouw = await nieuwLid('v');
  const man = await nieuwLid('m');
  await verbind(vrouw, man);
  const voorstel = await inDeBuurt(vrouw, man);
  await api(base, '/api/ontmoeten/kies', { voorstelId: voorstel.id, keuze: 'borrelen' }, vrouw.token);
  const match = await api(base, '/api/ontmoeten/kies', { voorstelId: voorstel.id, keuze: 'borrelen' }, man.token);
  const dateId = match.body.dateId;
  // eerst tekent alleen de vrouw: nog niet actief
  const t1 = await api(base, '/api/ontmoeten/teken', { dateId }, vrouw.token);
  assert.equal(t1.body.status, 'wacht-op-tekenen');
  // dan de man: nu actief
  const t2 = await api(base, '/api/ontmoeten/teken', { dateId }, man.token);
  assert.equal(t2.body.status, 'actief');
  // live-positie tijdens de afspraak gaat naar kantoor
  await api(base, '/api/ontmoeten/hier-date', { dateId, lat: 38.9088, lng: 1.4329 }, vrouw.token);
  const kant = await api(base, '/api/office/ontmoetingen', {}, office);
  const d = (kant.body.dates || []).find(x => x.id === dateId);
  assert.ok(d, 'RTG-kantoor ziet de lopende afspraak');
  assert.equal(d.status, 'actief');
  assert.ok(d.deelnemers.some(p => p.pos && Number.isFinite(p.pos.lat)), 'kantoor ziet de live-locatie');
});

test('7. SOS zet een alarm bij RTG-kantoor; kantoor handelt het af', async () => {
  const vrouw = await nieuwLid('v');
  const man = await nieuwLid('m');
  await verbind(vrouw, man);
  const voorstel = await inDeBuurt(vrouw, man);
  await api(base, '/api/ontmoeten/kies', { voorstelId: voorstel.id, keuze: 'wandelen' }, vrouw.token);
  const match = await api(base, '/api/ontmoeten/kies', { voorstelId: voorstel.id, keuze: 'wandelen' }, man.token);
  const dateId = match.body.dateId;
  await api(base, '/api/ontmoeten/teken', { dateId }, vrouw.token);
  await api(base, '/api/ontmoeten/teken', { dateId }, man.token);
  // SOS
  const sos = await api(base, '/api/ontmoeten/sos', { dateId, bericht: 'Voelt niet veilig', lat: 38.91, lng: 1.43 }, vrouw.token);
  assert.equal(sos.status, 200);
  const kant = await api(base, '/api/office/ontmoetingen', {}, office);
  assert.ok(kant.body.alarmen >= 1, 'er is een alarm bij kantoor');
  const d = (kant.body.dates || []).find(x => x.id === dateId);
  assert.equal(d.status, 'noodgeval');
  assert.ok(d.sos.length >= 1, 'de SOS staat bij kantoor');
  // kantoor handelt af
  const af = await api(base, '/api/office/ontmoeting/sos-af', { dateId, sosId: d.sos[0].id }, office);
  assert.equal(af.status, 200);
  assert.equal((af.body.ontmoetingen.dates.find(x => x.id === dateId) || {}).sos.length, 0, 'geen open SOS meer');
});

test('8. de functie uitzetten laat openstaande voorstellen vervallen', async () => {
  const a = await nieuwLid('v');
  const b = await nieuwLid('m');
  await verbind(a, b);
  const voorstel = await inDeBuurt(a, b);
  assert.ok(voorstel, 'er is een voorstel');
  await api(base, '/api/ontmoeten/aan', { aan: false }, a.token);
  const st = await api(base, '/api/ontmoeten/state', {}, a.token);
  assert.equal(st.body.aan, false);
  assert.equal((st.body.voorstellen || []).length, 0, 'geen open voorstellen meer na uitzetten');
});
