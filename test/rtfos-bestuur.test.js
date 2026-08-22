/* ============================================================================
   ZES ROUTES VAN HET FOUNDATION OS DIE DOOR NIEMAND WERDEN AANGEROEPEN

   /api/rtfos/activiteiten, /api/rtfos/beleid, /api/rtfos/herkomst,
   /api/rtfos/subsidies, /api/rtfos/vergadering en /api/rtfos/voorraad stonden
   geregistreerd, werden door de schermen gebruikt en door geen enkele toets
   aangeraakt. Dat is LAT.md regel 10 op zijn kaalst: een route die niemand
   aanroept, blijft groen bij elke fout die erin komt -- de dekkingsmeter sloeg
   uit, en er was niets dat hem liet uitslaan.

   DE VALKUIL BIJ HET REPAREREN IS GROTER DAN HET GAT ZELF. Zes keer een lege
   POST doen tot er een 200 terugkomt, vult de teller en toetst niets: dat is
   een toets die niet kan zakken, en die is slechter dan geen toets (LAT.md
   regel 9). Daarom draagt elke aanroep hier een bewering die iets kan zeggen
   over de code eronder, en zijn dat er drie soorten:

     1. WAT ER IN HET ANTWOORD MOET STAAN, en dan niet "er is een lijst" maar
        de GETALLEN waarop een bestuur stuurt: hoeveel rapportagemomenten staan
        open, hoeveel staat er nog op voorraad, hoeveel mensen staan op de
        wachtlijst, hoeveel grote giften wachten nog op een oordeel. Een lijst
        zonder die getallen is een archief, en een toets die alleen de lijst
        telt, merkt niet dat ze verkeerd worden gerekend.

     2. HET GEVOLG VAN EEN SCHRIJFACTIE, TERUGGELEZEN VIA DEZELFDE ROUTE. Elke
        lijst wordt hier minstens twee keer gelezen: voor en na een uitgifte,
        een incheck, een bevestiging, een herkomstoordeel. Wat de eerste lezing
        beweert, moet de tweede tegenspreken -- anders leest de route iets dat
        met de werkelijkheid niets te maken heeft.

     3. DE POORT DIE DICHTGAAT. Zonder kantoorsessie (401), op een stad die niet
        bestaat (404), op de stad van een ander (403), en -- bij de vergadering
        -- op het orgaan van een ander: een stadsbestuurder leest de notulen van
        het landelijke bestuur niet. Bij dat laatste staat er met opzet ook een
        geval NAAST dat wel mag, want een 403 die altijd komt bewijst alleen dat
        de sessie stuk is.

   WAT ER MET EEN MUTATIE IS NAGETROKKEN (LAT.md regel 2). Elk van de zes
   toetsen hieronder is een keer gezien terwijl hij zakte, met een tijdelijke
   wijziging in de kern (in een kopie van de boom, zodat de echte bestanden
   ongemoeid bleven):

     - subsidies.js, `totalen.openMomenten` laten tellen op ALLE momenten in
       plaats van de open: RAAK op 1, en pas bij de tweede lezing -- de eerste
       lezing ziet er met een fout getal nog goed uit;
     - voorraad.js, `rest(b)` laten rekenen zonder de afschrijvingen: RAAK op 2;
     - voorraad.js, `!overDatum(b)` uit `bijnaOver` halen: RAAK op 2, op de
       bewering dat de twee aandachtslijsten uit elkaar liggen;
     - activiteiten.js, `aanwezig` laten tellen op status 'ingeschreven':
       RAAK op 3, na het inchecken;
     - bestuur.js, `quorumVan` zonder de `+ 1`: RAAK op 4;
     - beleid.js, `openVoorMij` laten rekenen alsof iedereen landelijk is:
       RAAK op 5 -- het getal bewoog niet mee met de stad die tekende;
     - herkomst.js, de `mijn`-filter eruit: RAAK op 6, op de stadsbestuurder
       die daarmee de grote gift van de andere stad zag staan.

   Alle zeven zakten op hun eigen toets en lieten de andere vijf groen; een
   mutatie die alles laat zakken, bewijst niets.

   BIJ DE KEURING KWAMEN ER TWEE MUTATIES BIJ, en die legden allebei een gat
   bloot dat hierboven nog niet gedekt was:

     - bestuur.js, `zetelsIn` voor een stadsvergadering laten teruggeven wat er
       bij het aanmaken als `omvang` werd MEEGEGEVEN in plaats van de zetels te
       tellen: RAAK op 4. Dat de landelijke vergadering wel met de opgegeven
       omvang rekent en de stad met haar echte zetels, stond nergens vast --
       een stad kon zo haar eigen quorum opgeven;
     - basis.js, de gedeelde 403 uit `poort` de stadsnaam afnemen: RAAK op 1, 2
       EN 3. Dat die er drie tegelijk raakt is met opzet: toetsen 1 en 2 keken
       al of de weigering de stad noemt, toets 3 nam met de kale 403 genoegen en
       bleef bij deze mutatie groen. Nu niet meer -- een 403 om een heel andere
       reden (module uit, stad geblokkeerd) telt daar niet meer mee als bewijs
       dat de stadsgrens dichtzit.

   Draai los: node --test test/rtfos-bestuur.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfosbestuur-'));
const OFFICE_CODE = 'RTFOSBESTUUR-KEURING';

let srv, BASE, LAND, BESTUUR_A, STAD_A, STAD_B, PROJECT_A;

const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const os_ = (pad, body, tok) => post('/api/rtfos/' + pad, body, tok || LAND);

const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const kort = b => JSON.stringify(b).slice(0, 200);

// Dezelfde weg naar binnen als in test/rtfos-uitvoering.test.js: een echt
// account, gekoppeld aan de kantoorcode, dat daarna een kantoorsessie start.
async function kantoorLid(naam, mail, telefoon) {
  const reg = await post('/api/auth/register', { name: naam, email: mail, phone: telefoon,
    password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  assert.ok(reg.body.token, 'registreren mislukte: ' + kort(reg.body));
  await post('/api/account/koppel', { soort: 'kantoor', code: OFFICE_CODE }, reg.body.token);
  const start = await post('/api/account/start', { rol: 'kantoor' }, reg.body.token);
  assert.ok(start.body.token, 'kantoorsessie mislukte: ' + kort(start.body));
  const ik = await os_('ik', {}, start.body.token);
  return { office: start.body.token, key: ik.body.key };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  BASE = srv.base;
  LAND = await kantoorAlsPersoon(BASE);
  assert.ok(LAND, 'geen kantoorsessie voor de eigenaar');

  /* TWEE STEDEN, en dat is geen decor: de helft van de beweringen hieronder
     gaat erover dat een lijst van de ENE stad de andere niet laat zien. Met een
     stad zou dat vanzelf waar zijn. */
  STAD_A = (await os_('stad/maak', { naam: 'Almelo' })).body.stad.id;
  STAD_B = (await os_('stad/maak', { naam: 'Assen' })).body.stad.id;
  for (const id of [STAD_A, STAD_B]) {
    await os_('stad/status', { id, status: 'actief' });
    for (const vlag of ['donations', 'subsidy_management', 'warehouse_management',
      'events', 'youth_programs', 'volunteer_management', 'clothing_distribution']) {
      await os_('stad/module', { id, vlag, aan: true });
    }
  }

  const a = await kantoorLid('Bestuur Almelo', 'bestuur.almelo@rtfosbestuur.test', '0612345681');
  BESTUUR_A = a.office;
  await os_('zetel', { stad: STAD_A, key: a.key, naam: 'Bestuur Almelo', rol: 'stadsbestuur' });

  const p = await os_('project/maak', { stad: STAD_A, naam: 'Kledingbank Almelo', soort: 'kleding',
    budget: 900, doelgroep: 'gezinnen' });
  assert.equal(p.status, 200, 'het proefproject kwam er niet: ' + kort(p.body));
  PROJECT_A = p.body.project.id;
  for (const st of ['aanvraag', 'beoordeling']) await os_('project/status', { id: PROJECT_A, status: st }, BESTUUR_A);
  for (const st of ['goedgekeurd', 'actief']) await os_('project/status', { id: PROJECT_A, status: st });
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------------------------------------------------------------------------
   1. /api/rtfos/subsidies -- de deur, en daarna de totalen

   Het subsidieregister is de plek waar een stichting haar verplichtingen
   bijhoudt. De drie getallen die ertoe doen staan in `totalen`: wat er is
   toegekend, hoeveel rapportagemomenten er open staan en hoeveel kansen er zijn
   gemist. Precies die drie worden hier nagerekend, want een lijst die ze
   verkeerd optelt ziet er even goed uit als een lijst die het goed doet.
   ------------------------------------------------------------------------- */
