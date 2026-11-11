/* De RTF-onboarding bewaart profielvelden achter de geverifieerde gezinssessie.
   De kale effectmeting ziet die sessieopslag niet als gewone collectie en mag
   daarom niet zelf besluiten dat de route zonder contract kan. De bouw en de
   drie bestaande ketenproeven dragen de menselijke classificatie hieronder. */
'use strict';

const CONTRACTEN = {
  'POST /api/rtf/onboarding/opslaan': {
    mutatieId: 'rtf.onboarding.opslaan',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'code' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'test/onboarding.test.js, test/onboarding-workers.pg.test.js en test/rtf-onboarding-client.test.js',
      op: '2026-11-10'
    },
    waarom: 'De geverifieerde gezinssessie bepaalt het profiel. Opslaan vervangt uitsluitend de genoemde velden van dat profiel; dezelfde velden opnieuw opslaan verandert de uitkomst niet.',
    afgetekend: { door: 'Codex, handler en bestaande onboardingproeven nagelezen; geen menselijke productievrijgave', op: '2026-11-10' }
  }
};

module.exports = { CONTRACTEN };
