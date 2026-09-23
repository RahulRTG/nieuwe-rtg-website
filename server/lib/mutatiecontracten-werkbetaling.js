/* Mutatiecontracten voor de Werk OS-uitgave, deel twee (AUTHORITY.md par. 5e,
   vervolg): de koppeling van een werkruimte aan een entiteit, de betaalwijze die
   de werkruimte kiest, en de schakelaar waarmee RTG de weg via RTG Bank aan- of
   uitzet. Een eigen bestand omdat ./mutatiecontracten-beleidsmotor.js tegen de
   bestandsgrens zit; zelfde vorm, zelfde velden. */
'use strict';

const AF = { door: 'Claude Code, handler met de hand nagelezen en tegen een server gemeten', op: '2026-09-23' };
const WERK = { klasse: 'OBJECT_SCOPED', objectVeld: 'werkruimte' };

const CONTRACTEN = {
  'POST /api/bedrijf/werkruimte/entiteit': {
    mutatieId: 'bedrijf.werkruimte.entiteit', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: WERK, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/bedrijfuitgave-mix.test.js toets 1-3: koppelen zet w.entiteitId op een waarde; ' +
      'dezelfde koppeling nog eens zet dezelfde waarde', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: bedrijf/tekengrens.js zet g.w.entiteitId (of null) en een journaalregel',
    afgetekend: AF
  },
  'POST /api/bedrijf/werkruimte/betaalwijze': {
    mutatieId: 'bedrijf.werkruimte.betaalwijze', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: WERK, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/bedrijfuitgave-mix.test.js toets 4-5: de keuze is een toestand (extern of rtgbank)', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: bedrijf/tekengrens.js zet g.w.betaalwijze op een van twee waarden',
    afgetekend: AF
  },
  'POST /api/office/werkos/bankpad': {
    mutatieId: 'office.werkos.bankpad', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'test/bedrijfuitgave-mix.test.js: de stand lezen, ook door een boardroomlid dat niet de eigenaar is', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: de handler roept alleen kern.werkBankpadStand() aan, die leest via eigen.kijk',
    afgetekend: AF
  },
  'POST /api/office/werkos/bankpad/zet': {
    mutatieId: 'office.werkos.bankpad.zet', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/bedrijfuitgave-mix.test.js toets 4-5: aan en uit zijn een toestand; ' +
      'een tweede keer aan laat hem aan', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: kern/werkbetaling.js zet() schrijft aan, door en at op de ene kaart',
    afgetekend: AF
  }
};

module.exports = { CONTRACTEN };