test('het subsidieregister opent alleen voor wie erbij mag, en telt wat er open staat', async () => {
  // zonder kantoorsessie is er geen register
  const anoniem = await post('/api/rtfos/subsidies', { stad: STAD_A });
  assert.equal(anoniem.status, 401, 'het subsidieregister ging open zonder inlog');
  assert.match(anoniem.body.error, /backoffice-sessie/);

  // een stad die niet bestaat is een 404 en geen lege lijst: een leeg antwoord
  // op een typefout leest als "er zijn geen subsidies".
  const nergens = await os_('subsidies', { stad: 'bestaat-niet' });
  assert.equal(nergens.status, 404, kort(nergens.body));
  assert.match(nergens.body.error, /stadsafdeling bestaat niet/);

  // en de stad van een ander blijft dicht, met de naam van die stad erbij
  const vreemd = await os_('subsidies', { stad: STAD_B }, BESTUUR_A);
  assert.equal(vreemd.status, 403, 'Almelo las het subsidieregister van Assen');
  assert.match(vreemd.body.error, /Assen/);

  // een gemiste kans (deadline in het verleden, nog op "kans")
  const gemist = await os_('subsidie/maak', { stad: STAD_A, naam: 'Fonds Sluitpost', soort: 'fonds',
    verstrekker: 'Fonds Sluitpost', bedrag: 700, deadline: '2020-03-01' });
  assert.equal(gemist.status, 200, kort(gemist.body));

  // en een toegekende subsidie met een openstaand rapportagemoment
  const lopend = await os_('subsidie/maak', { stad: STAD_A, naam: 'Kledingbank Almelo 2026',
    soort: 'gemeente', verstrekker: 'Gemeente Almelo', bedrag: 3000, projectId: PROJECT_A, risico: 'hoog' });
  const id = lopend.body.subsidie.id;
  for (const st of ['in_voorbereiding', 'aangevraagd']) await os_('subsidie/status', { id, status: st });
  const toe = await os_('subsidie/status', { id, status: 'toegekend', bedrag: 3000 });
  assert.equal(toe.status, 200, kort(toe.body));
  const moment = await os_('subsidie/moment', { id, wat: 'tussenrapportage', datum: '2027-02-01' });
  assert.equal(moment.status, 200, kort(moment.body));

  // een subsidie in de ANDERE stad, die hier dus niet mag opduiken
  await os_('subsidie/maak', { stad: STAD_B, naam: 'Fonds Assen', soort: 'fonds',
    verstrekker: 'Fonds Drenthe', bedrag: 5000 });

  const lijst = await os_('subsidies', { stad: STAD_A });
  assert.equal(lijst.status, 200, kort(lijst.body));
  assert.equal(lijst.body.subsidies.length, 2, 'de lijst van Almelo telt niet twee subsidies');
  assert.equal(lijst.body.subsidies.every(s => s.stad === STAD_A), true,
    'er stond een subsidie van een andere stad in de lijst van Almelo');
  assert.equal(lijst.body.totalen.toegekend, 3000, 'het toegekende bedrag klopt niet');
  assert.equal(lijst.body.totalen.openMomenten, 1, 'het openstaande rapportagemoment wordt niet geteld');
  assert.equal(lijst.body.totalen.gemist, 1, 'de verstreken deadline komt niet terug als gemiste kans');
  assert.equal(lijst.body.totalen.risicoHoog, 1, 'de toegekende subsidie met hoog risico wordt niet geteld');
  // de keten komt mee, zodat een scherm de toegestane vervolgstappen niet verzint
  assert.deepEqual(lijst.body.keten.aangevraagd, ['toegekend', 'afgewezen'],
    'de statusketen komt niet mee uit de lijst');

  /* HET RAPPORTAGEMOMENT AFRONDEN, EN DEZELFDE ROUTE OPNIEUW LEZEN. Zonder deze
     tweede lezing zou "openMomenten: 1" ook kloppen bij een teller die vast
     staat op het aantal momenten. */
  const momentId = moment.body.subsidie.momenten[0].id;
  await os_('subsidie/moment', { id, momentId, af: true });
  const na = await os_('subsidies', { stad: STAD_A });
  assert.equal(na.body.totalen.openMomenten, 0, 'een afgerond rapportagemoment stond nog open in de lijst');
  assert.equal(na.body.subsidies.find(s => s.id === id).openMomenten, 0,
    'de subsidie zelf telt zijn afgeronde moment nog als open');
});

