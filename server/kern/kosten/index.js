/* RTG KOSTPRIJS: wat kost elke gebruiker ons, en wie betaalt dat.

   DE UITLEG STAAT IN KOSTEN.md en niet hier. Dit bestand is een ophanglijst: elk
   deel hangt aan het vorige, en die VOLGORDE is de enige inhoud. Ze stond hier
   ook uitgeschreven en dat waren twee plekken voor hetzelfde verhaal -- precies
   de dubbeling waar deze codebase zich vaker op heeft gebrand.

   De volgorde, want die is een afhankelijkheid en geen smaak:

     meter          voorop: hij bezit de periodesleutel (JJJJ-MM)
     providerfactuur  voor de tarieven en de nota's, die hun bron eruit afleiden
     tarieven       wat kost een eenheid, en waar komt dat getal vandaan
     huisrekening   wat betaalde RTG in het echt, per maand
     overzicht      tellers maal tarief, met de bewijsgraad erbij
     toerekening    na het overzicht: de sleutel gebruikt de gemeten kosten
     factuurregel / doorbelasting / dekking
     periode        na de afstemming, want hij leest de verschillen
     vooruitblik    na de dekking (huistotaal) en de periodestand
     grens          na het overzicht, en hangt zichzelf aan de haak

   Drie grenzen die niet mogen sneuvelen staan in KOSTEN.md par. 1: er staat
   nooit een getal waar er geen is, deze laag kent geen namen, en de machine zet
   klaar terwijl een mens vrijgeeft. De vierde staat in ECONOMIE.md: kosten van
   de ene wereld komen nooit bij een gebruiker van de andere.

   Opslag: db.data.kosten. De klok is injecteerbaar zodat een maandwisseling te
   beproeven is zonder te wachten tot het de eerste is (LAT.md regel 2). */
'use strict';

const { datum: klokDatum } = require('../../lib/klok');

const haak = require('./haak');
const soorten = require('./soorten');

