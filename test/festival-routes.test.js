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
  12. De partnerkant loopt niet via eigendom: de genoemde zaak bevestigt.
  13. De zaakcode komt uit de sessie; het lichaam mag hem niet zetten.
  14. De postbus toont alleen banden waarin deze zaak zelf genoemd is.
  15. Reserveren verbruikt de plek voordat er betaald is, en de prijs komt uit
      de reservering en niet uit het lichaam.
  16. Een mislukte betaling geeft de plek meteen terug.
  17. De ledenkant: een groep maken en meedoen met een code.
  18. Een niet-lid leest de stand niet.
  19. De codenaam komt uit de sessie; het lichaam mag hem niet zetten.
  20. Het rooster maken is managerwerk; het lezen doet iedereen over zichzelf.
  21. Wie de dienst van is komt uit de sessie: je leest die van een collega niet.
  22. Wie een boeking bevestigt komt uit de sessie -- een verslag van een
      menselijke uitspraak is niets waard als de aanvrager de naam invult.
  23. Het schema veranderen is managerwerk; een riderpunt afvinken doet de vloer.
  24. Het podiumbeeld neemt dag en klok van de server.
  25. De afrekening is een overzicht, en blijft bij de manager.
  26. De norm zetten is managerwerk; de vraag lezen doet de vloer.
  27. De voorspelling neemt dag en klok van de server.
  28. Afsluiten draagt de naam uit de sessie en gebeurt niet twee keer stil.
  29. Het geheugen blijft bij de manager en vergelijkt niet met niets.

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

