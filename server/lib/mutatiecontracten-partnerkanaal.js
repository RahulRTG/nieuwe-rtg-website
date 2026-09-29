/* Nagekeken contracten van de personeelscode per medewerker van het
   partnerkanaal (partnerkanaal.personeels_en_partnercode, besluit B14,
   server/kern/partnerpersoneelscode.js). Uitgeven maakt elke keer een nieuwe
   medewerkerplek met een eigen 128-bit code, roteren geeft een nieuwe code en
   trekt de vorige in; een herhaling is dus met opzet nooit dezelfde uitkomst.
   Intrekken is een stand die een tweede keer niets meer verandert. Alles in een
   collectietransactie.

   Toegang: de router ziet boardroomAuth en dus AUTHENTICATED; de eis van een
   MENS OP NAAM (boardroomWie) staat in de handler, en de gedeelde kantoorcode
   krijgt 403. */
'use strict';
const AF = { door: 'Claude, kern/partnerpersoneelscode.js en de vier kantoorroutes gelezen en tegen een server beproefd', op: '2026-09-29' };
const KANTOOR = { klasse: 'AUTHENTICATED',
  let: 'boardroomAuth is de laag die de router ziet; een mens op naam (boardroomWie) staat in de handler, de gedeelde kantoorcode krijgt 403' };
const CONTRACTEN = {
  'POST /api/office/partnerkanaal/personeelscode': {
    mutatieId: 'office.partnerkanaal.personeelscode', herkomst: 'mens', semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: KANTOOR, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'elke uitgifte maakt een nieuwe medewerkerplek met een eigen code; een herhaald antwoord zou een kale code heronthullen (lib/eenmalig-geheim-routes.js)',
    bewijs: { gemeten: 'test/partnerpersoneelscode.test.js toets 2: twee uitgiften geven twee plekken met twee verschillende codes, en de gedeelde kantoorcode krijgt 403', op: '2026-09-29' },
    afgetekend: AF
  },
  'POST /api/office/partnerkanaal/personeelscode/roteer': {
    mutatieId: 'office.partnerkanaal.personeelscode.roteer', herkomst: 'mens', semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: KANTOOR, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'roteren geeft een nieuwe code en trekt de vorige van die plek in; een tweede oproep roteert opnieuw',
    bewijs: { gemeten: 'test/partnerpersoneelscode.test.js toets 4: na een rotatie opent de oude code niets (404) en de nieuwe wel', op: '2026-09-29' },
    afgetekend: AF
  },
  'POST /api/office/partnerkanaal/personeelscode/intrek': {
    mutatieId: 'office.partnerkanaal.personeelscode.intrek', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: KANTOOR, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/partnerpersoneelscode.test.js toets 4: een tweede intrekking geeft ingetrokken:false en de code blijft 404', op: '2026-09-29' },
    afgetekend: AF
  },
  'POST /api/office/partnerkanaal/personeelscodes': {
    mutatieId: 'office.partnerkanaal.personeelscodes', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: KANTOOR, stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'test/partnerpersoneelscode.test.js toets 2: het overzicht zonder code en zonder hash', op: '2026-09-29' },
    nagekeken: 'met de hand, 2026-09-29: lijst() leest via eigen.kijk en schrijft niets; de route roept geen save() aan',
    afgetekend: AF
  }
};
module.exports = { CONTRACTEN };
