/* Partner Network (19 oktober 2026): een POST die alleen leest.

   /api/supplier/netwerk/overzicht telt uit vier bestaande domeinen (de Mall,
   de conciërge-lus, de samenwerkingen en de eigen werklijst) wat er voor een
   zaak klaarligt, met bij elk getal zijn bron (kern/partnernetwerk.js).
   Schrijven gebeurt langs de routes van die domeinen, met hun eigen
   contracten; deze route verandert niets. */
'use strict';

const OP = '2026-10-19';
const TOETS = 'test/partnernetwerk-scherm.test.js';

const CONTRACTEN = {
  'POST /api/supplier/netwerk/overzicht': {
    mutatieId: 'partnernetwerk.overzicht',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', uitleg: 'de zaakcode komt uit de sessie (supplierAuth), nooit uit het lijf' },
    stand: 'NOT_APPLICABLE',
    herkomst: 'mens',
    afgetekend: { door: 'Claude, op grond van ' + TOETS + ' en de handler in kern/partnernetwerk.js; niet door een mens nagelezen', op: OP },
    bewijs: { gemeten: TOETS + ': de opslag is na het overzicht byte-voor-byte gelijk aan ervoor', op: OP },
    nagekeken: 'Claude las de handler en alles wat hij aanroept: mallAanvragen.voorZaak, bureauZaak.opdrachten, samenwerking.mijn en de tickets van de zaak. Geen schrijfvorm, geen bestand, geen uitgaand bericht.'
  }
};

module.exports = { CONTRACTEN };
