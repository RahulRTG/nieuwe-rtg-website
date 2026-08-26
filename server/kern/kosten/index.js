/* RTG KOSTPRIJS: wat kost elke gebruiker ons, en wie betaalt dat.

   De vraag erachter is simpel en werd nergens beantwoord: RTG betaalt elke maand
   voor modellen, machines, stroom en betaalverkeer, en niemand kon zeggen welk
   deel daarvan bij welke gebruiker hoort. Zonder dat antwoord is een pasprijs
   een gok, is een gratis account een onbekend risico, en is "onze kosten worden
   gedekt" een gevoel.

   ZEVEN DELEN, EN DE VOLGORDE IS EEN AFHANKELIJKHEID:

     soorten        welke kosten bestaan er, en wat is ervan te meten
     tarieven       wat kost één eenheid, en waar komt dat getal vandaan
     huisrekening   wat betaalde RTG in het echt, per maand
     meter          tellen per gebruiker per maand (tellers, geen journaal)
     overzicht      tellers maal tarief, met de bewijsgraad erbij
     toerekening    de nota's die niet te meten zijn, verdeeld over gebruikers
     dekking        kosten tegenover bijdragen: dekt hij zichzelf?
     doorbelasting  wat mag er op een rekening, en wie geeft dat vrij

   DRIE GRENZEN DIE NIET MOGEN SNEUVELEN.

   1. ER STAAT NOOIT EEN GETAL WAAR ER GEEN IS. Geen tarief, geen nota, geen
      teller: dan komt er een REDEN en geen nul. Nul betekent gratis, en dat is
      een bewering. Dit is BESTUUR.md par. 3 toegepast op geld: elke regel draagt
      een bewijsgraad, en een toerekening kan nooit 'gemeten' heten.

   2. DEZE LAAG KENT GEEN NAMEN. Gebruikers staan hier met hun sessiesleutel,
      hun zaakcode of hun gezinscode -- dezelfde handvatten waarmee de facturen
      al werken. Echte namen wonen in de kluis (accounts.js) en komen hier niet.
      Een kostenoverzicht is een gedragsbeeld; dat hoort niet naast een naam te
      liggen.

   3. DE AI ZET KLAAR, EEN MENS GEEFT VRIJ. Er wordt niets gefactureerd zonder
      dat een mens uit het kantoor de maand vrijgeeft, met zijn naam eronder.
      GELD.md par. 3.

   Opslag: db.data.kosten. De klok is injecteerbaar zodat een maandwisseling te
   beproeven is zonder te wachten tot het de eerste is (LAT.md regel 2). */
'use strict';

const haak = require('./haak');
const soorten = require('./soorten');

function maakKosten({ db, save, accounts, geldPasprijzen, fonds, klok }) {
  const nu = () => (typeof klok === 'function' ? klok() : new Date()).toISOString();

  function d() {
    if (!db.data.kosten || typeof db.data.kosten !== 'object') db.data.kosten = {};
    return db.data.kosten;
  }

  const ctx = { db, save, nu, d, accounts, geldPasprijzen, fonds };
  const tarieven = require('./tarieven')(ctx);
  ctx.tarieven = tarieven;
  const meter = require('./meter')(ctx);
  ctx.meter = meter;
  ctx.periodeVan = meter.periodeVan;
  const huisrekening = require('./huisrekening')(ctx);
  ctx.huisrekening = huisrekening;
  const overzicht = require('./overzicht')(ctx);
  ctx.overzicht = overzicht;
  /* De toerekening leest het overzicht (voor de verdeelsleutel) en het overzicht
     leest de toerekening (voor de regels). Dat is geen kringetje maar een
     volgorde: de sleutel gebruikt alleen de GEMETEN kosten, en die staan vast
     voordat er iets verdeeld is. Daarom komt de toerekening er na en wordt hij
     in de ctx gehangen die het overzicht al vasthoudt. */
  ctx.directeKostenPerDrager = overzicht.directeKostenPerDrager;
  const toerekening = require('./toerekening')(ctx);
  ctx.toerekening = toerekening;
  const { boekDoorbelasting } = require('./factuurregel')(ctx);
  ctx.boekDoorbelasting = boekDoorbelasting;
  const doorbelasting = require('./doorbelasting')(ctx);
  ctx.doorbelasting = doorbelasting;
  const dekking = require('./dekking')(ctx);

  /* De haak aanzetten. Vanaf hier landt alles wat server/ai.js en de poort
     melden in deze meter; daarvoor viel het stil op de grond, en dat is beter
     dan een AI-antwoord dat omvalt op een boekhouding die nog niet wakker is. */
  haak.zetMeter(meter.meet);

  /* Eén ingang voor de rest van het huis om verbruik te melden zonder de haak
     te kennen. `wie` is een drager uit haak.drager(). */
  const meet = (wie, soortId, aantal, opties) =>
    meter.meet(Object.assign({ drager: wie, soort: soortId, aantal }, opties || {}));

  return { kosten: {
    SOORTEN: soorten.SOORTEN, GRAAD: soorten.GRAAD,
    drager: haak.drager, binnen: haak.binnen, wieNu: haak.wieNu, ontleed: haak.ontleed,
    meet, periodeVan: meter.periodeVan, perioden: meter.perioden, kijk: meter.kijk,
    tarieven: tarieven.tarieven, tariefZet: tarieven.tariefZet, ontbrekendeTarieven: tarieven.ontbrekend,
    posten: huisrekening.posten, postZet: huisrekening.postZet, ontbrekendeNota: huisrekening.ontbrekend,
    voorDrager: overzicht.voorDrager, alleDragers: overzicht.alleDragers,
    nietGemeten: overzicht.nietGemeten, afstemming: overzicht.afstemming,
    verdeling: toerekening.verdeling,
    dekkingVoor: dekking.dekkingVoor, dekkingHuis: dekking.huis,
    beleid: doorbelasting.beleid, beleidZet: doorbelasting.beleidZet, voorstel: doorbelasting.voorstel,
    standVoor: doorbelasting.standVoor,
    vrijgeven: doorbelasting.vrijgeven, ronde: doorbelasting.ronde,
    DREMPEL_CENTEN: doorbelasting.DREMPEL_CENTEN
  } };
}

module.exports = maakKosten;
module.exports.maakKosten = maakKosten;
