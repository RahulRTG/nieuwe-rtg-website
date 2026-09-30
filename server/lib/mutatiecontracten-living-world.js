'use strict';
module.exports.CONTRACTEN = {
  'POST /api/living-world/view': {
    mutatieId:'living-world.view',herkomst:'mens',semantiek:{klasse:'idempotent'},
    toegang:{klasse:'AUTHENTICATED'},stand:'NOT_APPLICABLE',
    waarom:'Leest de voor dit lid zichtbare wereld en actuele bronverwijzingen. Alle domeinhandelingen lopen afzonderlijk door de Experience Broker.',
    nagekeken:'Codex, server/routes/living-world.js en server/kern/living-world/projection.js, 2026-09-30. Deze ingang schrijft geen ervaring, ontvangstbewijs of bijdrage.',
    afgetekend:{door:'Codex, in opdracht van de eigenaar',op:'2026-09-30'},
    bewijs:{gemeten:'test/living-world-http.test.js: echte sessies, verborgen privéplan, organisatorgrens en ketenresultaat; test/living-world.test.js: preview zonder domeinschrijving.',op:'2026-09-30'}
  }
};
