/* ============================================================================
   RTG FESTIVAL OVER ECHTE HTTP: de eigendomsgrens en de klok.

   WAAROM DIT NAAST test/festival.test.js BESTAAT

   Dat bestand is PUUR: het toetst de kern zonder server, en daar zitten de
   regels over rechten, tijd en telling in. Wat het per definitie NIET kan zien
   is alles wat op de ROUTE staat -- en dat is precies waar dit huis eerder op
   is gevallen (zie het slot van test/persoonseis.test.js: een mutatie die daar
   werd afgeslagen omdat de controle op de route zat).

   Twee dingen kunnen alleen hier zakken:

   1. DE EIGENDOMSGRENS. Een festival-id uit het lichaam is geen bewijs. De
      kern kent geen zaken en kan dit dus niet weten; als routes/festival.js
      zijn mijn()-controle verliest, blijft de pure toets vrolijk groen terwijl
      elke zaak bij elk festival kan.

   2. DE KLOK. De kern neemt een datum en tijd aan, want een offline bundel van
      gisteren moet verwerkt kunnen worden. Een LIVE scan mag ze nooit uit het
      lichaam halen: wie het tijdstip mag meesturen, laat een dagkaart van
      gisteren binnen en stapt door elk venster. Alleen hier is te zien of de
      route dat afdekt.

   WAT ER WORDT VASTGELEGD
    1. Zonder de capability `tickets` komt er geen festival.
    2. Personeel richt niet in; de manager wel.
    3. Het festival van een andere zaak bestaat niet voor u.
    4. Een editie van een ander festival evenmin (de tweede stap).
    5. De serverklok stempelt de scan; het lichaam mag hem niet zetten.
    6. De offline bundel mag zijn tijden wel meesturen, en vindt de dubbele.
    7. Deurpersoneel scant wel, maar geeft geen passen uit.
   8. Welke dag er LOOPT komt van de server, en "geen" is een geldig antwoord.
   9. Wie een stuk indient komt uit de SESSIE, niet uit het lichaam -- anders is
      de functiescheiding een formaliteit.
  10. De peildatum van de gereedheid komt van de server.
  11. Indienen mag het personeel; zaaien en aftekenen alleen de manager.

   DE MUTATIES staan aan het slot.
   Draai: node --experimental-sqlite --test test/festival-routes.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-fest-'));
const VANDAAG = new Date().toISOString().slice(0, 10);
const MORGEN = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

let manager, deur, andere, zonderTickets;
let fid, eid, vandaagId, morgenId, terreinId, ingangId, pasCode;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();
const post = async (pad, body, token) => json(await api(pad, body, token));

async function inloggen(code, rol) {
  const roster = await post('/api/supplier/roster', { code });
  const wie = rol === 'manager'
    ? roster.staff.find(x => x.role === 'manager')
    : roster.staff.find(x => x.role !== 'manager');
  const r = await post('/api/supplier/login', { code, staffId: wie.id, pin: rol === 'manager' ? '1234' : '5678' });
  return r.token;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  manager = await inloggen('ESVEDRA', 'manager');
  deur = await inloggen('ESVEDRA', 'staff');
  andere = await inloggen('MACE', 'manager');          // een andere zaak MET tickets
  zonderTickets = await inloggen('SAKURA', 'manager');  // appartementen: geen tickets

  fid = (await post('/api/festival/nieuw', { naam: 'Testival' }, manager)).festival.id;
  eid = (await post('/api/festival/editie', { festival: fid, jaar: 2027 }, manager)).editie.id;
  vandaagId = (await post('/api/festival/dag', { festival: fid, editie: eid, datum: VANDAAG, open: '00:00', sluit: '23:59' }, manager)).dag.id;
  morgenId = (await post('/api/festival/dag', { festival: fid, editie: eid, datum: MORGEN, open: '00:00', sluit: '23:59' }, manager)).dag.id;
  terreinId = (await post('/api/festival/plek', { festival: fid, editie: eid, naam: 'Terrein', soort: 'terrein', capaciteit: 5000 }, manager)).plek.id;
  ingangId = (await post('/api/festival/plek', { festival: fid, editie: eid, naam: 'Noord', soort: 'ingang', ouder: terreinId }, manager)).plek.id;
});

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. zonder de capability tickets komt er geen festival', async () => {
  const r = await api('/api/festival/nieuw', { naam: 'Mag niet' }, zonderTickets);
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /kaarten en entree/);
});

test('2. personeel richt niet in; de manager wel', async () => {
  assert.equal((await api('/api/festival/nieuw', { naam: 'Van de deur' }, deur)).status, 403);
  assert.equal((await api('/api/festival/plek', { festival: fid, editie: eid, naam: 'Bar', soort: 'bar', ouder: terreinId }, deur)).status, 403);
  const boom = await post('/api/festival/terrein', { festival: fid, editie: eid }, deur);
  assert.equal(boom.ok, true, 'lezen mag de deur wel: hij moet weten waar hij staat');
});

test('3. het festival van een andere zaak bestaat niet voor u', async () => {
  /* MACE mag zelf festivals draaien (tickets), maar niet DEZE. En het antwoord
     is 404 en geen 403: het verschil zou verklappen welke id's bestaan. */
  const r = await api('/api/festival/terrein', { festival: fid, editie: eid }, andere);
  assert.equal(r.status, 404);
  const mijn = await post('/api/festival/mijn', {}, andere);
  assert.deepEqual(mijn.festivals, [], 'en in zijn eigen lijst staat het niet');
});

