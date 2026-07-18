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

test('7. de routetekenaar: de manager zet zelf een lijn op de kaart en leden zien hem meteen', async () => {
  // de chauffeur mag niet aan de lijnen komen; alleen de manager
  const geenM = await api('/api/staff/ov/lijnen', {}, pda);
  assert.equal(geenM.status, 403, 'de routetekenaar is alleen voor de manager');
  const roster = await api('/api/supplier/roster', { code: 'TRANSIT' });
  const m = roster.body.staff.find(x => x.role === 'manager');
  const baas = (await api('/api/supplier/login', { code: 'TRANSIT', staffId: m.id, pin: '1234' })).body.token;
  const beheer = await api('/api/staff/ov/lijnen', {}, baas);
  assert.equal(beheer.status, 200);
  assert.ok(beheer.body.soorten.includes('bus'), 'de soorten staan klaar');
  assert.ok(beheer.body.ijkpunten.length > 0, 'de eigen kaart ijkt op bekende plekken in de stad');
  // een lijn met minder dan twee haltes is geen lijn
  const teKort = await api('/api/staff/ov/lijn/zet', { naam: 'Stompje', soort: 'bus',
    haltes: [{ naam: 'Ergens', lat: 38.9, lng: 1.43 }] }, baas);
  assert.equal(teKort.status, 400);
  // drie tikken op de kaart en de lijn staat er
  const nieuw = await api('/api/staff/ov/lijn/zet', { naam: 'Lijn 9 Haven', soort: 'bus', frequentieMin: 10,
    tarief: { basis: 200, perKm: 25 },
    haltes: [{ naam: 'Haven', lat: 38.912, lng: 1.436 }, { lat: 38.916, lng: 1.446 },
      { naam: 'Talamanca', lat: 38.917, lng: 1.455 }] }, baas);
  assert.equal(nieuw.status, 200);
  assert.equal(nieuw.body.lijn.haltes.length, 3);
  assert.equal(nieuw.body.lijn.haltes[1].naam, 'Halte 2', 'een naamloze tik krijgt een nette naam');
  const kaart = await api('/api/ov/kaart', STAD, lidB);
  const zichtbaar = kaart.body.lijnen.find(l => l.naam === 'Lijn 9 Haven');
  assert.ok(zichtbaar, 'leden zien de nieuwe lijn meteen in de OV-app');
  // bewerken: dezelfde lijn een andere naam geven, geen tweede lijn erbij
  const voor = (await api('/api/staff/ov/lijnen', {}, baas)).body.lijnen.length;
  const anders = await api('/api/staff/ov/lijn/zet', { id: nieuw.body.lijn.id, naam: 'Lijn 9 Marina',
    soort: 'bus', haltes: nieuw.body.lijn.haltes }, baas);
  assert.equal(anders.status, 200);
  const na = (await api('/api/staff/ov/lijnen', {}, baas)).body.lijnen;
  assert.equal(na.length, voor, 'bewerken maakt geen extra lijn');
  assert.ok(na.some(l => l.naam === 'Lijn 9 Marina'));
  // weghalen ruimt ook de voertuigen van die lijn op
  await api('/api/staff/ov/dienst', { lijnId: nieuw.body.lijn.id, voertuigNaam: 'Bus 9' }, pda);
  await api('/api/staff/ov/pos', { lat: 38.912, lng: 1.436 }, pda);
  const weg = await api('/api/staff/ov/lijn/zet', { id: nieuw.body.lijn.id, weg: true }, baas);
  assert.equal(weg.status, 200);
  const over = await api('/api/supplier/ov/overzicht', {}, baas);
  assert.ok(!over.body.voertuigen.some(v => /Bus 9/.test(v.naam)), 'het voertuig van de lijn is mee opgeruimd');
  const kaart2 = await api('/api/ov/kaart', STAD, lidB);
  assert.ok(!kaart2.body.lijnen.some(l => /Lijn 9/.test(l.naam)), 'de lijn is uit de leden-app');
});
