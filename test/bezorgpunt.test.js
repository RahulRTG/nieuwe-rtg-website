/* EEN BEZORGPUNT VERDWIJNT BIJ LEVERING (NAVIGATIE.md N20).

   Tijdens een bezorging mag alles wat goede navigatie vraagt (N11): een
   coordinaat van het bezorgadres, de laatste positie van de koerier, een ETA.
   Na de levering heeft niemand die nog nodig, en een coordinaat die dan blijft
   staan is een stukje bewegingsspoor van de klant. Dus: bij geleverd/bezorgd
   of geannuleerd gaan de coordinaat en de laatste koerierpositie weg, en het
   ADRES als tekst blijft bij de bestelling (bon, geschil, "waar ging het heen").

   Vier stromen, elk met een eigen eindstand:
   - horeca-bezorgadres  `rek.bezorg.lat/lng`  (geleverd, oninbaar)
   - bezorgdienst-adres  `order.geo`           (bezorgd, geweigerd, terugbetaald, geannuleerd)
   - mode-adres          `bezorging.loc`       (afgeleverd, retour)
   - koerier-mode        `bezorging.gps`       (afgeleverd, retour)

   En par. 12 gebrek 5: modebezorging verzon zonder coordinaat een bestemming
   (de winkel plus 0,01; 0,008) en rekende daar een afstand en een ETA naartoe.
   Geen punt is geen punt: `loc` blijft null en de route zegt `afstandM: null`.

   Elke bewering hieronder is met een mutatie nagetrokken: de regel die wist
   teruggedraaid, de toets zien zakken, hersteld. Zie de "ZAKT OP"-regels. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');

let BASE, child, KIKU, MAISON;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bezorgpunt-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function maakLid(naam, metAdres) {
  const u = String(Date.now()) + Math.floor(Math.random() * 1000);
  const reg = await post('/api/auth/register', { name: naam, email: 'bp' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(-8), password: 'geheim123',
    geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, 'lid aangemaakt: ' + JSON.stringify(reg.body).slice(0, 160));
  if (metAdres) {
    const start = await post('/api/gegevens/start', { soort: 'bezorging' }, reg.body.token);
    if (start.body && start.body.id)
      await post('/api/gegevens/zeg', { id: start.body.id, tekst: 'Damstraat 1, 1011AB Amsterdam' }, reg.body.token);
  }
  return reg.body.token;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', DEMO_SUPPLIER: 'MAISON' } }));
  const roster = (await post('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  KIKU = (await post('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  MAISON = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  assert.ok(KIKU && MAISON, 'beide zaken zijn ingelogd');
  await post('/api/supplier/horeca/bezorg/zone', { open: true, zones: [
    { id: 'z1', naam: 'Centrum', postcodes: ['1011', '1012'], kosten: 3.5, minimum: 5, gratisVanaf: 40, minuten: 30 }
  ] }, KIKU);
  const prod = await post('/api/supplier/bezorg/product', { name: 'Omakase-box', price: 48.5 }, KIKU);
  assert.equal(prod.status, 200);
  await post('/api/supplier/bezorg/instellingen', { aan: true, bezorgen: true }, KIKU);
  await post('/api/supplier/mode/bezorg/setup', { aan: true }, MAISON);
});
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------------- 1. horeca-bezorgadres ---------------- */
async function horecaBestelling(lid, idem) {
  const kaart = (await post('/api/gast/bezorg/kaart', { zaak: 'KIKUNOI' }, lid)).body.kaart;
  const item = kaart.filter(x => !x.alcohol && !x.uitverkocht).sort((a, b) => b.centen - a.centen)[0];
  const b = await post('/api/gast/bezorg/bestel', { zaak: 'KIKUNOI', postcode: '1011AB', adres: 'Damstraat 18',
    lat: 52.3731, lng: 4.8932, idem, items: [{ itemId: item.id, aantal: 2 }] }, lid);
  assert.equal(b.status, 200, JSON.stringify(b.body).slice(0, 200));
  return b.body.rekening.rekeningId;
}
const horecaBezorg = async (lid, rekeningId) =>
  ((await post('/api/gast/bezorg/mijn', {}, lid)).body.bestellingen.find(x => x.rekeningId === rekeningId) || {}).bezorg;