/* ---------------------------------------------------------------------------
   2. /api/rtfos/voorraad -- de aandachtslijst is het punt

   De voorraadlijst heeft een `aandacht`-blok: wat ligt er over de datum, en wat
   is er bijna over. Dat is het enige in die module waar iemand vandaag iets mee
   moet doen, en het is ook het enige dat niet vanzelf klopt -- het wordt bij
   elke lezing gerekend uit de houdbaarheidsdatum en het restant.
   ------------------------------------------------------------------------- */
test('de voorraadlijst rekent restant en houdbaarheid bij elke lezing opnieuw', async () => {
  const oud = await os_('voorraad/binnen', { stad: STAD_A, soort: 'voedsel', wat: 'blikken soep',
    aantal: 30, houdbaarTot: '2020-05-01', gever: 'Supermarkt Almelo', locatie: 'magazijn' });
  assert.equal(oud.status, 200, kort(oud.body));
  const bijna = await os_('voorraad/binnen', { stad: STAD_A, soort: 'voedsel', wat: 'melkpakken',
    aantal: 10, houdbaarTot: overDagen(3), locatie: 'koeling' });
  const kleding = await os_('voorraad/binnen', { stad: STAD_A, soort: 'kleding', wat: 'winterjassen',
    aantal: 20, waarde: 400, locatie: 'magazijn' });
  assert.equal(kleding.status, 200, kort(kleding.body));

  const eerst = await os_('voorraad', { stad: STAD_A });
  assert.equal(eerst.status, 200, kort(eerst.body));
  assert.equal(eerst.body.totalen.batches, 3);
  assert.equal(eerst.body.totalen.opVoorraad, 60, 'de optelling over de partijen klopt niet');
  assert.equal(eerst.body.totalen.waardeGeschat, 400, 'de geschatte waarde komt niet uit de partijen');

  /* De twee aandachtslijsten zijn NIET dezelfde lijst anders gesorteerd: de
     partij van 2020 hoort alleen bij "over de datum", de melk van over drie
     dagen alleen bij "bijna over", en de winterjassen bij geen van beide. */
  assert.deepEqual(eerst.body.aandacht.overDatum.map(b => b.id), [oud.body.batch.id],
    'de partij over de datum staat niet (alleen) in overDatum');
  assert.deepEqual(eerst.body.aandacht.bijnaOver.map(b => b.id), [bijna.body.batch.id],
    'de weekgrens van bijnaOver klopt niet');

  // vier jassen de deur uit, en de soep van 2020 afgeschreven
  const uit = await os_('voorraad/uit', { id: kleding.body.batch.id, aantal: 4, projectId: PROJECT_A });
  assert.equal(uit.status, 200, kort(uit.body));
  const af = await os_('voorraad/afschrijven', { id: oud.body.batch.id, aantal: 30, reden: 'over de datum' });
  assert.equal(af.status, 200, kort(af.body));

  const na = await os_('voorraad', { stad: STAD_A });
  assert.equal(na.body.totalen.opVoorraad, 26, 'uitgifte en afschrijving gaan niet van de voorraad af');
  assert.equal(na.body.totalen.uitgegeven, 4);
  assert.equal(na.body.totalen.afgeschreven, 30);
  assert.equal(na.body.totalen.batches, 3, 'een afgeschreven partij verdween uit de administratie');
  /* En dit is waar de aandachtslijst zich onderscheidt van een filter op datum:
     wat er niet meer ligt, vraagt geen aandacht meer. */
  assert.deepEqual(na.body.aandacht.overDatum, [],
    'de afgeschreven partij stond nog steeds als "ligt over de datum in het magazijn"');
  assert.equal(na.body.batches.find(b => b.id === kleding.body.batch.id).restant, 16);

  // en ook hier: de stad van een ander gaat niet open
  const vreemd = await os_('voorraad', { stad: STAD_B }, BESTUUR_A);
  assert.equal(vreemd.status, 403, 'Almelo keek in het magazijn van Assen');
  assert.match(vreemd.body.error, /Assen/);
});

