/* ============================================================================
   MUTATIECONTRACT -- van een betaalde pas naar gast (vijf routes,
   server/routes/naargast.js en server/kern/aanmeldingen/naargast.js, besluit C5).

   Deel van ./mutatiecontracten.js; zie de kop daar voor de vorm. Wat een tweede
   aanroep doet, per route, gemeten in test/naargast.test.js:

   - het lid NU: de eerste oproep laat de sessies vervallen, dus de tweede met
     hetzelfde token krijgt 401 en verandert niets;
   - het lid AAN HET EIND: de opzegweg is idempotent op stand (alOpgezegd), en de
     geplande datum wordt met dezelfde datum overschreven;
   - het kantoor: een tweede keer is 409, het account is al gast;
   - de schakelaar: dezelfde waarde nog eens geeft dezelfde regel (alleen het
     tijdstip van zetten schuift);
   - de ronde: convergent -- wat al gebeurd is gebeurt niet nog eens, en een
     aankondiging gaat een keer uit.
   ========================================================================== */
'use strict';

const OP = '2026-09-27';
const AF = { door: 'Claude, op grond van test/naargast.test.js; niet door een mens nagelezen', op: OP };
const LID = { klasse: 'AUTHENTICATED' };

const CONTRACTEN = {
  'POST /api/mijn/pas/gast': {
    mutatieId: 'pas.naargast.lid', herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang: LID,
    stand: 'PROTECTED',
    bewijs: { gemeten: 'toets 1: na "nu" krijgt hetzelfde token 401 (sessiegrens); toets 2: "einde" zegt op en het lid ' +
      'blijft ingelogd, met het contract op OPZEGGEND', op: OP },
    afgetekend: AF
  },
  'POST /api/office/pas/gast': {
    mutatieId: 'pas.naargast.kantoor', herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang: LID,
    stand: 'PROTECTED',
    bewijs: { gemeten: 'toets 3: zonder reden 400, met reden 200 naar guest; een tweede keer weigert naarGast() met 409 ' +
      '(al gast)', op: OP },
    afgetekend: AF
  },
  'POST /api/office/pas/gast/regels': {
    mutatieId: 'pas.naargast.regels', herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang: LID,
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'toets 4: leest de drie regels, standaard uit', op: OP },
    nagekeken: 'met de hand, 2026-09-27: regels() leest via eigencollectie.kijk -- geen save(), geen toewijzing',
    afgetekend: AF
  },
  'POST /api/office/pas/gast/regels/zet': {
    mutatieId: 'pas.naargast.regelzet', herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang: LID,
    stand: 'PROTECTED',
    bewijs: { gemeten: 'toets 4: een ongeldige wachttijd 400, een geldige zet de regel; dezelfde waarde nog eens geeft ' +
      'dezelfde regel', op: OP },
    afgetekend: AF
  },
  'POST /api/office/pas/gast/ronde': {
    mutatieId: 'pas.naargast.ronde', herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang: LID,
    stand: 'PROTECTED',
    bewijs: { gemeten: 'toets 7: een tweede ronde kondigt niet opnieuw aan (aangekondigd 0) en zet niemand twee keer ' +
      'naar gast; toets 4: de route geeft tellingen en geen namen', op: OP },
    afgetekend: AF
  }
};

module.exports = { CONTRACTEN };
