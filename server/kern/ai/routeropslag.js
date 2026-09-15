/* WAAR DE ROUTERSCHADUW BLIJFT STAAN -- de bewaarplek onder
   ./routermeting.js, en verder niets.

   WAAROM DIT EEN EIGEN BESTANDJE IS EN GEEN REGEL IN server.js. De declaratie
   van een collectie hoort bij de EIGENAAR en niet in een middenregister
   (kern/eigencollectie.js, en keuringsregel 54 zakt op een dubbele claim).
   ./routermeting.js zelf kan hem niet dragen: die module is een zuivere teller
   die niets van db of save weet, en dat moet zo blijven -- anders is hij in een
   toets niet meer los te draaien.

   WAAROM DE TELLERS ÜBERHAUPT MOETEN BLIJVEN STAAN. De vorige stand hield ze
   in het geheugen van het proces. Dat is voor een schaduwmeting die een
   BESLUIT moet dragen te weinig: "62% had goedkoper gekund" is dan een indruk
   van sinds de laatste herstart, en de vraag is juist wat er over echt verkeer
   gebeurt. Vandaar deze plek, en vandaar dat `stand()` `duurzaam: false` zegt
   zolang hij er niet is -- niet gemeten mag nooit als gemeten langskomen.

   HIER STAAT GEEN MENS IN. De meter levert alleen aantallen per ingang; er gaat
   geen vraag en geen sessiesleutel doorheen, dus deze collectie heeft geen
   bewaartermijn nodig en geen vergetelheidsbezem. Zie de kop van
   ./routermeting.js voor waarom dat een besluit is en geen gemak. */
'use strict';

module.exports = function maakRouteropslag({ db, save }) {
  const eigen = require('../eigencollectie')({
    db, domein: 'kern/ai/routermeting', bezit: { routerschaduw: 'kaart' }
  });
  return {
    /* Lezen schept niets: bij het opstarten is een ontbrekende collectie gewoon
       "nog nooit gemeten", en dat hoort geen lege kaart in de opslag te leggen. */
    lees: () => eigen.kijk('routerschaduw'),
    schrijf: (stand) => {
      const bak = eigen.bak('routerschaduw');
      for (const k of Object.keys(bak)) if (!(k in stand)) delete bak[k];
      Object.assign(bak, stand);
      if (typeof save === 'function') save();
    }
  };
};
