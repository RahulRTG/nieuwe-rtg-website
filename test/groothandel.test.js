/* Groothandel & markt: een brede B2B/B2C-marktplaats op het RTG-systeem. Een
   groothandel voert een assortiment, zet zijn eigen functies aan/uit, en levert
   aan horeca (inkoopprijs), leden (boodschappen) en collega-groothandels. De AI
   stelt op basis van verkoop + mise-en-place een bijbestelling voor. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { startServer, stop } = require('./helper');
const { maakGroothandel } = require('../server/kern/groothandel');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, gh, horeca, lid;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gh-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'MERCABIZA' } });
  base = srv.base;
  // groothandel: rahul/Imran logt in als de demo-groothandel (DEMO_SUPPLIER)
  gh = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  // horeca-koper: manager van de demo-restaurant via pincode
  const rooster = await api(base, '/api/supplier/roster', { code: 'KIKUNOI' });
  const mgr = (rooster.body.staff || []).find(s => s.role === 'manager');
  horeca = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  // een lid voor de boodschappen
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Boodschappen Lid', email: 'b' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. de groothandel ziet zijn functies (alles aan) en assortiment', async () => {
  const o = await api(base, '/api/supplier/groothandel/overzicht', {}, gh);
  assert.equal(o.status, 200);
  assert.ok(o.body.functies.length >= 10, 'veel schakelbare functies');
  assert.ok(o.body.functies.every(f => f.aan), 'standaard staat alles aan');
  assert.ok(o.body.producten.length >= 8, 'een gevuld assortiment');
});

test('2. een groothandel zet zijn eigen functie uit (B2B) en dat blokkeert inkoop', async () => {
  await api(base, '/api/supplier/groothandel/functie', { id: 'b2b', aan: false }, gh);
  const bestel = await api(base, '/api/supplier/inkoop/bestel', { groothandelCode: 'MERCABIZA', regels: [] }, horeca);
  assert.equal(bestel.status, 409, 'zonder B2B kan de horeca niet inkopen');
  await api(base, '/api/supplier/groothandel/functie', { id: 'b2b', aan: true }, gh); // weer aan
});

test('3. de horeca koopt in bij de groothandel (B2B, inkoopprijs) en de order loopt door', async () => {
  const markt = await api(base, '/api/supplier/inkoop/markt', {}, horeca);
  const m = (markt.body.groothandels || []).find(x => x.code === 'MERCABIZA');
  assert.ok(m && m.producten.length, 'de groothandel staat op de inkoopmarkt');
  const p = m.producten[0];
  const best = await api(base, '/api/supplier/inkoop/bestel', { groothandelCode: 'MERCABIZA', regels: [{ productId: p.id, aantal: 3 }] }, horeca);
  assert.equal(best.status, 200);
  assert.equal(best.body.order.status, 'aangevraagd');
  const ref = best.body.order.ref;
  // de groothandel ziet de order binnenkomen en zet hem door
  const ink = await api(base, '/api/supplier/groothandel/overzicht', {}, gh);
  assert.ok(ink.body.inkomend.open.some(o => o.ref === ref), 'de order staat bij de groothandel');
  let st = await api(base, '/api/supplier/groothandel/order/status', { ref, actie: 'verder' }, gh);
  assert.equal(st.body.status, 'bevestigd');
  st = await api(base, '/api/supplier/groothandel/order/status', { ref, actie: 'verder' }, gh);
  assert.equal(st.body.status, 'onderweg');
  st = await api(base, '/api/supplier/groothandel/order/status', { ref, actie: 'verder' }, gh);
  assert.equal(st.body.status, 'geleverd');
});

test('4. een lid bestelt boodschappen bij de groothandel (consumentprijs)', async () => {
  const markt = await api(base, '/api/groothandel/markt', {}, lid);
  const m = (markt.body.groothandels || []).find(x => x.code === 'MERCABIZA');
  assert.ok(m, 'de groothandel levert ook boodschappen aan leden');
  const p = m.producten[0];
  const best = await api(base, '/api/groothandel/bestel', { groothandelCode: 'MERCABIZA', regels: [{ productId: p.id, aantal: 2 }] }, lid);
  assert.equal(best.status, 200);
  assert.equal(best.body.order.soort, 'boodschappen');
  const mijn = await api(base, '/api/groothandel/mijn', {}, lid);
  assert.ok(mijn.body.bestellingen.some(o => o.ref === best.body.order.ref));
});

test('5. consument-functie uit blokkeert boodschappen van leden', async () => {
  await api(base, '/api/supplier/groothandel/functie', { id: 'consument', aan: false }, gh);
  const markt = await api(base, '/api/groothandel/markt', {}, lid);
  assert.ok(!(markt.body.groothandels || []).some(x => x.code === 'MERCABIZA'), 'niet meer op de boodschappen-markt');
  await api(base, '/api/supplier/groothandel/functie', { id: 'consument', aan: true }, gh);
});

test('6. AI-bijbestellen geeft een voorstel terug', async () => {
  const ai = await api(base, '/api/supplier/inkoop/ai', { groothandelCode: 'MERCABIZA' }, horeca);
  assert.equal(ai.status, 200);
  assert.ok(Array.isArray(ai.body.regels), 'een lijst met voorgestelde regels');
  assert.equal(typeof ai.body.uitleg, 'string');
});

// De kern van het AI-bijbestellen: verkoopdata (+ mise-en-place) sturen het voorstel.
test('7. de AI-heuristiek kiest het juiste product uit de verkoop', () => {
  const ghSupplier = {
    code: 'GH', name: 'Testgroothandel', type: 'groothandel',
    groothandel: { functies: {}, producten: [
      { id: 'p1', naam: 'Verse tonijn', categorie: 'Vlees & vis', eenheid: 'kg', inkoopPrijs: 20, consumentPrijs: 30, voorraad: 10, minBestel: 2, actief: true },
      { id: 'p2', naam: 'Servetten', categorie: 'Non-food', eenheid: 'pak', inkoopPrijs: 5, consumentPrijs: 8, voorraad: 10, minBestel: 1, actief: true }
    ] }
  };
  const partner = { code: 'REST', name: 'Sal de Mar', dailyMeps: {} };
  const db = { data: { suppliers: [ghSupplier], orders: [
    { supplierCode: 'REST', at: new Date().toISOString(), items: [{ name: 'Tonijn tataki', qty: 6 }] }
  ], groothandelOrders: [] } };
  const mod = maakGroothandel({ db, save() {}, crypto, findSupplier: c => db.data.suppliers.find(s => s.code === c),
    notify() {}, notifySupplier() {}, sseToSupplier() {}, sseToCustomer() {}, sseToOffice() {}, anthropic: null });
  mod.ghDefaults(ghSupplier);
  const r = mod.ghBijbestelVoorstel(partner, 'GH');
  assert.equal(r.status, 200);
  assert.ok(r.regels.some(x => x.productId === 'p1'), 'de tonijn wordt voorgesteld (kwam in de verkoop voor)');
  assert.ok(!r.regels.some(x => x.productId === 'p2'), 'servetten niet (geen verkoopsignaal)');
});

/* 8. /api/groothandel/annuleer: een lid annuleert zijn eigen boodschappen zolang
   de groothandel nog niet bevestigde, en de voorraad komt terug. Daarna niet meer,
   en een ander lid kan andermans bestelling niet aanraken.
   MUTATIE GEZIEN ZAKKEN: in server/kern/groothandel/orderlaag.js de regel
   `voorraadTerug(o);` in annuleer() weggehaald; de toets zakte op "de voorraad
   komt terug". */
