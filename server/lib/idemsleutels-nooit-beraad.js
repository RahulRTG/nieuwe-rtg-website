/* HET BERAAD bij ./idemsleutels-nooit-gemeenschap.js -- zes routes die het ZELF al
   weten. Vijf herkennen een herhaling en geven `herhaling: true` zonder iets te
   veranderen; heropenen weigert hem met 409. Een duplicaatlaag hoort daar NIET
   tussen, en de reden is bij alle zes dezelfde vorm: het venster van de laag is
   kort, maar lang genoeg voor een wijziging en een terugwijziging. Wie binnen
   dat venster voor, tegen en weer voor stemt, kreeg het eerste antwoord
   afgespeeld terwijl de stem op tegen bleef staan -- de laag maakt dan een
   handeling ongedaan zonder dat iemand het ziet. Gemeten in
   test/beraad-server.test.js toets 6 (MUTATIECONTRACT.md par. 5o). */
'use strict';

const ZELF = 'herkent een herhaling zelf en verandert dan niets; een afgespeeld eerder antwoord zou een ' +
  'tussentijdse wijziging binnen het venster stil ongedaan maken';

module.exports = Object.freeze({
  'POST /api/beraad/voorstel': ZELF + ' (versie 1, versie 2, weer versie 1 bleef op versie 2 staan)',
  'POST /api/beraad/naar-stemmen': ZELF + ' (een nieuw voorstel zet de ronde terug; nog eens naar stemmen moet dan echt gebeuren)',
  'POST /api/beraad/stem': ZELF + ' (voor, tegen, weer voor zou op tegen blijven staan)',
  'POST /api/beraad/sluit': ZELF + '; de eerste sluiting blijft leidend en een herhaling stuurt geen tweede bericht',
  'POST /api/beraad/terugkoppeling-gezien': ZELF + '; een trede gaat nooit terug',
  'POST /api/beraad/heropen':
    'weigert met 409 zolang de nieuwe ronde loopt; een afgespeeld succes laat een tweede beheerder ' +
    'denken dat HIJ de nieuwe ronde opende, en er ontstaat geen derde ronde'
});
