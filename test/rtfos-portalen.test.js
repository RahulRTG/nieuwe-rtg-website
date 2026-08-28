/* ============================================================================
   HET FOUNDATION OS: DE PORTALEN EN DE DOSSIERS

   Dit derde toetsbestand dekt wat de eerste twee lieten liggen: de code-deuren
   naar buiten (partnerstichting en lokale ondernemer), en de dossierkant van
   projecten, vrijwilligers en zetels.

   HET IS ER GEKOMEN DOOR EEN FOUT IN MIJN EIGEN ROUTELAAG, en dat hoort er
   eerlijk bij te staan. De routes werden eerst geregistreerd met een hulpje dat
   het pad OPBOUWDE (`app.post('/api/rtfos/' + pad, ...)`). Dat werkte, maar
   vier meters van dit huis lezen de bron met een regex op een letterlijk pad:
   de poort-audit (check.js regel 28), de dubbele-routecontrole (regel 31),
   scripts/schakelbaar.js en de routekaart. Die zagen EEN route, `/api/rtfos/`,
   in plaats van vijfentachtig. Alles stond op groen omdat er niets te zien was.

   Sinds de paden letterlijk zijn, ziet de poort-audit ze wel -- nagetrokken met
   een mutatie: `officeAuth` weghalen bij een route liet regel 28 zakken met die
   route bij naam. En pas daarna werd zichtbaar dat vierentwintig van die routes
   nog nooit door een toets waren aangeraakt. Dit bestand raakt ze, met echte
   beweringen en niet met een rondje langs de deuren.

   VIER GRENDELS DIE HIER VOOR HET EERST WORDEN GETOETST:

     1. een budgetverhoging na goedkeuring zet een project terug op beoordeling
        -- anders keurt de stad 2.000 euro goed en staat er de volgende dag
        40.000;
     2. uren boeken kan alleen op een project waar de vrijwilliger op staat;
     3. een afdeling die zonder stadsbestuur komt te staan, meldt dat luid --
        en dat is een REPARATIE: hier stond eerst een grendel die in een
        onbereikbare tak zat en waar geen enkele toets op zakte;
     4. een rapportage zonder knelpunt bestaat niet -- een rapportage waarin
        nooit iets misgaat, wordt niet gelezen maar afgevinkt.

   Mutaties (LAT.md regel 2), vijf stuks, elk op hun eigen bewering en met de
   andere groen: de budgetgrendel, de urenkoppeling, de rapportage-knelpunt, en
   het lekken van de interne beoordeling naar het partnerportaal waren alle
   vier RAAK. De vijfde -- de "laatste stadsbestuur"-grendel -- sloeg AF, en dat
   was de nuttigste: die grendel bleek onbereikbaar (een stadsbestuur kan
   sowieso geen stadsbestuur-zetel intrekken, en voor landelijk werd hij
   expliciet overgeslagen). Hij is vervangen door een luide melding plus een
   auditregel, en daar bijt de mutatie nu wel.

   Draai los: node --test test/rtfos-portalen.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfos3-'));
const OFFICE_CODE = 'RTFOS3-KEURING';

let srv, BASE, LAND, STAD, PROJECT, PARTNER, PARTNERCODE, LEIDER, LEIDERKEY;

const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const os_ = (pad, body, tok) => post('/api/rtfos/' + pad, body, tok || LAND);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  BASE = srv.base;
  LAND = await kantoorAlsPersoon(BASE);
  assert.ok(LAND, 'geen kantoorsessie voor de eigenaar');

  STAD = (await os_('stad/maak', { naam: 'Rotterdam' })).body.stad.id;
  await os_('stad/status', { id: STAD, status: 'actief' });
  for (const vlag of ['youth_programs', 'donations', 'volunteer_management', 'individual_cases',
    'business_sponsorships', 'municipal_reporting', 'subsidy_management']) {
    await os_('stad/module', { id: STAD, vlag, aan: true });
  }

  // een tweede mens, want indienen en goedkeuren zijn twee handen
  const reg = await post('/api/auth/register', { name: 'Leider Rotterdam', email: 'leider.rotterdam@rtfos.test',
    phone: '0612345672', password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  await post('/api/account/koppel', { soort: 'kantoor', code: OFFICE_CODE }, reg.body.token);
  LEIDER = (await post('/api/account/start', { rol: 'kantoor' }, reg.body.token)).body.token;
  LEIDERKEY = (await os_('ik', {}, LEIDER)).body.key;
  await os_('zetel', { stad: STAD, key: LEIDERKEY, naam: 'Leider Rotterdam', rol: 'projectleider' });

  const p = await os_('project/maak', { stad: STAD, naam: 'Huiswerkklas Zuid', soort: 'jongeren',
    budget: 1000, doelgroep: 'jongeren' });
  PROJECT = p.body.project.id;
  await os_('project/status', { id: PROJECT, status: 'aanvraag' }, LEIDER);
  await os_('project/status', { id: PROJECT, status: 'beoordeling' }, LEIDER);
  await os_('project/status', { id: PROJECT, status: 'goedgekeurd' });
  await os_('project/status', { id: PROJECT, status: 'actief' });

  const pt = await os_('partner/maak', { stad: STAD, naam: 'Stichting Zuid Samen', kvk: '87654321',
    rsin: '123456789', doel: 'jongeren in Rotterdam-Zuid', werkgebied: 'Zuid' });
  PARTNER = pt.body.partner.id;
  PARTNERCODE = pt.body.partner.code;
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------------------------------------------------------------------------
   1. HET PARTNERPORTAAL: HET EIGEN DOSSIER, EN DRIE DICHTE DEUREN
   Beeindigd, opgeschort en verlopen zijn drie verschillende mededelingen met
   drie verschillende vervolgstappen. Een gedeelde 403 maakt er een raadsel van.
   ------------------------------------------------------------------------- */
