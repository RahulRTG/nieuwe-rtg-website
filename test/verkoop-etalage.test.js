/* ============================================================================
   DE ETALAGE VAN EEN ZAAK -- 4 endpoints uit de supplier-groep.

   verkoop/aan, verkoop/auto/weg, retail/collectie en mode/bezorg/overzicht
   stonden als nooit aangeroepen in de waargenomen dekkingsmeting. Ze horen
   bij elkaar als "wat de zaak te koop aanbiedt en hoe het bij de klant komt".

   WAT ER OP HET SPEL STAAT

   - EEN AUTO GAAT NOOIT HARD WEG. verwijderAuto() zet de status op 'verkocht'
     en gooit niets uit de lijst, want lopende deals verwijzen ernaar. Zou hij
     echt verdwijnen, dan wijst een proefrit of een aanvaarde koop naar een
     auto die niet meer bestaat -- en dan is er een klant met een afspraak
     over niets. Dat staat in toets 2.
   - EEN AFDELING AANZETTEN IS EEN EIGENAARSBESLUIT, EN ALLEEN WAAR HET PAST.
     Autoverkoop hoort bij een verhuur- of autobedrijf; een restaurant dat de
     showroom aanzet is geen showroom maar een fout.
   - DE ETALAGE VAN DE BUREN IS EEN ANDERE ETALAGE.

   Draai los: node --test test/verkoop-etalage.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, dealer, dealerWerker, mode, modeWerker, resto;
let autoId = null, collectieId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-etalage-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function inlog(code, rol) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = (roster.body.staff || []).find(x => x.role === rol);
  return wie ? (await api('/api/supplier/login', { code, staffId: wie.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token : null;
}
const showroom = t => api('/api/supplier/verkoop/overzicht', {}, t).then(r => r.body.showroom || r.body.autos || []);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  dealer = await inlog('ISLAREN', 'manager');       // Isla Rent Ibiza: verhuur, mag verkopen
  dealerWerker = await inlog('ISLAREN', 'staff');
  mode = await inlog('MAISON', 'manager');          // Maison Solene: retail
  modeWerker = await inlog('MAISON', 'staff');
  resto = await inlog('KIKUNOI', 'manager');        // Sal de Mar: geen van beide
  assert.ok(dealer && mode && resto, 'de dealer, het modehuis en het restaurant staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de showroom aanzetten is voor de eigenaar, en alleen waar het past', async () => {
  assert.equal((await api('/api/supplier/verkoop/aan', { aan: true }, resto)).status, 409,
    'een restaurant is geen autobedrijf');
  if (dealerWerker) assert.equal((await api('/api/supplier/verkoop/aan', { aan: true }, dealerWerker)).status, 403,
    'en een afdeling openen is een eigenaarsbesluit');

  const aan = await api('/api/supplier/verkoop/aan', { aan: true }, dealer);
  assert.equal(aan.status, 200, JSON.stringify(aan.body));
  assert.equal(aan.body.aan, true);
  assert.equal((await api('/api/supplier/verkoop/aan', { aan: false }, dealer)).body.aan, false, 'en weer dicht');
  await api('/api/supplier/verkoop/aan', { aan: true }, dealer);
});

test('2. een auto gaat nooit hard weg: hij wordt verkocht', async () => {
  const mk = await api('/api/supplier/verkoop/auto',
    { merk: 'Land Rover', model: 'Defender 110', jaar: 2023, km: 18000, prijs: 89500, brandstof: 'Diesel' }, dealer);
  assert.equal(mk.status, 200, JSON.stringify(mk.body).slice(0, 200));
  autoId = mk.body.auto.id;
  assert.equal(mk.body.auto.merk, 'Land Rover');

  assert.equal((await api('/api/supplier/verkoop/auto', { model: 'Zonder merk' }, dealer)).status, 400,
    'zonder merk staat er niets in de showroom');
  if (dealerWerker) assert.equal((await api('/api/supplier/verkoop/auto/weg', { id: autoId }, dealerWerker)).status, 403,
    'een auto uit de etalage halen doet de eigenaar');

  const weg = await api('/api/supplier/verkoop/auto/weg', { id: autoId }, dealer);
  assert.equal(weg.status, 200);

  /* DE BEWERING VAN DIT BESTAND. Lopende deals -- een geplande proefrit, een
     aanvaarde koop -- verwijzen naar deze auto. Zou hij echt uit de lijst
     verdwijnen, dan heeft een klant een afspraak over iets wat niet meer
     bestaat, en ziet niemand in het systeem dat er iets mis is. */
  const na = (await showroom(dealer)).find(a => a.id === autoId);
  assert.ok(na, 'de auto staat er nog, want deals verwijzen ernaar');
  assert.equal(na.status, 'verkocht', 'maar wel als verkocht');

  assert.equal((await api('/api/supplier/verkoop/auto/weg', { id: 'bestaatniet' }, dealer)).status, 200,
    'een id dat niet bestaat is geen fout');
  assert.equal((await api('/api/supplier/verkoop/auto/weg', { id: autoId }, resto)).status, 409,
    'en een restaurant komt niet eens bij de showroom');
});

