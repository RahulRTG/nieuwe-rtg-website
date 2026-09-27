/* Nagekeken contracten van de werkruimtesleutels buiten productie
   (workos.workspace_access_tokens, server/bedrijf/sleutels.js). De houder van
   een beheer- of lidsessie roteert of trekt hem zelf in; de werkruimte uit het
   lijf is het object, de sessie de sleutel. In productie antwoorden beide 404:
   daar is het RTG-account de sleutel. */
'use strict';
const OBJECT = { klasse: 'OBJECT_SCOPED', objectVeld: 'werkruimte',
  uitleg: 'de werkruimte uit het lijf plus een geldige beheer- of lidsessie van DIE werkruimte; anders 403' };
const AF = { door: 'Claude, sleutelmodule en beide routes gelezen en beproefd', op: '2026-09-27' };
const CONTRACTEN = {
  'POST /api/bedrijf/sleutel/roteer': {
    mutatieId: 'bedrijf.sleutel.roteren', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' }, toegang: OBJECT,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Roteren maakt elke keer een nieuwe 128-bit sessie en trekt de gebruikte in. Een herhaling die de vorige teruggaf zou een geheim uit een cache heronthullen; daarom staat de route in lib/eenmalig-geheim-routes.js.',
    bewijs: { gemeten: 'test/werksleutels.test.js 5 en 9: na een rotatie opent de oude sessie niets meer (403) en een herhaling heronthult niets', op: '2026-09-27' },
    afgetekend: AF
  },
  'POST /api/bedrijf/sleutel/intrek': {
    mutatieId: 'bedrijf.sleutel.intrekken', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: OBJECT, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/werksleutels.test.js 5 en 9: intrekken sluit alleen die sessie; daarna geeft zij 403', op: '2026-09-27' },
    afgetekend: AF
  }
};
module.exports = { CONTRACTEN };
