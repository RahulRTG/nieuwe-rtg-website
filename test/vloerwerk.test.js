/* ============================================================================
   DE WERKVLOER VAN EEN ZAAK -- 8 endpoints achter de leverancier-inlog.

   Deze acht wees de waargenomen dekkingsmeting aan als nooit aangeroepen:
   table/add, table/remove, table/status, minibar/count, minibar/item/add,
   minibar/item/remove, order/table en order/station. Bij elkaar is dit wat er
   op een gewone werkdag gebeurt: tafels indelen, de minibar tellen, een bon
   aan een tafel hangen en hem door de keuken en de bar loodsen.

   WAT ER OP HET SPEL STAAT

   Twee dingen die geld en vertrouwen raken.

   De minibar TELLEN is niet neutraal: wat er geteld wordt, komt als kamerlast
   op de rekening van de gast en verschijnt bij het uitchecken. Een telling van
   nul hoort dus ook nul te kosten, en een artikel dat niet in de catalogus
   staat hoort niet stiekem mee te rekenen.

   Een bon is pas KLAAR als elk station dat eraan moet werken klaar is. Zou de
   bar alleen genoeg zijn, dan krijgt de gast het bericht "uw bestelling is
   klaar" terwijl de keuken nog bezig is -- en dan staat hij aan de balie voor
   een bord dat er niet is.

   En de derde: een bon van de buren is geen bon van jou. Dat is hier de
   scheiding tussen zaken.

   Draai los: node --experimental-sqlite --test test/vloerwerk.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, baas, ober, hotelBaas, hotelKamermeisje, lid;
let tafelId = null, artikelId = null, bonRef = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vloerwerk-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function inlog(code, rol) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = roster.body.staff.find(x => x.role === rol);
  assert.ok(wie, code + ' heeft iemand met rol ' + rol);
  return (await api('/api/supplier/login', { code, staffId: wie.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  baas = await inlog('KIKUNOI', 'manager');       // restaurant
  ober = await inlog('KIKUNOI', 'staff');
  hotelBaas = await inlog('HOSHI', 'manager');    // hotel, met minibar
  hotelKamermeisje = await inlog('HOSHI', 'staff');
  const u = String(Date.now()).slice(-8);
  /* Met telefoonnummer, want bestellen bij een zaak gaat langs de
     gegevenspoort (kern/gegevenspoort.js: bestelling -> telefoon). Die poort
     hoort hier niet beproefd te worden; die heeft zijn eigen toetsen. */
  lid = (await api('/api/auth/register', { name: 'Vloer Gast', email: 'vl' + u + '@voorbeeld.test', phone: '06' + u,
    password: 'vloergeheim12', geboortedatum: '1992-06-06', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.ok(baas && ober && hotelBaas && lid, 'iedereen staat op de vloer');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. tafels: erbij zetten is van de baas, de status zetten doet de bediening', async () => {
  assert.equal((await api('/api/supplier/table/add', { name: '  ', seats: 4 }, baas)).status, 400, 'een tafel zonder naam is geen tafel');
  const bij = await api('/api/supplier/table/add', { name: 'Terras 7', seats: 99 }, baas);
  assert.equal(bij.status, 200);
  const t = bij.body.tables.find(x => x.name === 'Terras 7');
  tafelId = t.id;
  assert.equal(t.seats, 20, 'meer dan twintig stoelen aan een tafel bestaat niet');
  assert.equal(t.status, 'vrij', 'een nieuwe tafel staat vrij');
  assert.equal((await api('/api/supplier/table/add', { name: 'Stiekem', seats: 2 }, ober)).status, 403, 'de bediening zet er geen tafels bij');

  // de status is juist wel het werk van de bediening
  const bezet = await api('/api/supplier/table/status', { id: tafelId, status: 'bezet' }, ober);
  assert.equal(bezet.status, 200);
  assert.equal(bezet.body.tables.find(x => x.id === tafelId).status, 'bezet');
  assert.equal((await api('/api/supplier/table/status', { id: tafelId, status: 'in de fik' }, ober)).status, 400, 'een verzonnen status telt niet');
  assert.equal((await api('/api/supplier/table/status', { id: 'bestaatniet', status: 'vrij' }, ober)).status, 404);
});

test('2. een bon aan een tafel hangen, en niet aan die van de buren', async () => {
  /* Een gerecht uit de keuken EN een glas van de bar, want alleen dan moeten
     er straks twee stations klaar zijn (m5 draagt station: 'bar'). */
  const best = await api('/api/order', { supplierCode: 'KIKUNOI',
    items: [{ id: 'm1', qty: 2 }, { id: 'm5', qty: 2 }], note: 'Tafel buiten' }, lid);
  assert.equal(best.status, 200, 'het lid bestelt');
  bonRef = best.body.order.ref;

  const zet = await api('/api/supplier/order/table', { ref: bonRef, table: 'Terras 7' }, ober);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.order.table, 'Terras 7');
  assert.equal((await api('/api/supplier/order/table', { ref: 'BESTAATNIET', table: 'X' }, ober)).status, 404);
  /* Dezelfde bon, maar gezien vanuit een andere zaak: die hoort niet te
     bestaan. De route zoekt de bon op en kijkt daarna of hij van deze zaak
     is; zonder die tweede stap kan iedere zaak de bonnen van de buren
     verzetten. */
  assert.equal((await api('/api/supplier/order/table', { ref: bonRef, table: 'X' }, hotelBaas)).status, 404, 'een bon van de buren bestaat hier niet');
});