test('horeca: het bezorgpunt bestaat tijdens de rit en verdwijnt bij geleverd; het adres blijft', async () => {
  const lid = await maakLid('Horeca punt', true);
  const rekeningId = await horecaBestelling(lid, 'bp-horeca-1');
  for (const status of ['geaccepteerd', 'in-bereiding', 'klaar', 'overgedragen', 'onderweg']) {
    const stap = await post('/api/supplier/eten/status', { rekeningId, status }, KIKU);
    assert.equal(stap.status, 200, status + ': ' + JSON.stringify(stap.body).slice(0, 160));
  }
  const onderweg = await horecaBezorg(lid, rekeningId);
  // N11: tijdens de bezorging werkt alles zoals het werkte
  assert.equal(onderweg.lat, 52.3731, 'onderweg staat het punt er');
  assert.equal(onderweg.lng, 4.8932);
  assert.equal((await post('/api/supplier/eten/status', { rekeningId, status: 'geleverd' }, KIKU)).status, 200);
  const na = await horecaBezorg(lid, rekeningId);
  // ZAKT OP: zonder `rek.bezorg.lat = null; rek.bezorg.lng = null` in routes/supplier/eten.js
  assert.equal(na.lat, null, 'na geleverd geen breedtegraad meer');
  assert.equal(na.lng, null, 'na geleverd geen lengtegraad meer');
  assert.equal(na.adres, 'Damstraat 18', 'het adres blijft bij de bestelling');
  assert.equal(na.postcode, '1011AB');
});

test('horeca: een bezorgrekening die als oninbaar stopt, houdt geen punt', async () => {
  const lid = await maakLid('Horeca oninbaar', true);
  const rekeningId = await horecaBestelling(lid, 'bp-horeca-2');
  assert.equal((await horecaBezorg(lid, rekeningId)).lat, 52.3731, 'voor het stoppen staat het punt er');
  const r = await post('/api/supplier/horeca/oninbaar', { rekeningId, reden: 'klant annuleerde' }, KIKU);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  const na = await horecaBezorg(lid, rekeningId);
  // ZAKT OP: zonder de wisregel in routes/supplier/horeca/betalen.js (oninbaar)
  assert.equal(na.lat, null); assert.equal(na.lng, null);
  assert.equal(na.adres, 'Damstraat 18', 'het adres blijft');
});

/* ---------------- 2. bezorgdienst-adres ---------------- */
async function dienstBestelling(lid) {
  const partners = (await post('/api/bezorg/partners', {}, lid)).body.partners;
  const p = partners.find(x => x.code === 'KIKUNOI');
  const b = await post('/api/bezorg/bestel', { supplierCode: 'KIKUNOI', levering: 'bezorgen',
    items: [{ id: p.producten[0].id, qty: 1 }], adres: 'Carrer de la Mar 10', lat: 38.91, lng: 1.43 }, lid);
  assert.equal(b.status, 200, JSON.stringify(b.body).slice(0, 160));
  return b.body.order.ref;
}
const volg = async (lid, ref) => (await post('/api/bezorg/volg', { ref }, lid)).body.order;

test('bezorgdienst: het punt bestaat onderweg en verdwijnt bij bezorgd; het adres blijft', async () => {
  const lid = await maakLid('Dienst punt', false);
  const ref = await dienstBestelling(lid);
  assert.equal((await post('/api/order/pay', { ref }, lid)).status, 200);
  await post('/api/supplier/bezorg/neem', { refs: [ref] }, KIKU);
  const pid = (await post('/api/bezorg/partners', {}, lid)).body.partners.find(x => x.code === 'KIKUNOI').producten[0].id;
  await post('/api/supplier/bezorg/inpak', { ref, bon: ref, tas: 'Tas 1', items: [pid] }, KIKU);
  await post('/api/supplier/bezorg/pakcheck', { refs: [ref] }, KIKU);
  assert.equal((await post('/api/supplier/bezorg/status', { refs: [ref], status: 'onderweg' }, KIKU)).status, 200);
  assert.deepEqual((await volg(lid, ref)).geo, { lat: 38.91, lng: 1.43 }, 'onderweg staat het punt er (N11)');
  assert.equal((await post('/api/supplier/bezorg/status', { refs: [ref], status: 'bezorgd' }, KIKU)).status, 200);
  const na = await volg(lid, ref);
  // ZAKT OP: zonder `if (o.geo) o.geo = null` in routes/supplier/bezorg.js
  assert.equal(na.geo, null, 'na bezorgd geen punt meer');
  assert.equal(na.adres, 'Carrer de la Mar 10', 'het adres blijft');
});

