/* N21: VIER STROMEN ZONDER PUNT (NAVIGATIE.md par. 15.0).

   Vier plekken bewaarden een positie van een mens zonder termijn, terwijl de
   functie eromheen dat punt na afloop niet nodig had:

     1. vonk-profiel      een datingprofiel droeg het exacte punt; nu een vak van 5 km
     2. markt-overdracht  de GPS van koper en verkoper bleef op de chat; nu alleen de uitkomst
     3. gemeente-melding  de plek bleef met de codenaam van de melder; na afhandeling zonder
     4. reis-etappes      "hier" was de GPS van het lid; nu de dichtstbijzijnde plaatsnaam

   N11 staat erboven: TIJDENS de taak mag het punt gebruikt worden (plannen,
   matchen, vergelijken). Deze toets kijkt naar wat er NA de taak overblijft.

   Waar een HTTP-route het gedrag laat zien (gemeente, reis), gaat de toets via
   een echte server. Waar het antwoord de opslag met opzet NIET toont (Vonk
   geeft zijn punt nooit terug, de markt toont geen coordinaten), kijkt de toets
   in-process in de opslag zelf -- want een antwoord dat niets toont bewijst niet
   dat er niets staat.

   Elke bewering is met een mutatie nagetrokken: zie de ZAKT OP-regels.
   Draai los: node --test test/n21stromen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { startServer, stop } = require('./helper');
const { haversine } = require('../server/lib/geo');

const schoon = (t, n) => String(t == null ? '' : t).slice(0, n);

/* ---------------------------------------------------------------- 1. Vonk -- */

function vonkMet(db) {
  const { maakVonk } = require('../server/kern/vonk');
  const accounts = { getUserById: () => ({ id: 1, verified: 'verified' }), getMemberState: () => ({ geboren: '1990-05-05' }) };
  return maakVonk({ db, save() {}, crypto, schoon, accounts, leeftijdVan: () => 36, codenaamVan: k => k,
    keyVanCodenaam: async n => ({ key: n }), haversine, reserveerTafel: () => ({}), pay: {},
    notify() {}, sseToCustomer() {}, sseToOffice() {} });
}

test('1a. vonk: het profiel bewaart een vak van 5 km en nooit het punt', () => {
  const db = { data: { suppliers: {} } };
  const api = vonkMet(db);
  api.vonkProfielZet('user-1', { stad: 'Amsterdam', lat: 52.371234, lng: 4.891234, maxKm: 5 });
  const p = db.data.vonk.profielen['user-1'];
  /* ZAKT OP: de oude regel `p.lat = coord(data.lat, 90); p.lng = coord(data.lng, 180);`
     in server/kern/vonk/index.js terugzetten -- dan staat het punt weer op het profiel. */
  assert.ok(!('lat' in p) && !('lng' in p), 'het profiel draagt geen lat/lng');
  assert.ok(!JSON.stringify(db.data.vonk).includes('52.371234'), 'en het punt staat nergens in Vonk');
  assert.match(p.vak, /^v5:-?\d+:-?\d+$/, 'wel een vak');
  const { middenVan } = require('../server/kern/vonk/vak');
  const m = middenVan(p.vak);
  const [, rij, kol] = p.vak.split(':');
  const oost = middenVan('v5:' + rij + ':' + (Number(kol) + 1));
  const noord = middenVan('v5:' + (Number(rij) + 1) + ':' + kol);
  /* ZAKT OP: de kolombreedte op de evenaar houden (`dlngOp` geeft DLAT terug) -- dan is
     een vak op 52 graden 3 km breed en wordt het punt nauwkeuriger dan de 5 km van N21. */
  assert.ok(Math.abs(haversine(m, oost) - 5000) < 100, 'een vak is oost-west 5 km breed');
  assert.ok(Math.abs(haversine(m, noord) - 5000) < 100, 'en noord-zuid 5 km hoog');
  assert.ok(haversine(m, { lat: 52.371234, lng: 4.891234 }) < 5000,
    'het midden van het vak ligt binnen 5 km van het punt: grof, maar niet ergens anders');
});

