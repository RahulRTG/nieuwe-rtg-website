/* DE KRING ALLEEN IN EEN VENSTER, DE RONDE ZONDER GPS (NAVIGATIE.md N19).

   Twee stromen:
   - veilig-laatste-plek: de laatst bekende plek van een lid voor zijn
     veiligheidskring bestaat alleen zolang de kring een venster open heeft
     (een wacht, een alarm, een codewoord) en gaat weg als dat venster sluit of
     afloopt. Tot 29 september 2026 werd hij ook zonder venster bewaard, en nooit
     weggehaald.
   - patrouille: het controlepunt bewijst de ronde; de positie van de bewaker
     wordt niet meer bewaard.

   In-process op de echte modules, plus een keer tegen een echte server: de
   route /api/veiligheid/plek moet zonder venster niets bewaren en met venster
   wel -- anders is het alleen de module die zich houdt aan het besluit.

   Draai los: node --test test/kringronde.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

function bouwPlek() {
  const db = { data: {} };
  const opslag = require('../server/kern/veiligheid/opslag')({ db });
  const plek = require('../server/kern/veiligheid/plek')({ opslag, save: () => {} });
  return { db, plek, V: () => opslag.wortel() };
}

test('1. zonder open venster wordt de plek niet bewaard', () => {
  /* ZAKT OP: de regel `if (!venster) { vergeetHandle(...); ... }` in plekMelden
     weghalen -- dan onthoudt de server weer een plek terwijl er niets loopt. */
  const { plek, V } = bouwPlek();
  const r = plek.plekMelden('H', { lat: 52.3676, lon: 4.9041 });
  assert.equal(r.status, 200, 'het toestel doet niets fout');
  assert.equal(r.bewaard, false, 'en hoort dat er niets is bewaard');
  assert.equal(V().plek.H, undefined, 'in de la: geen plek');
  assert.equal(plek.laatstePlek('H'), null);
});

test('2. binnen een venster blijft de laatste plek, en bij sluiten gaat hij mee weg', () => {
  /* ZAKT OP: `delete V.plek[handle]` uit vergeetHandle() halen -- dan blijft de plek
     na het sluiten van de wacht staan. */
  const { plek, V } = bouwPlek();
  plek.vensterOpen('H', 60, 'wacht');
  plek.plekMelden('H', { lat: 52.3676, lon: 4.9041 });
  assert.equal(plek.laatstePlek('H').lat, 52.3676, 'tijdens het venster is de plek er');
  assert.equal(plek.plekVoorContact('H', true).lat, 52.3676, 'en ziet de kring hem');
  plek.vensterSluit('H');
  assert.equal(V().plek.H, undefined, 'venster dicht: plek weg');
  assert.equal(plek.laatstePlek('H'), null);
});

test('3. een afgelopen venster telt als dicht: niets meer te lezen, en de veger haalt de plek weg', () => {
  /* ZAKT OP: de venstertoets in laatstePlek() weghalen -- dan leest een alarm
     na afloop nog een plek van toen.
     ZAKT OP: de eerste lus in vergeetVerlopen() weghalen -- dan blijft de plek
     van wie nooit sloot in de la staan. */
  const { plek, V } = bouwPlek();
  plek.vensterOpen('H', 60, 'wacht');
  plek.plekMelden('H', { lat: 52.1, lon: 4.3 });
  V().vensters.H.tot = Date.now() - 1000;          // het venster liep af, niemand sloot
  V().plek.OUD = { lat: 51.9, lon: 4.4, at: new Date().toISOString() };   // van voor N19, zonder venster
  assert.equal(plek.laatstePlek('H'), null, 'na afloop is er geen laatste plek meer');
  assert.equal(plek.vergeetVerlopen(), 2, 'de veger wist de plek van H en de oude zonder venster');
  assert.equal(V().plek.H, undefined);
  assert.equal(V().plek.OUD, undefined);
  assert.equal(V().vensters.H, undefined, 'en het verlopen venster zelf');
});

test('4. patrouille: het controlepunt wordt bewaard, de GPS van de bewaker niet', () => {
  /* ZAKT OP: lat/lng terugzetten in de push van rondeCheckpoint (patrouille.js). */
  const zaak = { code: 'BEV', name: 'Team', type: 'beveiliging', beveiliging: { posten: [{ id: 'p1', naam: 'Object', minMan: 1 }] } };
  const db = { data: { bevDiensten: [], bevIncidenten: [], bevRondes: [], suppliers: [zaak] } };
  const bev = require('../server/kern/beveiliging').maakBeveiliging({
    db, save: () => {}, crypto,
    accounts: { listStaff: () => [{ id: 7, name: 'Bewaker Zeven', role: 'staff' }], publicStaff: x => x },
    findSupplier: c => (c === 'BEV' ? zaak : null),
    notify: () => {}, notifySupplier: () => {}, sseToSupplier: () => {}, sseToOffice: () => {},
    logActivity: () => {}, haversine: () => 0
  });
  const r = bev.bevRondeStart('BEV', 7, 'p1');
  assert.equal(r.status, 200, JSON.stringify(r));
  // een oude client stuurt de positie nog mee; die mag nergens landen
  const cp = bev.bevRondeCheckpoint('BEV', 7, r.ronde.id, 'Achterhek', 38.876, 1.383);
  assert.equal(cp.status, 200);
  const rauw = db.data.bevRondes[0].checkpoints[0];
  assert.equal(rauw.naam, 'Achterhek', 'het controlepunt bewijst de ronde');
  assert.ok(rauw.at, 'met zijn tijd');
  assert.ok(!('lat' in rauw) && !('lng' in rauw), 'maar zonder positie: ' + JSON.stringify(rauw));
});