test('3. de bon is pas klaar als elk station klaar is', async () => {
  /* Eerst betalen: een onbetaalde bon staat op "wacht-op-betaling" en gaat de
     keuken niet in. Dat is de bedoeling -- de brigade begint niet aan werk dat
     nog niet is afgerekend. */
  const betaald = await api('/api/order/pay', { ref: bonRef }, lid);
  assert.equal(betaald.status, 200, 'het lid rekent af');

  const keuken = await api('/api/supplier/order/station', { ref: bonRef, station: 'keuken', phase: 'bezig' }, ober);
  assert.equal(keuken.status, 200);
  assert.equal(keuken.body.order.status, 'in bereiding', 'de bon loopt');

  const bar = await api('/api/supplier/order/station', { ref: bonRef, station: 'bar', phase: 'klaar' }, ober);
  assert.notEqual(bar.body.order.status, 'klaar', 'met alleen de bar klaar is de bon niet klaar');

  const af = await api('/api/supplier/order/station', { ref: bonRef, station: 'keuken', phase: 'klaar' }, ober);
  assert.equal(af.body.order.status, 'klaar', 'nu elk station klaar is, is de bon klaar');
  assert.ok(af.body.order.pasAt, 'het moment dat de keuken hem op de pas zette staat genoteerd');
  assert.equal((await api('/api/supplier/order/station', { ref: 'BESTAATNIET' }, ober)).status, 404);
});

test('4. de minibar-catalogus is van het management', async () => {
  assert.equal((await api('/api/supplier/minibar/item/add', { name: 'Cava', price: 0 }, hotelBaas)).status, 400, 'een artikel zonder prijs kan niet');
  const bij = await api('/api/supplier/minibar/item/add', { name: 'Cava split', price: 12 }, hotelBaas);
  assert.equal(bij.status, 200);
  artikelId = bij.body.minibar.find(x => x.name === 'Cava split').id;
  assert.equal((await api('/api/supplier/minibar/item/add', { name: 'Eigen voorraadje', price: 5 }, hotelKamermeisje)).status, 403,
    'wie de kamers doet, verandert de prijslijst niet');
  assert.equal((await api('/api/supplier/minibar/item/remove', { id: artikelId }, hotelKamermeisje)).status, 403);
  // een restaurant heeft helemaal geen minibar
  assert.equal((await api('/api/supplier/minibar/item/add', { name: 'Iets', price: 3 }, baas)).status, 400, 'een restaurant heeft geen minibar');
});

test('5. de minibar tellen is geld: nul telt nul, en onbekend telt niet mee', async () => {
  assert.equal((await api('/api/supplier/minibar/count', { room: '', items: [] }, hotelKamermeisje)).status, 400, 'zonder kamer geen telling');

  const niets = await api('/api/supplier/minibar/count', { room: '204', items: [{ id: artikelId, qty: 0 }] }, hotelKamermeisje);
  assert.equal(niets.status, 200);
  assert.equal(niets.body.charged, 0, 'niets gebruikt kost niets');
  assert.deepEqual(niets.body.entry.items, [], 'en er staat niets op de bon');

  const wel = await api('/api/supplier/minibar/count',
    { room: '204', items: [{ id: artikelId, qty: 2 }, { id: 'bestaatniet', qty: 99 }] }, hotelKamermeisje);
  assert.equal(wel.body.charged, 24, 'twee keer twaalf euro, en het onbekende artikel telt niet mee');
  assert.equal(wel.body.entry.items.length, 1);

  /* Het verbruik hoort als kamerlast op de rekening te staan, want daar komt
     de gast het bij het uitchecken tegen. Staat het er niet, dan is de
     telling een aantekening zonder gevolg. */
  const pos = (await api('/api/supplier/state', {}, hotelBaas)).body.state.pos || {};
  const bon = (pos.sales || []).find(s => s.room === '204' && s.total === 24);
  assert.ok(bon, 'de kamerlast staat op de dagstaat');
  assert.equal(bon.method, 'kamer');
  assert.match(bon.desc, /Cava split/);

  // en de teller is per zaak: het restaurant ziet er niets van
  const posRest = (await api('/api/supplier/state', {}, baas)).body.state.pos || {};
  assert.ok(!(posRest.sales || []).some(s => s.room === '204'), 'de buren zien de kamerlast niet');
});

test('6. opruimen: het artikel en de tafel gaan er weer af', async () => {
  const weg = await api('/api/supplier/minibar/item/remove', { id: artikelId }, hotelBaas);
  assert.ok(!weg.body.minibar.some(x => x.id === artikelId), 'het artikel is uit de catalogus');

  const tw = await api('/api/supplier/table/remove', { id: tafelId }, baas);
  assert.ok(!tw.body.tables.some(x => x.id === tafelId), 'de tafel is weg');
  assert.equal((await api('/api/supplier/table/remove', { id: tafelId }, ober)).status, 403, 'tafels weghalen is van de baas');
});
