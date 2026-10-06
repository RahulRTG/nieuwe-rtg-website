'use strict';

module.exports = function maakKaartPayout(opdrachtenVan, log) {
  return async function payout(evt, object) {
    const soort = evt && evt.type;
    if (!['payout.paid', 'payout.failed', 'payout.canceled'].includes(soort)) return;
    const rij = opdrachtenVan && opdrachtenVan();
    if (!rij || !object || !object.id) return;
    const r = await rij.bevestig({ settlementRef: object.id, gelukt: soort === 'payout.paid',
      reden: object.failure_message || object.failure_code || soort });
    if (r && r.error) log.info('payout-webhook zonder bijbehorende betaalopdracht',
      { id: object.id, type: soort });
    else log.info('payout-webhook verwerkt',
      { id: object.id, type: soort, opdracht: r && r.id, status: r && r.status });
  };
};