test('bezorgdienst: geweigerd door de zaak laat geen punt achter', async () => {
  const lid = await maakLid('Dienst geweigerd', false);
  const ref = await dienstBestelling(lid);
  assert.equal((await post('/api/order/pay', { ref }, lid)).status, 200);
  assert.ok((await volg(lid, ref)).geo, 'voor de weigering staat het punt er');
  const r = await post('/api/supplier/order/status', { ref, status: 'geweigerd' }, KIKU);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  const na = await volg(lid, ref);
  // ZAKT OP: zonder de wisregel na `o.status = status` in routes/supplier/orders/afhandeling.js
  assert.equal(na.geo, null); assert.equal(na.adres, 'Carrer de la Mar 10');
});

test('bezorgdienst: terugbetaald laat geen punt achter', async () => {
  const lid = await maakLid('Dienst terug', false);
  const ref = await dienstBestelling(lid);
  assert.equal((await post('/api/order/pay', { ref }, lid)).status, 200);
  assert.ok((await volg(lid, ref)).geo);
  const r = await post('/api/supplier/refund', { ref }, KIKU);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  const na = await volg(lid, ref);
  // ZAKT OP: zonder de wisregel na `o.status = 'terugbetaald'` in afhandeling.js
  assert.equal(na.geo, null); assert.equal(na.adres, 'Carrer de la Mar 10');
});