test('het partnerportaal toont het eigen dossier, en drie dichte deuren zeggen drie dingen', async () => {
  // dossier vullen en de partner actief maken
  await os_('partner/zet', { id: PARTNER, iban: 'NL00BANK0123456789', van: '2026-01-01', tot: '2028-12-31',
    bestuurders: [{ naam: 'A. Jansen', functie: 'voorzitter' }],
    afspraken: { geld: 'rtf', vrijwilligers: 'partner', persoonsgegevens: 'partner', aansprakelijk: 'partner', rapportage: 'samen' },
    bevoegdheden: ['vrijwilligers plannen', 'activiteiten organiseren'] });
  await os_('partner/beoordeel', { id: PARTNER, cijfer: 8, tekst: 'goede eerste maanden, rapportage kan sneller' });
  await os_('partner/status', { id: PARTNER, status: 'in_toetsing' });
  await os_('partner/status', { id: PARTNER, status: 'goedgekeurd' });
  await os_('partner/document', { id: PARTNER, soort: 'overeenkomst', naam: 'Samenwerking 2026-2028' });
  await os_('partner/status', { id: PARTNER, status: 'actief' });

  const lijst = await os_('partners', { stad: STAD });
  assert.equal(lijst.status, 200);
  assert.equal(lijst.body.partners.length, 1);
  assert.equal(lijst.body.partners[0].beoordelingen.length, 1, 'de beoordeling staat niet in het kantoorbeeld');

  const portaal = await post('/api/rtfos/portaal/partner', { code: PARTNERCODE });
  assert.equal(portaal.status, 200, JSON.stringify(portaal.body).slice(0, 200));
  assert.equal(portaal.body.partner.naam, 'Stichting Zuid Samen');
  assert.equal(portaal.body.partner.afspraken.geld, 'rtf', 'de samenwerkingsafspraken staan niet in het portaal');
  /* HET OORDEEL IS VAN RTF EN KOMT NIET IN HET PORTAAL. Een oordeel dat je aan
     de beoordeelde toont, wordt een oordeel dat je niet meer durft op te
     schrijven. */
  assert.equal(JSON.stringify(portaal.body).includes('rapportage kan sneller'), false,
    'de interne beoordeling stond in het partnerportaal');
  assert.equal(JSON.stringify(portaal.body).includes('NL00BANK'), false,
    'het rekeningnummer stond in het portaal');

  // opgeschort, beeindigd en verlopen: drie zinnen
  await os_('partner/status', { id: PARTNER, status: 'opgeschort' });
  const op = await post('/api/rtfos/portaal/partner', { code: PARTNERCODE });
  assert.equal(op.status, 403);
  assert.match(op.body.error, /tijdelijk stil/);

  await os_('partner/status', { id: PARTNER, status: 'beeindigd' });
  const eind = await post('/api/rtfos/portaal/partner', { code: PARTNERCODE });
  assert.equal(eind.status, 403);
  assert.match(eind.body.error, /beeindigd/);
  assert.equal(eind.body.error === op.body.error, false, 'opgeschort en beeindigd geven dezelfde zin');

  // terug naar actief, maar met een verlopen looptijd
  await os_('partner/status', { id: PARTNER, status: 'in_toetsing' });
  await os_('partner/status', { id: PARTNER, status: 'goedgekeurd' });
  await os_('partner/status', { id: PARTNER, status: 'actief' });
  await os_('partner/zet', { id: PARTNER, tot: '2020-01-01' });
  const verlopen = await post('/api/rtfos/portaal/partner', { code: PARTNERCODE });
  assert.equal(verlopen.status, 403);
  assert.match(verlopen.body.error, /verlopen op 2020-01-01/);
  await os_('partner/zet', { id: PARTNER, tot: '2028-12-31' });
});

