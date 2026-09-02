/* ============================================================================
   MUTATIECONTRACT -- DE KNELPUNTMOTOR.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels. De route staat in server/routes/knelpunt.js, de motor in
   server/kern/knelpunt/.

   EEN ROUTE DIE MET OPZET NIETS BEWAART. Alles komt binnen in het lijf en gaat
   eruit als antwoord; er is geen opslagroute en die komt er ook niet. Zodra een
   uitkomst bewaard wordt, ontstaat er een dossier met wegen en blokkades per
   mens -- precies het bestand dat HDI.md par. 5.1 verbiedt. Dat is geen
   ontbrekende functie maar de grens zelf, en daarom staat hij hier en niet in
   een lijst met "nog te bouwen".
   ========================================================================== */
'use strict';

const { AFGETEKEND, OP } = require('./mutatiecontracten-beschermzaak-op');

const CONTRACTEN = {
  'POST /api/knelpunt': {
    mutatieId: 'knelpunt.reken', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    nagekeken: 'Claude, 2026-09-02: de handler roept kern/knelpunt/index.js aan en daarna, alleen ' +
      'bij een geslaagde berekening, kern/knelpunt/openingen.js. Geen van beide raakt opslag aan -- ' +
      'ze krijgen alles als argument, hebben geen db, geen save() en geen ctx, en zijn om die reden ' +
      'ook zonder database te toetsen (zelfde vorm als kern/livinglab/graden.js). De openingenlaag ' +
      'LEEST bovendien niets uit de database: haar kaart is een vaste meetuitslag in ' +
      'kern/knelpunt/openingen-kaart.js. De route zelf schrijft evenmin.',
    bewijs: {
      gemeten: 'ronde tegen een draaiende server (2 sep 2026, herhaald na de reparatie van de ' +
        'openingenlaag -- de eerste ronde mat code die inmiddels veranderd was, en een meting van ' +
        'oude code is geen bewijs): drie identieke oproepen gaven byte-voor-byte identieke ' +
        'antwoorden, en de som over server/data/rtg.db en store.db was voor en na die drie oproepen ' +
        'gelijk -- dus niet alleen even groot maar ongewijzigd. Zonder inlog antwoordt de route 401.',
      op: OP
    },
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
