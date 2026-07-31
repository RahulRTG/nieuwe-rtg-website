/* ============================================================================
   HET THUIS-KANTOOR VAN EEN ZAAK -- 5 endpoints achter de leverancier-inlog.

   Deze vijf wees de waargenomen dekkingsmeting aan als nooit aangeroepen:
   huizen, blokkeer, bericht, berichten en review. RTG Thuis werd wel beproefd
   vanaf de GAST (zoeken, boeken, annuleren), maar de hostkant hoort bij de
   leveranciers -- elke zaak host onder de eigen vlag 'zaak:<code>' -- en die
   deur was niet beproefd.

   WAT ER OP HET SPEL STAAT

   Een boeking is een gesprek tussen twee partijen die elkaar niet kennen, over
   een huis waar iemand gaat slapen. Drie dingen moeten daarom vastliggen:

   - Het berichtenspoor is van de gast en de host, en van niemand anders. Een
     derde zaak met een geldige inlog hoort er niet bij te kunnen.
   - Een blokkade is een belofte aan jezelf: die datums zijn niet te boeken.
     Een blokkade met een eindtijd voor de begintijd is geen blokkade.
   - Een review kan pas na het uitchecken, een keer per richting. Een sterrental
     buiten een tot vijf is geen oordeel maar een tikfout.

   Draai los: node --experimental-sqlite --test test/thuis-zaak.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, host, hostMedewerker, buurzaak, gast, gast2;
let huisId = null, ref = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-thuiszaak-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const zk = (pad, body, token) => api('/api/supplier/thuis/' + pad, body, token);
async function inlog(code, rol) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = roster.body.staff.find(x => x.role === rol);
  return (await api('/api/supplier/login', { code, staffId: wie.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token;
}
async function lid(naam) {
  const u = String(Date.now() + Math.round(performance.now())).slice(-9);
  /* Met telefoonnummer: boeken is een reservering en gaat dus langs de
     gegevenspoort. Die heeft zijn eigen toetsen; hier is het opzet. */
  return (await api('/api/auth/register', { name: naam, email: 'tz' + u + '@voorbeeld.test', phone: '06' + u.slice(0, 8),
    password: 'thuisgeheim12', geboortedatum: '1989-04-04', tier: 'rtg', pasApp: 'rtg' })).body.token;
}
const dag = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  host = await inlog('SAKURA', 'manager');            // appartementen: verhuurt op Thuis
  hostMedewerker = await inlog('SAKURA', 'staff');
  buurzaak = await inlog('KIKUNOI', 'manager');       // een restaurant: hoort er niets van te zien
  gast = await lid('Thuis Gast');
  gast2 = await lid('Andere Gast');
  assert.ok(host && buurzaak && gast, 'host, buurzaak en gast staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een huis op Thuis: het staat in het eigen kantoor en niet bij de buren', async () => {
  const mk = await zk('huis', { huis: { titel: 'Casa Bahia, zeezicht', plaats: 'Ibiza', prijs: 240,
    gasten: 4, type: 'appartement', beschrijving: 'Rustig appartement met terras op het zuiden.' } }, host);
  assert.equal(mk.status, 200);
  huisId = mk.body.huis.id;

  const mijn = await zk('huizen', {}, host);
  assert.equal(mijn.status, 200);
  assert.ok(mijn.body.huizen.some(h => h.id === huisId), 'het huis staat in het eigen kantoor');
  // lezen mag het hele team
  assert.ok((await zk('huizen', {}, hostMedewerker)).body.huizen.some(h => h.id === huisId), 'de medewerker ziet het aanbod ook');
  // de buurzaak host onder een andere vlag en ziet dus niets
  assert.ok(!(await zk('huizen', {}, buurzaak)).body.huizen.some(h => h.id === huisId), 'de buurzaak ziet het huis niet');
  /* 403 en niet 404: het huis staat openbaar op Thuis, dus doen alsof het niet
     bestaat zou niets verbergen. Wat hier telt is dat de buurzaak er niet aan
     mag komen, en dat zegt 403 duidelijker. */
  assert.equal((await zk('huis', { id: huisId, huis: { titel: 'Gekaapt' } }, buurzaak)).status, 403, 'en beheert het al helemaal niet');
});

