/* Het nagekeken contract van het stroomticket van RTFoundation-onderwijs (4
   oktober 2026, RELEASEKANDIDAAT.md B25; foundation/onderwijs/stroomticket.js).
   De lessleutel verlaat de URL; omdat een EventSource geen koppen stuurt, ruilt
   het scherm zijn sleutel (in de kop) voor een eenmalig ticket dat alleen in
   het adres van de stroom staat. Elke oproep geeft een ander ticket en is dus
   met opzet niet herhaalbaar (lib/eenmalig-geheim-routes.js). Eigen bestand,
   naast ./mutatiecontracten-lesfamilie.js, zodat parallelle migraties elkaars
   lijst niet raken. */
'use strict';
const OP = '2026-10-04';
const CONTRACTEN = {
  'POST /api/foundation/les/stroomticket': { mutatieId: 'foundation.les.stroomticket', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'code',
      uitleg: 'het les-id uit het lijf plus een leraar- of leerlingsleutel van DIE les in de kop; een sleutel van ' +
        'een andere les, een ingetrokken leerling of een gesloten les krijgt 403' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Elke oproep geeft een nieuw eenmalig ticket van dertig seconden. Een herhaling die het vorige ticket ' +
      'teruggaf zou een geheim uit een cache heronthullen; daarom staat de route ook in lib/eenmalig-geheim-routes.js.',
    bewijs: { gemeten: 'test/foundation-lesstroom.test.js: twee oproepen geven twee verschillende tickets, en elk ' +
      'opent de stroom precies een keer, tegen een echte server', op: OP },
    afgetekend: { door: 'Claude, de stroomticketmodule en haar routes gelezen en beproefd', op: OP } }
};
module.exports = { CONTRACTEN };
