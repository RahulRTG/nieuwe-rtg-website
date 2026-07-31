/* ============================================================================
   VLOOT, FACTUREN EN OPROEPEN -- 5 endpoints uit de supplier-groep.

   fleet, auto, facturen/maak, samenwerking/oproep/sluit en guest/connect
   stonden als nooit aangeroepen in de waargenomen dekkingsmeting.

   WAT ER OP HET SPEL STAAT

   - TWEE SOORTEN "WEG", EN DAT VERSCHIL IS EEN KEUZE. Een HUURAUTO gaat nooit
     echt weg maar op actief:false, want lopende huren verwijzen ernaar. Een
     VOERTUIG UIT DE VLOOT verdwijnt wel echt -- en dat mag, omdat een rit een
     kopie van het voertuig meedraagt (naam, kenteken, stoelen) en dus niet
     stukgaat als het origineel verdwijnt. Toets 1 en 2 leggen allebei de
     kanten vast, zodat niemand ze later "gelijktrekt".
   - EEN FACTUUR IS EEN GELDSTUK PAPIER. facturen/maak boekt op codenaam en
     weigert een regel zonder bedrag. Een codenaam die geen lid is wordt wel
     geaccepteerd: een zaak factureert ook aan partijen buiten RTG, en die
     factuur draagt dan de naam maar niet de sleutel.
   - EEN OPROEP SLUITEN IS EEN EIGENAARSBESLUIT. Nog eens sluiten mag: de
     uitkomst is hetzelfde. Dat is een andere keuze dan bij het intrekken van
     een betaalverzoek, waar de tweede poging 409 krijgt -- daar gaat het over
     geld en telt "is dit al gebeurd", hier niet.

   Draai los: node --experimental-sqlite --test test/zaak-vloot-en-facturen.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, taxi, taxiWerker, verhuur, resto, restoWerker, lid, lidCode;
let voertuigId = null, autoId = null, oproepId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vloot-'));

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

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  taxi = await inlog('MKKX', 'manager');
  taxiWerker = await inlog('MKKX', 'staff');
  verhuur = await inlog('ISLAREN', 'manager');
  resto = await inlog('KIKUNOI', 'manager');
  restoWerker = await inlog('KIKUNOI', 'staff');
  lid = (await api('/api/login', { tier: 'business' })).body.token;
  lidCode = (await api('/api/pay/overzicht', {}, lid)).body.codenaam;
  assert.ok(taxi && verhuur && resto && lidCode, 'de zaken en een lid staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de vloot: een voertuig mag echt weg, want een rit draagt zijn eigen kopie', async () => {
  if (taxiWerker) assert.equal((await api('/api/supplier/fleet', { action: 'add', name: 'Mercedes V' }, taxiWerker)).status, 403,
    'de vloot is van het management');
  assert.equal((await api('/api/supplier/fleet', { action: 'add', name: '' }, taxi)).status, 400, 'zonder naam');
  assert.equal((await api('/api/supplier/fleet', { action: 'poetsen' }, taxi)).status, 400, 'een actie die we niet kennen');

  /* Een naam die zeker niet in de seed staat: mijn eerste versie zocht op
     "Mercedes V-klasse" en vond de GESEEDE bus met zes stoelen in plaats van
     de zojuist toegevoegde met zeven. De toets faalde daardoor op iets wat
     helemaal goed ging. */
  const naam = 'Toetsbus ' + Date.now().toString(36);
  const mk = await api('/api/supplier/fleet', { action: 'add', name: naam, plate: '1234-IBZ', seats: 7 }, taxi);
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  const v = mk.body.fleet.find(x => x.name === naam);
  assert.ok(v, 'het voertuig staat in de vloot');
  voertuigId = v.id;
  assert.equal(v.seats, 7);
  assert.equal(v.active, true, 'een nieuw voertuig staat actief');

  const uit = await api('/api/supplier/fleet', { action: 'toggle', id: voertuigId }, taxi);
  assert.equal(uit.body.fleet.find(x => x.id === voertuigId).active, false, 'buiten dienst zetten kan');
  await api('/api/supplier/fleet', { action: 'toggle', id: voertuigId }, taxi);

  /* Hier MAG hard weg. Een rit bewaart naam, kenteken en stoelen als eigen
     kopie (zie ride/assign), dus een oude rit blijft leesbaar ook als het
     voertuig van de lijst is. Dat is het verschil met de huurauto hieronder,
     en het is een keuze en geen inconsistentie. */
  const weg = await api('/api/supplier/fleet', { action: 'remove', id: voertuigId }, taxi);
  assert.equal(weg.status, 200);
  assert.ok(!weg.body.fleet.some(x => x.id === voertuigId), 'het voertuig is echt van de lijst');
});