test('4. een editie van een ander festival wordt ook geweigerd', async () => {
  const eigen = await post('/api/festival/nieuw', { naam: 'Van MACE' }, andere);
  const eigenEditie = await post('/api/festival/editie', { festival: eigen.festival.id, jaar: 2027 }, andere);
  /* Het festival is van MIJ, de editie niet. Die grendel zit in de KERN en niet
     op de route: elke kernfunctie zoekt een editie binnen het festival dat er
     als eerste argument bij hoort. Deze toets legt het GEDRAG vast, niet de
     plek -- zodat hij blijft staan als die grendel ooit verhuist. */
  const r = await api('/api/festival/dag', { festival: fid, editie: eigenEditie.editie.id, datum: '2027-09-09', open: '10:00', sluit: '22:00' }, manager);
  assert.equal(r.status, 404);
});

test('5. de serverklok stempelt de scan; het lichaam mag hem niet zetten', async () => {
  /* Een pas die ALLEEN morgen geldt. Wie de klok mag meesturen, claimt morgen
     en loopt vandaag naar binnen. */
  const pas = await post('/api/festival/pas', { festival: fid, editie: eid, drager: 'Kobalt',
    rechten: [{ soort: 'festival.entree', dagen: [morgenId] }] }, manager);
  pasCode = pas.pas.code;

  const r = await api('/api/festival/scan', { festival: fid, editie: eid, code: pasCode,
    plek: ingangId, poort: 'Noord', datum: MORGEN, tijd: '12:00' }, deur);
  const b = await r.json();
  assert.equal(b.stand, 'rood');
  assert.match(b.zin, new RegExp(VANDAAG), 'de weigering noemt VANDAAG, dus de server stempelde zelf');

  // en met een pas die vandaag geldt, gaat dezelfde poort gewoon open
  const goed = await post('/api/festival/pas', { festival: fid, editie: eid, drager: 'Amber',
    rechten: [{ soort: 'festival.entree', dagen: [vandaagId] }] }, manager);
  const uit = await post('/api/festival/scan', { festival: fid, editie: eid, code: goed.pas.code,
    plek: ingangId, poort: 'Noord' }, deur);
  assert.equal(uit.stand, 'groen');
  assert.equal(uit.scan.dag, vandaagId);
  assert.ok(uit.scan.door, 'de scan draagt de naam van wie hem deed');
});

test('6. de offline bundel mag zijn tijden wel meesturen, en vindt de dubbele', async () => {
  const pas = await post('/api/festival/pas', { festival: fid, editie: eid, drager: 'Ivo',
    rechten: [{ soort: 'festival.entree', dagen: [vandaagId] }] }, manager);
  const r = await post('/api/festival/scan/bundel', { festival: fid, editie: eid, scans: [
    { code: pas.pas.code, plek: ingangId, poort: 'Zuid', datum: VANDAAG, tijd: '10:20' },
    { code: pas.pas.code, plek: ingangId, poort: 'Noord', datum: VANDAAG, tijd: '09:50' }
  ] }, deur);
  assert.equal(r.verwerkt, 1, 'de vroegste wint');
  assert.equal(r.dubbel.length, 1);
  assert.equal(r.dubbel[0].poort, 'Zuid');
});

