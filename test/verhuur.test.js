/* Autoverhuur, eerlijk: vaste dagprijs vooraf betaald, dubbele boekingen
   onmogelijk, foto's VOOR de uitgifte en NA het inleveren als harde eis
   (beide partijen leggen vast, niets kan worden gewist), een SOS-knop die
   zaak EN RTG-actiecentrum bereikt, en vrijwillig live locatie delen.
   Draai: node --experimental-sqlite --test test/verhuur.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 4730 + Math.floor(Math.random() * 60);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vh-'));
const D = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const FOTO = 'data:image/jpeg;base64,' + Buffer.from('demo-foto').toString('base64');
let child, lidToken, balieToken, managerToken, ownerToken, huur;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  const reg = await json(await api('/api/auth/register', { name: 'Huur Lid', email: 'huur@x.nl', phone: '0612345696',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' }));
  lidToken = reg.token;
  const roster = await json(await api('/api/supplier/roster', { code: 'ISLAREN' }));
  const man = roster.staff.find(x => x.role === 'manager');
  const balie = roster.staff.find(x => x.role !== 'manager');
  managerToken = (await json(await api('/api/supplier/login', { code: 'ISLAREN', staffId: man.id, pin: '1234' }))).token;
  balieToken = (await json(await api('/api/supplier/login', { code: 'ISLAREN', staffId: balie.id, pin: '5678' }))).token;
  ownerToken = (await json(await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('boeken: vaste dagprijs, en dubbel boeken van dezelfde auto kan niet', async () => {
  const p = await json(await api('/api/verhuur/aanbod', {}, lidToken));
  const zaak = p.partners.find(x => x.code === 'ISLAREN');
  assert.ok(zaak && zaak.autos.length >= 3, 'de demovloot staat klaar');
  const b = await json(await api('/api/huur/boek', { supplierCode: 'ISLAREN', autoId: 'c1', van: D(1), tot: D(4) }, lidToken));
  assert.equal(b.huur.price, 49 * 3, 'drie dagen tegen de vaste dagprijs');
  assert.equal(b.huur.status, 'wacht-op-betaling');
  // overlappende periode: geweigerd
  assert.equal((await api('/api/huur/boek', { supplierCode: 'ISLAREN', autoId: 'c1', van: D(3), tot: D(6) }, lidToken)).status, 409);
  // betalen via de bestaande stroom
  assert.equal((await api('/api/booking/pay', { ref: b.huur.ref }, lidToken)).status, 200);
  huur = b.huur;
});

test('uitgeven kan NIET zonder voor-foto; met foto wel (de kern tegen schimmig verhuren)', async () => {
  const geenFoto = await api('/api/supplier/huur/status', { ref: huur.ref, status: 'lopend', kmStart: 24500 }, balieToken);
  assert.equal(geenFoto.status, 409);
  assert.match((await geenFoto.json()).error, /voor-foto/);
  // de huurder legt de staat vast, en de balie ook
  assert.equal((await api('/api/huur/foto', { ref: huur.ref, fase: 'voor', foto: FOTO }, lidToken)).status, 200);
  assert.equal((await api('/api/supplier/huur/foto', { ref: huur.ref, fase: 'voor', foto: FOTO }, balieToken)).status, 200);
  // na-foto's kunnen nu nog niet (de huur loopt nog niet)
  assert.equal((await api('/api/huur/foto', { ref: huur.ref, fase: 'na', foto: FOTO }, lidToken)).status, 409);
  // uitgeven zonder km-stand kan niet (het startpunt moet vast)
  assert.equal((await api('/api/supplier/huur/status', { ref: huur.ref, status: 'lopend' }, balieToken)).status, 400);
  const uit = await json(await api('/api/supplier/huur/status', { ref: huur.ref, status: 'lopend', kmStart: 24500, tankStart: 8 }, balieToken));
  assert.equal(uit.huur.status, 'lopend');
  const f = await json(await api('/api/supplier/huur/fotos', { ref: huur.ref }, balieToken));
  assert.equal(f.fotos.voor.length, 2, 'beide partijen hebben vastgelegd');
  assert.ok(f.fotos.voor.some(x => x.door === 'huurder') && f.fotos.voor.some(x => x.door === 'Pau Riera'));
});

test('SOS: de zaak krijgt hem en het RTG-actiecentrum zet hem rood bovenaan', async () => {
  assert.equal((await api('/api/huur/sos', { ref: huur.ref, bericht: 'Auto weigert dienst op een donkere weg', lat: 38.98, lng: 1.3 }, lidToken)).status, 200);
  const ov = await json(await api('/api/supplier/huur/overzicht', {}, balieToken));
  const h = ov.huren.find(x => x.ref === huur.ref);
  assert.equal(h.sos.length, 1, 'de zaak ziet de open SOS');
  assert.ok(Number.isFinite(h.sos[0].lat), 'met locatie');
  const st = await json(await api('/api/office/state', {}, ownerToken));
  assert.ok(st.state.alerts.some(a => a.kind === 'sos' && a.ref === huur.ref), 'RTG ziet de SOS in het actiecentrum');
  // de zaak handelt hem af: alert weg
  assert.equal((await api('/api/supplier/huur/sos-ok', { ref: huur.ref }, balieToken)).status, 200);
  const st2 = await json(await api('/api/office/state', {}, ownerToken));
  assert.ok(!st2.state.alerts.some(a => a.kind === 'sos' && a.ref === huur.ref));
});

test('live locatie: vrijwillig aan, zichtbaar voor de zaak, en uit = meteen weg', async () => {
  await api('/api/huur/locatie', { ref: huur.ref, aan: true, lat: 38.95, lng: 1.35 }, lidToken);
  let ov = await json(await api('/api/supplier/huur/overzicht', {}, balieToken));
  assert.ok(ov.huren.find(x => x.ref === huur.ref).locatie, 'de zaak ziet de gedeelde locatie');
  await api('/api/huur/locatie', { ref: huur.ref, aan: false }, lidToken);
  ov = await json(await api('/api/supplier/huur/overzicht', {}, balieToken));
  assert.equal(ov.huren.find(x => x.ref === huur.ref).locatie, null, 'uitgezet: geen spoor');
});

test('inleveren kan NIET zonder na-foto; met foto rondt hij af', async () => {
  const geenFoto = await api('/api/supplier/huur/status', { ref: huur.ref, status: 'afgerond', kmEind: 25200 }, balieToken);
  assert.equal(geenFoto.status, 409);
  assert.equal((await api('/api/huur/foto', { ref: huur.ref, fase: 'na', foto: FOTO }, lidToken)).status, 200);
  const geenKm = await api('/api/supplier/huur/status', { ref: huur.ref, status: 'afgerond' }, balieToken);
  assert.equal(geenKm.status, 400, 'inleveren vereist ook de eind-km');
  // 700 km gereden op een Fiat 500 (200 km/dag vrij, 3 dagen = 600 vrij): 100 extra x 0,25 = 25 euro
  // plus een halfvolle tank terug (4/8 tekort van 8): ~30 euro
  const af = await json(await api('/api/supplier/huur/status', { ref: huur.ref, status: 'afgerond', kmEind: 25200, tankEind: 4 }, balieToken));
  assert.equal(af.huur.status, 'afgerond');
  // het lid ziet de afgeronde huur met de fototellers
  const mijn = await json(await api('/api/huur/mijn', {}, lidToken));
  const m = mijn.huren.find(x => x.ref === huur.ref);
  assert.equal(m.status, 'afgerond');
  assert.equal(m.fotosVoor, 2);
  assert.equal(m.fotosNa, 1);
  // transparante afrekening zichtbaar bij zaak: 100 extra km x 0,25 = 25 euro
  const ov = await json(await api('/api/supplier/huur/overzicht', {}, balieToken));
  const h = ov.huren.find(x => x.ref === huur.ref);
  assert.equal(h.inname.gereden, 700);
  assert.equal(h.inname.extraKm, 100);
  assert.equal(h.inname.kmKosten, 25);
  assert.ok(h.inname.tankKosten > 0, 'een niet-volle tank levert transparante brandstofkosten');
});

test('annuleren is een management-handeling, en een lopende huur annuleer je niet', async () => {
  const b = await json(await api('/api/huur/boek', { supplierCode: 'ISLAREN', autoId: 'c2', van: D(1), tot: D(2) }, lidToken));
  await api('/api/booking/pay', { ref: b.huur.ref }, lidToken);
  assert.equal((await api('/api/supplier/huur/status', { ref: b.huur.ref, status: 'geweigerd' }, balieToken)).status, 403);
  assert.equal((await api('/api/supplier/huur/status', { ref: b.huur.ref, status: 'geweigerd' }, managerToken)).status, 200);
});
