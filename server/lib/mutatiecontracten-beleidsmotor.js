/* ============================================================================
   MUTATIECONTRACT -- DE STAND VAN DE BELEIDSMOTOR (AUTHORITY.md fase 1).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm. Een
   eigen bestand, want ./mutatiecontracten-leest.js zat aan de 10 kB-grens. De
   vorm is die van POST /api/office/mensdeur daar: de stand van een
   schaduwmeting, en de meting zelf schrijft via een andere ingang (res.finish).
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  'POST /api/office/beleidsmotor': {
    mutatieId: 'office.beleidsmotor',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'tegen een draaiende server (test/beleidsmotor.test.js toets 2 en 4): 403 op een ' +
      'gedeelde kantoorsessie, 401 zonder sessie, 200 voor de eigenaar; twee keer lezen geeft dezelfde vorm', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: server/routes/office/beleidsmotor.js roept alleen ' +
      'kern.beleidsmotor.stand() aan, en die leest via eigen.kijk() plus een projectie van de RAM-buffer -- ' +
      'geen save(), geen toewijzing. De tellers zelf lopen via bewaak()/meelezer() op res.finish; ' +
      'ook dit verzoek telt daar mee als een waarneming van de boardroomdeur, en dat is die andere ingang',
    afgetekend: { door: 'Claude Code, handler met de hand nagelezen en tegen een server gemeten', op: '2026-09-23' }
  },
  'POST /api/office/beleidsmotor/waarom': {
    mutatieId: 'office.beleidsmotor.waarom',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'tegen een draaiende server (test/beleidsmotor.test.js toets 8): 401 zonder sessie, 403 voor ' +
      'de gedeelde code, en per sessie op naam het besluit over zichzelf; twee keer vragen geeft hetzelfde', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: de handler roept alleen beleidsmotor.waarom(req) aan, en die leest de ' +
      'feiten van het token en rekent met regels.kan() -- geen save(), geen toewijzing. De poort ervoor ' +
      '(kluisAuth, gewikkeld) telt via res.finish mee in de schaduw; dat is de andere ingang',
    afgetekend: { door: 'Claude Code, handler met de hand nagelezen en tegen een server gemeten', op: '2026-09-23' }
  },
  'POST /api/office/beleidsmotor/review': {
    mutatieId: 'office.beleidsmotor.review',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'tegen een draaiende server (test/beleidsmotor-review.test.js): 403 voor de gedeelde code, ' +
      '400 zonder reden, twee keer vragen geeft dezelfde houders, en onder schrijf-verloren geen lijst', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: de handler schrijft alleen een regel in het inzagejournaal ' +
      '(noteerVast, bewust een per inzage) en roept daarna beleidsmotor.review() aan, die de drie zetelbronnen ' +
      'leest -- geen save(), geen toewijzing',
    afgetekend: { door: 'Claude Code, handler met de hand nagelezen en tegen een server gemeten', op: '2026-09-23' }
  },
  /* De kantooruitnodiging (AUTHORITY.md fase 2) woont hier mee: dezelfde laag,
     de kantoordeur op naam. */
  'POST /api/office/kantoor/uitnodiging': {
    mutatieId: 'office.kantoor.uitnodiging',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'een tweede oproep is een tweede uitnodiging: een nieuwe code, en de vorige van dezelfde mens vervalt',
    bewijs: { gemeten: 'tegen een draaiende server (test/kantooruitnodiging.test.js): twee oproepen gaven twee ' +
      'codes, en de eerste koppelde daarna niet meer (401)', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: server/kern/kantoor/uitnodiging.js maak() trekt de open uitnodiging van ' +
      'dezelfde sleutel in en zet een nieuwe met een eigen hash',
    afgetekend: { door: 'Claude Code, handler met de hand nagelezen en tegen een server gemeten', op: '2026-09-23' }
  },
  'POST /api/office/kantoor/uitnodigingen': {
    mutatieId: 'office.kantoor.uitnodigingen',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'tegen een draaiende server (test/kantooruitnodiging.test.js): het overzicht met de ' +
      'koppelwegen, zonder hash', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: de handler roept alleen overzicht() aan, die leest via eigen.bak/kijk ' +
      'en schrijft niets',
    afgetekend: { door: 'Claude Code, handler met de hand nagelezen en tegen een server gemeten', op: '2026-09-23' }
  },
};

module.exports = { CONTRACTEN };