/* ---------------------------------------------------------------------------
   3. /api/rtfos/activiteiten -- de tellingen aan de deur

   Wat een activiteitenlijst moet dragen zijn de vier tellingen waarop een
   coordinator stuurt: hoeveel plekken, hoeveel ingeschreven, hoeveel op de
   wachtlijst, hoeveel binnen. Die komen alle vier uit de inschrijvingen en
   worden gerekend, niet opgeslagen -- dus ze zijn precies het soort getal dat
   stil verkeerd kan gaan staan.
   ------------------------------------------------------------------------- */
test('de activiteitenlijst telt plekken, wachtlijst en aanwezigen mee met wat er gebeurt', async () => {
  const jaar = overDagen(365);
  const v = await os_('vrijwilliger/maak', { stad: STAD_A, naam: 'Begeleider Werkplaats' });
  await os_('vrijwilliger/zet', { id: v.body.vrijwilliger.id, status: 'actief', gedragscode: true, vogGeldigTot: jaar });

  const w = await os_('activiteit/maak', { stad: STAD_A, naam: 'Fietswerkplaats', soort: 'workshop',
    capaciteit: 1, wanneer: '2026-10-03', locatie: 'buurthuis' });
  assert.equal(w.status, 200, kort(w.body));
  const id = w.body.activiteit.id;
  const maaltijd = await os_('activiteit/maak', { stad: STAD_A, naam: 'Buurtmaaltijd', soort: 'buurtmaaltijd',
    capaciteit: 40, wanneer: '2026-10-10' });

  const gepland = await os_('activiteiten', { stad: STAD_A });
  assert.equal(gepland.status, 200, kort(gepland.body));
  assert.equal(gepland.body.activiteiten.length, 2);
  const rij = gepland.body.activiteiten.find(a => a.id === id);
  assert.equal(rij.status, 'gepland', 'een nieuwe activiteit staat niet op gepland');
  assert.equal(rij.jeugd, true, 'een workshop wordt niet als jeugdactiviteit herkend');
  assert.equal(rij.begeleiders, 0);
  assert.equal(gepland.body.activiteiten.find(a => a.id === maaltijd.body.activiteit.id).jeugd, false,
    'een buurtmaaltijd werd als jeugdactiviteit gemarkeerd');
  // de soortenlijsten komen mee, zodat het scherm de jeugdregel niet zelf verzint
  assert.equal(gepland.body.jeugdsoorten.includes('workshop'), true);
  assert.equal(gepland.body.jeugdsoorten.includes('buurtmaaltijd'), false);

  await os_('activiteit/begeleiders', { id, ids: [v.body.vrijwilliger.id] });
  await os_('activiteit/zet', { id, veiligheidsplan: 'twee begeleiders, gereedschap achter slot' });
  const open = await os_('activiteit/open', { id });
  assert.equal(open.status, 200, kort(open.body));

  const een = await os_('activiteit/inschrijven', { id, codenaam: 'HV-FIETS1' });
  const twee = await os_('activiteit/inschrijven', { id, codenaam: 'HV-FIETS2' });
  assert.equal(twee.body.inschrijving.status, 'wachtlijst', 'de tweede kwam er bij een capaciteit van een gewoon bij');

  const vol = await os_('activiteiten', { stad: STAD_A });
  const rijVol = vol.body.activiteiten.find(a => a.id === id);
  assert.equal(rijVol.status, 'vol', 'de lijst laat een volle activiteit als open zien');
  assert.equal(rijVol.ingeschreven, 1, 'de lijst telt de wachtlijst mee als ingeschreven');
  assert.equal(rijVol.wachtlijst, 1, 'de wachtlijst wordt niet apart geteld');
  assert.equal(rijVol.aanwezig, 0, 'er stond iemand aanwezig voordat de deur openging');
  assert.equal(rijVol.begeleiders, 1);

  // en na het inchecken telt dezelfde lijst een aanwezige, en staat de activiteit bezig
  const binnen = await os_('activiteit/incheck', { id, checkinCode: een.body.inschrijving.checkinCode });
  assert.equal(binnen.status, 200, kort(binnen.body));
  const bezig = await os_('activiteiten', { stad: STAD_A });
  const rijBezig = bezig.body.activiteiten.find(a => a.id === id);
  assert.equal(rijBezig.aanwezig, 1, 'de ingecheckte deelnemer komt niet terug in de lijst');
  assert.equal(rijBezig.ingeschreven, 1,
    'wie binnen is telde niet meer mee, terwijl hij nog steeds een van de plekken bezet');
  assert.equal(rijBezig.status, 'bezig', 'de activiteit bleef op vol staan terwijl er iemand binnen was');

  // de lijst is van de stad, niet van het land -- en de weigering noemt de stad
  // waarop hij slaat, zodat een 403 om een heel andere reden hier niet meetelt
  const vreemd = await os_('activiteiten', { stad: STAD_B }, BESTUUR_A);
  assert.equal(vreemd.status, 403, 'Almelo las de agenda van Assen');
  assert.match(vreemd.body.error, /Assen/);
});

