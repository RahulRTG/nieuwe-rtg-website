'use strict';

function nieuweCapabilitymeting(bucketCount) {
  return { attempts: 0, eligible: 0, succeeded: 0, failed: 0, degraded: 0,
    denied: 0, notApplicable: 0, replays: 0, durationCount: 0,
    durationBuckets: new Array(bucketCount).fill(0), durationSumMs: 0,
    domainOutcomes: {}, errorClasses: {}, firstAt: null, lastAt: null };
}

function voegCapabilitymetingToe(uit, bron) {
  for (const sleutel of ['attempts', 'eligible', 'succeeded', 'failed', 'degraded',
    'denied', 'notApplicable', 'replays', 'durationCount', 'durationSumMs'])
    uit[sleutel] += Number(bron[sleutel]) || 0;
  for (let n = 0; n < uit.durationBuckets.length; n++)
    uit.durationBuckets[n] += Number(bron.durationBuckets[n]) || 0;
  for (const [sleutel, waarde] of Object.entries(bron.domainOutcomes || {}))
    uit.domainOutcomes[sleutel] = (uit.domainOutcomes[sleutel] || 0) + waarde;
  for (const [sleutel, waarde] of Object.entries(bron.errorClasses || {}))
    uit.errorClasses[sleutel] = (uit.errorClasses[sleutel] || 0) + waarde;
  if (!uit.firstAt || bron.firstAt < uit.firstAt) uit.firstAt = bron.firstAt;
  if (!uit.lastAt || bron.lastAt > uit.lastAt) uit.lastAt = bron.lastAt;
  return uit;
}

module.exports = { nieuweCapabilitymeting, voegCapabilitymetingToe };
