/* ============================================================================
   MUTATIECONTRACT -- DE STAND VAN DE BELEIDSMOTOR (AUTHORITY.md fase 1).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm. Een
   eigen bestand, want ./mutatiecontracten-leest.js zat aan de 10 kB-grens. De
   vorm is die van POST /api/office/mensdeur daar: de stand van een
   schaduwmeting, en de meting zelf schrijft via een andere ingang (res.finish).
   ========================================================================== */
'use strict';

const AF = { door: 'Claude Code, handler met de hand nagelezen en tegen een server gemeten', op: '2026-09-23' };

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
  /* Fase 8 en 7: de simulator en de sleutel per zaakdoos. */
  'POST /api/office/beleidsmotor/simulatie': {
    mutatieId: 'office.beleidsmotor.simulatie', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'tegen een draaiende server (test/beleidsmotor-review.test.js): de simulatie verandert niets aan ' +
      'de review erna, en onder schrijf-verloren geen antwoord', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: alleen een journaalregel (bewust een per vraag) en een rekensom in review.simuleer()',
    afgetekend: AF
  },
  'POST /api/office/doos/sleutel': {
    mutatieId: 'office.doos.sleutel', herkomst: 'mens', semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'een tweede oproep geeft een nieuwe sleutel en maakt de vorige van die doos ongeldig',
    bewijs: { gemeten: 'test/doossleutels.test.js toets 5: na een tweede geef() geeft de eerste sleutel geen doos meer', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: kern/zaakdoos/sleutels.js geef() overschrijft de hash van die doos',
    afgetekend: AF
  },
  'POST /api/office/doos/sleutel/weg': {
    mutatieId: 'office.doos.sleutel.weg', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/doossleutels.test.js toets 5: een tweede trekIn() geeft ingetrokken:false en laat de ' +
      'opslag byte voor byte gelijk', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: trekIn() verwijdert alleen als de doos er staat; daarna is er niets meer te doen',
    afgetekend: AF
  },
  'POST /api/office/doos/sleutels': {
    mutatieId: 'office.doos.sleutels', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'test/doossleutels.test.js: het overzicht met de wegen, zonder sleutels of hashes', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: overzicht() leest via eigen.kijk en schrijft niets',
    afgetekend: AF
  },
  /* De uitgave in het Werk OS (AUTHORITY.md par. 5e, vervolg). */
  'POST /api/bedrijf/uitgave/maak': {
    mutatieId: 'bedrijf.uitgave.maak', herkomst: 'mens', semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'werkruimte' }, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'een tweede oproep is een tweede uitgave: twee facturen van hetzelfde bedrag bij dezelfde begunstigde zijn twee betalingen',
    bewijs: { gemeten: 'test/bedrijfuitgave.test.js: elke oproep geeft een uitgave met een eigen id', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: bedrijf/uitgave.js maakt elke keer een nieuw id met rid(5)',
    afgetekend: AF
  },
  'POST /api/bedrijf/uitgaven': {
    mutatieId: 'bedrijf.uitgaven', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'werkruimte' }, stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'test/bedrijfuitgave.test.js: de lijst met de berekende stand', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: de handler roept alleen toon() aan en schrijft niets; werkPoort met geld vraagt geen reden en logt dus niets',
    afgetekend: AF
  },
  'POST /api/bedrijf/uitgave/betaald': {
    mutatieId: 'bedrijf.uitgave.betaald', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'werkruimte' }, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/bedrijfuitgave.test.js toets 5-6: een tweede notitie geeft 409 en laat de eerste staan. ' +
      'Een toestandscontrole en geen duplicaatlaag', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: de route weigert zodra u.betaald staat',
    afgetekend: AF
  },
  'POST /api/bedrijf/lid/tekengrens': {
    mutatieId: 'bedrijf.lid.tekengrens', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'werkruimte' }, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/bedrijfuitgave.test.js toets 4: zetten en weghalen, en dezelfde waarde twee keer geeft dezelfde grens', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: de route zet l.tekengrensCenten op een waarde; een herhaling zet dezelfde waarde (en een journaalregel)',
    afgetekend: AF
  },
};

module.exports = { CONTRACTEN };