test('7. deurpersoneel scant wel, maar geeft geen passen uit', async () => {
  const r = await api('/api/festival/pas', { festival: fid, editie: eid, drager: 'Van de deur',
    rechten: [{ soort: 'festival.entree' }] }, deur);
  assert.equal(r.status, 403);

  const stand = await post('/api/festival/stand', { festival: fid, editie: eid, dag: vandaagId }, deur);
  assert.equal(stand.ok, true, 'de cockpit lezen mag hij wel');
  assert.ok(typeof stand.zin === 'string' && stand.zin.length > 0);
});

test('8. welke dag er loopt komt van de server, en geen is een geldig antwoord', async () => {
  /* Een festivaldag loopt over middernacht heen, dus "vandaag" is niet de
     kalenderdatum. Zou een scherm dat zelf uitrekenen, dan staat er een tweede
     waarheid naast kern/festival/model.js -- en die twee lopen uit elkaar op
     precies het uur waarop het ertoe doet. */
  const nu = await post('/api/festival/dag/nu', { festival: fid, editie: eid }, deur);
  assert.equal(nu.ok, true);
  assert.ok(nu.dag, 'er loopt een dag: die van vandaag, 00:00-23:59');
  assert.equal(nu.dag.id, vandaagId);

  /* En een editie waarvan de dagen voorbij zijn, geeft niets terug in plaats
     van de dichtstbijzijnde te raden. Een cockpit die buiten de openingstijden
     een dag verzint, telt mensen die er niet zijn. */
  const oud = await post('/api/festival/nieuw', { naam: 'Vorig jaar' }, manager);
  const oudE = await post('/api/festival/editie', { festival: oud.festival.id, jaar: 2026 }, manager);
  await post('/api/festival/dag', { festival: oud.festival.id, editie: oudE.editie.id,
    datum: '2026-01-05', open: '12:00', sluit: '23:00' }, manager);
  const leeg = await post('/api/festival/dag/nu', { festival: oud.festival.id, editie: oudE.editie.id }, manager);
  assert.equal(leeg.ok, true);
  assert.equal(leeg.dag, null);
});

test('9. wie indient komt uit de sessie, niet uit het lichaam', async () => {
  await post('/api/festival/controls/seed', { festival: fid, editie: eid }, manager);
  const stand = await post('/api/festival/gereed', { festival: fid, editie: eid }, deur);
  const eerste = stand.controls[0];

  /* De MANAGER dient in, maar zet een VREEMDE naam in het lichaam. Wordt die
     overgenomen, dan staat het stuk op naam van een verzinsel en mag de manager
     het straks gewoon zelf aftekenen -- en dan is de functiescheiding uit
     kern/festival/gereed.js een formulier dat zichzelf invult.

     De naam hieronder is met opzet een die in dit huis niet bestaat. Hij was
     eerst 'Marta Salas', en dat is toevallig de manager van ESVEDRA zelf: de
     mutatie sloeg daardoor af en de toets bewees niets. Zie mutatie 7. */
  const ingediend = await post('/api/festival/bewijs',
    { festival: fid, editie: eid, control: eerste.id, soort: 'besluit', nummer: 'A-1', door: 'Iemand Die Niet Bestaat' }, manager);
  assert.equal(ingediend.ok, true);

  const zelf = await api('/api/festival/bewijs/teken', { festival: fid, editie: eid, control: eerste.id }, manager);
  assert.equal(zelf.status, 409, 'de server kent de indiener als de manager zelf, dus dit mag niet');
  assert.match((await zelf.json()).error, /tekent het niet zelf af/);
});

test('10. de peildatum van de gereedheid komt van de server', async () => {
  const stand = await post('/api/festival/gereed', { festival: fid, editie: eid }, deur);
  const c = stand.controls.find(x => x.stand === 'ontbreekt');

  // een stuk dat LANG geleden verliep: het personeelslid dient in, de manager tekent af
  await post('/api/festival/bewijs', { festival: fid, editie: eid, control: c.id,
    soort: 'keuring', nummer: 'K-9', geldigTot: '2020-06-01' }, deur);
  await post('/api/festival/bewijs/teken', { festival: fid, editie: eid, control: c.id }, manager);

  /* Een peildatum meesturen waarop het stuk nog geldig WAS. Wordt hij
     overgenomen, dan keurt de organisatie zichzelf goed op een datum die haar
     uitkomt. */
  const na = await post('/api/festival/gereed', { festival: fid, editie: eid, op: '2020-01-01' }, deur);
  assert.notEqual(na.op, '2020-01-01');
  assert.equal(na.controls.find(x => x.id === c.id).stand, 'verlopen');
});

