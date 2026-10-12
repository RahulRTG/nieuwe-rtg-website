/* DE TERMIJN VAN DE LEIDINGSPLEK (besluit 584A, kern/rtmail-leidingtermijn.js).
   Beide routes zijn met opzet niet herhaalbaar: elke aanroep is een BESLUIT op
   naam en laat een eigen spoorregel na. Een poortcache die de tweede opslokt,
   zou een besluit laten verdwijnen samen met zijn spoor. */
'use strict';
const SLEUTELS = {
  'POST /api/supplier/rtmail/leiding/verleng': { nietIdempotent: true,
    waarom: 'elke verlenging is een besluit van een manager met grondslag en noodzaak en een eigen spoorregel; een tweede is een tweede besluit en mag niet stil verdwijnen' },
  'POST /api/office/rtmail/leiding/toets': { nietIdempotent: true,
    waarom: 'de juridische toets is een zet van de eigenaar op naam: dicht, open, weer dicht binnen het venster zijn drie bewuste zetten met elk een spoorregel' },
  'POST /api/supplier/rtmail/leiding/hold': { nietIdempotent: true,
    waarom: 'elke aanvraag is een eigen hold met een eigen beoordeling en spoorregel; twee aanvragen zijn twee dossiers voor de beoordelaar' },
  'POST /api/office/rtmail/leiding/hold': { nietIdempotent: true,
    waarom: 'een beoordeling is een besluit op naam met een verse passkey; een herhaalde herbeoordeling is een nieuw besluit en mag niet stil verdwijnen' }
};
module.exports = { SLEUTELS };