test('1b. vonk: de afstand wordt tussen vakken gerekend en de straal telt nog', () => {
  const db = { data: { suppliers: {} } };
  const api = vonkMet(db);
  api.vonkProfielZet('user-1', { stad: 'Amsterdam', lat: 52.37, lng: 4.89, maxKm: 20 });
  api.vonkProfielZet('user-2', { stad: 'Amstelveen', lat: 52.30, lng: 4.86, maxKm: 20 });
  api.vonkProfielZet('user-3', { stad: 'Athene', lat: 37.98, lng: 23.73, maxKm: 20 });
  const namen = api.vonkSelectie('user-1').mensen.map(x => x.codenaam);
  /* ZAKT OP: `km()` in server/kern/vonk/selectie.js terugzetten naar `a.lat` op het
     profiel -- dan is de afstand onbekend, filtert hij niet, en staat Athene erin. */
  assert.ok(namen.includes('user-2'), 'wie een paar km verder woont, staat in de selectie');
  assert.ok(!namen.includes('user-3'), 'wie 2000 km verder woont niet: de straal werkt op vakken');
});

test('1c. vonk: uitzetten laat geen plek achter, en een oud profiel verliest zijn punt', () => {
  const db = { data: { suppliers: {}, vonk: { profielen: {
    'user-9': { over: 'oud', geslacht: 'v', zoekt: ['m'], leeftijdMin: 18, leeftijdMax: 99, maxKm: 50,
      interesses: [], stad: 'Utrecht', lat: 52.09071, lng: 5.12142, actief: true, blokkade: [] } },
    likes: [], matches: [], meldingen: [] } } };
  const api = vonkMet(db);
  api.vonkProfielZet('user-1', { stad: 'Amsterdam', lat: 52.37, lng: 4.89 });
  const oud = db.data.vonk.profielen['user-9'];
  /* ZAKT OP: de migratie in d() (`migreerEenmaal` in server/kern/vonk/vak.js, over alle
     profielen) weghalen -- dan houdt een profiel van voor N21 zijn punt. */
  assert.ok(!('lat' in oud) && !('lng' in oud), 'een profiel van voor N21 verliest zijn punt');
  assert.match(oud.vak, /^v5:/, 'en krijgt er een vak voor terug');

  api.vonkProfielZet('user-1', { actief: false });
  /* ZAKT OP: `if (!p.actief) delete p.vak;` weghalen -- dan blijft de plek van wie
     Vonk uitzette gewoon staan. */
  assert.ok(!('vak' in db.data.vonk.profielen['user-1']), 'wie Vonk uitzet, heeft geen plek meer');
});

test('1d. vonk: vergeten haalt het profiel met zijn vak weg', () => {
  const db = { data: { cvs: {}, live: {}, notifications: {}, posts: [],
    vonk: { profielen: { 'user-5': { vak: 'v5:1164:62', actief: true } }, likes: [], matches: [], meldingen: [] } } };
  const { wisEigen } = require('../server/kern/vergeten/eigen')({ db });
  wisEigen('user-5', () => {}, [], 'Codenaam');
  /* ZAKT OP: de regel `delete db.data.vonk.profielen[key]` in
     server/kern/vergeten/eigen.js weghalen -- EIGEN_TAKKEN raakt een laag dieper niet. */
  assert.ok(!('user-5' in db.data.vonk.profielen), 'het Vonk-profiel van een vergeten lid is weg');
});

/* --------------------------------------------------------------- 2. Markt -- */

function marktMet() {
  const db = { data: {} };
  const { maakMarkt } = require('../server/kern/markt');
  const m = maakMarkt({ db, save() {}, crypto, anthropic: null, schoon, notify() {}, notifySupplier() {},
    haversine, betaal: null });
  const verkoper = { soort: 'lid', id: 'user-1', naam: 'Verkoper' };
  const koper = { soort: 'lid', id: 'user-2', naam: 'Koper' };
  const ad = m.plaats({ akkoord: true, titel: 'Houten stoel', beschrijving: 'Stevige stoel, weinig gebruikt', prijs: 40 }, verkoper);
  assert.ok(ad.ok, JSON.stringify(ad));
  const r = m.reageer(ad.ad.id, koper, 'Is hij er nog?');
  assert.ok(r.ok, JSON.stringify(r));
  const cid = r.chat.id;
  assert.ok(m.dealVoorstel(cid, verkoper, 40).ok);
  const deal = () => db.data.markt.chats[cid].deal;
  return { db, m, verkoper, koper, cid, deal };
}
const V = { lat: 38.909013, lng: 1.433017 };      // verkoper bij de overhandiging
const KVER = { lat: 39.500071, lng: 2.650093 };   // koper nog ver weg
const KBIJ = { lat: 38.909107, lng: 1.433119 };   // koper een paar meter verder

