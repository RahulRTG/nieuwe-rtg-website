/* Nagekeken contracten van de BEVESTIGDE AANKOMST (NAVIGATIE.md N3 en N13).
   Een aankomst is een bevestiging van het lid of van de zaak die zijn
   bestemming is, en nooit meer een positie binnen 150 m. Wie het eerst
   bevestigt is genoeg; een tweede bevestiging, van wie ook, verandert de stand
   niet en stuurt geen tweede bericht (kern/live.js bevestigAankomst, de tak
   `al`). */
'use strict';
const AF = { door: 'Claude, kern/live.js en beide routes gelezen en beproefd', op: '2026-09-29' };
const BEWIJS = { gemeten: 'test/onderweg-positie.test.js 6 en 7: een tweede bevestiging, door het lid en daarna door de ' +
  'zaak, laat aankomstAt en aankomstDoor ongemoeid; een zaak die niet de bestemming is krijgt 404', op: '2026-09-29' };
const CONTRACTEN = {
  'POST /api/live/aangekomen': {
    mutatieId: 'live.aankomst.lid', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
    bewijs: BEWIJS, afgetekend: AF
  },
  'POST /api/supplier/guest/aangekomen': {
    mutatieId: 'live.aankomst.zaak', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'codename',
      uitleg: 'de codenaam wijst een gast aan die live onderweg is naar DEZE zaak; een gast met een andere bestemming geeft 404' },
    stand: 'PROTECTED', bewijs: BEWIJS, afgetekend: AF
  }
};
module.exports = { CONTRACTEN };
