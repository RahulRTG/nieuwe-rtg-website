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

module.exports = (ctxIn) => {
  const { db, save, bijeen, crypto, betaal, keyVanCodenaam, sseToCustomer, schoon, betaaldienstKosten, betaalOpdrachten,
    payBoekingenVoegToe } = ctxIn;
  /* WEIGEREN BIJ HET BOUWEN, NIET OMVALLEN BIJ DE EERSTE BOEKING.
     Zelfde vorm als kern/directpay: de weg waarlangs een grootboekregel wordt
     opgeslagen is geen optie maar een voorwaarde. Zou hij ontbreken, dan valt
     pasToe() om middenin een geldbeweging -- na het verschuiven van de saldi en
     voor het vastleggen van de regel, de slechtste plek van allemaal. */
  if (typeof payBoekingenVoegToe !== 'function')
    throw new Error('pay: payBoekingenVoegToe ontbreekt. Zonder die weg landt geen enkele grootboekregel ' +
      'in het transactiegrootboek en valt de historie bij een herstart stil weg.');
  const nu = () => Date.now();
  const d = () => db.data;
  /* De stand van deze laag -- de drie schakelaars uit de omgeving en de zes
     bedragen -- staat in ./stand.js. Een keer bepaald bij het opstarten, en
     daarna onveranderlijk; alles hieronder werkt per boeking. */
  const { betalingenUit, uitFout, schaduw, motorklant, geldModus,
    MIN_CENTEN, MAX_CENTEN, OPLAAD_MIN, AUTOLAAD_STAP, KASCODE_MS, KASCODE_MAX } = require('./stand')();

  function saldi() { if (!d().paySaldi || typeof d().paySaldi !== 'object') d().paySaldi = {}; return d().paySaldi; }
  function grootboek() { if (!Array.isArray(d().payBoekingen)) d().payBoekingen = []; return d().payBoekingen; }
  function klompjes() { if (!Array.isArray(d().payVerzoeken)) d().payVerzoeken = []; return d().payVerzoeken; }
  function kascodes() { if (!Array.isArray(d().payCodes)) d().payCodes = []; return d().payCodes; }
  function tikcodes() { if (!Array.isArray(d().payTikCodes)) d().payTikCodes = []; return d().payTikCodes; }

  const rekLid = c => 'lid:' + c;
  const rekPartner = c => 'partner:' + c;
  const saldoVan = rek => Math.round(saldi()[rek] || 0);
  const id = p => (p || 'P') + crypto.randomBytes(5).toString('hex').toUpperCase();

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

  /* ---------- het grootboek zelf ----------
     De drie functies die een cent verplaatsen (pasToe, de synchrone guard en het
     async choke-point voor de motor-cutover) staan in ./boeken.js -- de
     schrijvende kant van deze laag, tegenover ./kijken.js als de lezende.
     Daar staat ook waarom de historie sinds TAKEN.md 4.39 door het
     transactiegrootboek gaat en niet meer door unshift+pop. */
  const { boek, boekAsync } = require('./boeken')({
    saldi, grootboek, saldoVan, payBoekingenVoegToe, save, id, schoon, nu,
    betalingenUit, uitFout, schaduw, motorklant, geldModus, MIN_CENTEN, MAX_CENTEN
  });

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
    betaaldienstKosten: betaaldienstKosten || (() => 0),
    opdrachten: betaalOpdrachten,
    MIN_CENTEN, MAX_CENTEN, KASCODE_MS, KASCODE_MAX
  };
  /* rekLid hoort bij het koppelvlak: de vorm 'lid:' + codenaam is een regel
     van dit domein, en wie hem nodig heeft (ov, mobiliteit, geldwereld) tikte
     hem tot nu toe letterlijk na. Een naamregel die op vier plekken staat, is
     op dag een al drie keer bijna fout gegaan. */
  const api = { MIN_CENTEN, MAX_CENTEN, boek, boekAsync, geldModus, sluitcontrole, laadOp, oplaadAfronden, saldoVan, rekLid, boekingenVan, koppelBank, reconcileVanMotor };
  api.schaduw = schaduwStand;
  Object.assign(api, require('./verzoeken')(ctx));
  Object.assign(api, require('./kassa')(ctx));
  return { pay: api };
};