test('5. patrouille: rondes van voor N19 verliezen hun GPS, niet hun controlepunten', () => {
  /* ZAKT OP: vergeetRondePosities() leeg laten teruggeven.
     ZAKT OP: de map in rondePubliek() terug naar `r.checkpoints || []` -- dan
     toont het commandocentrum een oude positie nog. */
  const zaak = { code: 'BEV', name: 'Team', type: 'beveiliging', beveiliging: { posten: [{ id: 'p1', naam: 'Object', minMan: 1 }] } };
  const oud = { id: 'r1', supplierCode: 'BEV', postId: 'p1', guardId: 7, gestart: new Date().toISOString(), klaar: null,
    checkpoints: [{ naam: 'Poort', at: new Date().toISOString(), lat: 38.8, lng: 1.3 }] };
  const db = { data: { bevDiensten: [], bevIncidenten: [], bevRondes: [oud], suppliers: [zaak] } };
  const bev = require('../server/kern/beveiliging').maakBeveiliging({
    db, save: () => {}, crypto,
    accounts: { listStaff: () => [{ id: 7, name: 'Bewaker Zeven', role: 'staff' }], publicStaff: x => x },
    findSupplier: c => (c === 'BEV' ? zaak : null),
    notify: () => {}, notifySupplier: () => {}, sseToSupplier: () => {}, sseToOffice: () => {},
    logActivity: () => {}, haversine: () => 0
  });
  const beeld = bev.bevMijnDiensten('BEV', 7);
  assert.deepEqual(Object.keys(beeld.ronde.checkpoints[0]).sort(), ['at', 'naam'], 'het beeld toont geen positie');
  assert.equal(bev.bevVergeetRondePosities(), 1);
  assert.deepEqual(Object.keys(oud.checkpoints[0]).sort(), ['at', 'naam'], 'in de la: alleen naam en tijd');
});

/* ---- tegen een echte server ---- */
const { startServer, stop } = require('./helper');

async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
let n = 0;
async function registreer(base) {
  const u = Date.now().toString(36) + (n++) + Math.random().toString(36).slice(2, 6);
  const r = await api(base, '/api/auth/register', {
    name: 'Kring Lid', email: u + '@x.nl', phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  assert.equal(r.status, 200, 'registreren: ' + JSON.stringify(r.body));
  const con = await api(base, '/api/member/connections', {}, r.body.token);
  return { token: r.body.token, key: con.body.me };
}

test('6. echte server: /api/veiligheid/plek bewaart alleen binnen een wacht, en de plek is weg na stoppen', async (t) => {
  /* ZAKT OP: de tak `if (!venster)` uit plekMelden halen -- de route meldt dan
     `bewaard` niet meer eerlijk. Wat er in de LA staat na het sluiten, kan deze
     toets niet zien (de opslag is SQLite en /api/veiligheid leest door
     laatstePlek(), die zelf al op het venster let): wegen die elkaar dekken,
     laten een enkele mutatie hier niet zakken. De la zelf toetsen 1 t/m 3. */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kring-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir, RTG_DEMO: '0' } });
  t.after(() => stop(srv && srv.child));
  const B = srv.base;
  const ik = await registreer(B), maat = await registreer(B);
  assert.equal((await api(B, '/api/member/connect', { key: maat.key }, ik.token)).status, 200);
  assert.equal((await api(B, '/api/member/connect/respond', { key: ik.key, action: 'accept' }, maat.token)).status, 200);
  assert.equal((await api(B, '/api/veiligheid/kring/toevoegen', { handle: maat.key }, ik.token)).status, 200);

  const los = await api(B, '/api/veiligheid/plek', { lat: 52.3676, lon: 4.9041 }, ik.token);
  assert.equal(los.status, 200);
  assert.equal(los.body.bewaard, false);
  assert.equal((await api(B, '/api/veiligheid', {}, ik.token)).body.plek, null, 'zonder venster geen laatste plek');

  const w = await api(B, '/api/veiligheid/wacht/start', { soort: 'thuis', minuten: 30, label: 'Naar huis' }, ik.token);
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.equal((await api(B, '/api/veiligheid/plek', { lat: 52.3676, lon: 4.9041 }, ik.token)).body.bewaard, true);
  assert.ok((await api(B, '/api/veiligheid', {}, ik.token)).body.plek, 'binnen de wacht is de plek er');

  assert.equal((await api(B, '/api/veiligheid/wacht/stop', { id: w.body.wacht.id }, ik.token)).status, 200);
  assert.equal((await api(B, '/api/veiligheid', {}, ik.token)).body.plek, null, 'wacht gestopt: plek weg');
});
