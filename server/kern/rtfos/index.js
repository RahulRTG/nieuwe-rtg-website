/* Foundation OS (kern/rtfos): het bestuurssysteem van de RTFoundation.

   WAT DIT IS. RTF is een landelijke stichting die per stad met bestaande lokale
   partijen samenwerkt: eigen bestuur, eigen projecten, eigen budgetten, eigen
   mensen -- onder een centrale governance. Dat is een federatief model, en de
   software moet het dragen in plaats van het te beschrijven. Alles wat het
   landelijke toezicht draagt (steden activeren, modules per stad, goedkeurings-
   limieten, oormerken op geld, meldingen die niet gewist kunnen worden) is hier
   code en geen afspraak.

   DE OPBOUW. Een gedeelde context (./basis) gaat EEN keer bij het opstarten
   rond; elk deel krijgt hem mee en geeft zijn eigen functies terug. Geen kosten
   per verzoek, en er is precies EEN plek waar "wie mag wat, waar" wordt
   beantwoord. De delen:

     basis            de bodem: opslag, audit, zetels, rechten, vlaggen
     steden + zetels  de organisatieboom en wie er in een stad iets mag
     partners         de lokale stichtingen, hun dossier en hun portaal
     projecten        het centrale object van de uitvoering
     vrijwilligers    het register, de VOG-grendel, uren en planning
     geld             bronnen met een oormerk, uitgaven met vier ogen
     casus            de individuele hulpvraag (codenaam, toestemming)
     integriteit      incidenten, klachten, klokkenluider
     rapport          impact per stad en landelijk
     gemeente         de verantwoording aan de gemeente (geteld, nooit gelezen)
     ondernemers      het lokale maatschappelijke ondernemersnetwerk
     subsidies        aanvragen, voorwaarden, rapportagemomenten, terugvordering
     voorraad         goederen als batch: houdbaarheid, restant, bestemming
     activiteiten     inschrijven, wachtlijst, toestemming, incheck aan de deur
     berichten        communicatie per stad, publiek pas na landelijk akkoord
     netwerk          blauwdrukken delen tussen steden, en eerlijk vergelijken
     inkoop           samen kopen zonder de goedkeuring van een stad te omzeilen
     uitwisseling     vrijwilligers tussen steden, met toestemming en einddatum
     campagnes        landelijk werven, centnauwkeurig verdelen over steden
     koppeling        wat er naar RTG loopt, en wat er eerlijk NIET loopt
     vrijwilligerportaal  de vrijwilliger zelf: planning, uren, VOG-datum
     deelnemerportaal     de hulpvrager zelf: de stand, en toestemming intrekken
     publiek          de app voor de buurt: geen inlog, dus de strengste grens
     veld             de medewerker op pad: alleen wat aan hem is toegewezen
     donateur         de gever: zijn eigen giften, en zijn giftbewijs
     bestuur          vergaderingen, quorum, besluiten en vastgestelde notulen
     beleid           landelijke regels; een nieuwe versie wist alle bevestigingen
     jaarverslag      het ANBI-jaarstuk, met bevroren cijfers en een besluit eronder
     risico           het risicoregister: beheerst is een bewering, niet een vinkje
     herkomst         grote en contante giften: het geld staat stil tot er gekeken is
     meldcode         de vijf wettelijke stappen bij zorg om een kind
     ruil             de buurtruil tussen leden: spullen, zonder geld
     gift             de giftstand, het voornemen en de bevestigde gift

   WAT DIT NIET IS. Geen tweede ledenadministratie en geen tweede boekhouding.
   De 30%-afdracht van RTG naar de stichting blijft in kern/fonds.js; dit OS
   gaat over wat de stichting met dat geld DOET. */

const kluis = require('../../kluis');

