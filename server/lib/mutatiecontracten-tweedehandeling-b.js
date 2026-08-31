/* ============================================================================
   MUTATIECONTRACTEN -- EEN TWEEDE AANROEP IS EEN TWEEDE HANDELING.

   Deel van server/lib/mutatiecontracten.js. Deze dertig komen uit dezelfde kale
   ronde als ./mutatiecontracten-kaleronde.js en ./mutatiecontracten-kaleronde-b.js,
   maar met de omgekeerde uitkomst: bij deze is de herhaling GEEN dubbeltik.

   ZE HEBBEN MET OPZET GEEN DUPLICAATREGEL, en dat is de moeilijkere helft. Een
   laag die hier de tweede oproep opslikt, laat werk verdwijnen zonder dat iemand
   het merkt. Drie soorten:

     RONDES    een controle, een opruiming, een bijwerkronde, een integriteits-
               check. De tweede ronde hoort met recht iets anders te vinden dan de
               eerste -- dat is niet toevallig, dat is het bewijs dat de eerste
               werkte.
     INZAGE    een raadpleging die een journaalregel schrijft. Twee keer in een
               leerlingdossier kijken is twee keer kijken, en het inzagejournaal
               hoort dat allebei te dragen. Dedupliceren maakt daar van een
               privacywaarborg een gemiddelde.
     MOMENTEN  een pols, een alarm, een locatiemelding, een vraag aan de AI. Twee
               keer is twee keer, ook als de inhoud gelijk is.

   Dat laatste is niet theoretisch. /api/supplier/security is een ALARMKNOP: een
   laag die de tweede druk opslikt, kan iemand in nood stil laten staan.

   HET BEWIJS DAT DEZE STAND EIST is precies wat de kale ronde gaf: alle dertig
   zijn gemeten als `onbeschermd` -- een woordelijk gelijke herhaling DEED het
   werk opnieuw. Dat is hier geen bevinding maar de bevestiging dat het gedrag is
   zoals de reden zegt. De reden zelf staat per route in
   ./idemsleutels-kaleronde-b.js, waar hij ook de idem-poort stuurt; hem hier
   overschrijven zou twee plekken maken van een waarheid.
   ========================================================================== */
'use strict';

const { SLEUTELS } = require('./idemsleutels-kaleronde-b');

const AFGETEKEND = {
  door: 'Claude (Opus 5), handler per route gelezen op 30 augustus 2026; niet door een mens nagelezen',
  op: '2026-08-30'
};

const auth = { klasse: 'AUTHENTICATED' };
const school = { klasse: 'OBJECT_SCOPED', objectVeld: 'schoolCode' };
const gezin = { klasse: 'OBJECT_SCOPED', objectVeld: 'code' };
const huis = { klasse: 'OBJECT_SCOPED', objectVeld: 'bedrijf' };

/* DE REDEN KOMT UIT DE SLEUTELLIJST EN WORDT HIER NIET OVERGETYPT. Daar stuurt
   hij de idem-poort, hier draagt hij het contract -- en twee kopieen van een zin
   lopen uiteen zodra iemand er een verbetert (LAT.md regel 4). Ontbreekt hij,
   dan is dat een fout en geen lege string: de keuring weigert het contract dan
   met zoveel woorden, en dat is precies wat je wilt. */
const tweede = (route, mutatieId, toegang) => {
  const v = SLEUTELS[route];
  if (!v || !v.nietIdempotent || !v.waarom) {
    throw new Error('mutatiecontracten-tweedehandeling-b: ' + route + ' heeft geen `nietIdempotent` met ' +
      'reden in ./idemsleutels-kaleronde-b.js -- daar hoort de reden te staan, niet hier');
  }
  return [route, {
    mutatieId, herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: v.waarom,
    bewijs: {
      gemeten: 'kale ronde zonder sleutel: twee woordelijk gelijke oproepen, en de tweede DEED het werk ' +
        'opnieuw -- het gedrag is dus werkelijk zoals de reden hierboven zegt',
      op: '2026-08-30'
    },
    afgetekend: AFGETEKEND
  }];
};

const CONTRACTEN = Object.fromEntries([
  tweede('POST /api/appstore/kantoor/hercontrole', 'appstore.kantoor.hercontrole', auth),
  tweede('POST /api/command/incident/weeg', 'command.incident.weeg', auth),
  tweede('POST /api/command/operator/plan', 'command.operator.plan', auth),
  tweede('POST /api/supplier/command/operator/plan', 'supplier.command.operator.plan', auth),
  tweede('POST /api/office/bank/regels/check', 'office.bank.regels.check', auth),
  tweede('POST /api/office/partner/regels/check', 'office.partner.regels.check', auth),
  tweede('POST /api/office/rechtsvormwacht/check', 'office.rechtsvormwacht.check', auth),
  tweede('POST /api/office/payroll/regels/haal', 'office.payroll.regels.haal', auth),
  tweede('POST /api/office/onderzoeker/ontwikkel', 'office.onderzoeker.ontwikkel', auth),
  tweede('POST /api/office/boardroom/verbeter', 'office.boardroom.verbeter', auth),
  tweede('POST /api/office/weefsel/reeks/veeg', 'office.weefsel.reeks.veeg', auth),
  tweede('POST /api/office/zelfzorg/bescherm', 'office.zelfzorg.bescherm', auth),
  tweede('POST /api/office/zelfzorg/herstel', 'office.zelfzorg.herstel', auth),
  tweede('POST /api/office/zelfzorg/opruim', 'office.zelfzorg.opruim', auth),
  tweede('POST /api/office/zelfzorg/upgrade', 'office.zelfzorg.upgrade', auth),
  tweede('POST /api/techniek/controle/integriteit', 'techniek.controle.integriteit', auth),
  tweede('POST /api/foundation/school/export', 'foundation.school.export', school),
  tweede('POST /api/foundation/school/incident/lijst', 'foundation.school.incident.lijst', school),
  tweede('POST /api/foundation/school/ontruiming', 'foundation.school.ontruiming', school),
  tweede('POST /api/supplier/zegel/check', 'supplier.zegel.check', auth),
  tweede('POST /api/residentie/pols', 'residentie.pols', auth),
  tweede('POST /api/residentie/emote', 'residentie.emote', auth),
  tweede('POST /api/residentie/betreed', 'residentie.betreed', auth),
  tweede('POST /api/foundation/gezin/locatie', 'foundation.gezin.locatie', gezin),
  tweede('POST /api/supplier/security', 'supplier.security', auth),
  tweede('POST /api/supplier/team/buzz', 'supplier.team.buzz', auth),
  tweede('POST /api/foundation/school/bijles/vraag', 'foundation.school.bijles.vraag', gezin),
  tweede('POST /api/member/lifestyle/concierge/vraag', 'member.lifestyle.concierge.vraag', auth),
  tweede('POST /api/kantoorpakket/maak', 'kantoorpakket.maak', auth),
  tweede('POST /api/werkplek/kantoorpakket/maak', 'werkplek.kantoorpakket.maak', huis)
]);

module.exports = { CONTRACTEN };
