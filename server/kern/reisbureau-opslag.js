/* ============================================================================
   HET OPSLAGCONTRACT VAN HET REISBUREAU -- de deur naar de twee collecties van
   RTG Reizen: het aanbod (db.data.partnerTrips) en de aanvragen
   (db.data.reisAanvragen).

   WAAROM EEN DEUR EN NIET TWEE EIGENAREN DIE ELKAAR LEZEN. ./reisaanbod.js
   schrijft het aanbod en telt de open aanvragen erbij; ./reisbureau.js schrijft
   de aanvragen en leest het aanbod; ./reisbureau-besluit.js leest een aanvraag
   om er een besluit op te zetten. Drie bestanden die elk in db.data keken, en
   twee die er schreven -- met elk een eigen vormcontrole (de een met
   Array.isArray, de ander met `|| []`). Het is EEN domein met twee collecties,
   dus een deur, zoals kern/connect/opslag.js voor zijn drie.

   kern/eigencollectie.js past hier met opzet niet: de twee collecties hebben
   elk een andere schrijver binnen hetzelfde domein, en eigencollectie kent
   per collectie precies een eigenaarsbestand. Wie hem toch zo inzet, maakt van
   ./reisaanbod.js een indringer in keuringsregel 63 terwijl hij het aanbod
   juist BEZIT.

   PAKKEN EN LEZEN ZIJN TWEE DINGEN.
   - `pakReizen()` / `pakAanvragen()` maken de lijst aan als hij er niet is,
     omdat er zo meteen in geschreven wordt -- de vorm die de schrijvers
     altijd al gebruikten.
   - `reizen()` / `aanvragen()` maken NIETS aan; een ontbrekende lijst is leeg.
   - `zetAanvragen(lijst)` vervangt de lijst, voor de kap op 5000.

   WAT DIT BESTAND MET OPZET NIET DOET: geen prijslogica (de nettoprijs-projectie
   blijft reisAanbod() in ./reisbureau.js, LAT-regel 4), geen standen (de
   besluitlaag), geen rechten. En de lezers BUITEN dit domein (de Mall-
   bestellingen, de spaarpot, de kernlaag-telling) staan hier nog niet achter.
   ========================================================================== */
'use strict';

const REGISTER = {
  partnerTrips:  { soort: 'lijst', schrijver: 'kern/reisaanbod.js', wat: 'het samengestelde reisaanbod (ook het partnerkanaal)' },
  reisAanvragen: { soort: 'lijst', schrijver: 'kern/reisbureau.js', wat: 'de aanvragen van leden, nieuwste eerst' }
};

module.exports = function maakReisOpslag({ db }) {
  if (!db) throw new Error('kern/reisbureau-opslag: zonder db is er niets om te bewaren');

  const lees = (naam) => (db.data && Array.isArray(db.data[naam]) ? db.data[naam] : []);
  const pak = (naam) => (Array.isArray(db.data[naam]) ? db.data[naam] : (db.data[naam] = []));

  return {
    REGISTER,
    reizen: () => lees('partnerTrips'),
    pakReizen: () => pak('partnerTrips'),
    aanvragen: () => lees('reisAanvragen'),
    pakAanvragen: () => pak('reisAanvragen'),
    zetAanvragen: (lijst) => (db.data.reisAanvragen = lijst)
  };
};

module.exports.REGISTER = REGISTER;