module.exports = (state) => {
  const { db, save, crypto, boardroomWie, magBoardroom, pay } = state;
  const ctx = require('./basis')({ db, save, crypto, boardroomWie, magBoardroom });
  // De schrijflaag en de kluis gaan mee op dezelfde context: elk deel schrijft
  // via dezelfde save() en versleutelt via dezelfde sleutel.
  Object.assign(ctx, { db, save, crypto, kluis, pay });

  const steden = require('./steden')(ctx);
  const partners = require('./partners')(ctx);
  const projecten = require('./projecten')(ctx);
  const vrijwilligers = require('./vrijwilligers')(ctx);
  /* De herkomstcontrole staat VOOR het geld in deze lijst, en dat is geen
     smaak: geld.js markeert een grote of contante gift al bij het aanmaken van
     de bron. Een controle die pas ontstaat als iemand een scherm opent,
     ontstaat niet. */
  const herkomst = require('./herkomst')(ctx);
  ctx.herkomstBepaal = herkomst.bepaal;
  const geld = require('./geld')(ctx);
  const casus = require('./casus')(ctx);
  const integriteit = require('./integriteit')(ctx);
  const rapport = require('./rapport')(ctx);
  const gemeente = require('./gemeente')(ctx, { cijfersVan: rapport.cijfersVan });
  const ondernemers = require('./ondernemers')(ctx);
  /* De uitwisseling wordt hier opgebouwd omdat het vrijwilligersregister hem
     nodig heeft: die laatste vraagt bij het
     koppelen of een vrijwilliger uit een andere stad hier is uitgeleend, en die
     vraag hoort thuis bij de uitwisseling zelf (een tweede oordeel zou uiteen
     gaan lopen -- LAT.md regel 4). De verwijzing gaat via de context, want
     twee modules die elkaar over en weer laden is een kring die alleen werkt
     zolang niemand de volgorde aanraakt. */
  const uitwisseling = require('./uitwisseling')(ctx);
  ctx.magInStad = uitwisseling.magInStad;

  /* Fase twee: de uitvoering op straat. Subsidies leunen op geld.js (een
     toegekende subsidie MAAKT zijn geoormerkte bron, en maakt hem niet na);
     activiteiten leunen op de VOG-toets. Beide krijgen die functie mee in
     plaats van hem opnieuw te bedenken (LAT.md regel 4). */
  const subsidies = require('./subsidies')(ctx, { bronUitSubsidie: geld.bronUitSubsidie });
  const voorraad = require('./voorraad')(ctx);
  const ruil = require('./ruil')(ctx);
  ctx.bronUitGift = (x) => geld.bronUitGift(x);
  const gift = require('./gift')(ctx);
  const activiteiten = require('./activiteiten')(ctx, { vogGeldig: vrijwilligers.vogGeldig });
  const berichten = require('./berichten')(ctx);
  /* Fase vier: het netwerkeffect. Delen, samen kopen, mensen uitwisselen en
     landelijk werven -- allemaal met de stadsgrenzen intact. */
  const netwerk = require('./netwerk')(ctx);
  const inkoop = require('./inkoop')(ctx, { boekAanvraag: geld.boekAanvraag });
  const campagnes = require('./campagnes')(ctx, { bronUitCampagne: geld.bronUitCampagne });
  const koppeling = require('./koppeling')(ctx, { agenda: state.agenda });
  /* De drie doelgroepen die tot nu toe wel in het systeem stonden maar er niet
     in konden: de vrijwilliger, de hulpvrager en de buurt. Alle drie op een
     eigen ingang met een eigen, engere blik -- zie de kop van elke module. */
  /* Fase drie: de governance-laag. Het bestuur zelf (vergaderingen, quorum,
     besluiten), de regels die het stelt, de verantwoording achteraf en de
     dingen die mis kunnen gaan. Het jaarverslag leunt op drie delen -- rapport.js
     (cijfers), bestuur-notulen.js (besluit) en gift.js (de ANBI-stand, die
     het aannam) -- en maakt er geen na (LAT.md regel 4). */
  const bestuur = require('./bestuur')(ctx);
  const notulen = require('./bestuur-notulen')(ctx, { vind: bestuur.vind, beeld: bestuur.beeld,
    mag: bestuur.mag, quorumVan: bestuur.quorumVan });
  Object.assign(bestuur, notulen);
  const beleid = require('./beleid')(ctx);
  const jaarverslag = require('./jaarverslag')(ctx, { cijfersVan: rapport.cijfersVan,
    besluitVindbaar: notulen.besluitVindbaar, anbiVan: gift.stand });
  const risico = require('./risico')(ctx);
  const meldcode = require('./meldcode')(ctx);

  const vrijwilligerportaal = require('./vrijwilligerportaal')(ctx);
  const deelnemerportaal = require('./deelnemerportaal')(ctx, { toestemmingWegDirect: casus.toestemmingWegDirect });
  const publiek = require('./publiek')(ctx);
  /* De laatste twee ingangen: de medewerker die op pad is (alleen wat aan hem
     is toegewezen) en de gever (alleen zijn eigen giften). Beide leunen op iets
     dat al bestaat en maken het niet na: de veld-app op de ontsleutelfunctie
     met de auditregel uit casus-dossier.js, het donateursportaal op de cijfers
     uit rapport.js. */
  const veld = require('./veld')(ctx, { vind: casus.vind, contactVan: casus.contactVan });
  const donateur = require('./donateur')(ctx, { cijfersVan: rapport.cijfersVan });

  /* De spiegel van dit OS -- "wat mag ik zien" en "wat is er gedaan" --
     staat hiernaast: dit bestand is bedrading, en dat zijn de enige twee
     functies die naar het systeem zelf kijken. */
  const { auditlog, ik } = require('./index-spiegel')(ctx);

  return { rtfos: {
    ik, auditlog,
    boom: steden.boom, stad: steden.stad, stadMaak: steden.stadMaak, stadStatus: steden.stadStatus,
    vlagZet: steden.vlagZet, limietZet: steden.limietZet, zetelZet: steden.zetelZet,
    zetelWeg: steden.zetelWeg, kernteamZet: steden.kernteamZet,
    partners, projecten, vrijwilligers, geld, casus, integriteit, rapport, gemeente, ondernemers,
    subsidies, voorraad, ruil, gift, activiteiten, berichten,
    netwerk, inkoop, uitwisseling, campagnes, koppeling,
    bestuur, beleid, jaarverslag, risico, herkomst, meldcode,
    vrijwilligerportaal, deelnemerportaal, publiek,
    veld, donateur,
    VLAGGEN: ctx.VLAGGEN, ROLLEN: ctx.ROLLEN
  } };
};
