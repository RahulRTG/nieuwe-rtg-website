/* ============================================================================
   MUTATIECONTRACTEN -- DE LEESROUTES VAN EEN ZAAK.

   Zijbestand van ./mutatiecontracten-leest.js; zie de kop van
   ./mutatiecontracten.js voor de vorm en de regels, en die van ./mutatiecontracten-leest.js
   voor waarom NOT_APPLICABLE twee onafhankelijke lijnen bewijs eist.

   Waarom apart: ./mutatiecontracten-leest.js ging over de 10 kB-grens die
   scripts/check.js bewaakt, en deze kant groeit mee met de ketenproeven terwijl
   de rest van dat bestand stil ligt.
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  /* HET LOGBOEK VAN DE ZAAK. Toegevoegd op 2026-09-13 omdat er tot die dag geen
     enkele route was die db.data.supplierActivity teruggaf: logActivity()
     schreef er sinds jaar en dag naartoe en niemand kon het lezen. Gevonden
     door scripts/zaakliveproef.js, storing 6.

     Let op de toegangsklasse. De ROUTER ziet supplierAuth en dus AUTHENTICATED;
     de manager-eis zit IN de handler (managerOnly). Dat is precies het patroon
     waar test/autonomiegrens.test.js over gaat, en het staat hier daarom
     uitgeschreven in plaats van als CAPABILITY_GATED verklaard -- een klasse
     die de router niet kan zien, is een bewering en geen grens. */
  'POST /api/supplier/activity': {
    mutatieId: 'supplier.activity.lezen', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED',
      let: 'supplierAuth is de bewakerslaag die de router ziet. De manager-eis (managerOnly) ' +
        'staat in de handler en is van buiten niet af te leiden; de code van de zaak komt uit ' +
        'de SESSIE en nooit uit het lichaam, dus een zaak leest hier uitsluitend haar eigen bak.' },
    stand: 'NOT_APPLICABLE',
    nagekeken: 'Claude, 2026-09-13: de handler in routes/supplier/tafels-team.js leest ' +
      'db.data.supplierActivity[req.supplier.code], begrenst met slice() en geeft terug -- ' +
      'geen save(), geen logActivity(), geen toewijzing. slice() muteert niet.',
    bewijs: { gemeten: 'dubbeltik-ronde op een verse zaak: twee oproepen gaven een identiek ' +
      'antwoord en de spoorteller bleef op 1 (een schrijvende route zou hem hebben opgehoogd); ' +
      'een ledentoken kreeg 401', op: '2026-09-13' },
    afgetekend: { door: 'Claude (Opus 5), handler geschreven en nagelezen, dubbeltik gemeten', op: '2026-09-13' }
  }
};

module.exports = { CONTRACTEN };
