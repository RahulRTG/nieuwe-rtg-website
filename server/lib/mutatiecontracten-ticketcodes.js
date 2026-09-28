/* Nagekeken contracten van de drie toonroutes van een ticket- of kaartcode
   (travelos.activity_ticket_entry, travelos.mobility_transport_ticket). Alle
   drie roteren: tonen maakt een nieuwe 128-bit code en trekt de vorige in, dus
   een tweede oproep heeft met opzet een andere uitkomst. */
'use strict';
const AF = { door: 'Claude, ticket- en kaartcodekern en de routes gelezen en beproefd', op: '2026-09-27' };
const ROTEREN = { klasse: 'nietHerhaalbaar' };
const CONTRACTEN = {
  'POST /api/ticket/toon': {
    mutatieId: 'ticket.entreecode.tonen', herkomst: 'mens', semantiek: ROTEREN,
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'ref',
      uitleg: 'de ref moet een ticket van DEZE sessie zijn; een ref van een ander lid geeft 404' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Tonen is roteren (kern/tickettoegang.js): elke oproep maakt een nieuwe code en trekt de vorige in. Een herhaald antwoord zou een ingetrokken of heronthulde code tonen; de route staat daarom in lib/eenmalig-geheim-routes.js.',
    bewijs: { gemeten: 'test/tickettoegang.test.js 1 en 7: een tweede oproep geeft een andere code en de vorige opent daarna niets meer (409)', op: '2026-09-27' },
    afgetekend: AF
  },
  'POST /api/supplier/ticket/toon': {
    mutatieId: 'ticket.deurcode.vernieuwen', herkomst: 'mens', semantiek: ROTEREN,
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'ref',
      uitleg: 'de ref moet een DEURticket (zonder lid) van deze zaak zijn; een ledenticket of een ticket van een andere zaak geeft 404' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Vernieuwen is roteren: de gast die zijn deurcode kwijt is krijgt een nieuwe en de oude sluit. Een herhaald antwoord zou een ingetrokken code tonen.',
    bewijs: { gemeten: 'test/tickettoegang.test.js 4: alleen de zaak van een deurticket vernieuwt, een ledenticket en een andere zaak krijgen 404', op: '2026-09-27' },
    afgetekend: AF
  },
  'POST /api/mob/kaart/toon': {
    mutatieId: 'vervoerbewijs.code.tonen', herkomst: 'mens', semantiek: ROTEREN,
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'id',
      uitleg: 'het id moet een kaartje of abonnement van DEZE sessie zijn; een ander geeft 404' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Tonen is roteren (kern/mobiliteit/kaarttoegang.js): een nieuwe code, de vorige ingetrokken, en de gebruiksteller van het kaartje reist mee zodat opnieuw tonen geen rit vrijspeelt.',
    bewijs: { gemeten: 'test/kaarttoegang.test.js 2 en 7: de vorige code geeft 409 en de nieuwe draagt het gebruik van de vorige', op: '2026-09-27' },
    afgetekend: AF
  }
};
module.exports = { CONTRACTEN };
