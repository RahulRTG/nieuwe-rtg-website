/* ============================================================================
   HET FOUNDATION OS, FASE TWEE: SUBSIDIES, VOORRAAD, ACTIVITEITEN, BERICHTEN

   test/rtfos.test.js toetst de governance-grendels (oormerk, vier ogen, limiet,
   VOG, toestemming, scheiding tussen steden). Dit bestand gaat over de
   uitvoering op straat, en over de vier plekken waar die uitvoering misgaat:

     1. SUBSIDIEGELD dat als losse donatie in de boeken belandt, of een
        verantwoording die "af" heet terwijl er niets is opgeleverd;
     2. VOEDSEL dat over de datum de deur uit gaat, of een uitgifte die meer
        weggeeft dan er ligt;
     3. EEN KIND dat zonder toestemming van de ouders binnenkomt, of een
        jeugdactiviteit zonder begeleider met een geldige VOG;
     4. EEN VERKLARING NAAR BUITEN die een stad in zijn eentje verstuurt onder
        de naam van de hele stichting.

   WAT ER MET EEN MUTATIE IS NAGETROKKEN (LAT.md regel 2). Elke bewering is een
   keer gezien terwijl hij zakte:

     - bronUitSubsidie niet aanroepen bij toekennen: RAAK op "een toegekende
       subsidie maakt zijn eigen geoormerkte bron";
     - de openMomenten-eis uit subsidies-keten.js halen: RAAK op de
       verantwoording;
     - de datumcontrole uit voorraad-uitgifte.js halen: RAAK op het voedsel;
     - de restant-controle laten rekenen met b.aantal in plaats van rest():
       RAAK op "er gaat nooit meer uit dan erin zit" -- en dat is de scherpste
       van de zeven, want met dat veld ziet de eerste uitgifte er nog goed uit
       en gaat pas de derde over de kop;
     - de VOG-eis bij het openzetten weghalen: RAAK op de jeugdactiviteit;
     - de oudertoestemming-grendel bij inchecken weghalen: RAAK op het kind;
     - NAAR_BUITEN leegmaken: RAAK op de publieke verklaring.

   Alle zeven zakten op precies hun eigen bewering en lieten de andere vijf
   groen -- een mutatie die alles laat zakken, bewijst niets (LAT.md regel 2).

   Draai los: node --experimental-sqlite --test test/rtfos-uitvoering.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfos2-'));
const OFFICE_CODE = 'RTFOS2-KEURING';

let srv, BASE, LAND, STAD, STADSBESTUUR, PROJECT;

const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const os_ = (pad, body, tok) => post('/api/rtfos/' + pad, body, tok || LAND);

async function kantoorLid(naam, mail) {
  const reg = await post('/api/auth/register', { name: naam, email: mail, phone: '0612345671',
    password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  assert.ok(reg.body.token, 'registreren mislukte: ' + JSON.stringify(reg.body).slice(0, 150));
  await post('/api/account/koppel', { soort: 'kantoor', code: OFFICE_CODE }, reg.body.token);
  const start = await post('/api/account/start', { rol: 'kantoor' }, reg.body.token);
  assert.ok(start.body.token, 'kantoorsessie mislukte');
  const ik = await os_('ik', {}, start.body.token);
  return { office: start.body.token, key: ik.body.key };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  BASE = srv.base;
  LAND = await kantoorAlsPersoon(BASE);
  assert.ok(LAND, 'geen kantoorsessie voor de eigenaar');

  STAD = (await os_('stad/maak', { naam: 'IJmuiden' })).body.stad.id;
  await os_('stad/status', { id: STAD, status: 'actief' });
  for (const vlag of ['youth_programs', 'donations', 'volunteer_management', 'individual_cases',
    'subsidy_management', 'warehouse_management', 'events', 'food_distribution']) {
    await os_('stad/module', { id: STAD, vlag, aan: true });
  }
  const bestuur = await kantoorLid('Bestuur IJmuiden', 'bestuur.ijmuiden@rtfos.test');
  STADSBESTUUR = bestuur.office;
  await os_('zetel', { stad: STAD, key: bestuur.key, naam: 'Bestuur IJmuiden', rol: 'stadsbestuur' });

  const p = await os_('project/maak', { stad: STAD, naam: 'Huiswerkklas Zeewijk', soort: 'jongeren',
    budget: 1500, doelgroep: 'jongeren 12-18' });
  PROJECT = p.body.project.id;
  await os_('project/status', { id: PROJECT, status: 'aanvraag' }, STADSBESTUUR);
  await os_('project/status', { id: PROJECT, status: 'beoordeling' }, STADSBESTUUR);
  await os_('project/status', { id: PROJECT, status: 'goedgekeurd' });
  await os_('project/status', { id: PROJECT, status: 'actief' });
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------------------------------------------------------------------------
   1. EEN TOEGEKENDE SUBSIDIE MAAKT ZIJN EIGEN GEOORMERKTE BRON
   Niet met de hand in een tweede scherm: twee plekken die hetzelfde bedrag
   vasthouden lopen uiteen, en bij subsidiegeld zit het oormerk dan niet in de
   administratie.
   ------------------------------------------------------------------------- */
