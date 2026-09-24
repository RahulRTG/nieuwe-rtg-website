/* Magnaat Economische Motor -- welke schok een dag treft.

   Deterministisch: een vast schema van twaalf dagen, tenzij iemand een
   scenario heeft klaargezet; dat geldt dan voor precies de volgende dag. */
'use strict';
const { SCHOKKEN } = require('./constanten');

module.exports = () => {
  function schokZonderMutatie(e, dag) {
    if (e.geforceerdeSchok) return SCHOKKEN.find(s => s.id === e.geforceerdeSchok) || SCHOKKEN[0];
    const patroon = { 3: 'vraagpiek', 6: 'leveranciersuitval', 9: 'arbeidstekort' };
    const cyclus = dag % 12;
    return SCHOKKEN.find(s => s.id === patroon[cyclus]) || SCHOKKEN[0];
  }

  function schokVoorDag(e) {
    const gekozen = schokZonderMutatie(e, e.dag);
    if (e.geforceerdeSchok) e.geforceerdeSchok = null;
    return gekozen;
  }

  return { schokZonderMutatie, schokVoorDag };
};