/* ---------------------------------------------------------------------------
   2. HET ONDERNEMERSPORTAAL: WAAR MIJN VIJFTIG MAALTIJDEN HEEN GINGEN
   Een bedrijf dat dat nooit hoort, geeft er ooit vijftig en daarna geen meer.
   ------------------------------------------------------------------------- */
test('het ondernemersportaal laat zien waar de bijdrage terechtkwam', async () => {
  const o = await os_('ondernemer/maak', { stad: STAD, naam: 'Restaurant De Kade', branche: 'horeca' });
  assert.equal(o.status, 200, JSON.stringify(o.body).slice(0, 200));
  const id = o.body.ondernemer.id;
  const code = o.body.ondernemer.code;

  const aanbod = await os_('ondernemer/aanbod', { id, soort: 'maaltijden',
    wat: 'vijftig maaltijden op dinsdag', aantal: 50, ritme: 'wekelijks', waarde: 375 });
  assert.equal(aanbod.status, 200, JSON.stringify(aanbod.body).slice(0, 200));
  const aanbodId = aanbod.body.ondernemer.aanbod[0].id;

  const lijst = await os_('ondernemers', { stad: STAD });
  assert.equal(lijst.body.openstaand.length, 1, 'het openstaande aanbod valt niet op');

  // benutten kan niet zolang niemand weet waar het heen ging
  const teVroeg = await os_('ondernemer/aanbod-status', { id, aanbodId, status: 'benut' });
  assert.equal(teVroeg.status, 400, 'aanbod kon benut heten zonder bestemming');
  assert.match(teVroeg.body.error, /eerst aan een project/);

  await os_('ondernemer/koppel', { id, aanbodId, projectId: PROJECT });
  const benut = await os_('ondernemer/aanbod-status', { id, aanbodId, status: 'benut' });
  assert.equal(benut.status, 200, JSON.stringify(benut.body).slice(0, 200));

  const portaal = await post('/api/rtfos/portaal/ondernemer', { code });
  assert.equal(portaal.status, 200, JSON.stringify(portaal.body).slice(0, 200));
  assert.equal(portaal.body.bedrijf.naam, 'Restaurant De Kade');
  assert.equal(portaal.body.impact.benut, 1);
  assert.equal(portaal.body.impact.waardeGeschat, 375);
  assert.deepEqual(portaal.body.impact.projecten, ['Huiswerkklas Zuid'],
    'het bedrijf ziet niet waar zijn maaltijden heen gingen');

  const onzin = await post('/api/rtfos/portaal/ondernemer', { code: 'RTFO-ZZZZZZZ' });
  assert.equal(onzin.status, 404);
});

/* ---------------------------------------------------------------------------
   3. HET PROJECTDOSSIER, EN DE BUDGETGRENDEL
   ------------------------------------------------------------------------- */
