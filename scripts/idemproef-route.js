#!/usr/bin/env node
/* ============================================================================
   DE IDEMPOTENTIE, PER ROUTE -- de IDEMPOTENCY-kolom van de bewijsmatrix.

   Het oordeel staat in scripts/lib/idemproef.js (en is daar los te toetsen);
   dit script zet er een echte server omheen en schrijft IDEMPROEF.json.

   Derde in dezelfde familie: rolproef (verkeerde rol, plausibele invoer),
   invoerproef (juiste rol, rommel), idemproef (juiste rol, plausibele invoer,
   drie keer). Ze delen de wegwerpserver, de demo-tokens en het plausibele lijf,
   want drie definities van "plausibel" is drie plekken die uiteenlopen.

   DEZE PROEF MUTEERT ECHT, en meer dan de andere twee: hij voert per route
   twee opdrachten uit die kunnen slagen. Dat is de prijs van meten of een
   herhaling iets doet -- en de reden dat hij nooit ergens anders dan op een
   wegwerpmap draait.

   Draai:  node scripts/idemproef-route.js
           node scripts/idemproef-route.js --max=200
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { draaiIdemproef } = require('./lib/idemproef');
const { plausibelLijf } = require('./lib/rolproef');
const { alleRoutes, isSchakel, verdeelOpRol, meldZonderRol } = require('./lib/routes');
const { maakSleutels, haalSleutels, ONMISBAAR } = require('./lib/proefsleutels');
/* Wanneer is dit gemeten, en waartegen. Zonder stempel is een register niet na
   te lopen: verouderd ziet er identiek uit aan vers. Zie scripts/lib/stempel.js. */
const { stempel, eisSchoneBoom } = require('./lib/stempel');

/* WEIGEREN VOOR HET BEGINT. Deze ronde duurt minuten en levert een register op
   dat NERGENS meetelt zodra er ongecommit werk in de boom staat -- boomVuil
   wordt pas aan het eind vastgesteld. Zie de kop van ./lib/stempel.js voor de
   drie rondes die daar in een zitting aan zijn opgegaan. */
function wachtOpSchoneBoom() {
  const b = eisSchoneBoom('de idemproef');
  if (b.ok) return;
  console.error('\n  DEZE RONDE ZOU NIET MEETELLEN\n');
  console.error('  ' + b.reden);
  for (const r of (b.bestanden || [])) console.error('    ' + r);
  process.exit(3);
}

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'IDEMPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;   // 0 = alles

/* rolVan() woont in ./lib/routes.js, samen met de REDEN waarom een rol soms niet
   te bepalen valt. Hij stond hier woordelijk, en in drie andere proef-scripts nog
   eens -- vier kopieen van dezelfde afleiding (LAT.md regel 4). */


/* ALLEEN DOEN ALS IEMAND DIT BESTAND DRAAIT. Zonder deze wacht start een
   VOLLEDIGE meetronde zodra iets dit bestand require't -- een toets, de keuring,
   of iemand die alleen even wil kijken of het laadt. Dat is hier echt gebeurd:
   een onschuldige laadcontrole draaide de rolproef met de STANDAARDbegrenzing en
   schreef ROLPROEF.json van 3377 beproefde routes terug naar 292. Het register
   zag er daarna volkomen normaal uit.

   scripts/bewijsmatrix.js heeft deze wacht al sinds hij ooit de hele testrunner
   meenam. Dezelfde wacht hoort op elk instrument dat bij het draaien een register
   OVERSCHRIJFT. */
if (require.main !== module) { module.exports = {}; return; }
wachtOpSchoneBoom();