test('een toegekende subsidie wordt zelf de geoormerkte bron', async () => {
  const s = await os_('subsidie/maak', { stad: STAD, naam: 'Jeugdfonds Kennemerland', soort: 'fonds',
    verstrekker: 'Jeugdfonds', bedrag: 2000, projectId: PROJECT, risico: 'middel' });
  assert.equal(s.status, 200, JSON.stringify(s.body).slice(0, 200));
  const id = s.body.subsidie.id;
  assert.equal(s.body.subsidie.bronId, null, 'er stond al een bron voor de subsidie was toegekend');

  await os_('subsidie/status', { id, status: 'in_voorbereiding' });
  await os_('subsidie/status', { id, status: 'aangevraagd' });
  const toe = await os_('subsidie/status', { id, status: 'toegekend', bedrag: 2000 });
  assert.equal(toe.status, 200, JSON.stringify(toe.body).slice(0, 200));
  assert.ok(toe.body.subsidie.bronId, 'toekennen leverde geen bron op');

  const geld = await os_('geld', { stad: STAD });
  const bron = geld.body.bronnen.find(b => b.id === toe.body.subsidie.bronId);
  assert.ok(bron, 'de bron staat niet in het geldoverzicht');
  assert.equal(bron.soort, 'subsidie', 'de bron staat als iets anders dan subsidie in de boeken');
  assert.equal(bron.geoormerkt, true, 'de subsidiebron is niet geoormerkt');
  assert.equal(bron.binnen, 2000);

  /* En het oormerk werkt zoals bij elke andere bron: dit geld kan niet naar een
     ander project. Dat is de hele reden dat toekennen de bron maakt. */
  const ander = await os_('project/maak', { stad: STAD, naam: 'Ouderenbezoek', soort: 'taal', budget: 200 });
  const anderId = ander.body.project.id;
  /* Het andere project moet ECHT actief zijn, anders stuit de aanvraag al op de
     projectstatus en toetst deze bewering iets anders dan ze zegt -- dezelfde
     val als bij de toestemming in test/rtfos.test.js. */
  await os_('project/status', { id: anderId, status: 'aanvraag' }, STADSBESTUUR);
  await os_('project/status', { id: anderId, status: 'beoordeling' }, STADSBESTUUR);
  await os_('project/status', { id: anderId, status: 'goedgekeurd' });
  await os_('project/status', { id: anderId, status: 'actief' });
  const fout = await os_('uitgave/aanvraag', { projectId: anderId, bronId: bron.id,
    omschrijving: 'iets anders', bedrag: 50 });
  assert.equal(fout.status, 403, 'subsidiegeld liep zo naar een ander project');
  assert.match(fout.body.error, /geoormerkt/);
});

/* ---------------------------------------------------------------------------
   2. VERANTWOORD BETEKENT VERANTWOORD
   ------------------------------------------------------------------------- */
