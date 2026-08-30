/* ============================================================================
   EEN SESSIE VERFIJNEN -- drie registers, een regel.

   Drie keer achter elkaar kwam dezelfde vorm boven: de bewakerskaart zegt
   welke SOORT sessie een route vraagt, en de handeling erachter vraagt daar
   iets specifiekers van.

     member   -> member-account    er moet een ACCOUNT achter de pas zitten
     supplier -> zaak-persoonlijk  er moet een PERSOON achter de zaak zitten
     office   -> kantoor-op-naam   er moet iemand ZITTEN, geen gedeelde code

   Alle drie zijn ze een verfijning en geen tegenspraak: de soort deur blijft
   dezelfde, alleen wie er aanklopt wordt scherper. En alle drie dragen ze
   dezelfde grens, want zonder die grens gaat het mis op precies dezelfde
   manier: vanaf een ANDERE rol is het geen verfijning maar een ander antwoord,
   en dan weet een routetabel het beter dan de bewakerskaart. Dat is hoe
   `openbaar` ooit `member-zakelijk` werd (zie NOOIT_OPWAARDEREN in
   ./lijfsleutels.js).

   Die regel stond in drie bestanden. Deze module roept ze op volgorde aan en
   is de enige plek waar de proef ze hoeft te kennen; de registers houden hun
   eigen redenering, want die verschilt per geval en hoort bij de data. */
'use strict';

const { accountRolVoor } = require('./accountroutes');
const { persoonsRolVoor } = require('./persoonsroutes');
const { kantoorRolVoor } = require('./kantoorroutes');

/* Op volgorde. Ze sluiten elkaar uit -- elk register verfijnt een andere
   uitgangsrol -- dus de volgorde is een vorm en geen voorrang. */
const REGISTERS = [
  { naam: 'account',  van: 'member',   naar: 'member-account',   beslis: accountRolVoor },
  { naam: 'persoon',  van: 'supplier', naar: 'zaak-persoonlijk', beslis: persoonsRolVoor },
  { naam: 'kantoor',  van: 'office',   naar: 'kantoor-op-naam',  beslis: kantoorRolVoor }
];

/* Geeft { rol, register } als er verfijnd wordt, anders { rol: null }.
   `heeftSleutel` is verplicht: verfijnen naar een rol waar geen sessie voor
   is opgehaald zou de proef zonder sleutel laten aankloppen, en dat meet
   niets terwijl het er in de uitslag uitziet als een gemeten route. */
function verfijn(huidigeRol, pad, heeftSleutel) {
  for (const r of REGISTERS) {
    const uit = r.beslis(huidigeRol, pad);
    if (!uit.rol) continue;
    if (!heeftSleutel(uit.rol)) {
      return { rol: null, register: r.naam,
        reden: 'er is geen sessie opgehaald voor `' + uit.rol + '`' };
    }
    return { rol: uit.rol, register: r.naam, reden: null };
  }
  return { rol: null, register: null, reden: 'geen register verfijnt dit pad' };
}

module.exports = { REGISTERS, verfijn };