test('11. indienen mag het personeel; zaaien en aftekenen alleen de manager', async () => {
  const eigen = await post('/api/festival/nieuw', { naam: 'Tweede' }, manager);
  const e2 = await post('/api/festival/editie', { festival: eigen.festival.id, jaar: 2028 }, manager);
  assert.equal((await api('/api/festival/controls/seed', { festival: eigen.festival.id, editie: e2.editie.id }, deur)).status, 403);
  assert.equal((await post('/api/festival/controls/seed', { festival: eigen.festival.id, editie: e2.editie.id }, manager)).ok, true);

  const st = await post('/api/festival/gereed', { festival: eigen.festival.id, editie: e2.editie.id }, deur);
  const c = st.controls[0];
  assert.equal((await post('/api/festival/bewijs', { festival: eigen.festival.id, editie: e2.editie.id,
    control: c.id, soort: 'besluit' }, deur)).ok, true, 'wie het stuk heeft, levert het aan');
  assert.equal((await api('/api/festival/bewijs/teken', { festival: eigen.festival.id, editie: e2.editie.id,
    control: c.id }, deur)).status, 403, 'maar aftekenen is managerwerk');
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   1. In routes/festival.js mijn() de eigendomscontrole weggehaald
      (`if (!f) return null` in plaats van `if (!f || f.eigenaar !== ...)`).
      -> toets 3 zakte: MACE las het terrein van ESVEDRA.
         De PURE toets bleef groen -- precies waarvoor dit bestand bestaat.

   2. AFGESLAGEN, EN DAT WAS DE NUTTIGSTE UITKOMST. Op de route stond een
      mijnEditie() die de editie eerst zelf opzocht en 404'de als hij niet bij
      dit festival hoorde. De mutatie liet hem over ALLE festivals zoeken -- en
      er zakte niets. Reden: elke kernfunctie neemt (festivalId, editieId) en
      zoekt de editie binnen dat festival, dus een vreemd editie-id kwam daar
      toch al niet doorheen.
      Die route-controle was dus geen wacht maar een verdubbeling, en dode code
      die op een wacht lijkt is erger dan geen wacht (LAT-regel 4). Hij is
      weggehaald; toets 4 staat er nog en meet nu de grendel die er echt is.

   3. In routes/festival/poort.js de klokstempel VOOR de body gezet
      (`...nu()` naar boven verplaatst), zodat het lichaam hem overschrijft.
      -> toets 5 zakte: de pas van morgen kwam vandaag binnen.
         Dit is de mutatie die telt: de kern is ongewijzigd en volstrekt in orde,
         en toch staat de deur open.

   4. In routes/festival.js managerOnly bij /api/festival/pas weggehaald.
      -> toets 7 zakte.

   5. In routes/festival.js magFestival() altijd true laten geven.
      -> toets 1 zakte.

   6. In routes/festival/poort.js /api/festival/dag/nu de datum en tijd uit het
      LICHAAM laten komen in plaats van uit nu().
      -> toets 8 zakte: met een lege body viel er geen dag meer te vinden, en
         het beeld zou dus buiten de openingstijden hetzelfde zeggen als erbinnen.

   7. In routes/festival/gereed.js bij /api/festival/bewijs `door` uit de body
      laten komen in plaats van uit req.actor.
      -> toets 9 zakte: de manager diende in op andermans naam en mocht daarna
         zijn eigen stuk aftekenen. De KERN is hier ongewijzigd en volstrekt in
         orde; de functiescheiding stond alleen op de route.
      LET OP -- deze mutatie sloeg de EERSTE keer af, en dat lag aan de toets.
         Die stuurde 'Marta Salas' mee als vreemde naam, en dat is toevallig de
         manager van ESVEDRA zelf; de wacht sloeg dus alsnog aan en de toets
         bewees niets. Nu staat er een naam die in dit huis niet bestaat. Dit is
         de tweede keer deze ronde dat een mutatie een gat in de TOETS aanwijst
         in plaats van in de code (zie ook mutatie 11 in test/festival.test.js),
         en dat is precies waar de discipline voor bestaat.

   8. In routes/festival/gereed.js de peildatum uit de body laten komen.
      -> toets 10 zakte: een stuk dat in 2020 verliep telde weer mee.
   ========================================================================== */