test('een budgetverhoging na goedkeuring zet het project terug op beoordeling', async () => {
  const voor = await os_('projecten', { stad: STAD });
  const p = voor.body.projecten.find(x => x.id === PROJECT);
  assert.equal(p.status, 'actief');
  assert.ok(p.besluit, 'er staat geen besluit bij een goedgekeurd project');

  // omlaag mag zonder nieuw besluit: minder geld is geen nieuw risico
  const omlaag = await os_('project/zet', { id: PROJECT, budget: 800 }, LEIDER);
  assert.equal(omlaag.body.project.status, 'actief', 'een verlaging gooide het besluit weg');

  // omhoog is een nieuw besluit
  const omhoog = await os_('project/zet', { id: PROJECT, budget: 40000 }, LEIDER);
  assert.equal(omhoog.body.project.status, 'beoordeling', 'het budget ging omhoog zonder nieuw besluit');
  assert.equal(omhoog.body.project.besluit, null, 'het oude besluit bleef staan bij een hoger budget');

  // en het nieuwe bedrag gaat boven de stadsgrens: dat is landelijk werk
  const stad = await os_('project/status', { id: PROJECT, status: 'goedgekeurd' }, LEIDER);
  assert.equal(stad.status, 403, 'de projectleider keurde 40.000 euro goed');
  const terug = await os_('project/zet', { id: PROJECT, budget: 1000 }, LEIDER);
  assert.equal(terug.body.project.status, 'beoordeling');
  const weer = await os_('project/status', { id: PROJECT, status: 'goedgekeurd' });
  assert.equal(weer.status, 200, JSON.stringify(weer.body).slice(0, 200));
  await os_('project/status', { id: PROJECT, status: 'actief' });
});

test('het projectdossier draagt activiteiten, bewijs en een rapportage met knelpunt', async () => {
  const act = await os_('project/activiteit', { id: PROJECT, tekst: 'huiswerkuur op dinsdag',
    wanneer: '2026-09-15', plek: 'buurthuis' }, LEIDER);
  assert.equal(act.status, 200, JSON.stringify(act.body).slice(0, 200));
  assert.equal(act.body.project.activiteiten.length, 1);

  const bewijs = await os_('project/bewijs', { id: PROJECT, naam: 'presentielijst september',
    soort: 'presentie', verwijzing: 'kluis://presentie-09' }, LEIDER);
  assert.equal(bewijs.status, 200);
  assert.equal(bewijs.body.project.bewijs.length, 1);

  /* EEN RAPPORTAGE ZONDER KNELPUNT BESTAAT NIET. Een rapportage waarin nooit
     iets misgaat wordt niet gelezen maar afgevinkt. */
  const zonder = await os_('project/rapportage', { id: PROJECT, periode: 'Q3 2026',
    gedaan: 'twaalf huiswerkuren gedraaid' }, LEIDER);
  assert.equal(zonder.status, 400, 'een rapportage zonder knelpunt kwam erdoor');
  assert.match(zonder.body.error, /knelpunt|lukte er niet/);

  const met = await os_('project/rapportage', { id: PROJECT, periode: 'Q3 2026',
    gedaan: 'twaalf huiswerkuren gedraaid', knelpunt: 'te weinig begeleiders op donderdag',
    resultaat: 'acht jongeren met een beter rapport' }, LEIDER);
  assert.equal(met.status, 200, JSON.stringify(met.body).slice(0, 200));
  assert.equal(met.body.project.rapportages.length, 1);
});

/* ---------------------------------------------------------------------------
   4. UREN EN EVALUATIES
   ------------------------------------------------------------------------- */
