/* ============================================================================
   DE INRICHTING VAN EEN ZAAK -- 6 endpoints uit de supplier-groep.

   room/remove, photo/remove, service, location, voorraad en menu/recipe
   stonden als nooit aangeroepen in de waargenomen dekkingsmeting. Ze horen
   bij elkaar als "hoe de zaak zichzelf inricht": welke kamers er zijn, welke
   foto's op de pagina staan, welke diensten er te koop zijn, waar de zaak nu
   is, wat er op voorraad ligt en hoe een gerecht gemaakt wordt.

   WAT ER OP HET SPEL STAAT

   - EEN KAMER VAN DE BUREN BESTAAT HIER NIET. Vier van deze zes doen aan een
     onbekend id of een index buiten bereik gewoon niets en melden 200. Dat is
     verdedigbaar, maar dan moet vaststaan dat de BUURZAAK ongemoeid blijft.
   - EEN FOTO GAAT OP INDEX WEG, NIET OP NAAM. Dat is een echt verschil: een
     index buiten bereik hoort niets te doen, en een negatieve index al
     helemaal niet -- splice(-1) haalt anders de laatste foto weg.
   - HET RECEPT LIEGT NIET OVER ZIJN HERKOMST. Zonder ANTHROPIC_API_KEY komt
     er een vast huisrecept terug, en het antwoord zegt met ai:false dat er
     geen AI aan te pas kwam. Doen alsof een vaste tekst een AI-recept is, is
     precies het soort belofte dat dit huis niet doet.

   WAT HIER NIET VERANDERD IS, EN WAAROM
   room/remove en photo/remove hebben geen managercontrole, terwijl service
   en verkoop/auto/weg die wel hebben. Een kamer weghalen is inrichting en
   geen dagelijks werk, dus dat verschil is opvallend -- maar room/ADD staat
   net zo open, en alleen het weghalen dichtzetten maakt het rijtje niet
   consistenter. Wie in een hotel een kamer uit de inventaris mag halen is een
   bedrijfsbesluit; de toets legt hieronder alleen vast wat het nu doet.

   Draai los: node --experimental-sqlite --test test/zaak-inrichting.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, hotel, hotelWerker, buurhotel, resto, restoWerker;
let kamerId = null, buurKamerId = null, dienstId = null, gerechtId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-inrichting-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function inlog(code, rol) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = roster.body.staff.find(x => x.role === rol);
  return (await api('/api/supplier/login', { code, staffId: wie.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token;
}
const staat = t => api('/api/supplier/state', {}, t).then(r => r.body.state);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  base = srv.base;
  hotel = await inlog('HOSHI', 'manager');          // Aguamarina Ibiza: heeft kamers
  hotelWerker = await inlog('HOSHI', 'staff');
  buurhotel = await inlog('SAKURA', 'manager');     // Villa Bahia: appartementen
  resto = await inlog('KIKUNOI', 'manager');        // Sal de Mar: heeft een menu
  restoWerker = await inlog('KIKUNOI', 'staff');
  assert.ok(hotel && buurhotel && resto, 'de zaken staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een kamer weghalen raakt alleen de eigen zaak', async () => {
  const mijn = (await staat(hotel)).rooms || [];
  assert.ok(mijn.length >= 2, 'het hotel heeft kamers (' + mijn.length + ')');
  kamerId = mijn[mijn.length - 1].id;
  const buur = (await staat(buurhotel)).rooms || [];
  assert.ok(buur.length, 'de buren ook');
  buurKamerId = buur[0].id;

  /* Een id van de buren: 200, en er hoort niets te gebeuren. Dat "200" is het
     antwoord waarbij niemand meer kijkt, dus kijken we bij de buren zelf. */
  const vreemd = await api('/api/supplier/room/remove', { id: buurKamerId }, hotel);
  assert.equal(vreemd.status, 200);
  assert.ok(vreemd.body.rooms.every(r => r.id !== buurKamerId), 'hij komt niet in de eigen lijst terecht');
  assert.ok(((await staat(buurhotel)).rooms || []).some(r => r.id === buurKamerId),
    'en bij de buren staat de kamer er gewoon nog');

  assert.equal((await api('/api/supplier/room/remove', { id: 'bestaatniet' }, hotel)).status, 200,
    'een id dat niet bestaat is geen fout');

  const weg = await api('/api/supplier/room/remove', { id: kamerId }, hotel);
  assert.ok(weg.body.rooms.every(r => r.id !== kamerId), 'de eigen kamer gaat er wel af');
  assert.equal(weg.body.rooms.length, mijn.length - 1);
});