test('een subsidie gaat niet op verantwoord met open momenten of zonder bewijs', async () => {
  const s = await os_('subsidie/maak', { stad: STAD, naam: 'Buurtbudget', soort: 'gemeente',
    verstrekker: 'Gemeente Velsen', bedrag: 1200 });
  const id = s.body.subsidie.id;
  await os_('subsidie/status', { id, status: 'in_voorbereiding' });
  await os_('subsidie/status', { id, status: 'aangevraagd' });
  await os_('subsidie/status', { id, status: 'toegekend', bedrag: 1200 });
  const m = await os_('subsidie/moment', { id, wat: 'tussenrapportage', datum: '2027-01-31' });
  assert.equal(m.status, 200, JSON.stringify(m.body).slice(0, 200));

  const open = await os_('subsidie/status', { id, status: 'verantwoord' });
  assert.equal(open.status, 400, 'verantwoorden lukte met een open rapportagemoment');
  assert.match(open.body.error, /rapportagemomenten open/);

  const momentId = m.body.subsidie.momenten[0].id;
  await os_('subsidie/moment', { id, momentId, af: true });
  const zonderBewijs = await os_('subsidie/status', { id, status: 'verantwoord' });
  assert.equal(zonderBewijs.status, 400, 'verantwoorden lukte zonder een enkel bewijsstuk');
  assert.match(zonderBewijs.body.error, /bewijs/i);

  await os_('subsidie/bewijs', { id, naam: 'Eindrapport 2026', soort: 'rapportage' });
  const klaar = await os_('subsidie/status', { id, status: 'verantwoord' });
  assert.equal(klaar.status, 200, JSON.stringify(klaar.body).slice(0, 200));
});

/* ---------------------------------------------------------------------------
   3. VOEDSEL OVER DE DATUM GAAT NIET DE DEUR UIT
   En er gaat nooit meer uit dan erin zit.
   ------------------------------------------------------------------------- */
test('over de datum gaat niet de deur uit, en meer dan er ligt ook niet', async () => {
  // bederfelijk zonder datum kan niet: anders is de grendel een lege huls
  const zonderDatum = await os_('voorraad/binnen', { stad: STAD, soort: 'voedsel', wat: 'broden', aantal: 50 });
  assert.equal(zonderDatum.status, 400, 'voedsel kwam binnen zonder houdbaarheidsdatum');
  assert.match(zonderDatum.body.error, /houdbaarheidsdatum/);

  const oud = await os_('voorraad/binnen', { stad: STAD, soort: 'voedsel', wat: 'broden',
    aantal: 50, houdbaarTot: '2020-01-01', gever: 'Bakkerij Zeewijk', locatie: 'uitgiftepunt' });
  assert.equal(oud.status, 200, JSON.stringify(oud.body).slice(0, 200));
  assert.equal(oud.body.batch.overDatum, true);
  const uit = await os_('voorraad/uit', { id: oud.body.batch.id, aantal: 5, projectId: PROJECT });
  assert.equal(uit.status, 403, 'voedsel over de datum ging de deur uit');
  assert.match(uit.body.error, /houdbaar tot 2020-01-01/);

  // afschrijven kan wel, en vraagt een reden
  const zonderReden = await os_('voorraad/afschrijven', { id: oud.body.batch.id, aantal: 50 });
  assert.equal(zonderReden.status, 400, 'afschrijven lukte zonder reden');
  const af = await os_('voorraad/afschrijven', { id: oud.body.batch.id, aantal: 50, reden: 'over de datum' });
  assert.equal(af.status, 200, JSON.stringify(af.body).slice(0, 200));
  assert.equal(af.body.batch.restant, 0);

  // en op een verse partij: nooit meer dan er ligt
  const jaar = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10);
  const vers = await os_('voorraad/binnen', { stad: STAD, soort: 'voedsel', wat: 'pakketten',
    aantal: 10, houdbaarTot: jaar, waarde: 250 });
  const teveel = await os_('voorraad/uit', { id: vers.body.batch.id, aantal: 11, projectId: PROJECT });
  assert.equal(teveel.status, 400, 'er ging meer uit dan erin zat');
  assert.match(teveel.body.error, /Er is nog 10/);

  // een uitgifte zonder bestemming kan niet -- en een naam is geen bestemming
  const zonderDoel = await os_('voorraad/uit', { id: vers.body.batch.id, aantal: 2 });
  assert.equal(zonderDoel.status, 400, 'er ging voorraad uit zonder bestemming');
  assert.match(zonderDoel.body.error, /project of vul de codenaam/);

  const goed = await os_('voorraad/uit', { id: vers.body.batch.id, aantal: 4, projectId: PROJECT });
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 200));
  assert.equal(goed.body.batch.restant, 6);

  // twee keer vier is acht; de negende gaat niet meer
  await os_('voorraad/uit', { id: vers.body.batch.id, aantal: 4, projectId: PROJECT });
  const derde = await os_('voorraad/uit', { id: vers.body.batch.id, aantal: 4, projectId: PROJECT });
  assert.equal(derde.status, 400, 'het restant werd niet uit de batch zelf gerekend');
  assert.match(derde.body.error, /Er is nog 2/);
});

