/* ============================================================================
   DE BEDOELING PER SCHRIJFROUTE VAN HET BELLEN.

   Het vierde deel naast ./mutatiecontracten-service.js (het lid),
   ./mutatiecontracten-service-kantoor.js (het kantoor) en
   ./mutatiecontracten-service-zaak.js (een zaak). Daar staan de kop, de
   aftekening, de meetronde en de vormen die hier worden hergebruikt.

   DE KALE RONDE VOND HIER OOK IETS, en de toets zag het niet: twee keer op
   bellen drukken maakte een tweede ZAAK aan. De controle op een lopende oproep
   stond namelijk NA het aanmaken van de zaak, dus de tweede druk maakte netjes
   een lege tweede zaak en gaf daarna het bestaande gesprek terug -- geen tweede
   rinkel, wel een lege zaak in de wachtrij. De toets keek naar het gesprek en
   niet naar het aantal zaken. Opgelost door de volgorde om te draaien, en beide
   staan nu in de toets.

   EEN SIGNAALROUTE IS EEN DOORGEEFLUIK EN GEEN SCHRIJFACTIE. `bel/signaal`
   verplaatst een WebRTC-pakket van de ene kant naar de andere en raakt de
   opslag niet -- gemeten, niet aangenomen. Dat maakt hem NOT_APPLICABLE, en dat
   is hier belangrijk: een ICE-onderhandeling stuurt tientallen berichten per
   gesprek, en wie die als schrijfacties telt, laat de wachtrij ontploffen.
   ========================================================================== */
'use strict';

const { LEEST, TWEEDE, BESCHERMD, AFGETEKEND, OP, zetel } = require('./mutatiecontracten-service');

const CONTRACTEN = Object.assign({},
  LEEST('POST /api/service/bel/mijn', 'service.bel.mijn',
    'gesprek.mijne() en magBellen(); een filter over de collectie plus een tabelvraag'),
  LEEST('POST /api/office/service/gesprekken', 'office.service.gesprekken',
    'gesprek.rij(): de oproepen die nu rinkelen of lopen, met stand() uit de klok'),

  BESCHERMD('POST /api/service/bel', 'service.bel',
    'een lopende oproep van dezelfde melder wordt teruggegeven in plaats van herhaald -- en die ' +
    'controle staat VOOR het aanmaken van de zaak, want anders kost elke druk een lege zaak'),
  BESCHERMD('POST /api/office/service/gesprek/neem', 'office.service.gesprek.neem',
    'een oproep die al bezig is wordt geweigerd met zijn stand erbij; opnemen kan een keer'),
  BESCHERMD('POST /api/office/service/gesprek/eind', 'office.service.gesprek.eind',
    'een gesprek dat al voorbij is blijft voorbij en krijgt geen tweede eindregel in de tijdlijn'),

  /* De ledenkant van ophangen loopt op dezelfde kern uit, maar draagt een eigen
     toegangsklasse: de melder mag alleen zijn EIGEN gesprek beeindigen, en dat
     wordt in de route gecontroleerd en niet in de kern. */
  {
    'POST /api/service/bel/eind': {
      mutatieId: 'service.bel.eind',
      semantiek: { klasse: 'idempotent' },
      toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'gesprek',
        uitleg: 'het gesprek uit `gesprek`, en alleen dat van de melder zelf' },
      stand: 'PROTECTED',
      herkomst: 'mens',
      afgetekend: AFGETEKEND,
      bewijs: { gemeten: 'kale ronde: de tweede aanroep liet de opslag ongewijzigd. Eigen afhandeling ' +
        'in de kern: een gesprek dat al beeindigd is krijgt geen tweede eindregel', op: OP }
    }
  },

  /* De twee doorgeefluiken. Zie de kop: dit is geen schrijfactie. */
  LEEST('POST /api/service/bel/signaal', 'service.bel.signaal',
    'gesprek.signaal(): controleert de richting en geeft het pakket door langs sseToOffice; ' +
    'er wordt niets bewaard, ook het pakket zelf niet'),
  LEEST('POST /api/office/service/gesprek/signaal', 'office.service.gesprek.signaal',
    'spiegelbeeld van de ledenkant: richting bewaken en doorgeven langs sseToCustomer, zonder opslag')
);

module.exports = { CONTRACTEN };
