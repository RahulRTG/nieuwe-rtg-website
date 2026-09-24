/* Mutatiecontracten voor de Werk OS-uitgave, deel twee (AUTHORITY.md par. 5e,
   vervolg): de koppeling van een werkruimte aan een entiteit, de betaalwijze die
   de werkruimte kiest, en de schakelaar waarmee RTG de weg via RTG Rekening aan- of
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
    bewijs: { gemeten: 'test/bedrijfuitgave-mix.test.js toets 4-5: de keuze is een toestand (extern of rekening)', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: bedrijf/tekengrens.js zet g.w.betaalwijze op een van twee waarden',
    afgetekend: AF
  },
  'POST /api/bedrijf/werkruimte/tekenwijze': {
    mutatieId: 'bedrijf.werkruimte.tekenwijze', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: WERK, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/samentekenen.test.js toets 1-5: de tekenwijze is een toestand (versmallen, bestuur of drempel ' +
      'met een bedrag); dezelfde keuze nog eens laat dezelfde stand achter', op: '2026-09-24' },
    nagekeken: 'met de hand, 2026-09-24: bedrijf/samentekenen.js zet g.w.tekenwijze en een journaalregel, alleen voor de eigenaar van de entiteit',
    afgetekend: AF
  },
  /* De gedeelde doos-sleutel dicht of open (fase 7). Hier en niet naast de andere
     doossleutels, omdat ./mutatiecontracten-beleidsmotor.js tegen de grens zit. */
  'POST /api/office/doos/gedeeld/zet': {
    mutatieId: 'office.doos.gedeeld.zet', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/doossleutels.test.js toets 7a-7c: dicht en open zijn een toestand; nog eens dicht ' +
      'laat hem dicht, en dichtzetten weigert zolang een doos de gedeelde sleutel gebruikt', op: '2026-09-24' },
    nagekeken: 'met de hand, 2026-09-24: kern/zaakdoos/sleutels.js gedeeldZet() schrijft dicht, door en at op de ene kaart',
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
  },
  /* De andere helft van de tekengrens-mix: een oude vrije naam in de concerngraaf
     alsnog duiden, zodat hij voor de tekengrens mee kan tellen. */
  'POST /api/concern/feit/duid': {
    mutatieId: 'concern.feit.duid', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'entiteit' }, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/concernduiding.test.js toets 1-5: een tweede duiding van hetzelfde feit geeft 404 (vervallen) ' +
      'en een feit op een codenaam 409; de stand blijft die van de eerste. Een toestandscontrole en geen duplicaatlaag', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: kern/concern/duiding.js laat het oude feit vervallen en zet een nieuw met hetzelfde venster',
    afgetekend: AF
  }
};

module.exports = { CONTRACTEN };