test('2. een foto gaat op index weg, en een index buiten bereik doet niets', async () => {
  /* Eerst twee foto's neerzetten. Zonder die opzet had deze toets geen tanden:
     het hotel heeft er in de seed nul, en dan slaagt "een negatieve index
     haalt niets weg" ook als splice(-1) wel degelijk zou toeslaan -- er is
     immers niets om weg te halen. De mutatie liep er dwars doorheen, en dat
     was de derde keer deze week dat een bewering van mij niet kon falen. */
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const een = await api('/api/supplier/photo/add', { image: png }, hotel);
  assert.equal(een.status, 200, 'de eerste foto staat op de pagina: ' + JSON.stringify(een.body));
  const twee = await api('/api/supplier/photo/add', { image: png }, hotel);
  const aantal = twee.body.count;
  assert.ok(aantal >= 2, 'er staan nu minstens twee foto\'s (' + aantal + ')');

  const raar = await api('/api/supplier/photo/remove', { index: 999 }, hotel);
  assert.equal(raar.status, 200);
  assert.equal(raar.body.count, aantal, 'een index buiten bereik haalt niets weg');

  /* splice(-1) zou de LAATSTE foto weghalen. Vandaar de expliciete i >= 0 in
     de route, en vandaar deze regel: een negatieve index is een tikfout, geen
     verwijzing naar het eind van de lijst. */
  const negatief = await api('/api/supplier/photo/remove', { index: -1 }, hotel);
  assert.equal(negatief.body.count, aantal, 'een negatieve index haalt de laatste foto niet weg');
  assert.equal((await api('/api/supplier/photo/remove', { index: 'twee' }, hotel)).body.count, aantal,
    'en een index die geen getal is ook niet');

  const weg = await api('/api/supplier/photo/remove', { index: 0 }, hotel);
  assert.equal(weg.body.count, aantal - 1, 'de eerste foto gaat er wel af');
});

test('3. diensten toevoegen en weghalen doet de eigenaar', async () => {
  assert.equal((await api('/api/supplier/service', { action: 'add', name: 'Late check-out', price: 25 }, hotelWerker)).status, 403,
    'de bediening zet geen diensten in de etalage');
  assert.equal((await api('/api/supplier/service', { action: 'add', name: '', price: 25 }, hotel)).status, 400, 'zonder naam');
  assert.equal((await api('/api/supplier/service', { action: 'add', name: 'Gratis', price: 0 }, hotel)).status, 400,
    'een dienst zonder prijs is geen dienst');
  assert.equal((await api('/api/supplier/service', { action: 'poetsen' }, hotel)).status, 400, 'een actie die we niet kennen');

  const mk = await api('/api/supplier/service',
    { action: 'add', name: 'Late check-out tot 16:00', desc: 'Op aanvraag, afhankelijk van de bezetting.', price: 45, duurMin: 240 }, hotel);
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  const lijst = (await staat(hotel)).services || mk.body.services || [];
  const nieuw = lijst.find(s => s.name === 'Late check-out tot 16:00');
  assert.ok(nieuw, 'de dienst staat in de etalage: ' + JSON.stringify(lijst).slice(0, 200));
  dienstId = nieuw.id;
  assert.equal(nieuw.price, 45);
  assert.equal(nieuw.soort, 'dienst', 'zonder soort is het een dienst en geen product');

  assert.equal((await api('/api/supplier/service', { action: 'remove', id: dienstId }, hotelWerker)).status, 403);
  assert.equal((await api('/api/supplier/service', { action: 'remove', id: dienstId }, hotel)).status, 200);
  assert.ok(!((await staat(hotel)).services || []).some(s => s.id === dienstId), 'en hij is er weer af');
});

