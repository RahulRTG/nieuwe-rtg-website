/* RTG OV: al het vervoer in een app. Lijnen met haltes, live voertuigen via
   de PDA, twee snelle check-ins (oplichtende code of GPS-een-tik) en
   uitchecken met eerlijke km-prijs via RTG Pay. Draai los:
   node --experimental-sqlite --test test/ov.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lidA, lidB, pda;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ov-'));
const STAD = { lat: 38.908, lng: 1.432 };

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Lid ' + seq, email: 'ov' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  return reg.body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lidA = await lid(); lidB = await lid();
  const roster = await api('/api/supplier/roster', { code: 'TRANSIT' });
  const chauffeur = (roster.body.staff || []).find(x => x.role !== 'manager');
  pda = (await api('/api/supplier/login', { code: 'TRANSIT', staffId: chauffeur.id, pin: '5678' })).body.token;
  assert.ok(pda, 'de chauffeur logt in op de PDA van Ibiza Transit');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de kaart: alle soorten in een app, haltes op afstand, boekje zonder en live met voertuig', async () => {
  const r = await api('/api/ov/kaart', STAD, lidA);
  assert.equal(r.status, 200);
  const soorten = new Set(r.body.lijnen.map(l => l.soort));
  for (const s of ['bus', 'metro', 'trein', 'veerboot']) assert.ok(soorten.has(s), 'de ' + s + ' zit in dezelfde app');
  const bus = r.body.lijnen.find(l => l.lijnId === 'L1');
  assert.ok(bus.halte && bus.halte.afstandM < 500, 'de dichtstbijzijnde halte kent zijn afstand');
  assert.equal(bus.live, false, 'zonder voertuig op de lijn is de tijd uit het boekje');
});

test('2. de dienst: de chauffeur deelt GPS en het lid ziet de bus live aankomen', async () => {
  const d = await api('/api/staff/ov/dienst', { lijnId: 'L1', voertuigNaam: 'Bus 4' }, pda);
  assert.equal(d.status, 200);
  const p = await api('/api/staff/ov/pos', { lat: 38.905, lng: 1.428 }, pda);
  assert.equal(p.status, 200);
  const r = await api('/api/ov/kaart', STAD, lidA);
  const bus = r.body.lijnen.find(l => l.lijnId === 'L1');
  assert.equal(bus.live, true, 'de lijn is nu live');
  assert.ok(bus.voertuigen.some(v => /Bus 4/.test(v.naam)), 'het lid ziet het voertuig');
  assert.ok(bus.overMin >= 1 && bus.overMin <= 15, 'met een echte aanrijtijd uit de GPS');
});

test('3. snelle optie 1: de oplichtende code; het personeel tikt hem in en u bent binnen', async () => {
  const c = await api('/api/ov/code', {}, lidA);
  assert.equal(c.status, 200);
  assert.match(c.body.code, /^[0-9A-F]{6}$/, 'een korte oplichtende code');
  const fout = await api('/api/staff/ov/checkin', { code: 'ZZZZZZ' }, pda);
  assert.equal(fout.status, 404);
  const inch = await api('/api/staff/ov/checkin', { code: c.body.code }, pda);
  assert.equal(inch.status, 200);
  assert.equal(inch.body.rit.status, 'in');
  const dubbel = await api('/api/ov/code', {}, lidA);
  assert.equal(dubbel.status, 409, 'wie al ingecheckt is, checkt eerst uit');
  const stand = await api('/api/staff/ov/stand', {}, pda);
  assert.equal(stand.body.aanBoord, 1, 'de chauffeur ziet de teller lopen');
});

test('4. snelle optie 2: een tik op GPS, alleen als u echt bij het voertuig staat', async () => {
  const ver = await api('/api/ov/hier', { lat: 38.985, lng: 1.535 }, lidB);
  assert.equal(ver.status, 409, 'te ver van elk voertuig: dan niet');
  const dichtbij = await api('/api/ov/hier', { lat: 38.9051, lng: 1.4281 }, lidB);
  assert.equal(dichtbij.status, 200, 'binnen 150 meter van de live bus is een tik genoeg');
  assert.equal(dichtbij.body.rit.status, 'in');
});

test('5. uitchecken: eerlijke km-prijs, betaald uit de wallet met autolaad, zaak ontvangt', async () => {
  // de bus rijdt naar Talamanca; lid A stapt daar uit (~3 km hemelsbreed)
  await api('/api/staff/ov/pos', { lat: 38.915, lng: 1.455 }, pda);
  const uit = await api('/api/ov/uit', { lat: 38.915, lng: 1.455, idem: 'u1' }, lidA);
  assert.equal(uit.status, 200);
  assert.ok(uit.body.km >= 2 && uit.body.km <= 4, 'de afstand klopt met de rit (~3 km)');
  const verwacht = Math.round(180 + uit.body.km * 22);
  assert.ok(Math.abs(uit.body.prijs - verwacht) <= 22, 'prijs = basis + km-tarief');
  const mijn = await api('/api/ov/mijn', {}, lidA);
  assert.equal(mijn.body.rit, null, 'geen actieve rit meer');
  assert.equal(mijn.body.ritten[0].prijs, uit.body.prijs, 'de rit staat met prijs in de historie');
  const nogmaals = await api('/api/ov/uit', { idem: 'u2' }, lidA);
  assert.equal(nogmaals.status, 409, 'zonder actieve rit valt er niets uit te checken');
});

test('6. het zaakoverzicht: live vloot, reizigers en omzet vandaag', async () => {
  const roster = await api('/api/supplier/roster', { code: 'TRANSIT' });
  const m = roster.body.staff.find(x => x.role === 'manager');
  const zaak = (await api('/api/supplier/login', { code: 'TRANSIT', staffId: m.id, pin: '1234' })).body.token;
  const r = await api('/api/supplier/ov/overzicht', {}, zaak);
  assert.equal(r.status, 200);
  assert.ok(r.body.voertuigen.some(v => /Bus 4/.test(v.naam)), 'de live vloot staat erop');
  assert.ok(r.body.reizigersVandaag >= 2, 'beide reizigers tellen mee');
  assert.ok(r.body.omzetVandaag > 0, 'de omzet van vandaag loopt');
  const taxi = await api('/api/supplier/roster', { code: 'MKKX' });
  const tm = taxi.body.staff.find(x => x.role === 'manager');
  const taxiTok = (await api('/api/supplier/login', { code: 'MKKX', staffId: tm.id, pin: '1234' })).body.token;
  const dicht = await api('/api/supplier/ov/overzicht', {}, taxiTok);
  assert.equal(dicht.status, 409, 'OV-functies horen alleen bij een OV-zaak');
});