/* ---------------------------------------------------------------------------
   4. DE ACTIVITEIT: VOG, VEILIGHEIDSPLAN, WACHTLIJST EN OUDERTOESTEMMING
   ------------------------------------------------------------------------- */
test('een jeugdactiviteit gaat niet open zonder VOG-begeleider en veiligheidsplan', async () => {
  const a = await os_('activiteit/maak', { stad: STAD, naam: 'Sportdag Zeewijk', soort: 'sportdag',
    capaciteit: 2, wanneer: '2026-09-12', locatie: 'gymzaal' });
  assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 200));
  const id = a.body.activiteit.id;

  const zonder = await os_('activiteit/open', { id });
  assert.equal(zonder.status, 403, 'een sportdag ging open zonder begeleider met VOG');
  assert.match(zonder.body.error, /geldige VOG/);

  // een begeleider zonder geldige VOG telt niet
  const v1 = await os_('vrijwilliger/maak', { stad: STAD, naam: 'Begeleider Zonder' });
  await os_('vrijwilliger/zet', { id: v1.body.vrijwilliger.id, status: 'actief', gedragscode: true });
  await os_('activiteit/begeleiders', { id, ids: [v1.body.vrijwilliger.id] });
  const nogSteeds = await os_('activiteit/open', { id });
  assert.equal(nogSteeds.status, 403, 'een begeleider zonder geldige VOG telde mee');

  const jaar = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const v2 = await os_('vrijwilliger/maak', { stad: STAD, naam: 'Begeleider Met' });
  await os_('vrijwilliger/zet', { id: v2.body.vrijwilliger.id, status: 'actief', gedragscode: true, vogGeldigTot: jaar });
  await os_('activiteit/begeleiders', { id, ids: [v1.body.vrijwilliger.id, v2.body.vrijwilliger.id] });

  const zonderPlan = await os_('activiteit/open', { id });
  assert.equal(zonderPlan.status, 400, 'een kinderactiviteit ging open zonder veiligheidsplan');
  assert.match(zonderPlan.body.error, /veiligheidsplan/);

  await os_('activiteit/zet', { id, veiligheidsplan: 'twee begeleiders bij de deur, EHBO-koffer in de kast' });
  const open = await os_('activiteit/open', { id });
  assert.equal(open.status, 200, JSON.stringify(open.body).slice(0, 200));
});