let manager, deur, andere, zonderTickets, lidA, lidB;
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

  /* Twee echte leden voor de groepskant: die is van GASTEN en niet van de zaak. */
  const u = Date.now().toString().slice(-7);
  lidA = (await post('/api/auth/register', { name: 'Groep A', email: 'ga' + u + '@x.nl', phone: '061' + u,
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).token;
  lidB = (await post('/api/auth/register', { name: 'Groep B', email: 'gb' + u + '@x.nl', phone: '062' + u,
    password: 'geheim12345', geboortedatum: '1991-01-01', tier: 'rtg', pasApp: 'rtg' })).token;

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

test('12. de partnerkant loopt niet via eigendom: de genoemde zaak bevestigt', async () => {
  /* MACE bezit dit festival niet en kan het niet lezen (toets 3). Maar als het
     festival MACE als partner voorstelt, moet MACE juist WEL kunnen antwoorden
     -- anders sluit een band nooit. Eigendom is hier de verkeerde vraag. */
  const voorstel = await post('/api/festival/partner', { festival: fid, editie: eid, rol: 'horeca', zaak: 'MACE' }, manager);
  assert.equal(voorstel.ok, true);
  assert.equal(voorstel.partner.stand, 'voorgesteld');

  const doorEigenaar = await api('/api/festival/partner/bevestig',
    { festival: fid, editie: eid, id: voorstel.partner.id }, manager);
  assert.equal(doorEigenaar.status, 404, 'de eigenaar kan zijn eigen voorstel niet bevestigen');

  const doorMace = await post('/api/festival/partner/bevestig',
    { festival: fid, editie: eid, id: voorstel.partner.id, deelt: ['x1'] }, andere);
  assert.equal(doorMace.ok, true);
  assert.equal(doorMace.partner.stand, 'bevestigd');
  assert.deepEqual(doorMace.partner.deelt, ['x1']);
});

test('13. de zaakcode komt uit de sessie; het lichaam mag hem niet zetten', async () => {
  const voorstel = await post('/api/festival/partner', { festival: fid, editie: eid, rol: 'techniek', zaak: 'MACE' }, manager);

  /* Het personeelslid van ESVEDRA doet alsof hij MACE is. Wordt zaakCode uit
     het lichaam genomen, dan bevestigt hij de band van een ander bedrijf -- en
     dan is de hele tweezijdigheid een formulier. */
  const alsof = await api('/api/festival/partner/bevestig',
    { festival: fid, editie: eid, id: voorstel.partner.id, zaakCode: 'MACE' }, deur);
  assert.equal(alsof.status, 404);

  const echt = await post('/api/festival/partner/bevestig', { festival: fid, editie: eid, id: voorstel.partner.id }, andere);
  assert.equal(echt.ok, true);
});

test('14. de postbus toont alleen banden waarin deze zaak zelf genoemd is', async () => {
  const inbox = await post('/api/festival/partner/inbox', {}, andere);
  assert.ok(inbox.banden.length >= 1, 'MACE ziet de banden waarin hij genoemd is');
  assert.ok(inbox.banden.every(b => b.festivalNaam), 'met genoeg context om te kunnen antwoorden');

  const leeg = await post('/api/festival/partner/inbox', {}, zonderTickets);
  assert.deepEqual(leeg.banden, [], 'en een zaak die nergens genoemd is, ziet niets');
});

test('15. reserveren verbruikt de plek voordat er betaald is', async () => {
  const prod = await post('/api/festival/product', { festival: fid, editie: eid, naam: 'Vroege vogel',
    prijs: 65, voorraad: 1, rechten: [{ soort: 'festival.entree', dagen: [vandaagId] }] }, manager);
  assert.equal(prod.ok, true);

  const a = await post('/api/festival/verkoop', { festival: fid, editie: eid, product: prod.product.id, koper: 'Kobalt' }, deur);
  assert.equal(a.ok, true);
  assert.equal(a.verkoop.stand, 'gereserveerd');

  const ruimte = await post('/api/festival/ruimte', { festival: fid, editie: eid, product: prod.product.id }, deur);
  assert.equal(ruimte.ruimte, 0, 'de plek is weg, en er is nog niets betaald');

  const tweede = await api('/api/festival/verkoop', { festival: fid, editie: eid, product: prod.product.id, koper: 'Amber' }, deur);
  assert.equal(tweede.status, 409, 'de tweede koper komt er niet meer bij');

  /* Afrekenen: het bedrag komt uit de RESERVERING. Een prijs die de koper
     meestuurt is geen prijs. */
  const rond = await post('/api/festival/verkoop/rond',
    { festival: fid, editie: eid, id: a.verkoop.id, methode: 'contant', prijs: 1 }, deur);
  assert.equal(rond.ok, true);
  assert.equal(rond.verkoop.betaald.centen, 6500);
  assert.equal(rond.pas.drager, 'Kobalt');
});

test('16. een mislukte betaling geeft de plek meteen terug', async () => {
  const prod = await post('/api/festival/product', { festival: fid, editie: eid, naam: 'Laatste plek',
    prijs: 40, voorraad: 1, rechten: [{ soort: 'festival.entree', dagen: [vandaagId] }] }, manager);
  const a = await post('/api/festival/verkoop', { festival: fid, editie: eid, product: prod.product.id, koper: 'Ivo' }, deur);
  assert.equal((await post('/api/festival/ruimte', { festival: fid, editie: eid, product: prod.product.id }, deur)).ruimte, 0);

  const stuk = await api('/api/festival/verkoop/rond',
    { festival: fid, editie: eid, id: a.verkoop.id, methode: 'rtgpay', payCode: 'BESTAATNIET' }, deur);
  assert.equal(stuk.status, 404);
  const body = await stuk.json();
  assert.equal(body.losgelaten, true);

  const na = await post('/api/festival/ruimte', { festival: fid, editie: eid, product: prod.product.id }, deur);
  assert.equal(na.ruimte, 1, 'een verkeerd getypte code houdt de zaal niet een kwartier bezet');
});

test('17. de ledenkant: een groep maken en meedoen met een code', async () => {
  const g = await post('/api/festival/groep', { festival: fid, editie: eid, naam: 'Naar Testival' }, lidA);
  assert.equal(g.ok, true);
  assert.equal(g.groep.leden.length, 1);

  /* Lid B doet zelf mee, met de code die A hem heeft gegeven. RTG heeft niets
     verstuurd: er is geen uitnodiging, geen melding, geen mail. */
  const mee = await post('/api/festival/groep/mee', { festival: fid, editie: eid, code: g.groep.code }, lidB);
  assert.equal(mee.ok, true);
  assert.equal(mee.groep.leden.length, 2);

  const stand = await post('/api/festival/groep/stand', { festival: fid, editie: eid, id: g.groep.id }, lidB);
  assert.equal(stand.zonderPas, 2, 'een getal, en verder niets');
  assert.deepEqual(Object.keys(stand).sort(), ['code', 'id', 'leden', 'maker', 'naam', 'ok', 'zonderPas']);
});

test('18. een niet-lid leest de stand niet', async () => {
  const g = await post('/api/festival/groep', { festival: fid, editie: eid, naam: 'Besloten' }, lidA);
  const buiten = await api('/api/festival/groep/stand', { festival: fid, editie: eid, id: g.groep.id }, lidB);
  assert.equal(buiten.status, 404, 'wie er in een groep zit is niets voor buitenstaanders');
});

test('19. de codenaam komt uit de sessie; het lichaam mag hem niet zetten', async () => {
  const g = await post('/api/festival/groep', { festival: fid, editie: eid, naam: 'Van A' }, lidA);
  const stand = await post('/api/festival/groep/stand', { festival: fid, editie: eid, id: g.groep.id }, lidA);
  const codenaamVanA = stand.maker;

  /* Lid B doet alsof hij A is. Wordt de codenaam uit het lichaam genomen, dan
     leest hij de groep van een ander -- en stapt hij er straks ook uit. */
  const alsof = await api('/api/festival/groep/stand',
    { festival: fid, editie: eid, id: g.groep.id, codenaam: codenaamVanA }, lidB);
  assert.equal(alsof.status, 404);

  const eruit = await api('/api/festival/groep/weg',
    { festival: fid, editie: eid, id: g.groep.id, codenaam: codenaamVanA }, lidB);
  assert.equal(eruit.status, 404);
  const na = await post('/api/festival/groep/stand', { festival: fid, editie: eid, id: g.groep.id }, lidA);
  assert.equal(na.leden.length, 1, 'A staat er nog gewoon in');
});

test('20. het rooster maken is managerwerk; het lezen doet iedereen', async () => {
  const roster = await post('/api/supplier/roster', { code: 'ESVEDRA' });
  const deurNaam = roster.staff.find(x => x.role !== 'manager').name;
  const terrein = (await post('/api/festival/plek', { festival: fid, editie: eid,
    naam: 'Bar Lima', soort: 'bar', ouder: terreinId }, manager)).plek;

  assert.equal((await api('/api/festival/dienst', { festival: fid, editie: eid, dag: vandaagId,
    plek: terrein.id, wie: deurNaam, van: '00:00', tot: '23:00' }, deur)).status, 403);

  const gezet = await post('/api/festival/dienst', { festival: fid, editie: eid, dag: vandaagId,
    plek: terrein.id, wie: deurNaam, van: '00:00', tot: '23:00', rol: 'Bar', briefing: 'Bekers bij B12' }, manager);
  assert.equal(gezet.ok, true);

  const rooster = await post('/api/festival/diensten', { festival: fid, editie: eid, dag: vandaagId }, deur);
  assert.equal(rooster.diensten.length, 1, 'het hele rooster lezen mag wel');
});

test('21. wie de dienst van is komt uit de sessie', async () => {
  /* Het personeelslid ziet zijn eigen dienst... */
  const mijne = await post('/api/festival/dienst/mijn', { festival: fid, editie: eid }, deur);
  assert.equal(mijne.ok, true);
  assert.ok(mijne.nu, 'de dienst loopt nu');
  assert.equal(mijne.nu.plek, 'Bar Lima');
  assert.equal(mijne.nu.briefing, 'Bekers bij B12');

  /* ...en de MANAGER, die niet is ingeroosterd, ziet niets -- ook niet als hij
     de naam van het personeelslid meestuurt. Zou `wie` uit het lichaam komen,
     dan leest iedereen de briefing en de collega's van een ander. */
  const roster = await post('/api/supplier/roster', { code: 'ESVEDRA' });
  const deurNaam = roster.staff.find(x => x.role !== 'manager').name;
  const alsof = await post('/api/festival/dienst/mijn',
    { festival: fid, editie: eid, wie: deurNaam }, manager);
  assert.equal(alsof.ok, true);
  assert.equal(alsof.nu, null, 'de manager staat niet ingeroosterd, wat hij ook meestuurt');
});

test('22. wie een boeking bevestigt komt uit de sessie', async () => {
  const podiumId = (await post('/api/festival/plek', { festival: fid, editie: eid,
    naam: 'Hoofdpodium', soort: 'podium', ouder: terreinId, changeover: 30 }, manager)).plek.id;
  const b = (await post('/api/festival/boeking', { festival: fid, editie: eid, dag: vandaagId,
    podium: podiumId, artiest: 'Fred Again', van: '21:00', tot: '22:30' }, manager)).boeking;
  assert.equal(b.stand, 'voornemen', 'een nieuwe boeking is een voornemen');

  /* Bevestigen op andermans naam. Het lichaam zegt Nienke Vroomen -- een naam
     die in dit huis niet bestaat, zodat de wacht niet toevallig aanslaat op de
     manager zelf (dat ging eerder mis, zie mutatie 7 hierboven). */
  const r = await post('/api/festival/boeking/stand', { festival: fid, editie: eid, id: b.id,
    stand: 'bevestigd', hoe: 'getekend contract', door: 'Nienke Vroomen' }, manager);
  const roster = await post('/api/supplier/roster', { code: 'ESVEDRA' });
  const managerNaam = roster.staff.find(x => x.role === 'manager').name;
  assert.equal(r.boeking.bevestigd.door, managerNaam,
    'het verslag draagt de naam van wie er zat, niet de naam die is ingetypt');
  assert.equal(r.boeking.bevestigd.hoe, 'getekend contract');
});

test('23. het schema veranderen is managerwerk; afvinken doet de vloer', async () => {
  const beeld = await post('/api/festival/podiumbeeld', { festival: fid, editie: eid }, deur);
  const boeking = (await post('/api/festival/boekingen', { festival: fid, editie: eid,
    dag: vandaagId }, deur)).boekingen[0];
  assert.ok(beeld.ok && boeking, 'lezen mag de vloer: hij moet weten wie er opgaat');

  assert.equal((await api('/api/festival/boeking', { festival: fid, editie: eid, dag: vandaagId,
    artiest: 'Van de deur', van: '10:00', tot: '11:00' }, deur)).status, 403);
  assert.equal((await api('/api/festival/rider', { festival: fid, editie: eid,
    boeking: boeking.id, wat: 'Handdoeken' }, deur)).status, 403);

  /* AFVINKEN MAG WEL. Wie de handdoeken neerlegt is niet de manager. Zijn naam
     komt uit de sessie, net als bij de bevestiging hierboven. */
  const item = (await post('/api/festival/rider', { festival: fid, editie: eid,
    boeking: boeking.id, wat: 'Handdoeken' }, manager)).item;
  const v = await post('/api/festival/rider/vink', { festival: fid, editie: eid,
    boeking: boeking.id, item: item.id, door: 'Nienke Vroomen' }, deur);
  const roster = await post('/api/supplier/roster', { code: 'ESVEDRA' });
  const deurNaam = roster.staff.find(x => x.role !== 'manager').name;
  assert.equal(v.item.klaar, true);
  assert.equal(v.item.door, deurNaam);
});

test('24. het podiumbeeld neemt dag en klok van de server', async () => {
  /* Het lichaam wijst naar MORGEN. Zou de route dat aannemen, dan kijkt een
     stage manager naar het programma van een dag die nog niet loopt terwijl
     zijn eigen podium draait. Dezelfde regel als bij de scan (toets 5). */
  const b = await post('/api/festival/podiumbeeld', { festival: fid, editie: eid,
    dag: morgenId, tijd: '04:00' }, deur);
  assert.equal(b.ok, true);
  assert.equal(b.dag, vandaagId);
  assert.ok(b.podia.some(p => p.naam === 'Hoofdpodium' && p.changeover === 30));
});

test('25. de afrekening is een overzicht en blijft bij de manager', async () => {
  const boeking = (await post('/api/festival/boekingen', { festival: fid, editie: eid,
    dag: vandaagId }, manager)).boekingen[0];
  await post('/api/festival/boeking', { festival: fid, editie: eid, id: boeking.id,
    dag: vandaagId, podium: boeking.podium, artiest: boeking.artiest,
    van: boeking.van, tot: boeking.tot, gage: 250000, voorschot: 50000 }, manager);
  await post('/api/festival/boeking/extra', { festival: fid, editie: eid,
    boeking: boeking.id, wat: 'Extra techniek', centen: 30000 }, manager);

  assert.equal((await api('/api/festival/boeking/afrekening', { festival: fid, editie: eid,
    boeking: boeking.id }, deur)).status, 403, 'wat een artiest kost gaat de bar niet aan');

  const a = await post('/api/festival/boeking/afrekening', { festival: fid, editie: eid,
    boeking: boeking.id }, manager);
  assert.equal(a.openstaand, 230000);
  assert.equal(a.betaald, false);
  assert.match(a.let_op, /niets geind en niets overgemaakt/);
});

test('26. de norm zetten is managerwerk, de vraag lezen doet de vloer', async () => {
  const barId = (await post('/api/festival/plek', { festival: fid, editie: eid,
    naam: 'Bar Lima', soort: 'bar', ouder: terreinId }, manager)).plek.id;

  assert.equal((await api('/api/festival/norm', { festival: fid, editie: eid, plek: barId,
    vast: 4, van: '00:00', tot: '23:59' }, deur)).status, 403);

  /* De norm hangt aan VANDAAG en niet aan elke dag. Dat is wat toets 27
     bruikbaar maakt: op de dag van morgen hoort er dan geen gat te staan, en
     een route die de dag uit het lichaam zou overnemen, valt daardoor door de
     mand. Met een norm voor alle dagen bewees die toets niets. */
  const r = await post('/api/festival/norm', { festival: fid, editie: eid, plek: barId,
    dag: vandaagId, vast: 4, van: '00:00', tot: '23:59' }, manager);
  assert.equal(r.ok, true);
  assert.equal(r.norm.wat, 'mensen');

  /* Lezen mag de vloer: wie ziet dat hij met twee van de vier staat, is de
     eerste die het kan melden. */
  const lijst = await post('/api/festival/normen', { festival: fid, editie: eid }, deur);
  assert.equal(lijst.ok, true);
  assert.ok(lijst.normen.some(n => n.plekNaam === 'Bar Lima'));
});

test('27. de voorspelling neemt de dag en de klok van de server', async () => {
  /* Het lichaam wijst naar morgen en naar vier uur 's nachts; de route hoort
     dat te negeren en de lopende dag te nemen. Zelfde regel als bij de scan
     (toets 5) en het podiumbeeld (toets 24), en hier omdat een gat van een uur
     geleden een ander gat is dan het gat van nu. */
  const b = await post('/api/festival/vooruit', { festival: fid, editie: eid,
    dag: morgenId, tijd: '04:00' }, deur);
  assert.equal(b.ok, true);
  assert.equal(b.dag, vandaagId);
  assert.ok(b.gaten.some(g => g.plekNaam === 'Bar Lima'),
    'er staat een norm van vier voor VANDAAG en niemand ingeroosterd; op de dag '
    + 'uit het lichaam zou hier niets staan');
  assert.equal(b.leegloop.bekend, false, 'geen doorstroom gezet, dus geen getal');
});

test('28. afsluiten draagt de naam uit de sessie, en gebeurt niet twee keer stil', async () => {
  assert.equal((await api('/api/festival/dag/sluiten', { festival: fid, editie: eid,
    dag: vandaagId }, deur)).status, 403, 'een dag afsluiten is geen deurwerk');

  const r = await post('/api/festival/dag/sluiten', { festival: fid, editie: eid,
    dag: vandaagId, door: 'Nienke Vroomen' }, manager);
  const roster = await post('/api/supplier/roster', { code: 'ESVEDRA' });
  const managerNaam = roster.staff.find(x => x.role === 'manager').name;
  assert.equal(r.afdruk.door, managerNaam, 'niet de naam die is ingetypt');
  assert.ok(r.afdruk.passenGeldig >= 1);

  const nog = await api('/api/festival/dag/sluiten', { festival: fid, editie: eid,
    dag: vandaagId }, manager);
  assert.equal(nog.status, 409);
});

test('29. het geheugen blijft bij de manager en vergelijkt niet met niets', async () => {
  assert.equal((await api('/api/festival/geheugen', { festival: fid, editie: eid }, deur)).status, 403);
  const g = await post('/api/festival/geheugen', { festival: fid, editie: eid }, manager);
  assert.equal(g.ok, true);
  assert.equal(g.bekend, false, 'er is nog geen eerdere editie');
  assert.equal(g.nu.dagen.length, 1);
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

   9. In routes/festival/partner.js `zaakCode` uit de body laten komen in plaats
      van uit req.supplier.
      -> toets 13 zakte: een personeelslid van het festival bevestigde de band
         van een ANDER bedrijf, en opende daarmee wat dat bedrijf deelt.

  10. In routes/festival/partner.js de postbus over alle banden laten lopen in
      plaats van alleen die waarin de zaak genoemd is.
      -> toets 14 zakte: een willekeurige zaak zag de partnerbanden van
         iedereen.

  11. In routes/festival/verkoop.js de plek NIET loslaten als de betaling
      mislukt.
      -> toets 16 zakte: een verkeerd getypte betaalcode hield de laatste plek
         een kwartier bezet.

  12. In routes/festival/verkoop.js het bedrag uit de body halen in plaats van
      uit de reservering.
      -> toets 15 zakte: de koper bepaalde zelf wat hij betaalde.

  13. In routes/festival/dienst.js `wie` uit de body laten komen in plaats van
      uit req.actor.
      -> toets 21 zakte: de manager las de dienst van een personeelslid,
         inclusief zijn briefing en met wie hij staat.

  14. In routes/festival/groep.js de codenaam uit de body laten komen in plaats
      van uit liveCodename(req.session).
      -> toets 19 zakte: lid B las de groep van lid A en kon hem eruit zetten.
         Dit is dezelfde fout als de klok en de zaakcode, en hier weegt hij het
         zwaarst: een groep wordt dan een lijst waar iedereen aan kan zitten.

  15. In routes/festival/artiest.js `door` uit de body laten komen in plaats van
      uit req.actor, bij /api/festival/boeking/stand.
      -> toets 22 zakte: "bevestigd door Nienke Vroomen" stond in de boeking
         terwijl Nienke niet bestaat. De KERN is hier volstrekt in orde -- die
         eist een naam EN een hoe -- en toch is de bevestiging dan een verhaal.
         Dit is de zesde keer in dit domein dat dezelfde mutatie raak is, en dat
         is geen herhaling maar de reden dat het een regel is.

  16. Dezelfde mutatie bij /api/festival/rider/vink.
      -> toets 23 zakte: het riderpunt kwam op naam van iemand anders, en dat is
         de naam waar je 's avonds naar teruggaat als het er niet blijkt te staan.

  17. In routes/festival/artiest.js managerOnly bij /api/festival/boeking en
      /api/festival/boeking/afrekening weggehaald.
      -> toets 23 en 25 zakten: de bar veranderde het schema en las de gage.

  18. In routes/festival/artiest.js dag en tijd van het podiumbeeld uit het
      LICHAAM laten komen in plaats van uit de serverklok.
      -> toets 24 zakte: het beeld toonde het programma van morgen terwijl het
         eigen podium draaide. Zelfde fout als mutatie 3 en 6, andere deur.

  19. In routes/festival/vooruit.js dag en tijd van /api/festival/vooruit uit
      het LICHAAM laten komen.
      -> toets 27 zakte. Dezelfde fout als mutatie 3, 6 en 18; de vijfde deur.
      LET OP -- deze mutatie sloeg de EERSTE keer af, en dat lag aan de toets.
         De norm die erin stond gold voor ELKE dag, dus op de dag uit het
         lichaam stond er net zo goed een gat en bewees de toets niets. De norm
         hangt nu aan vandaag; dan is er op de dag van morgen geen gat, en zakt
         de mutatie. Dit is de derde keer in dit bestand dat een mutatie een gat
         in de TOETS aanwijst in plaats van in de code (zie ook 2 en 7).

  20. In routes/festival/vooruit.js `door` bij /api/festival/dag/sluiten uit de
      body laten komen.
      -> toets 28 zakte: de afdruk van een festivaldag droeg de naam van iemand
         die niet bestaat, en dat is de naam waar je een jaar later op teruggaat.

  21. In routes/festival/vooruit.js managerOnly weghalen bij /api/festival/norm,
      /api/festival/dag/sluiten en /api/festival/geheugen.
      -> toetsen 26, 28 en 29 zakten.
   ========================================================================== */