test('3. de collectie is van het modehuis, en van de eigenaar daarbinnen', async () => {
  assert.equal((await api('/api/supplier/retail/collectie', { naam: 'Zomer 2027' }, dealer)).status, 409,
    'een autobedrijf voert geen modecollectie');
  if (modeWerker) assert.equal((await api('/api/supplier/retail/collectie', { naam: 'Zomer 2027' }, modeWerker)).status, 403,
    'en binnen de winkel bepaalt de eigenaar de collectie');

  const mk = await api('/api/supplier/retail/collectie', { naam: 'Zomer 2027', seizoen: 'zomer' }, mode);
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  const lijst = (await api('/api/supplier/retail', {}, mode)).body.retail.collecties || [];
  const nieuw = lijst.find(c => c.naam === 'Zomer 2027');
  assert.ok(nieuw, 'de collectie staat in de winkel: ' + JSON.stringify(lijst).slice(0, 160));
  collectieId = nieuw.id;

  const weg = await api('/api/supplier/retail/collectie', { action: 'remove', id: collectieId }, mode);
  assert.equal(weg.status, 200);
  const na = (await api('/api/supplier/retail', {}, mode)).body.retail.collecties || [];
  assert.ok(!na.some(c => c.id === collectieId), 'en hij gaat er weer af');
});

test('4. het bezorgbord toont de eigen winkel', async () => {
  const b = await api('/api/supplier/mode/bezorg/overzicht', {}, mode);
  assert.equal(b.status, 200);
  assert.ok(b.body && typeof b.body === 'object', 'er komt een bord terug');
  assert.equal((await api('/api/supplier/mode/bezorg/overzicht', {}, modeWerker || mode)).status, 200,
    'het bord lezen mag het hele team: wie bezorgt, kijkt erop');

  /* De route van de koerier leest een positie. Sinds coord()/coordPaar staat
     daar geen kale +req.body.lat meer: +null is 0, en dan begint de kortste
     route vanaf Null Island in plaats van vanaf de winkel. Deze regel legt
     vast dat een ontbrekende positie geen positie is. */
  const zonder = await api('/api/supplier/mode/bezorg/route', {}, mode);
  assert.equal(zonder.status, 200, 'zonder positie krijg je gewoon de open bezorgingen');
  assert.ok(Array.isArray(zonder.body.route), 'als lijst');
  const met = await api('/api/supplier/mode/bezorg/route', { lat: 38.9067, lng: 1.4206 }, mode);
  assert.equal(met.status, 200);
  const kapot = await api('/api/supplier/mode/bezorg/route', { lat: null, lng: null }, mode);
  assert.equal(kapot.status, 200, 'en een halve positie laat het bord niet vallen');
});
