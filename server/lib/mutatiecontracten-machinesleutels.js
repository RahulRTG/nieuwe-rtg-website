/* Nagekeken contracten van de drie ROTEERroutes die de machinesleutels
   kregen (CODECREDENTIALS.json: command.api_machinesleutel en
   rtmail.imap_apparaatsleutel). Roteren maakt elke keer een nieuw geheim en
   maakt het vorige in dezelfde schrijfactie waardeloos; een herhaling die de
   vorige uitkomst teruggaf zou een geheim uit een cache heronthullen, en daarom
   staan ze in lib/eenmalig-geheim-routes.js en in de NOOIT-lijst. */
'use strict';
const AF = { door: 'Claude, sleutelmodules en routes gelezen en beproefd', op: '2026-09-27' };
const ROTEER = { klasse: 'nietHerhaalbaar' };
const CONTRACTEN = {
  'POST /api/command/apipoort/roteer': {
    mutatieId: 'command.apipoort.roteren', herkomst: 'mens',
    semantiek: ROTEER, toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Roteren geeft een nieuwe machinesleutel (eenmaal kaal in het antwoord) en trekt de vorige in dezelfde opslagronde in. Een tweede aanroep op dezelfde id weigert met 409, want die sleutel is dan al ingetrokken; een cache die het eerste antwoord herhaalde zou een geheim heronthullen. De deur is naamAuth: een kantoorsessie op naam, niet de gedeelde code.',
    bewijs: { gemeten: 'test/apipoort-levensduur.test.js: na een rotatie opent de oude sleutel niets (401), de nieuwe wel, een tweede rotatie op dezelfde id is 409, en de gedeelde kantoorcode krijgt 403', op: '2026-09-27' },
    afgetekend: AF
  },
  'POST /api/member/rtmail/imap/roteer': {
    mutatieId: 'member.rtmail.imap.roteren', herkomst: 'mens',
    semantiek: ROTEER, toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Roteren geeft hetzelfde apparaat elke keer een nieuwe sleutel en maakt de vorige meteen waardeloos. Twee keer roteren zijn twee nieuwe sleutels; de tweede opslikken zou het lid een sleutel laten bewaren die al is vervangen.',
    bewijs: { gemeten: 'test/imap-sleutelverval.test.js: na een rotatie weigert de oude sleutel en werkt de nieuwe, via de echte route voor lid en zaak', op: '2026-09-27' },
    afgetekend: AF
  },
  'POST /api/supplier/rtmail/imap/roteer': {
    mutatieId: 'supplier.rtmail.imap.roteren', herkomst: 'mens',
    semantiek: ROTEER, toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Zelfde route als de ledenkant, voor het postvak van een zaak: elke rotatie is een nieuwe sleutel en de vorige werkt meteen niet meer.',
    bewijs: { gemeten: 'test/imap-sleutelverval.test.js: dezelfde proef op het postvak van een zaak', op: '2026-09-27' },
    afgetekend: AF
  }
};
module.exports = { CONTRACTEN };
