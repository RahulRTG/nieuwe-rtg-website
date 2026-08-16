/* Afwikkeling van uitgaande providerbetalingen. Afgesplitst van webhooks.js:
   dit is een eigen financieel proces, terwijl webhooks.js vooral de volgorde
   van parser, rem en opslagpoort bewaakt. */
'use strict';

module.exports = async function verwerkPayout({ soort, payout, opdrachtenVan, log }) {
  if (soort !== 'payout.paid' && soort !== 'payout.failed' && soort !== 'payout.canceled') return;
  const rij = opdrachtenVan && opdrachtenVan();
  if (!rij || !payout || !payout.id) return;

  /* Een mislukking moet via dezelfde opdracht worden teruggeboekt. bevestig()
     is idempotent, zodat herhaalde providerleveringen geen tweede mutatie doen. */
  const r = await rij.bevestig({
    settlementRef: payout.id,
    gelukt: soort === 'payout.paid',
    reden: payout.failure_message || payout.failure_code || soort
  });
  if (r && r.error)
    log.info('payout-webhook zonder bijbehorende betaalopdracht', { id: payout.id, type: soort });
  else
    log.info('payout-webhook verwerkt', { id: payout.id, type: soort, opdracht: r && r.id, status: r && r.status });
};