/* ---------------------------------------------------------------------------
   4. /api/rtfos/vergadering -- een notulenstuk opvragen

   Deze route is de enige manier om EEN vergadering met al haar besluiten op te
   halen; de lijst geeft ze ook, maar dit is wat een notulenscherm opent. Twee
   dingen zijn hier de moeite: dat het quorum GEREKEND terugkomt (het aantal
   zetels verandert, de vergadering niet), en dat de deur per ORGAAN dichtzit --
   een stadsbestuurder leest de landelijke notulen niet.
   ------------------------------------------------------------------------- */
test('een vergadering opvragen geeft het gerekende quorum, en niet aan het verkeerde orgaan', async () => {
  const v = await os_('vergadering/maak', { soort: 'landelijk', datum: '2026-09-14', plaats: 'Utrecht',
    omvang: 5, agenda: ['jaarplan'] });
  assert.equal(v.status, 200, kort(v.body));
  const id = v.body.vergadering.id;
  await os_('vergadering/agenda', { id, punt: 'kledingbank Almelo' });
  await os_('vergadering/presentie', { id, aanwezig: ['rahul', 'nadia', 'joost'], afwezig: ['tim', 'els'] });
  const besluit = await os_('vergadering/besluit', { id, onderwerp: 'kledingbank Almelo',
    tekst: 'het project krijgt drieduizend euro', voor: ['rahul', 'nadia'], tegen: ['joost'] });
  assert.equal(besluit.status, 200, kort(besluit.body));

  const een = await os_('vergadering', { id });
  assert.equal(een.status, 200, kort(een.body));
  assert.equal(een.body.vergadering.id, id);
  assert.equal(een.body.vergadering.omvang, 5);
  assert.equal(een.body.vergadering.quorum, 3, 'vijf bestuurders geeft een quorum van drie');
  assert.equal(een.body.vergadering.heeftQuorum, true, 'drie van de vijf aanwezig is geen quorum volgens het antwoord');
  assert.deepEqual(een.body.vergadering.agenda, ['jaarplan', 'kledingbank Almelo'],
    'het bijgeschreven agendapunt staat niet in het opgevraagde stuk');
  assert.equal(een.body.vergadering.besluiten.length, 1);
  assert.equal(een.body.vergadering.besluiten[0].aangenomen, true, '2 voor tegen 1 tegen is aangenomen');
  assert.deepEqual(een.body.vergadering.besluiten[0].tegen, ['joost'],
    'de tegenstem staat niet in het opgevraagde stuk');
  assert.equal(een.body.vergadering.vastgesteld, null, 'een verse vergadering stond al als vastgesteld');

  // een vergadering die niet bestaat is een 404, geen leeg stuk
  const weg = await os_('vergadering', { id: 'bestaatniet' });
  assert.equal(weg.status, 404, kort(weg.body));
  assert.match(weg.body.error, /vergadering bestaat niet/);

  // de landelijke notulen zijn niet van de stad
  const stad = await os_('vergadering', { id }, BESTUUR_A);
  assert.equal(stad.status, 403, 'een stadsbestuurder las de landelijke notulen');
  assert.match(stad.body.error, /landelijke bestuur/);

  /* EN NU HET GEVAL DAT WEL MOET LUKKEN, want een 403 die altijd komt zegt
     alleen dat de sessie stuk is. Dezelfde sessie, dezelfde route, een
     vergadering van het eigen orgaan. */
  const eigen = await os_('vergadering/maak', { soort: 'stad', stad: STAD_A, datum: '2026-09-21',
    plaats: 'buurthuis', omvang: 3 }, BESTUUR_A);
  assert.equal(eigen.status, 200, kort(eigen.body));
  const eigenLezen = await os_('vergadering', { id: eigen.body.vergadering.id }, BESTUUR_A);
  assert.equal(eigenLezen.status, 200, 'de stad kon haar eigen notulen niet opvragen');
  assert.equal(eigenLezen.body.vergadering.stad, STAD_A);

  /* En andersom: het landelijke bestuur mag WEL bij de notulen van een stad --
     de poort staat per orgaan open, niet per stad dicht. Een kale 200 zou hier
     te weinig zeggen (een lege of verkeerde vergadering is ook 200), dus het
     stuk dat terugkomt moet ook echt dat van Almelo zijn. */
  const landLeest = await os_('vergadering', { id: eigen.body.vergadering.id });
  assert.equal(landLeest.status, 200, 'het landelijke bestuur kwam niet bij de notulen van een stad');
  assert.equal(landLeest.body.vergadering.id, eigen.body.vergadering.id);
  assert.equal(landLeest.body.vergadering.stad, STAD_A,
    'het landelijke bestuur kreeg een ander stuk terug dan dat van Almelo');
  /* En hier komt het verschil met de landelijke vergadering hierboven boven
     water: die rekent met de OPGEGEVEN omvang (5), een stadsvergadering met de
     zetels die er echt zijn. Almelo heeft er een, en de `omvang: 3` die bij het
     aanmaken werd meegegeven telt dus niet mee -- anders zou een stad haar
     eigen quorum kunnen opgeven. */
  assert.equal(landLeest.body.vergadering.omvang, 1,
    'de opgegeven omvang overschreef het aantal zetels van de stad');
  assert.equal(landLeest.body.vergadering.quorum, 1,
    'het quorum van een stadsvergadering wordt niet uit haar zetels gerekend');
});

