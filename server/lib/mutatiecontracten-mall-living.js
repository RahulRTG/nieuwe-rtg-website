/* ============================================================================
   MUTATIECONTRACT -- LEVENDE MALL-PROJECTIE.

   Dit POST-loket leest bestaande Mall-, App-Bibliotheek-, RTG-product- en
   leveranciersbronnen en projecteert ze in een gezamenlijke etalage. Het
   schrijft geen product, bestelling, commercieel recht of betaling. Acties uit
   de etalage blijven naar de bestaande domeineigenaren wijzen.
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  'POST /api/mall/living': {
    mutatieId: 'mall.living.lezen',
    herkomst: 'mens',
    toegang: { klasse: 'AUTHENTICATED' },
    semantiek: { klasse: 'idempotent' },
    stand: 'NOT_APPLICABLE',
    waarom: 'De handler leest vier bestaande bronnen en geeft uitsluitend een read-only ' +
      'projectie terug. Installeren, bewaren, bestellen en betalen lopen via hun bestaande routes.',
    nagekeken: 'Codex, 2026-10-15: route en projectiefunctie volledig gelezen; geen productievrijgave',
    afgetekend: {
      door: 'Codex, lokale integratietoets; niet door een menselijke releasebeoordelaar afgetekend',
      op: '2026-10-15'
    },
    bewijs: {
      gemeten: 'test/mall-living.test.js bewijst pure projectie en brongebonden acties',
      op: '2026-10-15'
    }
  }
};

module.exports = { CONTRACTEN };