test('4. de live locatie: alleen een echte positie telt', async () => {
  const voor = (await staat(hotel)).supplier;
  void voor;
  const raar = await api('/api/supplier/location', { lat: 'ergens', lng: 'daar' }, hotel);
  assert.equal(raar.status, 200, 'een onleesbare positie is geen fout...');

  const goed = await api('/api/supplier/location', { lat: 38.9067, lng: 1.4206, label: 'Ibiza-stad, haven' }, hotelWerker);
  assert.equal(goed.status, 200, 'de locatie delen mag het hele team: wie rijdt, deelt');
  assert.equal(goed.body.loc.lat, 38.9067);
  assert.equal(goed.body.loc.label, 'Ibiza-stad, haven');

  /* ...en hij overschrijft de laatste bekende positie ook niet. DIT IS DE
     VONDST VAN DIT BESTAND. Number(null) is 0, en JSON maakt van een NaN of
     een ontbrekende waarde precies null -- dus met alleen Number.isFinite()
     kwam een half verstuurde positie er als 0,0 doorheen: Null Island in de
     Golf van Guinee. Voor een taxi of een jet met een lopende rit sprong de
     kaart van de klant naar de andere kant van de wereld. */
  const leeg = await api('/api/supplier/location', { lat: NaN, lng: NaN }, hotel);
  assert.equal(leeg.body.loc.lat, 38.9067, 'een null is geen coordinaat: de laatst bekende positie blijft staan');
  assert.equal((await api('/api/supplier/location', {}, hotel)).body.loc.lat, 38.9067,
    'en helemaal niets meesturen ook niet');

  // een coordinaat buiten de aarde is net zo goed geen positie
  assert.equal((await api('/api/supplier/location', { lat: 91, lng: 1.42 }, hotel)).body.loc.lat, 38.9067);
  assert.equal((await api('/api/supplier/location', { lat: 38.9, lng: 181 }, hotel)).body.loc.lat, 38.9067);

  // 0,0 blijft wel te versturen als iemand er echt is -- het is een geldige plek
  assert.equal((await api('/api/supplier/location', { lat: 0, lng: 0 }, hotel)).body.loc.lat, 0,
    'wie daar echt vaart mag het gewoon delen');
});

test('5. de voorraad is een lijst, ook als hij leeg is', async () => {
  const v = await api('/api/supplier/voorraad', {}, resto);
  assert.equal(v.status, 200);
  assert.ok(Array.isArray(v.body.voorraad), 'er komt een lijst terug');

  // het is de voorraad van de eigen zaak: twee zaken delen er geen
  const z = await api('/api/supplier/voorraad', {}, hotel);
  assert.ok(Array.isArray(z.body.voorraad));
  assert.equal((await api('/api/supplier/voorraad', {}, restoWerker)).status, 200, 'lezen mag het hele team');
});

test('6. het recept zegt eerlijk dat er geen AI aan te pas kwam', async () => {
  const menu = (await staat(resto)).menu || [];
  assert.ok(menu.length, 'het restaurant heeft een kaart');
  const metAllergeen = menu.find(m => (m.allergens || []).length) || menu[0];
  gerechtId = metAllergeen.id;

  assert.equal((await api('/api/supplier/menu/recipe', { itemId: 'bestaatniet' }, resto)).status, 404);
  /* Het gerecht van een andere zaak staat niet op deze kaart, dus 404 -- niet
     omdat er een eigenaarscontrole is, maar omdat de kaart per zaak wordt
     doorzocht. Voor de uitkomst maakt dat niet uit; voor het begrijpen wel. */
  assert.equal((await api('/api/supplier/menu/recipe', { itemId: gerechtId }, hotel)).status, 404,
    'een gerecht van het restaurant staat niet op de kaart van het hotel');

  const r = await api('/api/supplier/menu/recipe', { itemId: gerechtId }, restoWerker);
  assert.equal(r.status, 200, 'het recept opvragen mag het hele team: de keuken werkt ermee');
  assert.equal(r.body.ai, false, 'zonder sleutel staat er eerlijk bij dat het geen AI-recept is');
  assert.match(r.body.recept, /Mise en place/i, 'er komt een bruikbaar huisrecept terug');
  if ((metAllergeen.allergens || []).length)
    assert.match(r.body.recept, /allergen/i, 'en de allergenen staan erin, want daar hangt de keukenhygiene aan');

  // het recept blijft op de bon staan
  const na = ((await staat(resto)).menu || []).find(m => m.id === gerechtId);
  assert.ok(na.recept && na.recept.length > 20, 'het recept staat bij het gerecht');
});
