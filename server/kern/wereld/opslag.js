/* ============================================================================
   HET OPSLAGCONTRACT VAN DE WERELD -- de enige deur van dit domein naar db.data.

   db.data.wereld is EEN wortel met takken, dezelfde vorm als kern/concern en
   kern/veiligheid. Vijf bestanden schreven er elk hun eigen tak in, en elk
   herhaalde daarvoor dezelfde twee regels ("maak de wortel, maak de tak"):
   kern/wereld/bezoek.js, lijsten.js en profiel.js, routes/wereld.js (de modus)
   en opzet/kernlaag4.js (de voorkeur van de Saloon). Vijf deuren waar er een
   hoort, en de ratels `dbDeuren` en `dbDeurenSchrijvend` telden ze.

   VIJF TAKKEN, EN GEEN ERBIJ. `tak()` weigert een naam die niet in het register
   staat: een tak die niemand opschreef, kan niemand verhuizen.

   PAKKEN EN PEILEN ZIJN TWEE DINGEN.
   - `tak(naam)` MAAKT wortel en tak aan, omdat er zo meteen in geschreven wordt.
   - `peil(naam)` maakt niets aan en geeft null als de tak er niet is. Dat is de
     weg voor een leesroute: PostgreSQL weigert terecht een lezer die stil een
     collectie aanlegt zonder opslagcommit (de opmerking bij mijnModus in
     routes/wereld.js).

   WAT DIT BESTAND MET OPZET NIET DOET: geen bewaartermijn (bezoek.js kapt zelf
   op TTL_MS), geen zichtbaarheidsregels (profiel.js en zicht.js), geen rechten
   (rechten.js). Die zijn domeinkennis en blijven bij hun eigenaar.

   WAT DE WERELD VAN ANDEREN LEEST staat hier niet: feed, inzicht, netwerk en
   profiel lezen posts, pulse, zakelijk, salon, connections, suppliers en
   accountRollen. Dat zijn lezers van andermans collecties, geen schrijvers, en
   die draden wegtrekken is een eigen ronde.
   ========================================================================== */
'use strict';

const TAKKEN = {
  bezoek:  { wat: 'per profiel: wie het opende en wanneer (kern/wereld/bezoek.js, met TTL)' },
  lijsten: { wat: 'per lid en soort: de eigen lijsten (leads, kandidaten, ...) (kern/wereld/lijsten.js)' },
  zicht:   { wat: 'per lid: wie welk profielveld mag zien (kern/wereld/profiel.js)' },
  modus:   { wat: 'per lid: de gekozen modus, een voorkeur en geen recht (routes/wereld.js)' },
  saloon:  { wat: 'per lid: de voorkeur van de Saloon-feed (kern/wereld/saloon, via opzet/kernlaag4.js)' }
};

const isKaart = (w) => !!w && typeof w === 'object';

module.exports = function maakWereldOpslag({ db }) {
  if (!db) throw new Error('kern/wereld/opslag: zonder db is er niets om te bewaren');

  function eis(naam) {
    if (!TAKKEN[naam]) {
      throw new Error('kern/wereld/opslag: onbekende tak "' + naam + '" -- zet hem eerst in TAKKEN');
    }
  }

  /* PAKKEN: maakt wortel en tak aan. Alleen aanroepen als er geschreven gaat worden. */
  function tak(naam) {
    eis(naam);
    if (!isKaart(db.data.wereld)) db.data.wereld = {};
    const w = db.data.wereld;
    if (!isKaart(w[naam])) w[naam] = {};
    return w[naam];
  }

  /* PEILEN: maakt NIETS aan. */
  function peil(naam) {
    eis(naam);
    const w = db.data && db.data.wereld;
    return isKaart(w) && isKaart(w[naam]) ? w[naam] : null;
  }

  return { tak, peil, TAKKEN };
};

module.exports.TAKKEN = TAKKEN;
