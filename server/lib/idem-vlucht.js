/* ============================================================================
   DE VLUCHTEN VAN DE IDEM-POORT (lib/idem-poort.js)

   Een vlucht is een verzoek met een idem-sleutel dat nog bezig is. Komt er
   tijdens die vlucht een tweede verzoek met dezelfde sleutel binnen (twee
   gelijktijdige dubbeltikken), dan wacht dat tweede op de uitkomst van het
   eerste in plaats van ernaast te draaien. Zonder dit passen ze allebei door
   het gat tussen de controle en de vastlegging; lib/idem.js loste dezelfde
   fout met zijn eigen inVlucht op.

   Dit staat apart van de poort zoals de bewaarkast (idem-kast.js) en de
   sleutelbepaling (idem-sleutelbepaling.js): de poort beslist, deze module
   houdt alleen bij wat er nog onderweg is.
   ========================================================================== */
'use strict';

function maakVluchten() {
  const inVlucht = new Map(); // opslagsleutel -> { afdruk, belofte }

  /* Opent een vlucht en geeft de afronder terug. De afronder werkt precies een
     keer: een tweede aanroep (bijvoorbeeld close na een gewoon antwoord) doet
     niets meer. Een uitkomst null betekent "niets onthouden": een wachtende
     poging doet het werk dan zelf. */
  function open(id, afdruk) {
    let klaar;
    inVlucht.set(id, { afdruk, belofte: new Promise(r => { klaar = r; }) });
    let afgerond = false;
    return (uitkomst) => {
      if (afgerond) return;
      afgerond = true;
      inVlucht.delete(id);
      klaar(uitkomst);
    };
  }

  const vluchten = { bezig: (id) => inVlucht.get(id), open, omvang: () => inVlucht.size };
  return vluchten;
}

module.exports = { maakVluchten };
