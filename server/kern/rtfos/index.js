/* Foundation OS: federatief bestuur en uitvoering van de RTFoundation.
   Alle delen delen een context en dezelfde bevoegdheidscontrole. Dit is geen
   tweede ledenadministratie of boekhouding; kern/fonds.js blijft eigenaar van
   de 30%-afdracht, FoundationOS bestuurt wat de stichting ermee doet. */

const kluis = require('../../kluis');

module.exports = (state) => {
  const { db, save, bewerkCollectie, crypto, boardroomWie, magBoardroom, pay } = state;
  const ctx = require('./basis')({ db, save, bewerkCollectie, crypto, boardroomWie, magBoardroom });
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
  /* De winkel. Hij leunt op de giftstand voor EEN ding: waar het geld landt.
     Twee walletcodes naast elkaar zou betekenen dat de opbrengst van een boek
     ergens anders binnenkomt dan een gift, en dan klopt geen enkel overzicht. */
  ctx.winkelOntvanger = () => {
    const o = gift.stand().ontvanger;
    return o && o.soort === 'wallet' && o.code ? o.code : null;
  };
  const winkel = require('./winkel')(ctx);
  const activiteiten = require('./activiteiten')(ctx, { vogGeldig: vrijwilligers.vogGeldig });
  const berichten = require('./berichten')(ctx);
  /* Fase vier: het netwerkeffect. Delen, samen kopen, mensen uitwisselen en
     landelijk werven -- allemaal met de stadsgrenzen intact. */
  const netwerk = require('./netwerk')(ctx);
  const inkoop = require('./inkoop')(ctx, { boekAanvraag: geld.boekAanvraag });
  const campagnes = require('./campagnes')(ctx, { bronUitCampagne: geld.bronUitCampagne });
  const koppeling = require('./koppeling')(ctx, { agenda: state.agenda });
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
  // Buiten deze map, en dat is het punt (../beschermzaak/index.js).
  const beschermzaak = require('../beschermzaak')(ctx);
  const opvang = require('./opvang')(ctx, { beschermzaak, partners });
  ctx.opvangStopVoorZaak = opvang.stopVoorZaak;

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
    codekoppeling: require('../codekoppel')({ db, save }),
    boom: steden.boom, stad: steden.stad, stadMaak: steden.stadMaak, stadStatus: steden.stadStatus,
    vlagZet: steden.vlagZet, limietZet: steden.limietZet, zetelZet: steden.zetelZet,
    zetelWeg: steden.zetelWeg, kernteamZet: steden.kernteamZet,
    partners, projecten, vrijwilligers, geld, casus, integriteit, rapport, gemeente, ondernemers,
    subsidies, voorraad, ruil, gift, winkel, activiteiten, berichten,
    netwerk, inkoop, uitwisseling, campagnes, koppeling,
    bestuur, beleid, jaarverslag, risico, herkomst, meldcode, beschermzaak, opvang,
    vrijwilligerportaal, deelnemerportaal, publiek,
    veld, donateur, codeRoteren: require('./coderoteer')(ctx, { partners, gemeente, ondernemers }),
    VLAGGEN: ctx.VLAGGEN, ROLLEN: ctx.ROLLEN
  } };
};