/* ---------------------------------------------------------------------------
   5. /api/rtfos/beleid -- "wat moet ik nog" is niet "wat staat er open"

   De beleidslijst draagt een getal dat nergens anders wordt gerekend:
   `openVoorMij`. Voor het landelijke bestuur is dat "welke regels heeft nog
   iemand niet bevestigd", voor een stad "welke moet IK nog". Dat verschil is de
   hele reden dat het getal in de kern staat en niet in het scherm -- en het is
   pas zichtbaar met twee steden, waarvan er een tekent.
   ------------------------------------------------------------------------- */
test('de beleidslijst zegt per lezer wat er nog open staat, en negeert wat nog niet geldt', async () => {
  const privacy = await os_('beleid/maak', { titel: 'Beeldmateriaal van kinderen', soort: 'privacy',
    tekst: 'Geen herkenbare foto van een minderjarige zonder schriftelijke toestemming van beide ouders.' });
  assert.equal(privacy.status, 200, kort(privacy.body));
  const inkoop = await os_('beleid/maak', { titel: 'Inkoop boven duizend euro', soort: 'inkoop',
    tekst: 'Boven duizend euro zijn er twee offertes nodig, en de keuze wordt schriftelijk onderbouwd.' });
  assert.equal(inkoop.status, 200, kort(inkoop.body));
  const later = await os_('beleid/maak', { titel: 'Reiskostenregeling 2027', soort: 'financieel',
    tekst: 'Reiskosten worden vergoed op basis van het laagste openbaarvervoertarief, achteraf en met bewijs.',
    ingangsdatum: overDagen(90) });
  assert.equal(later.status, 200, kort(later.body));

  const land = await os_('beleid', {});
  assert.equal(land.status, 200, kort(land.body));
  assert.equal(land.body.aantal, 3);
  assert.equal(land.body.openVoorMij, 2,
    'de regel die pas over drie maanden ingaat werd het landelijke bestuur al aangerekend');
  const rijLater = land.body.regels.find(r => r.id === later.body.regel.id);
  assert.equal(rijLater.vanKracht, false, 'een regel met een toekomstige ingangsdatum gold al');
  assert.deepEqual(rijLater.open, [], 'een regel die nog niet geldt zette de steden al in gebreke');

  // filteren op soort levert echt een deelverzameling op
  const alleenPrivacy = await os_('beleid', { soort: 'privacy' });
  assert.equal(alleenPrivacy.body.aantal, 1, 'het filter op soort levert niet een regel op');
  assert.equal(alleenPrivacy.body.regels[0].id, privacy.body.regel.id);

  // voor Almelo staan dezelfde twee open -- nog
  const voor = await os_('beleid', {}, BESTUUR_A);
  assert.equal(voor.body.openVoorMij, 2, 'Almelo begint niet met twee openstaande regels');

  const teVroeg = await os_('beleid/bevestig', { id: later.body.regel.id, stad: STAD_A }, BESTUUR_A);
  assert.equal(teVroeg.status, 400, 'een regel kon worden bevestigd voordat hij inging');
  assert.match(teVroeg.body.error, /gaat pas in op/);

  const getekend = await os_('beleid/bevestig', { id: privacy.body.regel.id, stad: STAD_A }, BESTUUR_A);
  assert.equal(getekend.status, 200, kort(getekend.body));

  /* DE TWEE LEZINGEN NAAST ELKAAR. Voor Almelo staat er nog een open, voor het
     landelijke bestuur nog steeds twee -- want Assen heeft niets getekend. Zou
     `openVoorMij` gewoon "alle open regels" tellen, dan waren die twee getallen
     gelijk gebleven en zou niemand het merken. */
  const na = await os_('beleid', {}, BESTUUR_A);
  assert.equal(na.body.openVoorMij, 1, 'de bevestiging van Almelo veranderde niets aan het eigen getal');
  const landNa = await os_('beleid', {});
  assert.equal(landNa.body.openVoorMij, 2,
    'de handtekening van Almelo haalde de regel ook voor Assen van de lijst');
  const rijPrivacy = landNa.body.regels.find(r => r.id === privacy.body.regel.id);
  assert.deepEqual(rijPrivacy.bevestigd.map(b => b.stad), [STAD_A]);
  assert.deepEqual(rijPrivacy.open.map(o => o.stad), [STAD_B],
    'na de bevestiging van Almelo staat Assen niet meer als openstaand in de lijst');
});