test('2a. markt: het eerste punt wacht, het punt van wie te ver is blijft niet', () => {
  const { db, m, verkoper, koper, cid, deal } = marktMet();
  const een = m.dealHier(cid, verkoper, V.lat, V.lng);
  assert.equal(een.samen, false);
  assert.equal(deal().wacht.rol, 'verkoper', 'alleen het eerste punt wacht');
  assert.ok(!('koperGps' in deal()) && !('verkoperGps' in deal()), 'geen twee punten op de deal');
  const ver = m.dealHier(cid, koper, KVER.lat, KVER.lng);
  assert.equal(ver.samen, false);
  assert.ok(ver.afstand > 100000, 'de afstand wordt wel gerekend');
  /* ZAKT OP: in samenkomst.js het punt van de nieuwkomer ook bewaren (bv. `deal.wacht = { rol, lat, lng, at }`
     voor de vergelijking) -- dan staat de koper op de chat. */
  assert.ok(!JSON.stringify(db.data.markt).includes(String(KVER.lat)), 'het punt van de koper is niet bewaard');
  assert.equal(deal().wacht.rol, 'verkoper', 'het wachtende punt blijft binnen zijn venster');
});

test('2b. markt: samen vervangt beide punten door de uitkomst', () => {
  const { db, m, verkoper, koper, cid, deal } = marktMet();
  m.dealHier(cid, verkoper, V.lat, V.lng);
  const bij = m.dealHier(cid, koper, KBIJ.lat, KBIJ.lng);
  assert.equal(bij.samen, true, 'een paar meter uit elkaar is samen');
  assert.ok(bij.chat.deal.factuur, 'de factuur staat klaar');
  assert.equal(typeof deal().afstand, 'number', 'de afstand in meters blijft');
  assert.ok(deal().afstand < 50);
  /* ZAKT OP: `if (samen) delete deal.wacht;` in server/kern/markt/handel/samenkomst.js
     weghalen -- dan blijft het punt van de verkoper na de overhandiging staan. */
  assert.ok(!('wacht' in deal()), 'geen wachtend punt meer');
  const json = JSON.stringify(db.data.markt);
  for (const p of [V, KBIJ]) assert.ok(!json.includes(String(p.lat)) && !json.includes(String(p.lng)),
    'geen coordinaat van koper of verkoper in de markt');
  assert.equal(bij.chat.deal.ikGedeeld, true, 'het scherm weet nog dat er gedeeld is, zonder plek');
});

test('2c. markt: een wachtend punt vervalt na zijn venster, ook als de ander nooit komt', () => {
  const { SAMEN_VERS_MS } = require('../server/kern/markt/regels');
  const a = marktMet();
  a.m.dealHier(a.cid, a.verkoper, V.lat, V.lng);
  a.deal().wacht.at = Date.now() - SAMEN_VERS_MS - 1000;   // de ander kwam nooit
  // een deal in een ander gesprek van dezelfde markt raakt het oude punt kwijt
  const r = a.m.reageer(a.db.data.markt.ads[0].id, { soort: 'lid', id: 'user-3', naam: 'Derde' }, 'Hallo');
  a.m.dealVoorstel(r.chat.id, { soort: 'lid', id: 'user-3', naam: 'Derde' }, 40);
  a.m.dealHier(r.chat.id, { soort: 'lid', id: 'user-3', naam: 'Derde' }, 52.1, 5.1);
  /* ZAKT OP: de veegregel `for (const c of Object.values(store().chats || {})) S.vervalWacht(...)`
     in server/kern/markt/handel/deal.js weghalen -- dan blijft een verlopen punt eeuwig op de chat. */
  assert.ok(!('wacht' in a.deal()), 'het verlopen punt van de verkoper is weg');
});

/* ------------------------------------------------- 3 en 4: echte server -- */

