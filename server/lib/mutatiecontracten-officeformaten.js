/* ============================================================================
   MUTATIECONTRACTEN -- RTG OFFICE IN EN UIT (exporteer en importeer).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm.

   Beide routes doen bij elke aanroep MET OPZET een tweede handeling:
   - exporteer schrijft elke keer een regel `geexporteerd` in het documentspoor.
     Twee downloads zijn twee keer dat een bestand het huis verliet, en het spoor
     hoort ze allebei te kennen; een herhaling samenvouwen zou er een verzwijgen.
   - importeer maakt elke keer een NIEUW rekenblad en schrijft nooit over een
     bestaand document heen. Twee keer inlezen is twee bladen, net als twee keer
     "nieuw" -- hinderlijk, en zonder geld of tweede persoon.
   ========================================================================== */
'use strict';

const AFGETEKEND = { door: 'Claude, op grond van test/office-formaten.test.js toets 4; niet door een mens nagelezen', op: '2026-10-11' };
const BEWIJS = { gemeten: 'test/office-formaten.test.js toets 4: twee exports geven twee regels geexporteerd in het spoor, ' +
  'twee imports geven twee nieuwe bladen (mijn telt +2)', op: '2026-10-11' };
const WAAROM = {
  exporteer: 'Elke export is een bestand dat het huis verlaat; het documentspoor noteert elke keer wie, welk formaat en welke classificatie.',
  importeer: 'Inlezen maakt altijd een nieuw rekenblad en overschrijft nooit; een tweede aanroep is een tweede blad, zoals een tweede keer Nieuw.'
};

const contract = (route, mutatieId, actie, toegang) => [route, {
  mutatieId, herkomst: 'mens', semantiek: { klasse: 'nietHerhaalbaar' }, toegang,
  stand: 'INTENTIONALLY_NON_IDEMPOTENT', waarom: WAAROM[actie], bewijs: BEWIJS, afgetekend: AFGETEKEND
}];

const INGANGEN = [
  ['/api/kantoorpakket/', 'kantoorpakket.', { klasse: 'AUTHENTICATED' }],
  ['/api/supplier/kantoorpakket/', 'supplier.kantoorpakket.', { klasse: 'AUTHENTICATED' }],
  ['/api/office/kantoorpakket/', 'office.kantoorpakket.', { klasse: 'AUTHENTICATED' }],
  ['/api/rtf/kantoorpakket/', 'rtf.kantoorpakket.', { klasse: 'OBJECT_SCOPED', objectVeld: 'code' }],
  ['/api/werkplek/kantoorpakket/', 'werkplek.kantoorpakket.', { klasse: 'OBJECT_SCOPED', objectVeld: 'bedrijf' }]
];

const CONTRACTEN = Object.fromEntries([].concat(...INGANGEN.map(([pad, id, toegang]) =>
  ['exporteer', 'importeer'].map(actie => contract('POST ' + pad + actie, id + actie, actie, toegang)))));

module.exports = { CONTRACTEN };
