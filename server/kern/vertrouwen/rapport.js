/* ============================================================================
   DE LEESKANT VAN DE TRUST FABRIC -- lagen 6, 7 en 8, en niets dat schrijft.

   WAAROM DIT EEN EIGEN BESTAND IS. VERTROUWEN.md par. 3.4 belooft dat SIMULEREN
   NIETS VERANDERT, en dat is precies het soort belofte dat sneuvelt zonder dat
   iemand het merkt: er komt een `save()` bij een tegel die "even" een teller wil
   bijhouden, en dan heeft de knop waar iemand op drukt om te KIJKEN een
   bijwerking. Dat is de duurste soort bug, want hij ontstaat bij het toevoegen
   van iets onschuldigs.

   Zolang die functies tussen de schrijvende helft in staan, is dat verschil een
   afspraak. Hier is het een eigenschap van het bestand: er staat geen `save` in,
   en dat is met een oogopslag te zien.

   Wat WEL schrijft -- de gewoonte, het tempo, de verificatie, de poort en de
   bon -- staat in ./index.js.
   ========================================================================== */
'use strict';

const bereik = require('./bereik');
const staat = require('./staat');
const bon = require('./bon');

module.exports = ({ db, bak }) => ({
  bereikVan: (actor, opties) => bereik.van(db.data, actor, opties && opties.rechtenVan),
  simuleer: (actor, opties) => bereik.simuleer(db.data, actor, opties || {}),
  trustState: (handelingen, scanner) => staat.staat(bak(), handelingen, scanner),
  bonnen: (hoeveel) => bon.lees(bak(), hoeveel),
  bonnenKlopt: () => bon.controleer(bak()),
  /* Het anker: de momentopname van de kop, om BUITEN dit huis weg te zetten.
     Hij wordt hier gemaakt en niet bewaard -- een anker in dezelfde database is
     geen anker maar een tweede regel om te wijzigen. */
  bonAnker: () => bon.ankerPunt(bak()),
  bonTegenAnker: (a) => bon.tegenAnker(bak(), a)
});