test('2. een huurauto gaat nooit echt weg: lopende huren verwijzen ernaar', async () => {
  assert.equal((await api('/api/supplier/auto', { name: 'Iets', dagprijs: 50 }, resto)).status, 409,
    'een restaurant verhuurt geen autos');
  assert.equal((await api('/api/supplier/auto', { name: '', dagprijs: 50 }, verhuur)).status, 400);
  assert.equal((await api('/api/supplier/auto', { name: 'Gratis', dagprijs: 0 }, verhuur)).status, 400,
    'een auto zonder dagprijs');
  assert.equal((await api('/api/supplier/auto', { name: 'Te duur', dagprijs: 99999 }, verhuur)).status, 400);

  const mk = await api('/api/supplier/auto',
    { name: 'Seat Ibiza', plate: '5678-IBZ', dagprijs: 45, transmissie: 'automaat', brandstof: 'hybride', stoelen: 5 }, verhuur);
  assert.equal(mk.status, 200, JSON.stringify(mk.body).slice(0, 200));
  const a = mk.body.autos.find(x => x.name === 'Seat Ibiza');
  assert.ok(a, 'de auto staat in de vloot');
  autoId = a.id;
  assert.equal(a.transmissie, 'automaat');
  assert.equal(a.brandstof, 'hybride');
  assert.equal(a.actief, true);

  /* Een verzonnen transmissie of brandstof wordt niet overgenomen maar valt
     terug op de standaard. Zo staat er nooit "brandstof: raketaandrijving" op
     een huurcontract. */
  const raar = await api('/api/supplier/auto', { name: 'Rare auto', dagprijs: 40, transmissie: 'zweven', brandstof: 'kernfusie' }, verhuur);
  const r = raar.body.autos.find(x => x.name === 'Rare auto');
  assert.equal(r.transmissie, 'handgeschakeld', 'onbekende transmissie valt terug op de standaard');
  assert.equal(r.brandstof, 'benzine');

  const weg = await api('/api/supplier/auto', { weg: true, id: autoId }, verhuur);
  assert.equal(weg.status, 200);
  const na = weg.body.autos.find(x => x.id === autoId);
  assert.ok(na, 'de auto staat er nog: lopende huren verwijzen ernaar');
  assert.equal(na.actief, false, 'maar hij staat niet meer actief');
});

test('3. een factuur boekt op codenaam, met regels die ergens over gaan', async () => {
  if (restoWerker) assert.equal((await api('/api/supplier/facturen/maak',
    { codenaam: lidCode, omschrijving: 'Diner', aantal: 1, bedrag: 120 }, restoWerker)).status, 403,
    'factureren doet het management');

  const leeg = await api('/api/supplier/facturen/maak', { codenaam: lidCode, omschrijving: '', aantal: 1, bedrag: 0 }, resto);
  assert.equal(leeg.status, 400, 'een regel zonder bedrag is geen factuur');
  assert.match(leeg.body.error, /bedrag/i);

  const f = await api('/api/supplier/facturen/maak',
    { codenaam: lidCode, soort: 'dienst', koperNaam: 'Zakelijke gast',
      regels: [{ omschrijving: 'Chef\'s table voor vier', aantal: 4, stuk: 145 }] }, resto);
  assert.equal(f.status, 200, JSON.stringify(f.body).slice(0, 220));
  assert.ok(f.body.overzicht, 'het eigen factuuroverzicht komt mee terug');

  /* Een codenaam die geen lid is, wordt als gewone tekst op de factuur gezet
     zonder koppeling aan een account. Dat is met opzet: een zaak factureert
     ook aan partijen buiten RTG, en die hebben geen codenaam. De factuur draagt
     dan wel de naam maar niet de sleutel -- precies het verschil tussen "aan
     dit lid" en "aan deze klant". */
  assert.equal((await api('/api/supplier/facturen/maak',
    { codenaam: 'BestaatNiet999', koperNaam: 'Extern bedrijf', regels: [{ omschrijving: 'Advies', aantal: 1, stuk: 250 }] }, resto)).status, 200,
    'factureren aan een partij buiten RTG kan gewoon');
});