test('bezorgdienst: geannuleerd door het lid laat geen punt achter', async () => {
  const lid = await maakLid('Dienst annuleer', false);
  const ref = await dienstBestelling(lid);
  assert.ok((await volg(lid, ref)).geo);
  const r = await post('/api/annuleer', { soort: 'order', ref }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  const na = await volg(lid, ref);
  // ZAKT OP: zonder de wisregel in kern/ervaring/leden/annuleren.js
  assert.equal(na.geo, null); assert.equal(na.adres, 'Carrer de la Mar 10');
});

/* ---------------- 3 en 4. mode-adres en koerier-mode ---------------- */
test('mode: zonder coordinaat bestaat er geen verzonnen bestemming (gebrek 5)', async () => {
  const lid = await maakLid('Mode zonder punt', false);
  const r = await post('/api/mode/bezorg/aanvraag', { supplierCode: 'MAISON', adres: 'Carrer de la Mar 10, Ibiza',
    items: [{ naam: 'Linnen jurk', prijs: 80, aantal: 1 }] }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  const ref = r.body.bezorging.ref;
  const rt = await post('/api/supplier/mode/bezorg/route', { lat: 38.907, lng: 1.435 }, MAISON);
  const stop = rt.body.route.find(x => x.ref === ref);
  assert.ok(stop, 'de bezorging staat op de route');
  // ZAKT OP: het oude `s.loc.lat + 0.01`-punt in kern/modebezorg/winkel.js geeft hier een afstand en ETA
  assert.equal(stop.afstandM, null, 'geen punt, dus geen afstand');
  assert.equal(stop.etaMin, null, 'en geen ETA naar een plek die niemand opgaf');
});

test('mode: koerierpositie bestaat onderweg, verdwijnt bij afgeleverd en komt niet terug', async () => {
  const lid = await maakLid('Mode koerier', false);
  const r = await post('/api/mode/bezorg/aanvraag', { supplierCode: 'MAISON', adres: 'Carrer de la Mar 10, Ibiza',
    lat: 38.91, lng: 1.43, items: [{ naam: 'Zijden blouse', prijs: 90, aantal: 1 }] }, lid);
  const ref = r.body.bezorging.ref;
  // de aanvraag draagt geen code meer; het lid vraagt hem op (kern/modebezorg/bezorgcode.js)
  const code = (await post('/api/mode/bezorg/code', { ref }, lid)).body.bezorgcode;
  await post('/api/supplier/mode/bezorg/neem', { ref }, MAISON);
  const gp = await post('/api/supplier/mode/bezorg/gps', { ref, lat: 38.905, lng: 1.44 }, MAISON);
  assert.equal(gp.status, 200);
  assert.ok(Number.isFinite(gp.body.etaMin), 'onderweg is er een ETA naar het echte punt (N11)');
  const mijn = async () => (await post('/api/mode/bezorg/mijn', {}, lid)).body.bezorgingen.find(x => x.ref === ref);
  assert.equal((await mijn()).gps.lat, 38.905, 'onderweg staat de koerierpositie er');
  assert.equal((await post('/api/supplier/mode/bezorg/overhandig', { ref, bezorgcode: code }, MAISON)).status, 200);
  // ZAKT OP: zonder `wisPunt(b)` in overhandig() van kern/modebezorg/koerier.js
  assert.equal((await mijn()).gps, null, 'na afgeleverd geen koerierpositie meer');
  const laat = await post('/api/supplier/mode/bezorg/gps', { ref, lat: 38.906, lng: 1.441 }, MAISON);
  // ZAKT OP: zonder de KLAAR-grendel in gps() -- een achterblijvende app zet het punt terug
  assert.equal(laat.status, 409, 'na de levering neemt de server geen positie meer aan');
  assert.equal((await mijn()).gps, null);
});

/* De bestemming zelf (`loc`) staat in geen enkel antwoord, dus die meten we in
   het proces op de echte module, met een kale context. */
function modeInProces() {
  const db = { data: { modeBezorg: [] } };
  const zaak = { code: 'MODE1', name: 'Mode', type: 'retail', loc: { lat: 52, lng: 4.9 },
    modebezorg: { aan: true, straalKm: 15, kosten: 6.5, gratisVanaf: 150, waardegrensId: 250, retourAanDeur: true } };
  const niets = () => {};
  // de bezorgcode leeft in een collectietransactie; hier een in het geheugen
  const bewerkCollectie = async (naam, werk) => werk(db.data[naam] || (db.data[naam] = {}));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bezorgpunt-'));
  const mb = require('../server/kern/modebezorg').maakModebezorg({ db, save: niets, crypto, bewerkCollectie, dataDir,
    findSupplier: c => (c === 'MODE1' ? zaak : null), accounts: { getUserById: () => null },
    notify: niets, notifySupplier: niets, sseToCustomer: niets, sseToSupplier: niets, sseToOffice: niets,
    haversine: (a, b) => Math.hypot(a.lat - b.lat, a.lng - b.lng) * 111000, etaMinutes: m => Math.ceil(m / 500),
    leesUploadDataUrl: niets });
  return { db, mb };
}

test('mode in het proces: loc en gps weg bij afgeleverd en bij retour; adres blijft; geen punt is null', async () => {
  const { db, mb } = modeInProces();
  const items = [{ naam: 'Jas', prijs: 90, aantal: 1 }];
  const leeg = mb.mbAanvraag('k1', 'Lid', 'MODE1', items, { adres: 'Straat 1' });
  // ZAKT OP: het verzonnen punt (winkel + 0,01; 0,008) in kern/modebezorg/winkel.js
  assert.equal(db.data.modeBezorg.find(b => b.ref === leeg.bezorging.ref).loc, null, 'geen punt is null');
  const nul = mb.mbAanvraag('k1', 'Lid', 'MODE1', items, { adres: 'Straat 1', lat: null, lng: '' });
  // ZAKT OP: `Number(null)` is 0 -- zonder de null/''-controle wordt dit het punt (0, 0)
  assert.equal(db.data.modeBezorg.find(b => b.ref === nul.bezorging.ref).loc, null, 'null en leeg zijn ook geen punt');

  for (const einde of ['afgeleverd', 'retour']) {
    const a = mb.mbAanvraag('k1', 'Lid', 'MODE1', items, { adres: 'Straat 2', lat: 52.01, lng: 4.91 });
    const b = db.data.modeBezorg.find(x => x.ref === a.bezorging.ref);
    mb.mbNeem('MODE1', b.ref, { name: 'Koerier' });
    mb.mbGps('MODE1', b.ref, 52.005, 4.905);
    assert.deepEqual(b.loc, { lat: 52.01, lng: 4.91 }, 'onderweg staat de bestemming er');
    assert.equal(b.gps.lat, 52.005, 'onderweg staat de koerierpositie er');
    const r = einde === 'afgeleverd'
      ? await mb.mbOverhandig('MODE1', b.ref, { bezorgcode: (await mb.mbCode('k1', b.ref)).bezorgcode }, { name: 'Koerier' })
      : await mb.mbRetour('MODE1', b.ref, 'past niet', { name: 'Koerier' });
    assert.equal(r.status, 200);
    // ZAKT OP: zonder `wisPunt(b)` in overhandig() resp. retour()
    assert.equal(b.loc, null, einde + ': geen bestemming meer');
    assert.equal(b.gps, null, einde + ': geen koerierpositie meer');
    assert.equal(b.adres, 'Straat 2', einde + ': het adres blijft');
  }
});
