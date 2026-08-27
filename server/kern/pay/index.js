/* RTG Pay: de interne betaallaag van het hele huis. Een wallet per lid, een
   grootboek dat elke cent dubbel boekt, en alles frictieloos: EEN knop.

   De regels van het grootboek (dit is de kern van elk betaalbedrijf):
   - Elke beweging is een boeking VAN een rekening NAAR een rekening. Geld
     ontstaat nooit uit het niets: opladen komt van 'extern:oplaad' (daar
     staat de echte kaartbetaling via de betaal-naad tegenover), uitbetalen
     gaat naar 'extern:uitbetaald' (daar staat een echte payout tegenover).
   - De som van ALLE saldi is altijd exact nul (dubbel boekhouden). De
     sluitcontrole bewaakt dat, en /api/pay/gezond meldt het aan de bewaking.
   - Leden- en partnerrekeningen kunnen nooit onder nul; alleen de
     extern-rekeningen mogen negatief staan (dat IS de belofte van de bank).

   Frictieloos, EEN knop:
   - Betalen met te weinig saldo? De wallet laadt zelf bij (in stappen van
     tien euro) via de betaal-naad (Apple Pay/kaart) en betaalt door. Het lid
     tikt een keer, klaar.

   Identiteit: de wallet hangt aan de codenaam (dezelfde sociale identiteit
   als de vriendenlaag en de chats, over RTG en RTF heen). In productie hangt
   hij aan het account-id en is de codenaam alleen het adres.

   In productie wordt het saldo aangehouden bij de betaalpartner (Stripe
   Connect / Adyen for Platforms): zij houden het geld, dit grootboek blijft
   de waarheid over wie wat heeft. De naad (server/betaal.js) is er al. Dit is
   de orkestrator: het grootboek, de idempotentie en het opladen wonen hier;
   de Klompjes/tik/p2p in ./verzoeken, de kassa en de partnerkant in ./kassa. */