test('8. een lid annuleert zijn eigen, nog niet bevestigde bestelling en de voorraad komt terug', async () => {
  const product = async () => {
    const m = (await api(base, '/api/groothandel/markt', {}, lid)).body.groothandels.find(x => x.code === 'MERCABIZA');
    return m.producten.find(x => x.voorraad >= 10);
  };
  const p = await product();
  assert.ok(p, 'er is een product met voorraad');
  const best = await api(base, '/api/groothandel/bestel', { groothandelCode: 'MERCABIZA', regels: [{ productId: p.id, aantal: 2 }] }, lid);
  assert.equal(best.status, 200, JSON.stringify(best.body).slice(0, 160));
  const ref = best.body.order.ref;
  const tussen = (await api(base, '/api/groothandel/markt', {}, lid)).body.groothandels
    .find(x => x.code === 'MERCABIZA').producten.find(x => x.id === p.id);

  const u = Date.now().toString().slice(-8);
  const ander = (await api(base, '/api/auth/register', { name: 'Ander Lid', email: 'ga' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.equal((await api(base, '/api/groothandel/annuleer', { ref }, ander)).status, 404, 'andermans bestelling bestaat niet voor dit lid');
  assert.equal((await api(base, '/api/groothandel/annuleer', { ref }, null)).status, 401);

  const weg = await api(base, '/api/groothandel/annuleer', { ref }, lid);
  assert.equal(weg.status, 200, JSON.stringify(weg.body).slice(0, 160));
  const o = (await api(base, '/api/groothandel/mijn', {}, lid)).body.bestellingen.find(x => x.ref === ref);
  assert.equal(o.status, 'geannuleerd');
  assert.equal(tussen.voorraad, p.voorraad - 2, 'bestellen haalt de voorraad eraf');
  const na = (await api(base, '/api/groothandel/markt', {}, lid)).body.groothandels
    .find(x => x.code === 'MERCABIZA').producten.find(x => x.id === p.id);
  assert.equal(na.voorraad, p.voorraad, 'de voorraad komt terug');
  assert.equal((await api(base, '/api/groothandel/annuleer', { ref }, lid)).status, 409, 'twee keer annuleren kan niet');

  // een bevestigde bestelling annuleert het lid niet meer
  const twee = await api(base, '/api/groothandel/bestel', { groothandelCode: 'MERCABIZA', regels: [{ productId: p.id, aantal: 1 }] }, lid);
  assert.equal(twee.status, 200);
  const st = await api(base, '/api/supplier/groothandel/order/status', { ref: twee.body.order.ref, actie: 'verder' }, gh);
  assert.equal(st.body.status, 'bevestigd');
  assert.equal((await api(base, '/api/groothandel/annuleer', { ref: twee.body.order.ref }, lid)).status, 409,
    'na bevestiging is annuleren niet meer aan het lid');
});

/* 9. De voltooiproef van de stand Bestellen (scripts/lib/voltooi-stand/
   bestellen.js, 19 oktober 2026): een dubbele tik op "Bezorgen" of een
   herhaling na een crash maakte een tweede bestelling en hield de voorraad twee
   keer vast, en een dubbele tik van de groothandel op "Volgende stap" sloeg een
   stap over. Met de herhaalsleutel van de stand en de stand die het scherm van
   de groothandel zag, gebeurt het een keer -- ook als het domein opnieuw op
   dezelfde gegevens wordt gebouwd, zoals na een herstart. */
test('9. een herhaalsleutel is een bestelling, en "volgende stap" slaat geen stap over', () => {
  const maak = (data) => {
    const db = { data };
    const mod = maakGroothandel({ db, save() {}, crypto, findSupplier: c => db.data.suppliers.find(s => s.code === c),
      notify() {}, notifySupplier() {}, sseToSupplier() {}, sseToCustomer() {}, sseToOffice() {}, anthropic: null });
    mod.ghDefaults(db.data.suppliers[0]);
    return mod;
  };
  const gh = { code: 'GH', name: 'Groothandel', type: 'groothandel', caps: ['groothandel'],
    groothandel: { functies: { consument: true, bezorgen: true, afhalen: true }, producten: [
      { id: 'p1', naam: 'Tonijn', categorie: 'Vlees & vis', eenheid: 'kg', inkoopPrijs: 20, consumentPrijs: 30, voorraad: 10, minBestel: 2, actief: true }] } };
  const data = { suppliers: [gh], groothandelOrders: [] };
  const koper = { soort: 'lid', id: 'lid-1', naam: 'Codenaam' };
  const eerst = maak(data).ghPlaatsBestelling('GH', koper, [{ productId: 'p1', aantal: 2 }], { idem: 'bs-1' });
  assert.equal(eerst.status, 200, JSON.stringify(eerst));
  const na = maak(JSON.parse(JSON.stringify(data)));
  const nogEens = na.ghPlaatsBestelling('GH', koper, [{ productId: 'p1', aantal: 2 }], { idem: 'bs-1' });
  assert.equal(nogEens.order.ref, eerst.order.ref, 'dezelfde bestelling');
  assert.equal(na.ghMijnBestellingen(koper).length, 1);
  const a = na.ghOrderVerder('GH', eerst.order.ref, 'verder', null, 'aangevraagd');
  const b = na.ghOrderVerder('GH', eerst.order.ref, 'verder', null, 'aangevraagd');
  assert.equal(a.status2 || a.status, 'bevestigd');
  assert.equal(b.status, 409, 'de tweede tik op dezelfde stand slaat geen stap over');
});

test('orderlijsten scheiden kopers en leveranciers zonder een schrijfpoort', () => {
  const orders = [
    { ref: 'eigen', groothandelCode: 'A', klant: { soort: 'lid', id: '1', naam: 'Een' }, status: 'aangevraagd', subtotaal: 10 },
    { ref: 'ander', groothandelCode: 'B', klant: { soort: 'lid', id: '2', naam: 'Twee' }, status: 'aangevraagd', subtotaal: 20 },
    { ref: 'zelfde-id-ander-type', groothandelCode: 'A', klant: { soort: 'partner', id: '1', naam: 'Zaak' }, status: 'geleverd', subtotaal: 30 },
    { ref: 'geannuleerd', groothandelCode: 'A', klant: { soort: 'lid', id: '1', naam: 'Een' }, status: 'geannuleerd', subtotaal: 40 }
  ];
  const voor = JSON.stringify(orders);
  const beeld = require('../server/kern/groothandel/orderbeeld')({
    orders: () => orders, klantSoortVan: koper => koper.soort,
    GH_KLAAR: { geleverd: true, geannuleerd: true }
  });
  const eigen = beeld.mijnBestellingen({ soort: 'lid', id: '1' });
  assert.deepEqual(eigen.map(o => o.ref), ['eigen', 'geannuleerd']);
  assert.ok(eigen.every(o => !Object.hasOwn(o.klant, 'id')), 'het klantbeeld geeft geen interne klant-id terug');
  const leverancier = beeld.inkomend('A');
  assert.deepEqual(leverancier.open.map(o => o.ref), ['eigen']);
  assert.deepEqual(leverancier.afgerond.map(o => o.ref), ['zelfde-id-ander-type', 'geannuleerd']);
  assert.equal(leverancier.omzet, 30, 'alleen geleverd telt als omzet');
  assert.equal(leverancier.open[0].klant.id, '1');
  assert.deepEqual(beeld.inkomend('onbekend'), { open: [], afgerond: [], omzet: 0 });
  assert.equal(JSON.stringify(orders), voor, 'lezen verandert geen order');
});
