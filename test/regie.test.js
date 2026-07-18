/* De app-regie van de boardroom: RTG bepaalt welke apps voor wie beschikbaar
   zijn. Elke eigen app staat als functie op het schakelbord (per pas of
   doelgroep te sluiten), de grote hendel zet alles bij iedereen aan of uit
   (de interne backoffice blijft open), en de leden-app hoort via
   /api/member/apps welke apps hij moet verbergen. Draai los:
   node --experimental-sqlite --test test/regie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regie-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api('/api/auth/register', { name: 'Regielid', email: 'regie' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })).body.token;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(lid && office, 'lid en backoffice zijn ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de standaardindeling: alles staat aan voor iedereen, dus elke app is open', async () => {
  assert.equal((await api('/api/theater/zaal', {}, lid)).status, 200, 'Theater is open');
  assert.equal((await api('/api/ov/kaart', { lat: 38.908, lng: 1.432 }, lid)).status, 200, 'OV is open');
  const apps = await api('/api/member/apps', {}, lid);
  assert.equal(apps.status, 200);
  assert.deepEqual(apps.body.uit, [], 'de leden-app hoeft niets te verbergen');
});

test('2. de nieuwe apps staan als functies op het schakelbord van de boardroom', async () => {
  const b = await api('/api/office/boardroom', {}, office);
  assert.equal(b.status, 200);
  const alleIds = b.body.functies.flatMap(g => g.functies.map(f => f.id));
  for (const id of ['podium', 'theater', 'flits', 'ov', 'wbw', 'spellen', 'oog', 'ghost', 'webauthn'])
    assert.ok(alleIds.includes(id), 'functie "' + id + '" staat op het bord');
});

test('3. per pas sluiten: Theater uit voor de RTG Pass en de leden-app hoort het', async () => {
  const zet = await api('/api/office/boardroom/schakel', { functie: 'theater', doelgroep: 'rtg', aan: false }, office);
  assert.equal(zet.status, 200);
  const dicht = await api('/api/theater/zaal', {}, lid);
  assert.equal(dicht.status, 503, 'de API weigert de app voor deze pas');
  assert.equal(dicht.body.reden, 'pas');
  const apps = await api('/api/member/apps', {}, lid);
  assert.ok(apps.body.uit.includes('theater'), 'het springboard weet dat Theater weg moet');
  assert.equal((await api('/api/ov/kaart', { lat: 38.908, lng: 1.432 }, lid)).status, 200, 'andere apps blijven open');
  await api('/api/office/boardroom/schakel', { functie: 'theater', doelgroep: 'rtg', aan: true }, office);
  assert.equal((await api('/api/theater/zaal', {}, lid)).status, 200, 'weer aan is meteen weer open');
});

test('4. de grote hendel: alles bij iedereen uit, en de boardroom kan hem zelf terugzetten', async () => {
  const uit = await api('/api/office/boardroom/alles', { aan: false }, office);
  assert.equal(uit.status, 200);
  assert.ok(uit.body.aantal > 30, 'de hele catalogus gaat om');
  const lidDicht = await api('/api/ov/kaart', { lat: 38.908, lng: 1.432 }, lid);
  assert.equal(lidDicht.status, 503);
  assert.equal(lidDicht.body.reden, 'globaal');
  assert.equal((await api('/api/wbw/mijn', {}, lid)).status, 503, 'ook Wie betaalt wat is dicht');
  assert.equal((await api('/api/supplier/ov/overzicht', {})).status, 503, 'de partnerkant is ook dicht');
  // de boardroom sluit zichzelf nooit buiten: intern blijft open
  const zelf = await api('/api/office/boardroom', {}, office);
  assert.equal(zelf.status, 200, 'het schakelbord blijft bereikbaar');
  const aan = await api('/api/office/boardroom/alles', { aan: true }, office);
  assert.equal(aan.status, 200);
  assert.equal((await api('/api/ov/kaart', { lat: 38.908, lng: 1.432 }, lid)).status, 200, 'alles staat weer open');
  assert.deepEqual((await api('/api/member/apps', {}, lid)).body.uit, [], 'en de leden-app verbergt weer niets');
});

test('5. de gratis app is een eigen doelgroep: de boardroom sluit gericht voor gasten', async () => {
  const gast = (await api('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  assert.ok(gast, 'de gratis app logt in als gast');
  assert.equal((await api('/api/member/apps', {}, gast)).status, 200, 'de gast kan de leden-laag bereiken');
  const zet = await api('/api/office/boardroom/schakel', { functie: 'member', doelgroep: 'gast', aan: false }, office);
  assert.equal(zet.status, 200);
  const dicht = await api('/api/member/apps', {}, gast);
  assert.equal(dicht.status, 503, 'de gratis app is nu gericht dicht');
  assert.equal(dicht.body.reden, 'pas');
  assert.equal((await api('/api/member/apps', {}, lid)).status, 200, 'leden met een pas merken er niets van');
  await api('/api/office/boardroom/schakel', { functie: 'member', doelgroep: 'gast', aan: true }, office);
  assert.equal((await api('/api/member/apps', {}, gast)).status, 200, 'weer open');
});

test('6. de leveranciers-regie: een functie per genre zaken dicht, andere genres blijven open', async () => {
  const roster = await api('/api/supplier/roster', { code: 'TRANSIT' });
  const m = roster.body.staff.find(x => x.role === 'manager');
  const ovZaak = (await api('/api/supplier/login', { code: 'TRANSIT', staffId: m.id, pin: '1234' })).body.token;
  assert.equal((await api('/api/supplier/ov/overzicht', {}, ovZaak)).status, 200, 'de OV-zaak kan erbij');
  const zet = await api('/api/office/boardroom/genre', { functie: 'ov', genre: 'ov', aan: false }, office);
  assert.equal(zet.status, 200);
  const dicht = await api('/api/supplier/ov/overzicht', {}, ovZaak);
  assert.equal(dicht.status, 503, 'de functie is voor dit genre gesloten');
  assert.equal(dicht.body.reden, 'genre');
  // een zaak van een ander genre merkt niets: de horeca-demo logt gewoon in en werkt
  const horeca = (await api('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  assert.ok(horeca, 'de horeca-zaak logt in');
  assert.equal((await api('/api/supplier/menu', { menu: [
    { id: 'x1', name: 'Proefgerecht', price: 10, publiekePrijs: 10, cat: 'Warm', station: 'keuken', sectie: 'warm' }
  ] }, horeca)).status, 200, 'en werkt gewoon door');
  // de regel staat op het bord en gaat er ook weer af
  const bord = await api('/api/office/boardroom', {}, office);
  assert.ok(bord.body.genreRegels.some(r => r.functie === 'ov' && r.genre === 'ov'), 'de regel staat op het bord');
  await api('/api/office/boardroom/genre', { functie: 'ov', genre: 'ov', aan: true }, office);
  assert.equal((await api('/api/supplier/ov/overzicht', {}, ovZaak)).status, 200, 'weer open voor het genre');
});

test('7. de vaste PDA-matrix: werk-apps horen standaard bij passende genres, met uitzonderingen', async () => {
  // een restaurant (Sal de Mar) heeft RTG Eye en Ghost Driver niet nodig: standaard dicht
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const kok = roster.body.staff.find(x => x.role !== 'manager');
  const restoPda = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: kok.id, pin: '5678' })).body.token;
  const oogDicht = await api('/api/staff/oog', {}, restoPda);
  assert.equal(oogDicht.status, 503, 'RTG Eye staat standaard niet op de horeca-PDA');
  assert.equal(oogDicht.body.reden, 'genre');
  const m = roster.body.staff.find(x => x.role === 'manager');
  const restoZaak = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: m.id, pin: '1234' })).body.token;
  assert.equal((await api('/api/supplier/ghost', {}, restoZaak)).status, 503, 'Ghost Driver ook niet');
  // een vervoerder (taxi) heeft ze wel: de standaard-matrix laat hem door
  const taxiRoster = await api('/api/supplier/roster', { code: 'MKKX' });
  const chauffeur = taxiRoster.body.staff.find(x => x.role !== 'manager');
  const taxiPda = (await api('/api/supplier/login', { code: 'MKKX', staffId: chauffeur.id, pin: '5678' })).body.token;
  assert.equal((await api('/api/staff/oog', {}, taxiPda)).status, 200, 'de taxi-PDA heeft RTG Eye gewoon');
  // de boardroom maakt een uitzondering: Eye toch open voor restaurants, en weer dicht
  await api('/api/office/boardroom/genre', { functie: 'oog', genre: 'restaurant', aan: true }, office);
  assert.equal((await api('/api/staff/oog', {}, restoPda)).status, 200, 'de uitzondering opent hem');
  const bord = await api('/api/office/boardroom', {}, office);
  assert.ok(bord.body.genreRegels.some(r => r.functie === 'oog' && r.soort === 'uitzondering'), 'de uitzondering staat op het bord');
  assert.ok(bord.body.genreStandaard.some(s => s.functie === 'oog' && s.alleen.includes('taxi')), 'de vaste matrix staat op het bord');
  await api('/api/office/boardroom/genre', { functie: 'oog', genre: 'restaurant', aan: false }, office);
  assert.equal((await api('/api/staff/oog', {}, restoPda)).status, 503, 'en dicht is weer dicht');
});