module.exports = ({ db, save, bijeen, crypto, betaal, keyVanCodenaam, sseToCustomer, schoon, betaaldienstKosten, betaalOpdrachten, waarde, accounts }) => {
  /* DE TIJD VAN DE HELE PAYLAAG, uit de huisklok en niet uit het
     besturingssysteem. Elk deelbestand hieronder leest `nu` uit deze ctx, dus
     deze ene regel bepaalt of vervaldatums, aflopende reserveringen, de
     wachttijd op een gewijzigd IBAN en dag- en maandgrenzen met RTG_KLOK
     meebewegen. Stond hier Date.now(), dan zaten de deelbestanden formeel op
     een gedeelde klok en in werkelijkheid nog steeds aan het OS -- de teller
     tevreden, de tijdmachine niet. Zonder RTG_KLOK geeft klok.nu() exact
     Date.now(); in productie weigert een verzette klok bij het laden. */
  const nu = require('../../lib/klok').nu;
  /* De opslagvorm -- de vijf bakken in db.data en de vier naamregels ('lid:',
     'partner:', het saldo van een rekening, een nieuw id) -- staat in ./bakken.js. */
  const { d, saldi, grootboek, klompjes, kascodes, tikcodes, rekLid, rekPartner, saldoVan, id } =
    require('./bakken')({ db, crypto });
  /* De stand van deze laag -- de drie schakelaars uit de omgeving en de zes
     bedragen -- staat in ./stand.js. Een keer bepaald bij het opstarten, en
     daarna onveranderlijk; alles hieronder werkt per boeking. */
  const { betalingenUit, uitFout, schaduw, motorklant, geldModus,
    MIN_CENTEN, MAX_CENTEN, OPLAAD_MIN, AUTOLAAD_STAP, KASCODE_MS, KASCODE_MAX } = require('./stand')();

  /* Idempotentie die een herstart overleeft: dezelfde knop twee keer indrukken
     (dubbeltik, haperend netwerk, retry) geeft exact hetzelfde antwoord en boekt
     nooit dubbel -- en dezelfde sleutel met een ANDER verzoek geeft een 409 in
     plaats van stil het oude antwoord. Zie ../../lib/idem.js. */
  /* Met de save-bundel (db.bijeen) landen de boeking en de idem-sleutel als
     EEN commit; de bundel is context-gebonden, dus ook met echte I/O in het
     werk (motor, kaart-naad) raakt hij geen saves van andere verzoeken. */
  /* duurzaam: geld is de enige laag waar bevestigen vóór duurzaamheid een belofte
     is die de opslag nog niet heeft gedaan. Boeking en idem-sleutel zitten al in
     EEN bundel (zie lib/idem.js); deze vlag maakt die bundel ook duurzaam. */
  const metIdem = require('../../lib/idem')({ d, save, naam: 'payIdem', bijeen, duurzaam: true });

  /* De waardepoort (./poort.js): de toets die VOOR elke boeking gaat -- de oude
     saldo-regel als bodem, daarbovenop klasse, beleid, reserveringen en plafond.
     Optioneel: zonder `waarde` is dit exact de regel die hier altijd stond. */
  const waardePoort = require('./poort')({ saldoVan, grootboek, waarde, nu });
  /* DE SCHRIJFWEG van het grootboek -- pasToe, boek en boekAsync -- staat in
     ./boeking.js. Dat is een ander onderwerp dan dit bestand: wie daar iets
     verandert, verandert wat er met GELD gebeurt; wie hier iets verandert,
     verandert welke ONDERDELEN aan elkaar hangen. */
  const { pasToe, boek, boekAsync } = require('./boeking')({
    saldi, saldoVan, grootboek, save, id, schoon, nu, waardePoort,
    betalingenUit, uitFout, geldModus, motorklant, schaduw, MIN_CENTEN, MAX_CENTEN });

  /* Het oplaaddeel (laadOp, bankdekking, zorgSaldo, herstart-reconcile) staat
     in ./opladen.js; het krijgt de guard (boekAsync) en de helpers mee en
     raakt de boekingsregels zelf niet aan. */
  const { laadOp, oplaadAfronden, koppelBank, reconcileVanMotor, zorgSaldo, bestaatLid } = require('./opladen').maakOpladen({
    betaal, metIdem, boekAsync, rekLid, saldoVan, nu, d, save,
    motorklant, geldModus, keyVanCodenaam,
    OPLAAD_MIN, MAX_CENTEN, AUTOLAAD_STAP
  });

  /* Alles wat uit deze laag komt zonder dat er geld beweegt -- de twee vragen
     aan het grootboek, het seintje naar het lid en de schaduwstand voor het
     statusbord -- staat in ./kijken.js. Daar komen save noch boek binnen: wie
     er iets verandert kan per definitie geen geld verplaatsen. */
  const { sluitcontrole, boekingenVan, seintje, schaduwStand } =
    require('./kijken')({ saldi, grootboek, keyVanCodenaam, sseToCustomer, schaduw });

  // de gedeelde ctx voor de deelbestanden
  const ctx = {
    db, save, crypto, betaal, schoon, nu, d,
    saldi, grootboek, klompjes, kascodes, tikcodes,
    rekLid, rekPartner, saldoVan, id, metIdem, boek, boekAsync, zorgSaldo, seintje, bestaatLid,
    betaaldienstKosten: betaaldienstKosten || (() => 0), waarde, accounts,
    opdrachten: betaalOpdrachten,
    MIN_CENTEN, MAX_CENTEN, KASCODE_MS, KASCODE_MAX
  };
  /* rekLid hoort bij het koppelvlak: de vorm 'lid:' + codenaam is een regel
     van dit domein, en wie hem nodig heeft (ov, mobiliteit, geldwereld) tikte
     hem tot nu toe letterlijk na. Een naamregel die op vier plekken staat, is
     op dag een al drie keer bijna fout gegaan. */
  const api = { MIN_CENTEN, MAX_CENTEN, boek, boekAsync, geldModus, sluitcontrole, laadOp, oplaadAfronden, saldoVan, rekLid, boekingenVan, koppelBank, reconcileVanMotor };
  api.schaduw = schaduwStand;
  // de portefeuille: de waardelaag kent de betekenis, dit grootboek de bedragen
  if (waarde) api.portefeuille = c => waarde.portefeuille(c, saldoVan);
  // late binding voor de eigen geldgrens van het lid (kern/geldbeleid, na pay gemount)
  api.koppelGrens = waardePoort.koppelGrens;
  /* De deelbestanden. ./samen en ./treasury gaan EERST in de ctx: kassa en
     vooraf betalen erlangs (een betaling kan sinds er budgetten bestaan uit
     meerdere potjes komen) en zetten via ./treasury meteen apart. ./vooraf
     staat naast ./kassa en niet erin: kassa kent EEN afrekenmoment, vooraf
     kent er twee met tijd ertussen.

     ./verkoop staat NA ./kassa en dat is de volgorde van main: een lid koopt
     van een partner en wat eraf moet -- btw, een afdracht -- volgt als eigen
     regel in hetzelfde grootboek. Apart van kassa omdat de teruggang erin zit
     en kassa.js daar met opzet anders mee omgaat. */
  // in de CTX: waar de rest op leunt. Op de API: wat naar buiten gaat.
  for (const naam of ['samen', 'treasury']) Object.assign(ctx, require('./' + naam)(ctx));
  for (const naam of ['verzoeken', 'kassa', 'verkoop', 'vooraf', 'budget', 'graaf', 'bewijs', 'terug', 'inkomsten']) Object.assign(api, require('./' + naam)(ctx));
  for (const k of ['treasuryBeleid', 'treasuryZet', 'treasuryStand', 'treasuryVrij', 'treasuryApart']) api[k] = ctx[k];
  return { pay: api };
};
