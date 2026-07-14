/* Charter (boten en jachten), eerlijk verhuren: vaste dagprijs vooraf betaald,
   met of zonder schipper, bareboat alleen met vaarbewijs, dubbele boekingen
   onmogelijk, staat met foto's VOOR het uitvaren en NA de teruggave, een SOS-knop
   op zee die de zaak EN RTG bereikt, en vrijwillig live positie delen.
   Draai: node --experimental-sqlite --test test/charter.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const D = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const FOTO = 'data:image/jpeg;base64,' + Buffer.from('demo-foto-charter').toString('base64');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, mgr, lid;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-charter-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'AZUL' } });
  base = srv.base;
  mgr = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Charter Lid', email: 'c' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  lid = reg.body.token;
});
test.after(() => stop(srv && srv.child));

async function boekBetaal(body) {
  const b = await api(base, '/api/charter/boek', body, lid);
  if (b.status === 200) await api(base, '/api/booking/pay', { ref: b.body.charter.ref }, lid);
  return b;
}

test('1. aanbod: het charterbedrijf toont zijn vloot met vaartuig-specs', async () => {
  const p = await api(base, '/api/charter/aanbod', {}, lid);
  const zaak = p.body.partners.find(x => x.code === 'AZUL');
  assert.ok(zaak && zaak.boten.length >= 4, 'de demovloot staat klaar');
  const serenidad = zaak.boten.find(v => v.naam === 'Serenidad');
  assert.equal(serenidad.type, 'Motorjacht');
  assert.equal(serenidad.skipperVerplicht, true, 'het grote jacht vaart met schipper');
});

test('2. bareboat kan alleen met vaarbewijs; met schipper telt de schipperprijs mee', async () => {
  // zonder vaarbewijs en zonder schipper: geweigerd
  const zonder = await api(base, '/api/charter/boek', { supplierCode: 'AZUL', bootId: 'b2', van: D(1), tot: D(4), metSkipper: false }, lid);
  assert.equal(zonder.status, 403, 'bareboat zonder vaarbewijs mag niet');
  // met vaarbewijs (bareboat): 3 dagen tegen de vaste dagprijs
  const bareboat = await api(base, '/api/charter/boek', { supplierCode: 'AZUL', bootId: 'b2', van: D(1), tot: D(4), metSkipper: false, vaarbewijs: true }, lid);
  assert.equal(bareboat.status, 200);
  assert.equal(bareboat.body.charter.price, 680 * 3, 'drie dagen bareboat');
  assert.equal((await api(base, '/api/booking/pay', { ref: bareboat.body.charter.ref }, lid)).status, 200);
  // met schipper: dagprijs + schipperprijs per dag
  const metSk = await boekBetaal({ supplierCode: 'AZUL', bootId: 'b3', van: D(1), tot: D(3), metSkipper: true });
  assert.equal(metSk.body.charter.price, (520 + 240) * 2, 'twee dagen met schipper');
  assert.equal(metSk.body.charter.metSkipper, true);
});

test('3. een skipper-verplicht vaartuig krijgt altijd een schipper, ook bij metSkipper:false', async () => {
  const b = await boekBetaal({ supplierCode: 'AZUL', bootId: 'b1', van: D(2), tot: D(4), metSkipper: false });
  assert.equal(b.status, 200);
  assert.equal(b.body.charter.metSkipper, true, 'schipper afgedwongen');
  assert.equal(b.body.charter.price, (1850 + 380) * 2, 'schipperprijs telt mee');
});

test('4. dubbel charteren van hetzelfde vaartuig in dezelfde periode kan niet', async () => {
  const a = await boekBetaal({ supplierCode: 'AZUL', bootId: 'b4', van: D(10), tot: D(13), metSkipper: true });
  assert.equal(a.status, 200);
  const overlap = await api(base, '/api/charter/boek', { supplierCode: 'AZUL', bootId: 'b4', van: D(12), tot: D(15), metSkipper: true }, lid);
  assert.equal(overlap.status, 409, 'de overlappende periode wordt geweigerd');
});

test('5. uitvaren kan NIET zonder voor-foto; teruggeven verrekent brandstof', async () => {
  const b = await boekBetaal({ supplierCode: 'AZUL', bootId: 'b3', van: D(20), tot: D(22), metSkipper: true });
  const ref = b.body.charter.ref;
  // zonder voor-foto weigert de uitvaart
  const geenFoto = await api(base, '/api/supplier/charter/status', { ref, status: 'lopend', urenStart: 120 }, mgr);
  assert.equal(geenFoto.status, 409);
  // met voor-foto en motorurenstand vaart hij uit (brandstof vol = 8)
  await api(base, '/api/supplier/charter/foto', { ref, fase: 'voor', foto: FOTO }, mgr);
  const uit = await api(base, '/api/supplier/charter/status', { ref, status: 'lopend', urenStart: 120, brandstofStart: 8 }, mgr);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.charter.status, 'lopend');
  // teruggeven: na-foto + motorurenstand + brandstof half vol (4/8) -> tekort verrekend
  await api(base, '/api/supplier/charter/foto', { ref, fase: 'na', foto: FOTO }, mgr);
  const terug = await api(base, '/api/supplier/charter/status', { ref, status: 'afgerond', urenEind: 126, brandstofEind: 4 }, mgr);
  assert.equal(terug.status, 200);
  const ov = await api(base, '/api/supplier/charter/overzicht', {}, mgr);
  const rij = ov.body.charters.find(c => c.ref === ref);
  assert.ok(rij && rij.teruggave, 'de teruggave is vastgelegd');
  assert.ok(rij.teruggave.brandstofKosten > 0, 'het brandstoftekort wordt eerlijk doorberekend');
  assert.equal(rij.teruggave.gevaren, 6, 'zes motoruren gevaren');
});

test('6. SOS op zee bereikt de zaak en is af te handelen', async () => {
  const b = await boekBetaal({ supplierCode: 'AZUL', bootId: 'b2', van: D(20), tot: D(22), metSkipper: false, vaarbewijs: true });
  const ref = b.body.charter.ref;
  assert.equal((await api(base, '/api/charter/sos', { ref, bericht: 'Motorpech ter hoogte van Es Vedra', lat: 38.86, lng: 1.20 }, lid)).status, 200);
  let ov = await api(base, '/api/supplier/charter/overzicht', {}, mgr);
  let rij = ov.body.charters.find(c => c.ref === ref);
  assert.equal(rij.sos.length, 1, 'de zaak ziet het openstaande noodsignaal');
  assert.equal((await api(base, '/api/supplier/charter/sos-ok', { ref }, mgr)).status, 200);
  ov = await api(base, '/api/supplier/charter/overzicht', {}, mgr);
  rij = ov.body.charters.find(c => c.ref === ref);
  assert.equal(rij.sos.length, 0, 'na afhandelen is er geen open SOS meer');
});

test('7. de gast deelt vrijwillig zijn positie op het water', async () => {
  const b = await boekBetaal({ supplierCode: 'AZUL', bootId: 'b3', van: D(25), tot: D(27), metSkipper: true });
  const ref = b.body.charter.ref;
  const aan = await api(base, '/api/charter/locatie', { ref, aan: true, lat: 38.9, lng: 1.4 }, lid);
  assert.equal(aan.body.aan, true);
  const mijn = await api(base, '/api/charter/mijn', {}, lid);
  assert.ok(mijn.body.charters.find(c => c.ref === ref).locatieAan, 'de gast ziet dat delen aanstaat');
});

test('8. een vaartuig toevoegen en de vloot bijwerken (manager)', async () => {
  const r = await api(base, '/api/supplier/boot', { naam: 'Brisa', type: 'Sloep', lengte: 8, gasten: 6,
    dagprijs: 240, borg: 500, skipperVerplicht: false, vaarbewijsVereist: true }, mgr);
  assert.equal(r.status, 200);
  assert.ok(r.body.boten.some(v => v.naam === 'Brisa'), 'het nieuwe vaartuig staat in de vloot');
});