(async () => {
  /* DE GEDEELDE WEGWERPSERVER. Hier stond de eigen kopie die de kop al een
     maand ontkende ('ze delen de wegwerpserver') -- de tekst beloofde wat de
     code niet deed, en zo lopen kopieen uiteen zonder dat iemand het ziet
     (LAT.md regel 4 en 6, en de post wegwerpserver-kopieen in
     BEWIJSSCHULD.json). */
  /* HET TWEEDE MEETPUNT AANZETTEN, en waarom dat hier moest.

     Deze proef heeft twee meetpunten: het ANTWOORD, en de stand van de opslag
     via de kop X-RTG-Staat (server/staatlog.js). Het tweede is er niet voor de
     sier -- hij bestaat juist voor de routes waarvan het antwoord niet per
     oproep verandert, en die zijn met het eerste meetpunt per definitie niet te
     beoordelen. Er staat hieronder zelfs een hele ijking om de ruis eruit te
     halen.

     Alleen: staatlog gaat aan met RTG_STAATLOG, en die vlag stond hier nergens.
     De ijking draaide dus altijd op niets, het meetpunt meldde zichzelf als UIT,
     en 34 routes bleven "ongemeten" met de reden "het antwoord verandert niet
     per oproep; een tweede effect zou hier niet te zien zijn" -- terwijl het
     gereedschap om het wel te zien in dit bestand klaarlag. Zelfde soort gat als
     RTG_DEMO dat een no-op was geworden: de opstelling belooft iets wat de
     omgeving niet aanzet, en aan de uitslag is dat niet te zien.

     EN WAAROM STAND 2 EN NIET 1. Stand 1 telt alleen de LENGTE van de arrays;
     stand 2 telt ook de sleutels van objecten en neemt van allebei een
     inhoudsafdruk (server/staatlog.js). Dat verschil is precies het verschil dat
     hier overbleef: met stand 1 zien een LEESroute en een route die een bestaande
     rij OP ZIJN PLAATS bijwerkt er identiek uit -- de lengte beweegt in geen van
     beide gevallen -- en de proef zei dat ook eerlijk ("dat verschil ziet dit
     meetpunt niet"). Stand 2 ziet het wel, want de afdruk verandert. Hij kost
     een hash over de opslag per antwoord; dat is de prijs van een meetpunt dat
     iets kan zeggen in plaats van niets. */
  /* RTG_DOOS_SLEUTEL hoort bij de OPSTELLING, net als OFFICE_CODE: zonder die
     variabele bestaat de doosdeur helemaal niet, ook niet in productie
     (server/routes/doos.js). Hem hier zetten opent geen deur die anders dicht
     zou zijn -- het maakt de opstelling compleet. */
  const DOOS_SLEUTEL = 'proef-doos-sleutel-0123456789abcdef';
  const server = await start({ naam: 'idemproef',
    env: { RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF', RTG_STAATLOG: '2',
      RTG_DOOS_SLEUTEL: DOOS_SLEUTEL } });
  const { basis, klaar } = server;

  /* `extraKoppen` is er voor deuren die hun sleutel in een KOP verwachten en
     niet in het lijf -- de zaakdoos is de enige. Hem in de body meesturen zou
     een weg beproeven die de route niet kent. */
  const post = async (pad, lijf, tok, extraKoppen) => {
    try {
      const r = await fetch(basis + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json',
          ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(extraKoppen || {}) },
        body: JSON.stringify(lijf || {}) });
      const tekst = await r.text();
      let data; try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
      return { status: r.status, data, staat: r.headers.get('x-rtg-staat') };
    } catch (e) { return { status: 0, data: String(e.message) }; }
  };

  /* De sleutelbos staat in ./lib/proefsleutels.js: zes instrumenten hadden hier
     dezelfde drie rollen staan, en dus alle zes dezelfde blinde vlek voor alles
     achter boardroomAuth en techAuth. */
  const bos = maakSleutels({ post, officeCode: 'RTG-OFFICE-PROEF' });
  const inlog = bos.inlog;
  const { tokens, mislukt } = await haalSleutels(bos);
  const ontbreekt = ONMISBAAR.filter(r => !tokens[r]);
  if (ontbreekt.length) {
    console.error('geen token voor: ' + ontbreekt.join(', ') + ' -- de proef zou dan doen alsof die routes zijn beproefd');
    klaar(); process.exit(2);
  }
  /* `lijfsleutel` is geen inlog: de sleutel zit in het LIJF. Een undefined token
     hier zou de proef een Authorization-kop laten weglaten, en dat is precies
     goed -- maar het moet met opzet zo staan en niet per ongeluk. */
  /* `lijfsleutel` en `omgeving` zijn geen inlog: bij de eerste zit de sleutel in
     het LIJF, bij de tweede beslist het ADRES waar vandaan wordt aangeklopt.
     Allebei horen ze geen Authorization-kop op te leveren, en dat moet met
     opzet zo staan en niet per ongeluk. */
  const tokenVoor = (rol) => (['lijfsleutel', 'omgeving', 'eigen-poort'].includes(rol) ? '' : tokens[rol]);
  /* DE LIJFSLEUTELS -- deuren waar de sleutel in het LICHAAM reist en niet in de
     kop. Die hebben geen rol (zie scripts/lib/bewakers.js) en vielen daarmee uit
     elke proef, terwijl er wel degelijk een sleutel te MAKEN is. Zie de kop van
     ./lib/lijfsleutels.js voor waarom dat een tweede begrip is en geen rol. */
  const { bouwLijfsleutels } = require('./lib/lijfsleutels');
  const lijfsleutels = await bouwLijfsleutels({ post, tokens, datamap: server.datamap, doosSleutel: DOOS_SLEUTEL });
  console.log('  lijfsleutels gebouwd                 : ' +
    (lijfsleutels.gebouwd.length ? lijfsleutels.gebouwd.map(g => g.naam).join(', ') : 'GEEN') +
    (lijfsleutels.mislukt.length ? '   (mislukt: ' + lijfsleutels.mislukt.map(m => m.naam).join(', ') + ')' : ''));

  const hernieuw = async (rol) => {
    try { const t = await inlog[rol](); if (t) { tokens[rol] = t; return true; } } catch (e) {}
    return false;
  };

  /* DE GENREWERELD -- ./lib/wereld-genre.js. Twintig zaaksessies, elk bij de
     juiste soort bedrijf, want 235 routes worden niet op de ROL geweigerd maar
     op wat de zaak IS. Zie ./lib/genrezaken.js voor waarom dat een eigen rol
     wordt en geen variant van `supplier`. */
  const { zetGenreKlaar } = require('./lib/wereld-genre');
  const { genreRolVoor, rolVanZaak: genreRolVanZaak } = require('./lib/genrezaken');
  const { accountRolVoor } = require('./lib/accountroutes');
  const { persoonsRolVoor } = require('./lib/persoonsroutes');
  const genreWereld = await zetGenreKlaar({ post });
  for (const [code, tok] of Object.entries(genreWereld.tokens)) tokens[genreRolVanZaak(code)] = tok;
  console.log('  genrewereld                          : ' +
    (genreWereld.klaar ? 'klaar   (' + Object.keys(genreWereld.tokens).length + ' zaken)'
                       : 'NIET klaar -- ' + genreWereld.reden));
  for (const st of genreWereld.stappen) if (!st.ok || st.waarom) console.log('      ' + st.zaak + ': ' + st.waarom);

  const kandidaten = alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
    .filter(r => !isSchakel(r.pad))
    .filter(r => !r.pad.includes(':'));
  /* De verdeling in plaats van een filter. `.filter(r => r.rol)` liet hier
     honderden routes verdwijnen zonder dat er ergens een getal omhoog ging; nu
     komen ze met hun reden terug en staan ze straks ook in het uitslagbestand. */
  /* ALLEEN ROLLEN WAARVOOR DIT INSTRUMENT EEN TOKEN HEEFT. Sinds de
     bewakerskaart ook eigenrollen kent (boardroom, techniek, scim,
     werkplekbaas) kwamen 123 routes hier binnen als "met rol" terwijl er
     geen sleutel voor bestaat: de idemproef herhaalt een oproep MET de juiste rol; zonder token voor die rol
     wordt elke herhaling even hard geweigerd en zegt de gelijkheid niets.
     Ze komen nu met die reden terug in het uitslagbestand (LAT.md regel 3). */
  const verdeling = verdeelOpRol(kandidaten, Object.keys(tokens));
  /* DE ROLLEN WAARVOOR ER WERKELIJK EEN SLEUTEL IS, en niet de rollen die dit
     instrument kon PROBEREN. Hier stond Object.keys(inlog), en dat is subtiel
     iets anders: mislukt een inlog (geen demo-eigenaar in deze database), dan
     zou die rol toch als "beproefbaar" tellen, zonder token worden aangeroepen,
     401 krijgen en dat als uitslag opleveren. Een meting zonder invoer die toch
     een cijfer geeft -- LAT.md regel 3. */
  /* De routes met een LIJFSLEUTEL komen erbij. Ze dragen geen rol -- dat is
     juist -- maar deze proef kan ze wel openen. Ze krijgen rol `lijfsleutel`
     zodat ze in het uitslagbestand te herkennen zijn en niet stilzwijgend als
     een gewone rolroute meetellen. */
  const metLijf = verdeling.zonderRol
    .filter(r => lijfsleutels.dekt(r.pad))
    /* Vraagt de familie ook een SESSIE, dan krijgt de route die rol -- anders
       `lijfsleutel`, wat geen Authorization-kop oplevert. Dat verschil moet uit
       de familie komen en niet uit een gok hier. */
    .map(r => ({ methode: r.methode, pad: r.pad, rol: lijfsleutels.rolVoor(r.pad) || 'lijfsleutel' }));

  /* EEN FAMILIE MAG EEN ROL OOK OPWAARDEREN, en dat kon eerst niet.

     De Lifestyle-familie dekt vier takken waarvan de bewakerskaart terecht
     `member` zegt: de deur eist een ledensessie en verder niets, de
     PAS-controle zit in de handler. Die routes hebben dus AL een rol en vielen
     daarmee buiten `metLijf` -- de familie werd netjes gebouwd en deed
     vervolgens niets. Gemeten: FIXTURE_403 bleef staan op 668, en `met bewijs`
     ging drie omhoog in plaats van tweehonderd.

     Een familie met een rol wint daarom van de bewakerskaart, MAAR alleen bij
     dezelfde soort deur: de kaart zegt welke SESSIE er nodig is, de familie
     welke PAS die sessie moet dragen. Dat is geen tegenspraak maar een
     verfijning, en hij staat expliciet in het uitslagbestand zodat niemand
     denkt dat de kaart iets anders vond. */
  /* Het OORDEEL of een familie mag winnen, woont in ./lib/lijfsleutels.js
     (magOpwaarderen) en is daar los getoetst. Hier alleen de boekhouding. */
  const { magOpwaarderen } = require('./lib/lijfsleutels');
  const opgewaardeerd = [];
  const geweigerd = [];
  const naarGenre = [];
  const naarAccount = [];
  const naarPersoon = [];
  const metRol = verdeling.metRol.map(r => {
    /* EERST DE GENREZAAK. Die verfijnt `supplier` naar EEN bepaalde zaak en
       staat los van de lijfsleutelfamilies: hij zegt niet welke pas de sessie
       draagt maar bij welk soort bedrijf zij hoort. Alleen als er ook
       werkelijk een sessie voor die zaak is opgehaald -- anders zou de proef
       aankloppen zonder sleutel en dat meet niets. */
    const g = genreRolVoor(r.rol, r.pad);
    if (g.rol && tokens[g.rol]) { naarGenre.push({ pad: r.pad, naar: g.rol }); return { ...r, rol: g.rol, rolVan: r.rol }; }
    /* EN DE ACCOUNTSESSIE. Dezelfde vorm, andere vraag: niet bij welk soort
       bedrijf hoort deze route, maar heeft de ledensessie een ACCOUNT nodig in
       plaats van alleen een pas. Zie ./lib/accountroutes.js. */
    const a = accountRolVoor(r.rol, r.pad);
    if (a.rol && tokens[a.rol]) { naarAccount.push({ pad: r.pad }); return { ...r, rol: a.rol, rolVan: r.rol }; }
    /* EN DE PERSOONLIJKE LOGIN. Zelfde vorm nog een keer: niet welke zaak en
       niet welke pas, maar of er een PERSOON achter de sessie hoort te staan.
       Zie ./lib/persoonsroutes.js. */
    const w = persoonsRolVoor(r.rol, r.pad);
    if (w.rol && tokens[w.rol]) { naarPersoon.push({ pad: r.pad }); return { ...r, rol: w.rol, rolVan: r.rol }; }
    const familieRol = lijfsleutels.rolVoor(r.pad);
    const oordeel = magOpwaarderen(r.rol, familieRol);
    if (!familieRol || familieRol === r.rol) return r;
    if (!oordeel.mag) { geweigerd.push({ pad: r.pad, van: r.rol, naar: familieRol, reden: oordeel.reden }); return r; }
    opgewaardeerd.push({ pad: r.pad, van: r.rol, naar: familieRol });
    return { ...r, rol: familieRol, rolVan: r.rol };
  });
  if (naarPersoon.length) {
    console.log('  routes naar een persoonlijke login   : ' + naarPersoon.length);
  }
  if (naarAccount.length) {
    console.log('  routes naar een accountsessie        : ' + naarAccount.length);
  }
  if (naarGenre.length) {
    console.log('  routes naar een genrezaak            : ' + naarGenre.length +
      '   (' + new Set(naarGenre.map(x => x.naar)).size + ' zaken)');
  }
  if (geweigerd.length) {
    console.log('  opwaardering GEWEIGERD                : ' + geweigerd.length +
      '   (' + [...new Set(geweigerd.map(x => x.van + ' blijft ' + x.van))].join(', ') + ')');
  }
  if (opgewaardeerd.length) {
    console.log('  rol opgewaardeerd door een familie    : ' + opgewaardeerd.length +
      '   (' + [...new Set(opgewaardeerd.map(x => x.van + ' -> ' + x.naar))].join(', ') + ')');
  }
  const routes = metRol.concat(metLijf);
  console.log('  routes op een lijfsleutel            : ' + metLijf.length);

  console.log('\n=== DE IDEMPOTENTIE PER ROUTE ===\n');
  console.log('  routes gevonden                      : ' + kandidaten.length);
  console.log('  routes met een herkenbare rol        : ' + routes.length);
  meldZonderRol(verdeling);
  console.log('  oproepen per route                   : 3  (K1, K1 opnieuw, K2 vers)');

  /* DE WERELD KLAARZETTEN, VOOR ER GEMETEN WORDT -- ./lib/idemwereld.js.

     Het plausibele lijf is voor alle routes hetzelfde en weet niet welke IBAN of
     welke codenaam er in DEZE database bestaan; het gevolg was dat 2.221 routes
     hun eerste oproep zagen stranden op "deed geen werk". Een route die niets
     doet, kun je niet betrappen op een tweede keer doen. Daarom bouwt die module
     eerst een echte wereld (rekening, saldo, pas, vaste betaling, twee klompjes)
     en levert per geldroute het lijf met de veldnamen van DIE route. Waarom per
     route, en waarom de kredietroutes NIET worden opengebroken, staat daar. */
  const { zetWereldKlaar } = require('./lib/idemwereld');
  const { extra, perRoute: geldLijven } = await zetWereldKlaar({ post, tokens, login: inlog });
  console.log('  wereld klaargezet                    : ' +
    (Object.keys(extra).length ? Object.keys(extra).join(', ') : 'NIETS -- de proef meet dan als vanouds'));
  console.log('  geldroutes met een eigen lijf        : ' + Object.keys(geldLijven).length);

  /* DE OBJECTEN DIE DE ROUTES NODIG HEBBEN -- ./lib/objectoogst.js.

     1635 routes strandden op 404: het ding waar ze over gaan bestaat niet. Deze
     stap draait eerst de MAAKroutes van het huis en geeft het teruggegeven id
     mee aan de zusterroutes in dezelfde tak. Gemeten levert dat er 121 op 2xx
     en nog eens 53 voorbij de 404 -- ongeveer een op de tien, en geen
     vervanging voor domeinwerk.

     Hij draait NA de wereldopzet en de lijfsleutels, want een maakroute heeft
     die zelf nodig. */
  /* DE SCHOOLWERELD -- ./lib/wereld-school.js. Vier objecten die aan elkaar
     hangen (gezin, kind, leraar, klas) en die samen 87 routes uit de
     404-bak halen. Draait NA de lijfsleutels, want hij bouwt op de school- en
     gezinsleutel voort. */
  const { zetSchoolKlaar } = require('./lib/wereld-school');
  const schoolSleutels = {};
  for (const f of require('./lib/lijfsleutels').FAMILIES) {
    if (lijfsleutels.gebouwd.some(g => g.naam === f.naam)) schoolSleutels[f.naam] = lijfsleutels.lijfVoor(f.prefixen[0]);
  }
  const schoolWereld = await zetSchoolKlaar({ post, sleutels: schoolSleutels, datamap: server.datamap });
  console.log('  schoolwereld                         : ' + (schoolWereld.klaar ? 'klaar' : 'NIET klaar -- ' + schoolWereld.reden) +
    '   (' + schoolWereld.stappen.filter(x => x.ok).length + '/' + schoolWereld.stappen.length + ' stappen)');
  for (const st of schoolWereld.stappen.filter(x => !x.ok)) console.log('      niet gelukt: ' + st.naam + ' -- ' + st.waarom);

  /* DE HORECAWERELD -- ./lib/wereld-horeca.js. Geen nieuwe keten maar een
     oogst op de gastfamilie: bij het aanschuiven ontstaat een rekening, en
     twintig zaakroutes vragen om precies dat id. */
  const { zetHorecaKlaar } = require('./lib/wereld-horeca');
  const horecaWereld = await zetHorecaKlaar({ post, sleutels: schoolSleutels, tokens });
  console.log('  horecawereld                         : ' + (horecaWereld.klaar ? 'klaar' : 'NIET klaar -- ' + horecaWereld.reden));


  const { oogstObjecten } = require('./lib/objectoogst');
  const objecten = await oogstObjecten({
    post, routes, tokenVoor,
    lijfVoor: (r) => ({ ...plausibelLijf(r.pad), ...extra,
      ...(r.pad.startsWith('/api/foundation/school/') ? schoolWereld.extra : {}),
      ...(r.pad.startsWith('/api/supplier/horeca/') ? horecaWereld.extra : {}),
      ...(lijfsleutels.lijfVoor(r.pad) || {}) }),
    koppenVoor: (r) => lijfsleutels.koppenVoor(r.pad)
  });
  console.log('  objecten gemaakt voor de proef       : ' + objecten.gelukt + ' van ' +
    objecten.geprobeerd + ' maakroutes, in ' + objecten.takken + ' takken');
  /* En waarom de rest niets opleverde -- zonder die redenen is het getal
     hierboven niet te bewerken. Zie ./lib/objectoogst.js. */
  if (process.env.RTG_OOGST_VELDEN) {
    for (const m of (objecten.mislukt || []).filter(x => /geen herkenbaar id/.test(x.waarom))) {
      console.log('      GEEN-ID ' + m.pad + '  velden: ' + JSON.stringify(m.velden || []));
    }
  }
  for (const rd of (objecten.redenen || []).slice(0, 8)) {
    console.log('      ' + String(rd.aantal).padStart(4) + '  ' + rd.reden + '   | ' + rd.voorbeeld);
  }

  /* ============================================================================
     HET TWEEDE MEETPUNT IJKEN.

     Elk antwoord draagt de stand per collectie. Maar sommige collecties
     veranderen bij ELK verzoek -- `doorgeefjournaal` schrijft een regel per
     verzoek, ook bij lezen. Zonder die ruis eruit zou elke oproep "werk gedaan"
     lijken en was dit meetpunt meteen blind. In stand 2 weegt dit zwaarder dan
     in stand 1: een inhoudsafdruk ziet ook de tellers en tijdstempels die bij
     elk verzoek een tik krijgen, dus er is MEER te ijken en niet minder.

     Wie de ruis is, staat daarom nergens als lijst: we METEN het. Een handvol
     oproepen die niets doen (een leesroute), kijken wat er dan toch groeit, en
     dat uitsluiten. Een handgeschreven lijst zou stil verouderen zodra er een
     teller bij komt; deze ijking niet. Zelfde gedachte als de per-route ijking
     in de proef zelf: eerst zien dat de meter kan bewegen. */
  const staatlog = require('../server/staatlog');
  const ruis = new Set();
  let ijkStand = null, staatWerkt = false;
  {
    const eerste = await post('/api/pay/overzicht', {}, tokens.member);
    ijkStand = eerste.staat || null;
    for (let i = 0; i < 6 && ijkStand != null; i++) {
      const nu = await post('/api/pay/overzicht', {}, tokens.member);
      if (nu.staat == null) break;
      for (const k of Object.keys(staatlog.verschil(ijkStand, nu.staat))) ruis.add(k);
      ijkStand = nu.staat;
    }
    staatWerkt = ijkStand != null;
  }
  /* DE VASTLEGGING wordt hier NIET geijkt, en dat is een gemeten keuze. Deze
     ijking draait op een LEESroute en vindt daarmee alleen wat bij ELK verzoek
     groeit (`doorgeefjournaal`). Collecties die bij elke HANDELING een regel
     schrijven -- `kantoorAudit`, `commandJournaal`, `securityLog` -- groeien bij
     lezen niet en komen hier dus nooit boven. Twee automatische zeven zijn hier
     op gemeten data gestrand (een steekproefronde, en een verhouding over alle
     deltas: die vond er nul, want een kantoorjournaal groeit alleen bij
     kantoorroutes). Ze staan nu bij naam en met reden in IDEMBESLUIT.json --
     zie de uitleg in scripts/lib/idemproef.js voor waarom een besluit hier
     beter is dan een slimmigheid, en hoe die lijst zelf gecontroleerd wordt. */
  console.log('  tweede meetpunt (de opslag)          : ' + (staatWerkt
    ? 'aan; ruis geijkt op ' + (ruis.size ? [...ruis].join(', ') : 'niets')
    : 'UIT -- geen X-RTG-Staat-kop; de proef meet alleen het antwoord'));

  /* Het verschil dat DEZE oproep achterliet. De stand loopt door over de hele
     ronde: elk antwoord is het nieuwe ijkpunt voor het volgende. */
  let vorigeStand = ijkStand;
  const staatVan = !staatWerkt ? null : (antwoord) => {
    if (!antwoord || antwoord.staat == null) return {};
    const d = staatlog.verschil(vorigeStand, antwoord.staat, ruis);
    vorigeStand = antwoord.staat;
    return d;
  };

  let register = {};
  try { register = JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMBESLUIT.json'), 'utf8')); } catch (e) {}
  const besluiten = register.routes || {};

  const uit = await draaiIdemproef({ post, routes, tokenVoor, hernieuw,
    /* DE VOLGORDE IS EEN BESLUIT. Het geoogste object staat NA het plausibele
       lijf (dat raadt) en VOOR het geldlijf en de lijfsleutel (die weten het
       zeker). Een id dat de applicatie zelf heeft uitgegeven, hoort te winnen
       van een verzonnen waarde en te verliezen van een sleutel die bij deze
       deur hoort. */
    lijfVoor: (r) => ({ ...plausibelLijf(r.pad), ...extra, ...objecten.voor(r.pad),
      ...(r.pad.startsWith('/api/foundation/school/') ? schoolWereld.extra : {}),
      ...(r.pad.startsWith('/api/supplier/horeca/') ? horecaWereld.extra : {}),
      ...(lijfsleutels.lijfVoor(r.pad) || {}), ...(geldLijven[r.pad] || {}) }),
    koppenVoor: (r) => lijfsleutels.koppenVoor(r.pad), maxRoutes: MAX, staatVan,
    /* De stand van het opslag-meetpunt reist mee: in stand 2 mag de uitslag
       niet meer beweren dat een wijziging op zijn plaats onzichtbaar is. Uit
       staatlog zelf en niet uit de env-string hier -- de module beslist of hij
       aanstaat, en een tweede lezing daarvan loopt uit de pas (LAT.md regel 4). */
    staatDiep: staatlog.diep,
    vastlegging: register.vastlegging });

  if (uit.meterStuk) {
    console.error('\n  DE METER IS BLIND: ' + uit.meterStuk);
    klaar(); process.exit(2);
  }

  const t = uit.telling;
  const beoordeeld = t.beschermd + t.onbeschermd;
  console.log('  oproepen                             : ' + uit.oproepen);
  console.log('  tokens onderweg opnieuw gehaald      : ' + uit.hernieuwd);
  console.log('  BEOORDEELD (tweede effect zichtbaar) : ' + beoordeeld + ' / ' + routes.length);
  console.log('      herhaling herkend (beschermd)    : ' + t.beschermd);
  console.log('      deed het opnieuw (onbeschermd)   : ' + t.onbeschermd);
  console.log('      waarvan gezien aan de OPSLAG     : ' + (uit.uitOpslag || 0) +
    '   <- het antwoord zei niets; de opslag wel');
  console.log('  ongemeten                            : ' + t.ongemeten +
    '   <- geen werk gedaan, of het antwoord reageert niet op een nieuwe oproep');
  /* De lijst met vastleggingen uit IDEMBESLUIT.json, met de controle erop: onder
     hoeveel verschillende routefamilies groeide elk van die collecties? Een
     doorlopende vastlegging groeit onder routes die verder niets met elkaar te
     maken hebben; groeit er een onder maar EEN familie, dan is het domeinwerk
     dat in de lijst is gezet -- en dan verdwijnt er een bevinding achter een
     regel in een bestand. Dat hoort hardop te klinken. */
  console.log('  vastlegging (geldt niet als werk)    : ' + ((uit.vastleggingGemeten || []).length
    ? uit.vastleggingGemeten.map(v => v.collectie + ' (' + v.families + ' routefamilies)').join(', ')
    : 'niets in IDEMBESLUIT.json'));
  for (const k of (uit.vastleggingVerdacht || [])) {
    console.log('      LET OP: ' + k + ' groeide maar onder EEN routefamilie -- dat lijkt domeinwerk, ' +
      'geen doorlopende vastlegging. Haal hem uit IDEMBESLUIT.json of onderbouw hem opnieuw.');
  }
  if (uit.tegenspraken && uit.tegenspraken.length) {
    console.log('  TEGENSPRAAK antwoord vs opslag       : ' + uit.tegenspraken.length + '   (elk nagetrokken met een vierde oproep)');
    for (const p of uit.tegenspraken.slice(0, 10)) console.log('      ' + p);
  }
  if (uit.vermoedensVerworpen) {
    console.log('  vermoedens die niet herhaalbaar waren: ' + uit.vermoedensVerworpen +
      '   <- bij B bewoog er iets dat bij een vierde oproep niet terugkwam');
  }

  /* ============================================================================
     ELKE ONBESCHERMDE ROUTE DRAAGT EEN BESLUIT (TAKEN.md 4.30).

     "Onbeschermd" is een telling en geen defect -- twee keer op bewaren drukken
     hoort twee notities op te leveren. Maar dan moet iemand dat wel HEBBEN
     BESLOTEN, en niet: het stond er en niemand keek. Het verschil tussen die
     twee is precies wat deze lijst zonder besluitregister niet kon laten zien.

     IDEMBESLUIT.json draagt per route waarom een herhaling daar mag (of niet).
     Wat hier onbeschermd uitkomt en er NIET in staat, is een route waarover nog
     niemand heeft nagedacht. Die worden bij naam genoemd. Ze maken deze proef
     niet rood -- dat zou een bevinding zijn en geen blindheid -- maar ze staan
     in het register onder `zonderBesluit`, zodat het getal niet stilletjes kan
     groeien. */
  const onbeschermd = Object.values(uit.perRoute).filter(r => r.idempotentie === 'onbeschermd');
  const zonderBesluit = onbeschermd.filter(r => !besluiten[r.pad]).map(r => r.pad);
  for (const r of onbeschermd.slice(0, 20)) console.log('      ' + r.methode + ' ' + r.pad + (besluiten[r.pad] ? '' : '   <- GEEN BESLUIT'));
  if (onbeschermd.length > 20) console.log('      ... en nog ' + (onbeschermd.length - 20));
  console.log('  onbeschermd MET een besluit          : ' + (onbeschermd.length - zonderBesluit.length) + ' / ' + onbeschermd.length);
  if (zonderBesluit.length) console.log('      zonder besluit in IDEMBESLUIT.json: ' + zonderBesluit.length);

  fs.writeFileSync(UITSLAG, JSON.stringify({
    stempel: stempel(),
    uitleg: 'Per route drie oproepen: twee met dezelfde sleutel en een met een verse. De derde is de ' +
      'IJKING -- verschilt hij van de eerste, dan is het antwoord gevoelig voor een nieuwe oproep en ' +
      'pas dan betekent een gelijke herhaling iets. Een route die hier NIET in staat is niet beproefd. ' +
      '"onbeschermd" is een telling en geen defect-oordeel; zie de grens in scripts/lib/idemproef.js.',
    /* WAT ER NIET IS BEPROEFD, met de reden erbij. Zonder dit veld leest
       routesMetRol als "dit zijn de routes" terwijl het "dit is wat we konden
       bereiken" betekent -- en dat verschil was jarenlang 1257 routes groot. */
    nietBeproefbaar: verdeling.zonderRol.length,
    redenenNietBeproefbaar: verdeling.redenen,
    routesGevonden: kandidaten.length,
    gemeten: { routesMetRol: routes.length, beoordeeld,
      beschermd: t.beschermd, onbeschermd: t.onbeschermd, ongemeten: t.ongemeten,
      oproepen: uit.oproepen, tokensHernieuwd: uit.hernieuwd,
      uitOpslag: uit.uitOpslag || 0, ruisGeijkt: [...ruis], vastlegging: uit.vastleggingGemeten || [],
      blindeRondes: uit.meterStuk ? 1 : 0, begrenzing: MAX,
      wereldKlaargezet: Object.keys(extra), geldroutesMetEigenLijf: Object.keys(geldLijven).length,
      /* WELKE LIJFSLEUTELS ER WERKELIJK ZIJN GEBOUWD, en welke niet. Een familie
         DECLAREREN is iets anders dan hem HEBBEN: de gezinsfamilie liep stuk op
         twee veldnamen en meldde zich netjes als mislukt, terwijl
         scripts/onbewezen.js zijn 187 routes toen al als "heeft een sleutel"
         telde -- die keek naar de declaratie. Sindsdien leest de trechter dit
         veld, en een familie die niet is gebouwd dekt niets. */
      objectenGemaakt: objecten.gelukt, objectTakken: objecten.takken,
      schoolwereld: schoolWereld.klaar, horecawereld: horecaWereld.klaar,
      rolOpgewaardeerd: opgewaardeerd.length, rolOpwaarderingGeweigerd: geweigerd.length,
      schoolwereldStappen: schoolWereld.stappen.map(x => ({ naam: x.naam, ok: x.ok, waarom: x.waarom })),
      lijfsleutelsGebouwd: lijfsleutels.gebouwd.map(g => g.naam),
      lijfsleutelsMislukt: lijfsleutels.mislukt,
      routesOpLijfsleutel: metLijf.length,
      onbeschermdMetBesluit: onbeschermd.length - zonderBesluit.length },
    zonderBesluit, tegenspraken: uit.tegenspraken || [], vastleggingVerdacht: uit.vastleggingVerdacht || [],
    vermoedensVerworpen: uit.vermoedensVerworpen || 0,
    perRoute: Object.values(uit.perRoute)
  }, null, 1) + '\n');
  console.log('\n  weggeschreven in IDEMPROEF.json');

  klaar();
  /* GEEN EXITCODE 1 OP "ONBESCHERMD". Dat is een telling en geen defect: twee
     keer op bewaren drukken hoort twee notities op te leveren. Alleen blindheid
     laat deze proef zakken -- LAT.md: een bevinding maakt CI niet rood,
     blindheid wel. */
  process.exit(0);
})().catch(e => { console.error('de idemproef viel om: ' + (e && e.stack || e)); process.exit(2); });