test('uren boeken kan alleen op een project waar de vrijwilliger op staat', async () => {
  const jaar = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const v = await os_('vrijwilliger/maak', { stad: STAD, naam: 'Vrijwilliger Zuid', contact: 'zuid@example.org' });
  const id = v.body.vrijwilliger.id;
  await os_('vrijwilliger/zet', { id, status: 'actief', gedragscode: true, vogGeldigTot: jaar,
    talen: ['Nederlands', 'Arabisch'], vaardigheden: ['huiswerkbegeleiding'], beschikbaar: ['di-a', 'do-a'], rijbewijs: true });

  const zonderKoppeling = await os_('vrijwilliger/uren', { id, uren: 3, projectId: PROJECT });
  assert.equal(zonderKoppeling.status, 400, 'er werden uren geboekt op een project waar hij niet op staat');
  assert.match(zonderKoppeling.body.error, /staat niet op dat project/);

  await os_('vrijwilliger/koppel', { id, projectId: PROJECT });
  const uren = await os_('vrijwilliger/uren', { id, uren: 3, projectId: PROJECT, datum: '2026-09-15', km: 12 });
  assert.equal(uren.status, 200, JSON.stringify(uren.body).slice(0, 200));
  assert.equal(uren.body.vrijwilliger.urenTotaal, 3);

  const teveel = await os_('vrijwilliger/uren', { id, uren: 30, projectId: PROJECT });
  assert.equal(teveel.status, 400, 'dertig uur op een dag werd geaccepteerd');

  const ev = await os_('vrijwilliger/evaluatie', { id, tekst: 'rustig, geduldig met de jongste groep' });
  assert.equal(ev.status, 200, JSON.stringify(ev.body).slice(0, 200));
  assert.equal(ev.body.vrijwilliger.evaluaties.length, 1);

  // de planner zoekt op wat er nodig is
  const zoek = await os_('vrijwilligers', { stad: STAD, taal: 'arab', dagdeel: 'di-a', vog: true, rijbewijs: true });
  assert.equal(zoek.body.aantal, 1, 'de planner vindt de vrijwilliger niet op taal, dagdeel, VOG en rijbewijs');
  const mis = await os_('vrijwilligers', { stad: STAD, taal: 'pools' });
  assert.equal(mis.body.aantal, 0, 'de zoekfilter laat iedereen door');
});

/* ---------------------------------------------------------------------------
   5. ZETELS EN KERNTEAM: DE LAATSTE STOEL BLIJFT STAAN
   ------------------------------------------------------------------------- */
