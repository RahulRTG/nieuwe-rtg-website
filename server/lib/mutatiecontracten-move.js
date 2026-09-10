/* ============================================================================
   MUTATIECONTRACTEN -- RTG MOVE. Drie routes, en alle drie lezen ze.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm.

   MUTATIECONTRACT.md verbiedt `onbekend` voor wat nieuw publiek aanroepbaar
   wordt, dus staan deze drie er VOORAF -- eerst het contract, dan de route.

   DE GROND IS HIER ANDER DAN IN ./mutatiecontracten-leest.js, en dat verschil
   hoort in het register te staan. Daar rust NOT_APPLICABLE op een MEETING (een
   kale ronde plus een statische schrijfanalyse). Hier rust hij op de BOUW: RTG
   Move heeft geen schrijfweg. De laag bezit geen collectie, en
   test/move.test.js toets 12 laat de bouw zakken zodra een van de drie modules
   `db.data` of `save()` aanraakt. Dat is een grendel en geen waarneming van twee
   oproepen -- sterker bewijs, en van een andere soort.

   Ze zijn dus ook idempotent in de sterkste zin die er is: er is niets om een
   tweede keer te doen. Een tweede aanroep rekent hetzelfde nog een keer uit.

   WAT DIT CONTRACT NIET DEKT: de dag dat Move een route krijgt die WEL iets
   verandert. Die bestaat met opzet niet (een transfer verzetten raakt een
   chauffeur, en dat gebeurt in het domein na een bevestiging door een mens --
   MOVE.md grens 5). Komt hij er ooit, dan hoort hij hier niet bij en krijgt hij
   zijn eigen regel.
   ========================================================================== */
'use strict';

const AFGETEKEND = 'Claude, 2026-09-10: opgesteld bij het bouwen van de laag zelf. ' +
  'De grond is de BOUW en niet een meting -- zie de kop.';

const leestMove = (route, mutatieId) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' },
  stand: 'NOT_APPLICABLE',
  bewijs: {
    gemeten: 'de laag heeft geen schrijfweg: server/kern/move/ bezit geen collectie en raakt ' +
      'db.data noch save() aan, afgedwongen door test/move.test.js toets 12',
    op: '2026-09-10'
  },
  nagekeken: 'test/move.test.js toets 12, 2026-09-10: leest de bron van naad.js, haalbaar.js en ' +
    'gevolg.js en zakt op elke aanraking van db.data, save() of fs -- de grendel staat in de toets ' +
    'en niet in een document',
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  /* Is deze reis haalbaar: per overgang een oordeel, met de dekking erbij. */
  leestMove('POST /api/move/reis', 'move.reis'),
  /* Wat een verschuiving doet met de rest van de reis. Zet voorstellen KLAAR
     met `uitgevoerd: false`; verandert zelf niets. */
  leestMove('POST /api/move/gevolg', 'move.gevolg'),
  /* De volgende beweging, voor de Continue Key. Leidt af en verzint niets. */
  leestMove('POST /api/move/volgende', 'move.volgende')
]);

module.exports = { CONTRACTEN };
