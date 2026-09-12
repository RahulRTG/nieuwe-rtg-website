/* HET CORPUS VAN DE DETERMINISTISCHE RAIL -- vastgelegde zinnen, niets meer.

   Elke regel zegt wat de rail bij die zin DOET (`stappen`, `projectie`) en wat
   de proef eraan mag VERWACHTEN (`klasse`, `maxMandaat`, `sideEffect`, ...).
   Die twee staan met opzet naast elkaar in één bestand maar worden door twee
   verschillende partijen gelezen: de rail leest alleen `stappen` en
   `projectie` en kijkt nooit naar de verwachtingen -- anders zou het corpus
   zichzelf gelijk geven.

   DE SLEUTEL IS DE GENORMALISEERDE ZIN: kleine letters, leestekens weg,
   spaties samengetrokken. Zie ./rail-corpus.js. Staat een zin er niet in, dan
   is het antwoord NIET_HERKEND en gebeurt er niets. Dat is de bedoeling.

   DE PADEN HIERONDER ZIJN ECHT en komen uit de allowlist van ./beleid.js --
   niet verzonnen. Een corpus dat naar een verzonnen pad wijst, bewijst dat het
   plan terecht wordt afgewezen en verder niets.

   WAT HET BOUWEN VAN DIT CORPUS AAN HET LICHT BRACHT, en het hoort hier omdat
   het de gouden slice raakt: op de member-allowlist staat GEEN ENKEL REISPAD.
   Wel kantoorpakket, onderwijs, leerstof, bijles, mediaos, agenda, locatie,
   asset, site en meet -- maar /api/reisbureau/*, /api/reis/* en /api/trip/*
   zijn alle drie `verboden` voor de wereld `member`. "parijs vrijdag" kan de
   RTG-machine dus wel doorlopen (de kaart versmalt, de projectie ontstaat),
   maar er is vandaag geen reis-capability om naar toe te leiden. Dat is een
   besluit van de eigenaar en geen gat dat dit corpus mag dichtschrijven: wie
   hier een reispad neerzet dat niet op de allowlist staat, krijgt een plan dat
   terecht zakt en een proef die daar niets van laat zien. */
'use strict';

module.exports = {
  /* ACTION, en de dragende zin van de opdracht. Met opzet ALLEEN `kaart`:
     dat roept de echte resolver aan op de echte allowlist, en de projectie
     zegt wat er kan zonder iets te beloven wat er niet is. Zodra er een
     reispad op de allowlist staat, hoort hier een `plan`-stap bij -- en dan
     pas, want een planstap naar een verboden pad bewijst niets. */
  'parijs vrijdag': {
    klasse: 'ACTION',
    context: 'geen',
    verwachtDoel: 'reis',
    ambigu: false,
    maxMandaat: 'tonen',
    sideEffect: false,
    blockingVraagMax: 1,
    architectuurKeuzes: 0,
    stappen: [
      { tools: [{ name: 'kaart', input: {} }] }
    ],
    projectie: 'Parijs · vrijdag\nIk kan je laten zien wat er kan. Waar wil je vertrekken?'
  },

  /* ACTION met een ECHTE planstap, zodat compileer() en voorspel() werkelijk
     draaien. /api/agenda/toevoegen staat op de VOORSTEL-lijst van member: een
     wijziging die eerst een servervoorstel oplevert en die een mens bevestigt.
     Precies het gedrag dat de plafondlaag op `tonen` moet tegenhouden. */
  'zet vrijdag in mijn agenda': {
    klasse: 'ACTION',
    context: 'geen',
    verwachtDoel: 'agenda',
    ambigu: false,
    maxMandaat: 'tonen',
    sideEffect: false,
    blockingVraagMax: 1,
    architectuurKeuzes: 0,
    stappen: [
      { tools: [{ name: 'kaart', input: {} }] },
      { tools: [{ name: 'plan', input: {
        doel: 'een afspraak op vrijdag in de agenda zetten',
        stappen: [
          { id: 's1', capability: '/api/agenda/mijn', invoer: {},
            uitkomst: 'wat er al op vrijdag staat' },
          { id: 's2', capability: '/api/agenda/toevoegen', invoer: {}, afhankelijkVan: ['s1'],
            uitkomst: 'de nieuwe afspraak staat klaar ter bevestiging' }
        ] } }] }
    ],
    projectie: 'Vrijdag · agenda\nIk heb klaargezet wat er zou veranderen. Bevestigen doe je zelf.'
  },

  /* INFORMATION. Geen enkele tool: een vraag om uitleg hoort de operationele
     motor niet te raken, en dat moet aantoonbaar zo blijven na de routewissel.
     Dit is de regel uit de opdracht die het scherpst is: GEEN ENKELE BESTAANDE
     VRAAG MAG DOOR DE ROUTEWISSEL AUTOMATISCH EEN SIDE EFFECT KRIJGEN. */
  'wat is travelos': {
    klasse: 'INFORMATION',
    context: 'geen',
    verwachtDoel: 'uitleg',
    ambigu: false,
    maxMandaat: 'geen',
    sideEffect: false,
    blockingVraagMax: 0,
    architectuurKeuzes: 0,
    stappen: [],
    projectie: 'TravelOS is de wereld waarin je reizen worden geregeld: boeken, ' +
      'onderweg zijn, en wat er daarna nog moet gebeuren.'
  }
};