test('het laatste stadsbestuur blijft staan, en het kernteam is een lijst namen', async () => {
  const reg = await post('/api/auth/register', { name: 'Bestuur Rotterdam', email: 'bestuur.rotterdam@rtfos.test',
    phone: '0612345673', password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  await post('/api/account/koppel', { soort: 'kantoor', code: OFFICE_CODE }, reg.body.token);
  const bestuurToken = (await post('/api/account/start', { rol: 'kantoor' }, reg.body.token)).body.token;
  const key = (await os_('ik', {}, bestuurToken)).body.key;
  const zetel = await os_('zetel', { stad: STAD, key, naam: 'Bestuur Rotterdam', rol: 'stadsbestuur' });
  assert.equal(zetel.status, 200, JSON.stringify(zetel.body).slice(0, 200));
  const zetelId = zetel.body.zetels.find(z => z.key === key).id;

  // een stadsbestuur kan geen tweede stadsbestuur aanstellen
  const tweede = await os_('zetel', { stad: STAD, key: 'user-999', naam: 'Nog een bestuur', rol: 'stadsbestuur' }, bestuurToken);
  assert.equal(tweede.status, 403, 'een stadsbestuur stelde een tweede stadsbestuur aan');

  // en het kan zijn eigen stoel niet intrekken: een stadsbestuur-zetel is
  // landelijk werk, in beide richtingen
  const zelf = await os_('zetel/weg', { id: zetelId }, bestuurToken);
  assert.equal(zelf.status, 403, 'het stadsbestuur trok zijn eigen zetel in');

  const kern = await os_('stad/kernteam', { id: STAD, namen: ['A. Jansen', 'B. de Wit'] }, bestuurToken);
  assert.equal(kern.status, 200, JSON.stringify(kern.body).slice(0, 200));
  assert.deepEqual(kern.body.kernteam, ['A. Jansen', 'B. de Wit']);

  /* LANDELIJK KAN HET WEL -- DAT IS HET VANGNET -- EN HET WORDT GEMELD.
     Hier stond eerst een grendel ("het laatste bestuur blijft staan") die in
     een onbereikbare tak zat: een mutatie die hem weghaalde liet geen enkele
     toets zakken. De reparatie is geen blokkade maar een luide mededeling; het
     landelijke bestuur buiten zijn eigen vangnet zetten zou erger zijn dan het
     gat dat het dicht. */
  const landelijk = await os_('zetel/weg', { id: zetelId });
  assert.equal(landelijk.status, 200, 'het landelijke bestuur kon de zetel niet intrekken');
  assert.equal(landelijk.body.zetels.some(z => z.id === zetelId), false, 'de zetel staat er nog');
  assert.equal(landelijk.body.zonderBestuur, true, 'een afdeling zonder stadsbestuur werd stil achtergelaten');
  assert.match(landelijk.body.melding, /geen stadsbestuur meer/);

  const spoor = await os_('audit', { wat: 'zetel.zonder-bestuur' });
  assert.equal(spoor.body.regels.length, 1, 'het wegvallen van het stadsbestuur staat niet in het auditspoor');

  // en de projectleider-zetel eronder kan een stadsbestuur wel intrekken --
  // anders bewijst de 403 hierboven alleen dat er iets dichtzit
  const nieuw = await os_('zetel', { stad: STAD, key: 'user-777', naam: 'Tijdelijke leider', rol: 'projectleider' });
  const leiderZetel = nieuw.body.zetels.find(z => z.key === 'user-777').id;
  const weg = await os_('zetel/weg', { id: leiderZetel });
  assert.equal(weg.status, 200, 'een projectleider-zetel liet zich niet intrekken');
  assert.equal(weg.body.zonderBestuur, true, 'de melding verdween bij een andere rol');
});

/* ---------------------------------------------------------------------------
   6. DE RAPPORTAGES EN DE OVERIGE REGISTERS
   Nul is geen uitkomst: wat niet is ingevuld staat als NIET GEMETEN.
   ------------------------------------------------------------------------- */
test('het stadsrapport en het landelijke beeld zeggen wat er niet is gemeten', async () => {
  const r = await os_('rapport', { stad: STAD });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.cijfers.mensen.gemeten, false, 'het rapport doet alsof nul mensen een meting is');
  assert.equal(r.body.cijfers.geld.kostenPerPersoon, null, 'er staat een kostprijs zonder geholpen mensen');

  await os_('project/deelnemers', { id: PROJECT, uniek: 24, herhaald: 9 }, LEIDER);
  const na = await os_('rapport', { stad: STAD });
  assert.equal(na.body.cijfers.mensen.gemeten, true);
  assert.equal(na.body.cijfers.mensen.uniekGeholpen, 24);

  const land = await os_('rapport/landelijk', {});
  assert.equal(land.status, 200, JSON.stringify(land.body).slice(0, 200));
  assert.equal(land.body.totaal.uniekGeholpen, 24);
  assert.equal(land.body.totaal.stedenZonderIndicatoren, 1,
    'een stad zonder indicatoren valt niet apart op in het landelijke beeld');

  // de overige registers antwoorden en zijn leeg zolang er niets is
  const casussen = await os_('casussen', { stad: STAD });
  assert.equal(casussen.status, 200);
  assert.equal(casussen.body.aantal, 0);
  const gemeenten = await os_('gemeenten', { stad: STAD });
  assert.equal(gemeenten.status, 200);
  assert.deepEqual(gemeenten.body.gemeenten, []);
});

test('een melding krijgt stappen, en een subsidie laat zich bijwerken', async () => {
  const m = await os_('melding/maak', { stad: STAD, soort: 'klacht', zwaarte: 'laag',
    tekst: 'de zaal was op dinsdag niet open en er stonden acht kinderen buiten' });
  assert.equal(m.status, 200, JSON.stringify(m.body).slice(0, 200));
  const stap = await os_('melding/stap', { id: m.body.melding.id, tekst: 'met de beheerder gesproken; sleutel ligt nu bij de projectleider' });
  assert.equal(stap.status, 200, JSON.stringify(stap.body).slice(0, 200));
  assert.equal(stap.body.melding.status, 'in_onderzoek', 'een melding met een stap bleef op open staan');

  const s = await os_('subsidie/maak', { stad: STAD, naam: 'Fonds Zuid', soort: 'fonds', bedrag: 500 });
  const zet = await os_('subsidie/zet', { id: s.body.subsidie.id, verstrekker: 'Fonds Zuid Rotterdam',
    risico: 'hoog', deadline: '2027-06-30', voorwaarden: ['minimaal 20 jongeren', 'eindrapport voor 1 juli'] });
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 200));
  assert.equal(zet.body.subsidie.risico, 'hoog');
  assert.equal(zet.body.subsidie.voorwaarden.length, 2);
});
