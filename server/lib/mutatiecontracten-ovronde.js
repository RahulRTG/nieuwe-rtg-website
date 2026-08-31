/* ============================================================================
   MUTATIECONTRACTEN -- DE LAATSTE VIER VAN DE OV-RONDE (30 augustus 2026).

   Deel van ./mutatiecontracten.js.

   Toen het genre `ov` werd aangesloten -- intern, dus via
   /api/office/instelling/aansluiten en niet langs de aanmeldbalie -- gingen de
   OV-deuren open en gaven negen van de negentien routes een uitslag. Drie ervan
   kwamen op LEGACY terecht, samen met een vierde die door de herstelde
   documentketen zichtbaar werd. Dezelfde beweging als bij de vorige twee rondes:
   er IS gemeten, dus BLOCKED_BY_TEST_FIXTURE geldt niet meer.

   Alle vier zijn de handler zelf ingelezen, want de meting alleen zegt hier het
   verkeerde: drie van de vier maten `beschermd` MET sleutel, en dat is bij een
   LEESroute niets anders dan de poort die een antwoord bewaart.
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de gelezen handler naast de meting; niet door een mens nagelezen',
  op: '2026-08-30'
};

/* Drie lezers in de OV-laag. `stand` en `overzicht` filteren db.data.ovRitten en
   geven het resultaat terug; `lijnenBeheer` heet wel "beheer" maar leest alleen
   (s.lijnen || []).map(...) en roept geen save(). Er valt hier niets te
   dedupliceren, en het `beschermd` uit de proef is de idem-poort die een
   LEESantwoord vasthield -- niet de route. */
const lezer = (route, mutatieId, wat) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' },
  stand: 'NOT_APPLICABLE',
  bewijs: {
    gemeten: 'OV-ronde: MET sleutel werd de herhaling opgevangen. Dat zegt bij een leesroute niets over ' +
      'de route -- de poort hield een antwoord vast',
    op: '2026-08-30'
  },
  nagekeken: 'handler gelezen in server/kern/ov/dienst.js: ' + wat + ' -- geen save(), geen schrijfvorm',
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  lezer('POST /api/staff/ov/stand', 'staff.ov.stand',
    'stand() filtert de ritten van vandaag voor dit voertuig en telt ze'),
  lezer('POST /api/staff/ov/lijnen', 'staff.ov.lijnen',
    'lijnenBeheer() geeft de lijnen, de soorten en de ijkpunten terug; de naam zegt "beheer" maar de ' +
    'functie schrijft niet (dat doet lijnZet ernaast)'),
  lezer('POST /api/supplier/ov/overzicht', 'supplier.ov.overzicht',
    'overzicht() filtert de ritten en operaties van vandaag'),

  ['POST /api/foundation/gezin/gezondheid/medicijn/verwijder', {
    mutatieId: 'foundation.gezin.gezondheid.medicijn.verwijder', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'code' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'OV-ronde: MET sleutel EN ZONDER sleutel werd de herhaling opgevangen, gezien aan de opslag',
      op: '2026-08-30'
    },
    nagekeken: 'handler gelezen in server/foundation/gasten/gezondheid.js: hij doet ' +
      '`h.medicijnen = h.medicijnen.filter(m => m.id !== medId)`. Een verwijdering die op een FILTER rust ' +
      'is idempotent van nature -- de tweede oproep vindt niets meer om weg te laten en laat exact ' +
      'dezelfde lijst achter. Dat is geen toestandscontrole (er komt geen 404 uit) maar echt hetzelfde ' +
      'eindresultaat',
    afgetekend: AFGETEKEND
  }]
]);

module.exports = CONTRACTEN;
