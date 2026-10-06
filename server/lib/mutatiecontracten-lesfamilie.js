/* Nagekeken contracten van de lescredentials van RTFoundation-onderwijs (29
   september 2026, RELEASEKANDIDAAT.md B17; foundation/onderwijs/toegang.js).
   Maken, meedoen en roteren tonen elk een kale code of sleutel precies een keer
   en zijn dus met opzet niet herhaalbaar (lib/eenmalig-geheim-routes.js);
   intrekken en sluiten zijn een stand die een tweede keer niets meer verandert.

   /les/maak stond in ./mutatiecontracten-wachtrij.js als PROTECTED, beschermd
   door de duplicaatregel `zelfdeVerzoek` in ./idemsleutels-kaleronde.js. Die
   regel HERHAALDE het antwoord -- dus ook de kale lescode en de leraarssleutel.
   Met hash-only codes mag dat niet meer: de regel is weg en de route staat hier.

   /les/join stond tijdelijk in MUTATIECONTRACT-AFGELEID.json. De hernieuwde
   proef bereikt de atomaire claim nu wel, waardoor die tijdelijke grond is
   verdwenen. Het nagekeken contract staat daarom hier: iedere claim geeft één
   nieuwe leerlingsleutel en een herhaling mag die nooit uit een cache tonen. */
'use strict';
const AF = { door: 'Claude, de lescredentialmodule en haar routes gelezen en beproefd', op: '2026-09-29' };
const OP = '2026-09-29';
const LES = { klasse: 'OBJECT_SCOPED', objectVeld: 'code',
  uitleg: 'het les-id uit het lijf plus de leraarssleutel van DIE les; een leerlingsleutel of een sleutel van een andere les krijgt 403, een onbekende les 404' };
const EENMALIG = (mutatieId, toegang, waarom, gemeten) => ({ mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'nietHerhaalbaar' }, toegang, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
  waarom: waarom + ' Een herhaling die de vorige code teruggaf zou een geheim uit een cache heronthullen; ' +
    'daarom staat de route ook in lib/eenmalig-geheim-routes.js.',
  bewijs: { gemeten, op: OP }, afgetekend: AF });
const STAND = (mutatieId, gemeten) => ({ mutatieId, herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: LES, stand: 'PROTECTED', bewijs: { gemeten, op: OP }, afgetekend: AF });

const CONTRACTEN = {
  'POST /api/foundation/les/maak': EENMALIG('foundation.les.maak',
    { klasse: 'PUBLIC', waarom: 'een begeleider die een les opent heeft op dat moment nog niets; de lescode en ' +
      'de leraarssleutel die hij terugkrijgt ZIJN de toegang. De rem staat op de route (20 per uur per adres)' },
    'Elke oproep maakt een nieuwe les met een eigen 128-bit lescode en leraarssleutel; met dezelfde `idem` weigert de kern (409) zonder codes.',
    'test/foundation-lescredential.test.js en test/foundation-lescredential-server.test.js: twee lessen hebben verschillende codes, en dezelfde idem geeft 409 zonder lescode of token'),
  'POST /api/foundation/les/join': EENMALIG('foundation.les.join',
    { klasse: 'PUBLIC', waarom: 'meedoen gebeurt vóór een account bestaat; de 128-bit lescode is de begrensde geloofsbrief en de route heeft een adresrem plus een lesplafond' },
    'Meedoen claimt de gekozen naam atomair en geeft de leerlingsleutel precies eenmaal; dezelfde naam krijgt daarna 409 zonder sleutel.',
    'test/foundation-lescredential.test.js en test/foundation-lescredential-server.test.js: een naam wordt eenmaal geclaimd, een dubbele claim krijgt 409 en iedere leerling krijgt een eigen sleutel'),
  'POST /api/foundation/les/code/roteer': EENMALIG('foundation.les.code.roteren', LES,
    'Roteren geeft elke keer een nieuwe lescode en trekt de vorige in.',
    'test/foundation-lescredential.test.js en test/foundation-lescredential-server.test.js: na roteren opent de oude lescode niets (410) en de nieuwe wel, tegen een echte server'),
  'POST /api/foundation/les/code/intrekken': STAND('foundation.les.code.intrekken',
    'test/foundation-lescredential.test.js en test/foundation-lescredential-server.test.js: intrekken zet ingetrokken_at eenmaal; daarna geeft meedoen 410 en een tweede intrekking verandert niets'),
  'POST /api/foundation/les/leerling/intrekken': STAND('foundation.les.leerling.intrekken',
    'test/foundation-lescredential.test.js en test/foundation-lescredential-server.test.js: de ingetrokken leerlingsleutel krijgt 403 op zijn schrift, de andere leerling niet'),
  'POST /api/foundation/les/sluit': STAND('foundation.les.sluiten',
    'test/foundation-lescredential.test.js en test/foundation-lescredential-server.test.js: na sluiten geven leraar- en leerlingsleutel 403 en meedoen 410')
};
module.exports = { CONTRACTEN };