test('vol is een wachtlijst, en een kind zonder oudertoestemming komt er niet in', async () => {
  const jaar = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const v = await os_('vrijwilliger/maak', { stad: STAD, naam: 'Begeleider Avond' });
  await os_('vrijwilliger/zet', { id: v.body.vrijwilliger.id, status: 'actief', gedragscode: true, vogGeldigTot: jaar });
  const a = await os_('activiteit/maak', { stad: STAD, naam: 'Jongerenavond', soort: 'jongerenavond', capaciteit: 2 });
  const id = a.body.activiteit.id;
  await os_('activiteit/begeleiders', { id, ids: [v.body.vrijwilliger.id] });
  await os_('activiteit/zet', { id, veiligheidsplan: 'begeleider bij de deur' });
  await os_('activiteit/open', { id });

  const een = await os_('activiteit/inschrijven', { id, codenaam: 'HV-AAAAA' });
  const twee = await os_('activiteit/inschrijven', { id, codenaam: 'HV-BBBBB', minderjarig: true, oudertoestemming: false });
  const drie = await os_('activiteit/inschrijven', { id, codenaam: 'HV-CCCCC' });
  assert.equal(een.body.inschrijving.status, 'ingeschreven');
  assert.equal(twee.body.inschrijving.status, 'ingeschreven');
  assert.equal(drie.body.inschrijving.status, 'wachtlijst', 'de derde kwam er gewoon bij terwijl het vol was');
  assert.equal(drie.body.inschrijving.wachtlijstplaats, 1);
  assert.match(drie.body.bericht, /wachtlijst, plaats 1/);

  // de incheckcode is per inschrijving verschillend en geen volgnummer
  assert.notEqual(een.body.inschrijving.checkinCode, twee.body.inschrijving.checkinCode);
  assert.match(een.body.inschrijving.checkinCode, /^IN-[A-Z0-9]{7}$/);

  // het kind zonder toestemming van de ouders komt er niet in
  const kind = await os_('activiteit/incheck', { id, checkinCode: twee.body.inschrijving.checkinCode });
  assert.equal(kind.status, 403, 'een minderjarige zonder oudertoestemming kwam binnen');
  assert.match(kind.body.error, /toestemming van de ouders/);

  // wie op de wachtlijst staat, checkt niet in
  const wacht = await os_('activiteit/incheck', { id, checkinCode: drie.body.inschrijving.checkinCode });
  assert.equal(wacht.status, 403, 'iemand van de wachtlijst kon inchecken');

  // een gewone inschrijving wel, en dubbel inchecken is geen fout maar een mededeling
  const binnen = await os_('activiteit/incheck', { id, checkinCode: een.body.inschrijving.checkinCode });
  assert.equal(binnen.status, 200, JSON.stringify(binnen.body).slice(0, 200));
  assert.equal(binnen.body.fototoestemming, false, 'fototoestemming werd afgeleid uit meedoen');
  const nogmaals = await os_('activiteit/incheck', { id, checkinCode: een.body.inschrijving.checkinCode });
  assert.equal(nogmaals.body.alBinnen, true, 'twee keer inchecken gaf geen duidelijk antwoord');

  // afmelden schuift de wachtlijst op, en zegt wie
  const af = await os_('activiteit/afmelden', { id, inschrijvingId: twee.body.inschrijving.id });
  assert.equal(af.status, 200, JSON.stringify(af.body).slice(0, 200));
  assert.deepEqual(af.body.opgeschoven, ['HV-CCCCC'], 'de wachtlijst schoof niet op');
  assert.match(af.body.bericht, /schuift op/);

  // afronden vraagt een evaluatie
  const zonder = await os_('activiteit/status', { id, status: 'afgerond' });
  assert.equal(zonder.status, 400, 'een activiteit werd afgerond zonder evaluatie');
  const klaar = await os_('activiteit/status', { id, status: 'afgerond', evaluatie: 'rustige avond, tien jongeren' });
  assert.equal(klaar.status, 200, JSON.stringify(klaar.body).slice(0, 200));
  assert.equal(klaar.body.activiteit.evaluatie.aanwezig, 1, 'het aantal aanwezigen werd niet vastgelegd');
});

/* ---------------------------------------------------------------------------
   5. NAAR BUITEN SPREKEN IS LANDELIJK
   Naar binnen stuurt de stad zelf -- anders gaat het bericht via een
   privé-appgroep en is het systeem het probleem geworden.
   ------------------------------------------------------------------------- */