/* ---------------------------------------------------------------------------
   6. /api/rtfos/herkomst -- de lijst met giften die stilstaan

   Deze lijst is het werkbakje van het landelijke bestuur: welke grote of
   contante giften wachten nog op een oordeel. Er zitten twee dingen in die
   alleen met tegenvoorbeelden te toetsen zijn -- de twee drempels (tienduizend
   gewoon, vijfhonderd contant) en het feit dat een stad hier alleen haar eigen
   giften ziet.
   ------------------------------------------------------------------------- */
test('de herkomstlijst toont wat stilstaat, per drempel en per stad', async () => {
  const groot = await os_('bron/maak', { stad: STAD_A, soort: 'donatie', gever: 'Erfenis mevrouw De Wit',
    bedrag: 25000 });
  assert.equal(groot.status, 200, kort(groot.body));
  const contant = await os_('bron/maak', { stad: STAD_A, soort: 'donatie', gever: 'Collecte kerk',
    bedrag: 600, kenmerk: 'contant' });
  /* HET TEGENVOORBEELD BIJ ALLEBEI DE DREMPELS, want zonder die twee zou "hij
     staat in de lijst" ook waar zijn bij een controle die altijd afgaat. */
  const zeshonderdGiraal = await os_('bron/maak', { stad: STAD_A, soort: 'donatie', gever: 'Buurtvereniging',
    bedrag: 600 });
  assert.equal(zeshonderdGiraal.body.melding, undefined,
    'een gewone gift van 600 euro werd als grote gift gemarkeerd');
  const subsidie = await os_('bron/maak', { stad: STAD_A, soort: 'subsidie', gever: 'Gemeente Almelo',
    bedrag: 40000 });
  assert.equal(subsidie.body.melding, undefined, 'een gemeentesubsidie kwam in de witwascontrole terecht');
  // en een grote gift in de andere stad, voor de scheiding verderop
  const assen = await os_('bron/maak', { stad: STAD_B, soort: 'donatie', gever: 'Anonieme gever Assen',
    bedrag: 12000 });
  assert.equal(assen.status, 200, kort(assen.body));

  const lijst = await os_('herkomst', {});
  assert.equal(lijst.status, 200, kort(lijst.body));
  assert.equal(lijst.body.aantal, 3, 'de lijst bevat niet precies de drie giften die boven een drempel uitkomen');
  assert.equal(lijst.body.open, 3, 'niet alle drie de controles staan open');
  assert.equal(lijst.body.drempel, 10000, 'de drempel komt niet mee, dus het scherm moet hem verzinnen');
  assert.equal(lijst.body.contantDrempel, 500);
  assert.deepEqual(lijst.body.uitkomsten, ['akkoord', 'akkoord_met_voorwaarde', 'geweigerd']);
  const bedragen = lijst.body.controles.map(c => c.bedrag).sort((a, b) => a - b);
  assert.deepEqual(bedragen, [600, 12000, 25000],
    'de girale gift van 600 of de subsidie van 40.000 staat in de controlelijst');
  const rijContant = lijst.body.controles.find(c => c.bronId === contant.body.bron.id);
  assert.match(rijContant.reden, /contante gift boven 500/, 'de contante drempel wordt niet als reden genoemd');

  // filteren op stad, en de stad die zelf kijkt ziet alleen zichzelf
  const alleenA = await os_('herkomst', { stad: STAD_A });
  assert.equal(alleenA.body.aantal, 2, 'het filter op stad levert niet de twee giften van Almelo op');
  const doorAlmelo = await os_('herkomst', {}, BESTUUR_A);
  assert.equal(doorAlmelo.body.aantal, 2, 'Almelo zag de grote gift van Assen in haar eigen lijst staan');
  assert.equal(doorAlmelo.body.controles.every(c => c.stad === STAD_A), true,
    'er stond een gift van een andere stad in de lijst van Almelo');

  /* EEN OORDEEL, EN DEZELFDE LIJST OPNIEUW. De beoordeelde gift verdwijnt uit
     het open-filter maar niet uit de lijst: wat gecontroleerd is, blijft
     zichtbaar met zijn uitkomst. */
  const oordeel = await os_('herkomst/beoordeel', { bronId: groot.body.bron.id, uitkomst: 'akkoord',
    herkomstGeld: 'nalatenschap, afwikkeling via notaris Van Dijk in maart 2026' });
  assert.equal(oordeel.status, 200, kort(oordeel.body));

  const na = await os_('herkomst', {});
  assert.equal(na.body.aantal, 3, 'de afgeronde controle verdween uit de lijst');
  assert.equal(na.body.open, 2, 'de afgeronde controle telde nog mee als open');
  assert.equal(na.body.controles.find(c => c.bronId === groot.body.bron.id).status, 'afgerond');
  const openBak = await os_('herkomst', { open: true });
  assert.equal(openBak.body.aantal, 2, 'het open-filter laat de afgeronde controle nog staan');
  assert.equal(openBak.body.controles.some(c => c.bronId === groot.body.bron.id), false,
    'de beoordeelde gift stond nog in het werkbakje');
});
