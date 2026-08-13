/* Domein "horeca": RTG Horeca OS -- de enterprise-laag bovenop de bestaande
   kassa, tafels, keuken, reserveringen, verblijf en events.

   Dit bestand is alleen de bedrading: het bouwt de gedeelde horeca-context
   (kern/horeca.js) een keer bij het opstarten en mount de deellagen daarop.
   Elke deellaag registreert zijn eigen routes onder /api/supplier/horeca/...,
   en valt daarmee onder de bestaande partner-functie in de schakelkast.

   Wat hier NIET opnieuw wordt gebouwd, en waarom: de losse kassaverkoop,
   derving, retour, kasopmaak en het dagrapport staan al in
   routes/supplier/kassa/, de tafelstatussen in tafels-team.js, de
   reserveringen in reserveringen.js, de keukenvoorraad en recepten in
   keuken.js en de hotelkamers in verblijf.js. Deze laag zet daar de dingen
   naast die een horecasysteem tot een besturingssysteem maken: een rekening
   die blijft leven (splitsen, samenvoegen, verhuizen, gangen), de bonnen, en
   verderop de keukenschermen, bezorgzones, clubtegoeden en de gastrekening
   van het hotel. */
module.exports = (kern) => {
  const horeca = require('../../kern/horeca')(kern);
  const polslaag = require('../../kern/horeca/pols')({ save: kern.save, schoon: kern.schoon, horeca });
  const clublaag = require('../../kern/horeca/clublaag')({ save: kern.save, schoon: kern.schoon, horeca });
  /* Dezelfde verzoekenlaag als de gastkant leest: de opslag zit in
     db.data.horeca[code].verzoeken, dus dit is een tweede lezer en geen
     tweede lijst. */
  const verzoeklaag = require('../../kern/gast/verzoek')({ save: kern.save, schoon: kern.schoon, horeca });
  const ctx = Object.assign({}, kern, { horeca, polslaag, clublaag, verzoeklaag });
  require('./horeca/rekening')(ctx);   // openen, regels, gangen, lijst
  require('./horeca/schuif')(ctx);     // verplaatsen, samenvoegen, splitsen
  require('./horeca/betalen')(ctx);    // korting, fooi, betalen, oninbaar
  require('./horeca/bonnen')(ctx);     // cadeaubon en tegoed, offline-sync, happy hour
  require('./horeca/keuken')(ctx);     // het keukenscherm: stations en standen
  require('./horeca/keuken-regie')(ctx); // het regiescherm van de chef en de drukterem
  require('./horeca/journey')(ctx);     // één gastreis en gangsynchronisatie voor alle schermen
  require('./horeca/dish-twin')(ctx);   // gerechtbrein, chefversies, stations en mise-en-place
  require('./horeca/spatial-command')(ctx); // venue twin, veilige golven, overdracht en herstel
  require('./horeca/invisible-arrival')(ctx); // één wens, capacity twin, promises en tijdelijke pass
  require('./horeca/simulation-bridge')(ctx); // anonieme Magnaat-brug; alleen voorstellen terug
  require('./horeca/bezorging')(ctx);  // bezorgzones en tijdsloten
  require('./horeca/bezorgrit')(ctx);  // gecombineerde route en afleverbewijs
  require('./horeca/club')(ctx);       // polsbandtegoed en minimum spend op een VIP-tafel
  require('./horeca/clubdeur')(ctx);   // de gastenlijst (incl. aanvragen van leden) en de deurteller
  require('./horeca/folio')(ctx);      // de gastrekening van het hotel: nachtrun, borg, afrekenen
  require('./horeca/event')(ctx);      // offerte, akkoord, aanbetaling, nacalculatie
  require('./horeca/haccp')(ctx);      // temperaturen, batches en THT, controlelijsten
  require('./horeca/personeel')(ctx);  // fooienpot, loonkosten tegenover omzet, gastprofiel
  require('./horeca/dashboard')(ctx);  // dagbeeld per kanaal en de signalen
  require('./horeca/gastbeheer')(ctx); // de zaakkant van de gastendeur: QR, uitverkocht, beleid, bevestigen
  require('./horeca/pols')(ctx);       // de pols: wat gemeten wordt, wat de zaak invult, wat gasten melden
  require('./horeca/verzoeken')(ctx);  // wat gasten vragen: oud bovenaan, met de minuten erbij
};
