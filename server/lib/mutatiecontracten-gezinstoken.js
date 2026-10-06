/* Nagekeken contracten van de routes van het gezinsprofieltoken
   (29 september 2026, RELEASEKANDIDAAT.md B17, foundation/gezinssessie.js).
   Roteren is met opzet nooit dezelfde uitkomst (elke oproep een nieuwe sessie,
   de gebruikte ingetrokken); intrekken is een stand die een tweede keer niets
   meer verandert. Het object is het gezin uit het lijf, de sleutel de sessie
   van DIT gezin -- een beheerderssluiting vraagt daarbovenop de beheerder. */
'use strict';
const AF = { door: 'Claude, gezinstoken.js, gezinssessie.js en beide routes gelezen en beproefd', op: '2026-09-29' };
const OP = '2026-09-29';
const GEZIN = { klasse: 'OBJECT_SCOPED', objectVeld: 'code',
  uitleg: 'het gezin uit het lijf plus een geldige gezinssessie van DAT gezin; een profielId vraagt de beheerder; anders 403' };
const GEZINSCODE = { klasse: 'OBJECT_SCOPED', objectVeld: 'gezinscode',
  uitleg: 'de 128-bit gezinscode uit het lijf is de claim op DIT gezin; waar nodig bewijst de pincode daarna het gekozen profiel' };
const EENMALIG = (mutatieId, waarom, gemeten) => ({
  mutatieId, herkomst: 'mens', semantiek: { klasse: 'nietHerhaalbaar' }, toegang: GEZINSCODE,
  stand: 'INTENTIONALLY_NON_IDEMPOTENT', waarom,
  bewijs: { gemeten, op: OP }, afgetekend: AF
});

const CONTRACTEN = {
  'POST /api/foundation/gezin/inloggen': EENMALIG('foundation.gezin.inloggen',
    'Iedere geslaagde inlog geeft een nieuwe gezinssessie die alleen in dat antwoord kaal bestaat; een herhaald antwoord zou een credential uit de cache heronthullen.',
    'test/gezinbewaren.test.js en test/foundation-gezinstoken-productie.test.js: een geldige gezinscode plus pincode geeft een verse sessie en een ingetrokken of ongeldige code geen token'),
  'POST /api/foundation/gezin/profiel/kies': EENMALIG('foundation.gezin.profiel.kies',
    'De profielkeuze geeft na de profielpincode een nieuwe gezinssessie; iedere nieuwe keuze is een nieuwe apparaat- of profielsessie en mag geen eerder geheim herhalen.',
    'test/world-desktop-identity.e2e.js en test/foundation-gezinstoken-productie.test.js: een profiel uit het aangewezen gezin geeft een sessie, een vreemd of verdwenen profiel niet'),
  'POST /api/foundation/gezin/sessie/roteer': {
    mutatieId: 'foundation.gezinssessie.roteren', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' }, toegang: GEZIN,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Roteren maakt elke keer een nieuwe 128-bit gezinssessie en trekt de gebruikte in. Een herhaling ' +
      'die de vorige teruggaf zou een geheim uit een cache heronthullen; daarom staat de route in ' +
      'lib/eenmalig-geheim-routes.js.',
    bewijs: { gemeten: 'test/gezinssessie.test.js 1: na roteren opent de oude sessie niets (403), een herhaling ' +
      'met de oude geeft 403 zonder token, en ook met een Idempotency-Key toont geen cache de nieuwe tweemaal', op: OP },
    afgetekend: AF
  },
  'POST /api/foundation/gezin/sessie/intrek': {
    mutatieId: 'foundation.gezinssessie.intrekken', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: GEZIN, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/gezinssessie.test.js 1 en 2: afmelden sluit alleen die sessie, een beheerder sluit elke ' +
      'sessie van een profiel of van het gezin (epoch), en een kind kan dat niet (403)', op: OP },
    afgetekend: AF
  }
};

module.exports = { CONTRACTEN };