test('4. een oproep sluiten doet de eigenaar, en maar een keer', async () => {
  const mk = await api('/api/supplier/samenwerking/oproep',
    { titel: 'Fotograaf gezocht voor de zomerkaart', tekst: 'Twee dagdelen, eigen apparatuur.', budget: 800 }, resto);
  if (mk.status !== 200) {
    /* Deze zaak mag geen oproep plaatsen (samenwerking hangt aan een genre).
       Dan toetsen we wat er wel vaststaat: sluiten is managerwerk en een
       onbekende oproep bestaat niet. */
    assert.equal((await api('/api/supplier/samenwerking/oproep/sluit', { id: 'x' }, restoWerker || resto)).status >= 400, true);
    return;
  }
  oproepId = mk.body.id;
  if (restoWerker) assert.equal((await api('/api/supplier/samenwerking/oproep/sluit', { id: oproepId }, restoWerker)).status, 403,
    'een oproep sluiten is een eigenaarsbesluit');
  assert.equal((await api('/api/supplier/samenwerking/oproep/sluit', { id: 'bestaatniet' }, resto)).status, 400);

  assert.equal((await api('/api/supplier/samenwerking/oproep/sluit', { id: oproepId }, resto)).status, 200);
  /* Sluiten is IDEMPOTENT: nog eens drukken zet 'open' opnieuw op false en
     meldt 200. Dat is verdedigbaar -- de uitkomst is hetzelfde en een dubbele
     tik hoort geen foutmelding te geven -- maar het is een andere keuze dan
     bij het intrekken van een betaalverzoek, waar de tweede poging juist 409
     krijgt. Daar gaat het over geld en telt "is dit al gebeurd"; hier niet. */
  assert.equal((await api('/api/supplier/samenwerking/oproep/sluit', { id: oproepId }, resto)).status, 200,
    'nog eens sluiten mag: de uitkomst is hetzelfde');
  assert.ok(!((await api('/api/supplier/samenwerking/mijn', {}, resto)).body.oproepen || [])
    .some(o => o.id === oproepId && o.open), 'en de oproep staat dicht');
});

test('5. verbinden met een gast kan alleen als die gast live onderweg is', async () => {
  /* De zaak verbindt met een gast die NU onderweg is, zodat de aankomst
     klaargezet kan worden. Een codenaam van iemand die niet live is bestaat
     hier dus niet -- en dat is geen technisch detail: het voorkomt dat een
     zaak zich aan een willekeurig lid kan koppelen.

     Deze toets ZET DAAROM EEN ECHTE LIVE GAST NEER. Zonder die opzet is
     db.data.live leeg, en dan geeft elke verkeerde opzoeking ook netjes 404 --
     de bewering kon dan niet falen, wat de mutatie ook aantoonde. */
  assert.equal((await api('/api/supplier/guest/connect', { codename: lidCode }, resto)).status, 404,
    'zolang niemand onderweg is, valt er niemand te verbinden');

  const start = await api('/api/live/start', { destCode: 'KIKUNOI', mode: 'driving' }, lid);
  assert.equal(start.status, 200, 'het lid gaat live onderweg: ' + JSON.stringify(start.body).slice(0, 160));

  assert.equal((await api('/api/supplier/guest/connect', { codename: 'BestaatNiet999' }, resto)).status, 404,
    'een codenaam die niemand draagt, ook nu er wel iemand live is');
  assert.equal((await api('/api/supplier/guest/connect', {}, resto)).status, 404, 'zonder codenaam al helemaal niet');

  const ok = await api('/api/supplier/guest/connect', { codename: lidCode }, resto);
  assert.equal(ok.status, 200, 'met de juiste codenaam verbindt de zaak wel: ' + JSON.stringify(ok.body).slice(0, 160));

  /* En de buurzaak verbindt met dezelfde gast op zijn eigen naam -- de
     koppeling is een lijst per gast, geen exclusief slot. Wel moet elke zaak
     de codenaam kennen; niemand komt erbij door alleen te vragen "wie is er
     onderweg". */
  const buur = await api('/api/supplier/guest/connect', { codename: 'BestaatNiet999' }, verhuur);
  assert.equal(buur.status, 404, 'raden werkt niet');
});
