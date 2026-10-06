/* De mutatiecontracten van de toestemming voor gezondheidsgegevens en de
   bewaartermijn van een gezin (5 oktober 2026, DPIA-GEZIN.md).

   - De gezinstoestemming hangt aan het gezin uit het lijf (`code`, plus een
     gezinssessie die bij dat gezin hoort): OBJECT_SCOPED. Geven is een stand
     zetten (de eerste datum blijft staan), intrekken wist wat er is; een
     tweede oproep doet dus niets meer.
   - De dagboektoestemming van wie 16 of ouder is: idem, op het eigen profiel.
   - De wisronde van de gezinnen is met opzet geen idempotente handeling maar
     een ronde, net als /api/techniek/bewaren/veeg: hij rekent elke keer opnieuw
     na wat rijp is. Een tweede ronde vindt het gewiste niet meer terug. */
'use strict';
const OP = '2026-10-05';
const AF = (bron) => ({ door: 'Claude, op grond van ' + bron + '; niet door een mens nagelezen', op: OP });
const gezin = { klasse: 'OBJECT_SCOPED', objectVeld: 'code' };

const CONTRACTEN = {
  'POST /api/foundation/gezin/toestemming/gezondheid': {
    mutatieId: 'foundation.gezin.toestemming.gezondheid', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: gezin, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/gezondheidstoestemming.test.js toets 3 en 5 (' + OP + '): twee keer geven gaf twee keer ' +
      'hetzelfde antwoord, twee keer intrekken met WIS gaf twee keer 200 met toestemming: false.', op: OP },
    afgetekend: AF('test/gezondheidstoestemming.test.js')
  },
  'POST /api/rtf/welzijn/toestemming': {
    mutatieId: 'welzijn.dagboek.toestemming', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: gezin, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/gezondheidstoestemming.test.js toets 4 (' + OP + '): twee keer geven gaf twee keer ' +
      'hetzelfde antwoord.', op: OP },
    afgetekend: AF('test/gezondheidstoestemming.test.js')
  },
  'POST /api/techniek/bewaren/gezinnen': {
    mutatieId: 'foundation.gezin.bewaren.veeg', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' }, toegang: { klasse: 'AUTHENTICATED', deur: 'techAuth + eigenaarAlleen' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Een wisronde rekent bij elke oproep opnieuw na welke gezinnen aangekondigd, oud genoeg en nog steeds ' +
      'ongebruikt zijn (foundation/gezinbewaren.js). Een afgespeeld antwoord zou "2 gewist" melden over een ronde die ' +
      'niets heeft gedaan. Zonder bevestig WIS is het een proef die niets verandert.',
    bewijs: { gemeten: 'test/gezinbewaren.test.js B3 (' + OP + '): twee proefrondes gaven hetzelfde getal en wisten ' +
      'niets; de WIS-ronde wiste de twee aangekondigde gezinnen en liet het gebruikte staan.', op: OP },
    afgetekend: AF('test/gezinbewaren.test.js')
  }
};

module.exports = { CONTRACTEN };
