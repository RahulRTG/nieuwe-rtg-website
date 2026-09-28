/* Nagekeken contracten van de sleutel per Zaakdoos (devices.zaakdoos_sleutel,
   besluit B12, server/kern/zaakdoos/sleutels.js). Uitgeven is roteren: elke
   oproep geeft een nieuwe 128-bit sleutel en trekt de vorige van die doos in, dus
   een herhaling is met opzet nooit dezelfde uitkomst. Intrekken is een stand die
   een tweede keer niets meer verandert. Allemaal in een collectietransactie.

   Toegang: de router ziet boardroomAuth of supplierAuth en dus AUTHENTICATED; de
   eis van de EIGENAAR (kantoor) of van een MANAGER OP NAAM (zaak) staat in de
   handler, en de zaak van de manager komt uit de sessie, nooit uit het lijf. */
'use strict';
const AF = { door: 'Claude, kern/zaakdoos/sleutels.js en de vier schrijfroutes gelezen en tegen een server beproefd', op: '2026-09-27' };
const KANTOOR = { klasse: 'AUTHENTICATED',
  let: 'boardroomAuth is de laag die de router ziet; alleen de eigenaar (boardroomBaas) met de zware bevestiging geeft of neemt een sleutel' };
const ZAAK = { klasse: 'AUTHENTICATED',
  let: 'supplierAuth is de laag die de router ziet; managerOnly plus een staffId of lidKey in de sessie staan in de handler, en de zaak komt uit de sessie' };
const CONTRACTEN = {
  'POST /api/office/doos/sleutel': {
    mutatieId: 'office.doos.sleutel', herkomst: 'mens', semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: KANTOOR, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'uitgeven is roteren: een tweede oproep geeft een nieuwe sleutel en trekt de vorige van die doos in; een herhaald antwoord zou een ingetrokken sleutel tonen (lib/eenmalig-geheim-routes.js)',
    bewijs: { gemeten: 'test/doossleutels.test.js toets 4: na een rotatie opent de oude sleutel niets (403) en de nieuwe wel', op: '2026-09-27' },
    afgetekend: AF
  },
  'POST /api/office/doos/sleutel/weg': {
    mutatieId: 'office.doos.sleutel.weg', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: KANTOOR, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/doossleutels.test.js toets 4: een tweede intrekking geeft ingetrokken:false en de sleutel blijft 403 met doos-sleutel-ingetrokken', op: '2026-09-27' },
    afgetekend: AF
  },
  'POST /api/office/doos/sleutels': {
    mutatieId: 'office.doos.sleutels', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: KANTOOR, stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'test/doossleutels.test.js toets 1: het overzicht zonder sleutel en zonder hash', op: '2026-09-27' },
    nagekeken: 'met de hand, 2026-09-27: overzicht() en dozen() lezen via eigen.kijk en schrijven niets',
    afgetekend: AF
  },
  'POST /api/supplier/doos/sleutel': {
    mutatieId: 'supplier.doos.sleutel', herkomst: 'mens', semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: ZAAK, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'zelfde reden als de kantoorkant: elke oproep roteert de sleutel van een eigen doos, en een doos van een andere zaak wordt niet overgenomen (409)',
    bewijs: { gemeten: 'test/doossleutels.test.js toets 5: de zaak komt uit de sessie, de gedeelde bedrijfsinlog krijgt 403, een doos van HOSHI 409', op: '2026-09-27' },
    afgetekend: AF
  },
  'POST /api/supplier/doos/sleutel/weg': {
    mutatieId: 'supplier.doos.sleutel.weg', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: ZAAK, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/doossleutels.test.js toets 5: intrekken van de eigen doos sluit de sleutel; een doos van een andere zaak is 404 en blijft werken', op: '2026-09-27' },
    afgetekend: AF
  },
  'POST /api/supplier/doos/sleutels': {
    mutatieId: 'supplier.doos.sleutels', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: ZAAK, stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'test/doossleutels.test.js toets 5: alleen de dozen van de eigen zaak, zonder sleutel of hash', op: '2026-09-27' },
    nagekeken: 'met de hand, 2026-09-27: dozen(zaak) leest via eigen.kijk en filtert op de zaak uit de sessie; geen save()',
    afgetekend: AF
  }
};
module.exports = { CONTRACTEN };