function maakKosten({ db, save, accounts, geldPasprijzen, fonds, economie, keyVanCodenaam, bestandenOpslag, klok }) {
  /* ZONDER ECONOMIELAAG BESTAAT DEZE LAAG NIET: een fout bij het OPBOUWEN en
     geen nette terugval bij het rekenen. Hier stonden drie takken die "als de
     economielaag ontbreekt, dan..." afhandelden; alle drie verdedigbaar, en
     samen een gat waarin een opzet die de firewall vergeet gewoon doordraait.
     Zelfde vorm als kern/aipoort.js met resolveSession. */
  if (!economie || typeof economie.magBelasten !== 'function') {
    throw new Error('kosten: de economielaag ontbreekt; zonder firewall is er geen grens tussen de vier economieen (ECONOMIE.md par. 3).');
  }
  /* De terugval is de HUISKLOK en niet het besturingssysteem. `new Date()` stond
     hier, en dat is precies de aanroep waar server/lib/klok.js voor bestaat: wie
     de tijd rechtstreeks aan het OS vraagt, doet niet mee aan RTG_KLOK en is dus
     niet te beproeven op een schrikkeldag, een zomertijdsprong of een maand die
     omslaat. In een boekhouding is die laatste geen theorie -- de periodesleutel
     JJJJ-MM hangt eraan. De injecteerbare `klok` blijft voorgaan, want een toets
     die een maandwissel naspeelt geeft er een mee. */
  const nu = () => (typeof klok === 'function' ? klok() : klokDatum()).toISOString();

  function d() {
    if (!db.data.kosten || typeof db.data.kosten !== 'object') db.data.kosten = {};
    return db.data.kosten;
  }

  const ctx = { db, save, nu, d, accounts, geldPasprijzen, fonds, economie, keyVanCodenaam, bestandenOpslag };
  /* DE METER GAAT VOOROP, want hij bezit de periodesleutel (JJJJ-MM) en drie
     lagen hieronder rekenen daarmee. Hij stond eerder verderop en dan moest
     `periodeVan` er tijdelijk twee keer staan -- twee definities van dezelfde
     maand, en dat is precies waar dit huis over struikelt. */
  const meter = require('./meter')(ctx);
  ctx.meter = meter;
  ctx.periodeVan = meter.periodeVan;
  /* De leveranciersfacturen staan VOOR de tarieven en de nota's: die twee leiden
     hun bron eruit af zodra er een factuur tegenover staat, zodat de herkomst op
     EEN plek staat in plaats van twee keer ingetikt. */
  const providerfactuur = require('./providerfactuur')(ctx);
  ctx.providerfactuur = providerfactuur;
  const tarieven = require('./tarieven')(ctx);
  ctx.tarieven = tarieven;
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
  /* De twee meters die niet aan een verzoek hangen. De transactiemeter wordt
     door de betaallaag aangeroepen (kern/pay/opladen.js, laat gebonden); de
     opslagpeiling door de onderhoudsronde. */
  const transactie = require('./transactiemeter')(ctx);
  const peiling = require('./peiling')(ctx);
  /* "Waarom betaal ik dit?" -- de keten van een bedrag terug naar de
     leveranciersfactuur. Leest alle lagen hierboven en rekent zelf niets. */
  const herkomst = require('./herkomst')(ctx);
  /* De periodeafsluiting leest de afstemming en de verdeling, dus hij komt NA
     allebei. Hij is ook de laag die de schrijvers hierboven kan tegenhouden:
     een gesloten maand verandert niet meer. */
  const periode = require('./periode')(ctx);
  ctx.periode = periode;
  ctx.dekking = dekking;
  /* De vooruitblik leest de dekking (voor het huistotaal) en de periodestand
     (voor "was die maand afgesloten"), dus hij komt na allebei. */
  const vooruitblik = require('./vooruitblik')(ctx);
  /* De verbruiksgrens. Hij leest het overzicht, dus hij komt daarna -- en hij
     wordt hieronder aan de haak gehangen, want server/ai.js vraagt het vlak
     voordat er geld gaat. */
  const grens = require('./grens')(ctx);

  /* EEN GESLOTEN MAAND VERANDERT NIET MEER, en die regel staat hier en niet in
     ./huisrekening.js -- die laag wordt gebouwd voordat de periodeafsluiting
     bestaat, en een module die zijn eigen slot pas later krijgt aangereikt kan
     dat slot ook vergeten. Zo staat het op de weg naar buiten, waar iedereen
     langs moet. */
  function postZetGeslotenControle(p, soortId, centen, bron, wie, factuurId) {
    const dicht = periode.slotFout(p);
    if (dicht) return dicht;
    return huisrekening.postZet(p, soortId, centen, bron, wie, factuurId);
  }

  /* De haak aanzetten. Vanaf hier landt alles wat server/ai.js en de poort
     melden in deze meter; daarvoor viel het stil op de grond, en dat is beter
     dan een AI-antwoord dat omvalt op een boekhouding die nog niet wakker is. */
  haak.zetMeter(meter.meet);
  haak.zetGrenswacht(grens.magUitgeven);

  /* Eén ingang voor de rest van het huis om verbruik te melden zonder de haak
     te kennen. `wie` is een drager uit haak.drager(). */
  const meet = (wie, soortId, aantal, opties) =>
    meter.meet(Object.assign({ drager: wie, soort: soortId, aantal }, opties || {}));

  return { kosten: {
    SOORTEN: soorten.SOORTEN, GRAAD: soorten.GRAAD,
    drager: haak.drager, binnen: haak.binnen, wieNu: haak.wieNu, ontleed: haak.ontleed,
    meet, periodeVan: meter.periodeVan, perioden: meter.perioden, kijk: meter.kijk,
    meldTransactie: transactie.meldTransactie,
    peilOpslag: peiling.peilOpslag, laatstePeiling: peiling.laatstePeiling,
    tarieven: tarieven.tarieven, tariefZet: tarieven.tariefZet, ontbrekendeTarieven: tarieven.ontbrekend,
    posten: huisrekening.posten, postZet: postZetGeslotenControle, ontbrekendeNota: huisrekening.ontbrekend,
    periodeStand: periode.stand, periodeVerklaar: periode.verklaar, periodeSluit: periode.sluit,
    periodeHeropen: periode.heropen,
    vooruitblik: vooruitblik.vooruitblik, vooruitblikVastleggen: vooruitblik.legVoorspellingVast,
    trefzekerheid: vooruitblik.trefzekerheid,
    grensVoor: grens.grensVoor, grensZet: grens.grensZet, grensStand: grens.stand,
    leveranciersfacturen: providerfactuur.facturen, leveranciersfactuurZet: providerfactuur.factuurZet,
    herkomst: herkomst.herkomst,
    voorDrager: overzicht.voorDrager, alleDragers: overzicht.alleDragers,
    nietGemeten: overzicht.nietGemeten, afstemming: overzicht.afstemming,
    verdeling: toerekening.verdeling, verbruikPerWereld: toerekening.perWereld,
    dekkingVoor: dekking.dekkingVoor, dekkingHuis: dekking.huis,
    beleid: doorbelasting.beleid, beleidZet: doorbelasting.beleidZet, voorstel: doorbelasting.voorstel,
    standVoor: doorbelasting.standVoor,
    vrijgeven: doorbelasting.vrijgeven, ronde: doorbelasting.ronde,
    DREMPEL_CENTEN: doorbelasting.DREMPEL_CENTEN
  } };
}

module.exports = maakKosten;
module.exports.maakKosten = maakKosten;