let srv, base, lid, gem;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-n21-'));
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
  lid = (await api('/api/auth/register', { name: 'N21 Lid', email: 'n21' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const roster = await api('/api/supplier/roster', { code: 'GEMEENTE' });
  const man = roster.body.staff.find(x => x.role === 'manager');
  gem = (await api('/api/supplier/login', { code: 'GEMEENTE', staffId: man.id, pin: '1234' })).body.token;
  assert.ok(lid && gem);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('3. gemeente: de plek blijft bij de melding, de codenaam van de melder gaat eraf na afhandeling', async () => {
  const PLEK = { lat: 38.911337, lng: 1.431771 };
  const m = await api('/api/gemeente/meld', { categorie: 'verlichting', tekst: 'Lantaarn bij de trap is stuk',
    lat: PLEK.lat, lng: PLEK.lng }, lid);
  assert.equal(m.status, 200, JSON.stringify(m.body));
  const ref = m.body.melding.ref;
  const zoek = async status => ((await api('/api/gemeente/meldingen', { status }, gem)).body.meldingen || [])
    .find(x => x.ref === ref);

  // besturing: zolang de melding loopt, staat de melder erbij -- anders bewijst de afwezigheid hieronder niets
  await api('/api/gemeente/melding/zet', { ref, patch: { status: 'in behandeling' } }, gem);
  const loopt = await zoek('in behandeling');
  assert.ok(loopt && loopt.melder, 'tijdens de behandeling kent de gemeente de melder');

  const zet = await api('/api/gemeente/melding/zet', { ref, patch: { status: 'opgelost', update: 'Lamp vervangen' } }, gem);
  assert.equal(zet.status, 200);
  const klaar = await zoek('opgelost');
  assert.ok(klaar, 'de melding staat nog bij de gemeente');
  assert.equal(klaar.lat, PLEK.lat, 'de plek van het probleem blijft');
  assert.equal(klaar.lng, PLEK.lng);
  /* ZAKT OP: `delete m.melderKey; delete m.melder;` in server/kern/gemeente/meldingen.js
     weghalen -- dan staat de codenaam van de melder na afhandeling nog naast de plek. */
  assert.ok(!klaar.melder, 'de codenaam van de melder is eraf');
  const mijn = (await api('/api/gemeente/meldingen/mijn', {}, lid)).body.meldingen || [];
  assert.ok(!mijn.some(x => x.ref === ref), 'en de melding hangt niet meer aan het lid');
  /* ZAKT OP: de `notify(m.melderKey, ...)` voor het loskoppelen weghalen -- dan hoort de
     melder nooit dat zijn melding is afgehandeld. */
  const berichten = (await api('/api/notifications', {}, lid)).body.notifications || [];
  assert.ok(berichten.some(b => String(b.title || '').includes(ref)), 'de melder kreeg de uitkomst als bericht');
});

test('4. reis: een reis vanaf "hier" bewaart een plaatsnaam en niet de GPS van het lid', async () => {
  const HIER = { lat: 38.930173, lng: 1.390137 };   // herkenbare cijfers, zodat ze op te sporen zijn
  const EULA = { lat: 38.984, lng: 1.537, label: 'Santa Eularia' };
  const start = await api('/api/live/start', { mode: 'driving', lat: HIER.lat, lng: HIER.lng }, lid);
  assert.equal(start.status, 200, JSON.stringify(start.body).slice(0, 200));
  const plan = await api('/api/mob/reis/plan', { van: { hier: true }, naar: EULA, stad: 'Ibiza' }, lid);
  assert.equal(plan.status, 200, JSON.stringify(plan.body).slice(0, 200));
  assert.equal(plan.body.van.bron, 'live', 'het plannen gebruikt de live positie (N11)');
  const optie = (plan.body.opties || []).find(o => o.etappes.some(e => e.wijze === 'taxi'));
  assert.ok(optie, 'er is een optie met een taxi vanaf hier');
  const boek = await api('/api/mob/reis/boek', { van: { hier: true }, naar: EULA, stad: 'Ibiza',
    optie: optie.id, idem: 'n21-reis' }, lid);
  assert.equal(boek.status, 200, JSON.stringify(boek.body).slice(0, 300));
  const taxi = boek.body.reis.etappes.find(e => e.wijze === 'taxi');
  assert.ok(taxi && taxi.ref, 'de taxi is een echte opdracht: die kreeg het ophaalpunt wel');

  const reis = ((await api('/api/mob/reis/mijn', {}, lid)).body.reizen || []).find(r => r.id === boek.body.reis.id);
  assert.ok(reis, 'de reis staat in het overzicht');
  /* ZAKT OP: `reisZonderGps(r);` in server/kern/mobiliteit/reis.js weghalen -- dan staat de
     live positie als `van` in de reis en in de eerste etappe. */
  const json = JSON.stringify(reis);
  assert.ok(!json.includes(String(HIER.lat)) && !json.includes(String(HIER.lng)),
    'de GPS van het lid staat nergens in de bewaarde reis');
  assert.equal(reis.van.bron, 'hier');
  assert.ok(!('lat' in reis.van) && !('lng' in reis.van), 'het vertrek is een naam en geen punt');
  /* ZAKT OP: in server/kern/mobiliteit/hiernaam.js altijd 'Vertrekpunt' teruggeven -- dan
     wordt er geen plaatsnaam gezocht. */
  assert.match(reis.van.label, /^Bij \S/, 'de dichtstbijzijnde bekende plek staat er als naam');
  assert.equal(reis.naar.lat, EULA.lat, 'een bestemming die het lid zelf koos blijft zoals hij was');
  await api('/api/live/stop', {}, lid);
});