test('2. blokkades: een periode die achteruit loopt is geen periode', async () => {
  assert.equal((await zk('blokkeer', { id: huisId, van: dag(20), tot: dag(10) }, host)).status, 400, 'tot voor van');
  assert.equal((await zk('blokkeer', { id: huisId, van: 'volgende week', tot: dag(30) }, host)).status, 400, 'geen datum');
  assert.equal((await zk('blokkeer', { id: huisId, van: dag(10), tot: dag(20) }, hostMedewerker)).status, 403,
    'blokkeren is van de manager, niet van het hele team');
  assert.equal((await zk('blokkeer', { id: 'bestaatniet', van: dag(10), tot: dag(20) }, host)).status, 404);

  const bl = await zk('blokkeer', { id: huisId, van: dag(10), tot: dag(20) }, host);
  assert.equal(bl.status, 200);
  assert.equal(bl.body.blokkades.length, 1);

  /* Een nieuwe blokkade die over de oude heen valt vervangt hem, en stapelt er
     niet bovenop. Twee blokkades over dezelfde dagen zeggen niets extra en
     maken de kalender alleen onleesbaar. */
  const overlap = await zk('blokkeer', { id: huisId, van: dag(15), tot: dag(25) }, host);
  assert.equal(overlap.body.blokkades.length, 1, 'de overlappende blokkade verving de oude');
  assert.equal(overlap.body.blokkades[0].tot, dag(25));

  const weg = await zk('blokkeer', { id: huisId, van: dag(15), tot: dag(25), weg: true }, host);
  assert.equal(weg.body.blokkades.length, 0, 'en hij gaat er weer af');
});

test('3. het berichtenspoor is van de gast en de host, en van niemand anders', async () => {
  const boek = await api('/api/thuis/boek', { id: huisId, van: dag(40), tot: dag(43), gasten: 2 }, gast);
  assert.equal(boek.status, 200, 'de gast boekt');
  ref = boek.body.boeking.ref;

  assert.equal((await zk('bericht', { ref, tekst: '   ' }, host)).status, 400, 'een leeg bericht is geen bericht');
  const van = await zk('bericht', { ref, tekst: 'Welkom. De sleutelkluis hangt links van de deur.' }, host);
  assert.equal(van.status, 200);
  assert.equal(van.body.berichten.length, 1);

  // de gast leest het en antwoordt via zijn eigen ingang
  const gastKant = await api('/api/thuis/berichten', { ref }, gast);
  assert.equal(gastKant.status, 200);
  assert.equal(gastKant.body.berichten[0].tekst, 'Welkom. De sleutelkluis hangt links van de deur.');
  await api('/api/thuis/bericht', { ref, tekst: 'Dank, we komen rond zeven uur aan.' }, gast);

  const terug = await zk('berichten', { ref }, host);
  assert.equal(terug.body.berichten.length, 2, 'beide kanten staan in hetzelfde spoor');

  // een derde partij: geldige inlog, maar niet van deze boeking
  assert.equal((await zk('berichten', { ref }, buurzaak)).status, 403, 'een andere zaak leest niet mee');
  assert.equal((await zk('bericht', { ref, tekst: 'hoi' }, buurzaak)).status, 403, 'en schrijft er niet in');
  assert.equal((await api('/api/thuis/berichten', { ref }, gast2)).status, 403, 'een ander lid ook niet');
  assert.equal((await zk('berichten', { ref: 'BESTAATNIET' }, host)).status, 404);
});

test('4. een review kan pas na het uitchecken, en dan een keer', async () => {
  assert.equal((await zk('review', { ref, sterren: 5 }, host)).status, 404, 'voor het uitchecken bestaat er niets om over te oordelen');

  await zk('beslis', { ref, akkoord: true }, host);
  await api('/api/thuis/checkin', { ref }, gast);
  await api('/api/thuis/checkuit', { ref }, gast);

  assert.equal((await zk('review', { ref, sterren: 9 }, host)).status, 400, 'negen sterren bestaan niet');
  assert.equal((await zk('review', { ref, sterren: 5, tekst: 'Nette gasten, alles netjes achtergelaten.' }, hostMedewerker)).status, 403,
    'een review namens de zaak schrijft de manager');

  const rv = await zk('review', { ref, sterren: 5, tekst: 'Nette gasten, alles netjes achtergelaten.' }, host);
  assert.equal(rv.status, 200);
  assert.equal(rv.body.richting, 'host', 'de zaak beoordeelt als host');
  assert.equal((await zk('review', { ref, sterren: 4 }, host)).status, 409, 'twee keer oordelen over dezelfde boeking kan niet');

  // de gast mag wel nog: dat is de andere richting
  const gastRv = await api('/api/thuis/review', { ref, sterren: 4, tekst: 'Fijn appartement, rustig gelegen.' }, gast);
  assert.equal(gastRv.status, 200);
  assert.equal(gastRv.body.richting, 'gast');
});
