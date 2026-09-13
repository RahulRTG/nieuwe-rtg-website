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
      'kern/knelpunt/openingen-kaart.js. De route zelf schrijft evenmin. ' +
      'BIJGEWERKT Claude, 2026-09-13: er hangt sinds vandaag een AANVOERLAAG naast ' +
      '(kern/knelpunt/aanvoer*.js), en die LEEST wel -- openVacatures loopt over db.data.vacatures en ' +
      'de Beroepen-Bibliotheek rekent procedureel. Lezen is geen schrijven en de klasse verandert dus ' +
      'niet, maar de oude zin "geen van beide raakt opslag aan" dekte de route niet meer zodra de ' +
      'aanvoer erbij kwam. Geen van de bronnen roept save() aan; kern/knelpunt/aanvoer-bronnen.js ' +
      'geeft ze de randvoorwaarde en verder niets, en wat zij teruggeven wordt gekeurd en weggeschreven ' +
      'in het ANTWOORD, nergens anders.',
    bewijs: {
      gemeten: 'ronde tegen een draaiende server (2 sep 2026, herhaald na de reparatie van de ' +
        'openingenlaag -- de eerste ronde mat code die inmiddels veranderd was, en een meting van ' +
        'oude code is geen bewijs): drie identieke oproepen gaven byte-voor-byte identieke ' +
        'antwoorden, en de som over server/data/rtg.db en store.db was voor en na die drie oproepen ' +
        'gelijk -- dus niet alleen even groot maar ongewijzigd. Zonder inlog antwoordt de route 401.',
      op: OP
    },
    afgetekend: AFGETEKEND
  },

  /* DE FOUNDATION-DEUR OP DEZELFDE MOTOR (besluit van de eigenaar, 13 september
     2026). Hij staat hier als een EIGEN contract en niet als een regel bij de
     vorige, want de toegangsklasse verschilt echt: /api/knelpunt vraagt om een
     ingelogde identiteit, deze om een specifiek GEZIN uit het verzoek. Twee
     deuren met een verschillende sleutel horen twee contracten te hebben, ook
     als de handler erachter dezelfde is. */
  'POST /api/rtf/knelpunt': {
    mutatieId: 'knelpunt.reken.gezin', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    /* OBJECT_SCOPED en niet AUTHENTICATED: de toegang hangt aan het gezin dat
       in het lijf staat (`code` + `token`, nagekeken door rtf.verifieerProfiel).
       Twee mensen met dezelfde rol krijgen hier hetzelfde antwoord, maar alleen
       met een geldig profiel van HUN gezin -- zonder dat is het 403. */
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'code',
      uitleg: 'het gezin uit `code`, en alleen met het `token` dat bij DAT gezin hoort -- '  +
        'rtf.verifieerProfiel() keurt het paar. De code wijst het object aan, het token bewijst het.' },
    stand: 'NOT_APPLICABLE',
    nagekeken: 'Claude, 2026-09-13: dezelfde handler als POST /api/knelpunt -- `beantwoord()` in ' +
      'routes/knelpunt.js staat een keer en beide deuren roepen hem aan, juist zodat een gezin nooit ' +
      'een ander antwoord kan krijgen dan een lid. De gezinssessie wordt ALLEEN gebruikt om de deur te ' +
      'openen: er gaat niets van `sess` mee naar de motor, de openingen of de aanvoer. Schrijft niets, ' +
      'om dezelfde redenen als hierboven.',
    bewijs: {
      gemeten: 'ronde tegen een wegwerpserver (13 sep 2026): een gezinsprofiel en een lid stelden ' +
        'dezelfde vraag en kregen een byte-voor-byte identiek `vondsten`-blok (25 vondsten, twee ' +
        'terreinen, een vorm). Zonder gezinssessie antwoordt de route 403 "Log opnieuw in bij je ' +
        'gezin." Geen enkele vondst draagt een veld uit MENSVELDEN. Vastgelegd als schakel 12 van ' +
        'scripts/adamproef.js, die bij een tweede oproep dezelfde uitslag geeft.',
      op: OP
    },
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