test('een publiek bericht gaat pas na landelijk akkoord de deur uit', async () => {
  const intern = await os_('bericht/maak', { stad: STAD, doelgroep: 'vrijwilligers', kanaal: 'app',
    onderwerp: 'Zaterdag', tekst: 'We beginnen om negen uur bij de gymzaal.' }, STADSBESTUUR);
  const internVerzend = await os_('bericht/verzend', { id: intern.body.bericht.id }, STADSBESTUUR);
  assert.equal(internVerzend.status, 200, JSON.stringify(internVerzend.body).slice(0, 200));
  assert.equal(internVerzend.body.bericht.status, 'verzonden', 'een intern bericht bleef hangen');

  const publiek = await os_('bericht/maak', { stad: STAD, doelgroep: 'publiek', kanaal: 'nieuwsbrief',
    onderwerp: 'Verklaring over het incident', tekst: 'Wij betreuren wat er is gebeurd.', spoed: true }, STADSBESTUUR);
  const voorgelegd = await os_('bericht/verzend', { id: publiek.body.bericht.id }, STADSBESTUUR);
  assert.equal(voorgelegd.status, 200);
  assert.equal(voorgelegd.body.bericht.status, 'wacht_op_landelijk', 'een publieke verklaring ging zomaar de deur uit');
  assert.equal(voorgelegd.body.voorgelegd, true);
  assert.match(voorgelegd.body.melding, /naam van de hele stichting/);

  /* Spoed geeft VOORRANG en geen omweg. Om dat te kunnen beweren staat er eerst
     een gewoon publiek bericht in de bak: met maar een bericht zou "hij staat
     bovenaan" vanzelf waar zijn, en dat is een toets die niet kan zakken
     (LAT.md regel 9). */
  const gewoon = await os_('bericht/maak', { stad: STAD, doelgroep: 'publiek', kanaal: 'nieuwsbrief',
    onderwerp: 'Jaarbericht', tekst: 'Een rustig overzicht van het jaar.' }, STADSBESTUUR);
  await os_('bericht/verzend', { id: gewoon.body.bericht.id }, STADSBESTUUR);
  const lijst = await os_('berichten', {});
  assert.ok(lijst.body.teBeoordelen.length >= 2, 'de landelijke bak bevat te weinig om over voorrang te praten');
  assert.equal(lijst.body.teBeoordelen[0].spoed, true, 'het spoedbericht stond niet bovenaan');

  // de stad kan niet zelf besluiten
  const zelf = await os_('bericht/besluit', { id: publiek.body.bericht.id, akkoord: true }, STADSBESTUUR);
  assert.equal(zelf.status, 403, 'de stad keurde zijn eigen publieke verklaring goed');

  // afkeuren vraagt een reden waar de stad iets mee kan
  const zonderReden = await os_('bericht/besluit', { id: publiek.body.bericht.id, akkoord: false, reden: 'nee' });
  assert.equal(zonderReden.status, 400, 'afkeuren lukte zonder bruikbare reden');

  const akkoord = await os_('bericht/besluit', { id: publiek.body.bericht.id, akkoord: true, reden: 'tekst klopt' });
  assert.equal(akkoord.status, 200, JSON.stringify(akkoord.body).slice(0, 200));

  /* EN NU DE GRENDEL DIE VAN EEN GOEDKEURING EEN GOEDKEURING MAAKT: wie de tekst
     na de goedkeuring wijzigt, valt terug op concept. Anders is de handtekening
     onder een blanco vel gezet. */
  const gewijzigd = await os_('bericht/zet', { id: publiek.body.bericht.id,
    tekst: 'Wij wijzen alle verantwoordelijkheid af en de gemeente heeft zitten slapen.' }, STADSBESTUUR);
  assert.equal(gewijzigd.body.bericht.status, 'concept', 'de goedkeuring bleef staan na een tekstwijziging');
  assert.equal(gewijzigd.body.goedkeuringVervallen, true);
  const opnieuw = await os_('bericht/verzend', { id: publiek.body.bericht.id }, STADSBESTUUR);
  assert.equal(opnieuw.body.bericht.status, 'wacht_op_landelijk', 'de gewijzigde tekst ging zonder nieuw besluit de deur uit');
});
