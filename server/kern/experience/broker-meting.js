/* Shadowmeting rond de Experience Broker. Meetfouten mogen de bestaande
   domeinhandeling nooit toestaan, weigeren of terugdraaien. */
'use strict';

module.exports = function maakBrokerMeting({ trustPlane, opslag }) {
  function start(key) {
    if (!trustPlane || typeof trustPlane.timer !== 'function') return null;
    try {
      return trustPlane.timer({ capability: 'experience.propose',
        boundary: 'actor:' + opslag.actor(key) });
    } catch (e) { return null; }
  }

  function finish(timer, result, succes, domainOutcome, measurementKey) {
    if (!timer) return;
    const status = Number(result && result.status) || (succes ? 200 : 500);
    try {
      timer.finish({ outcome: succes ? 'SUCCEEDED' : (status >= 500 ? 'FAILED' : 'DENIED'),
        domainOutcome, errorClass: succes ? null : (result && result.code) || 'HTTP_' + status,
        measurementKey: succes ? measurementKey : null, replay: !!(result && result.replay) });
    } catch (e) { /* shadowmeting verandert geen productbesluit */ }
  }

  return Object.freeze({ start, finish });
};
