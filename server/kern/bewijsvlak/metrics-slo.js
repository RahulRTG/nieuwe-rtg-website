/* Pure berekening van een capability-SLO uit een begrensd aggregaat. */
'use strict';

const { bevries, kopie } = require('./canon');
const DAG_MS = 86400000;

function percentile(c, buckets, quantile) {
  if (!c.durationCount) return null;
  const doel = c.durationCount * quantile;
  for (let n = 0; n < buckets.length; n++) if (c.durationBuckets[n] >= doel) return buckets[n];
  return null;
}

function bereken({ capability, profileId, profile, nowMs, startedAt, aggregate, buckets, iso }) {
  if (!profile) return { capability, profile: profileId, oordeel: 'onvoldoende gemeten',
    reasons: ['SLO_PROFILE_UNKNOWN'] };
  const c = aggregate(capability, profile.windowDays, nowMs);
  const windowMs = profile.windowDays * DAG_MS;
  const started = Math.max(startedAt, nowMs - windowMs);
  const coverage = Math.min(1, Math.max(0, nowMs - started) / windowMs);
  const bad = c.failed + c.degraded;
  const availability = c.eligible ? Number(((c.succeeded / c.eligible) * 100).toFixed(5)) : null;
  const latencyMs = percentile(c, buckets, profile.latency.quantile);
  const freshnessMs = c.lastAt ? nowMs - Date.parse(c.lastAt) : null;
  const reasons = [];
  if (!c.eligible) reasons.push('NO_ELIGIBLE_MEASUREMENTS');
  if (c.eligible < profile.minimumSamples) reasons.push('INSUFFICIENT_SAMPLES');
  if (coverage < profile.minimumCoverage) reasons.push('INSUFFICIENT_WINDOW_COVERAGE');
  if (c.durationCount < profile.minimumSamples) reasons.push('INSUFFICIENT_LATENCY_SAMPLES');
  if (freshnessMs == null || freshnessMs > profile.freshnessMinutes * 60000) reasons.push('STALE_MEASUREMENTS');
  const enough = reasons.length === 0;
  if (enough && availability < profile.availabilityTarget) reasons.push('AVAILABILITY_TARGET_MISSED');
  if (enough && (latencyMs == null || latencyMs > profile.latency.maxMs)) reasons.push('LATENCY_TARGET_MISSED');
  const allowedBad = c.eligible * ((100 - profile.availabilityTarget) / 100);
  const budgetUsed = allowedBad > 0 ? bad / allowedBad : (bad ? Infinity : 0);
  const oordeel = !enough ? 'onvoldoende gemeten'
    : reasons.some(x => x.endsWith('_MISSED')) ? 'niet gehaald' : 'gehaald';
  return bevries({ capability, profile: profileId, oordeel, reasons,
    window: { days: profile.windowDays, coverage: Number(coverage.toFixed(4)),
      startedAt: iso(started), lastAt: c.lastAt },
    availability: { target: profile.availabilityTarget, measured: availability,
      eligible: c.eligible, succeeded: c.succeeded, failed: c.failed, degraded: c.degraded,
      budget: { allowedBad: Number(allowedBad.toFixed(4)), usedBad: bad,
        usedPart: Number.isFinite(budgetUsed) ? Number(budgetUsed.toFixed(4)) : null,
        exhausted: bad > allowedBad } },
    latency: { quantile: profile.latency.quantile, targetMs: profile.latency.maxMs,
      measuredUpperBoundMs: latencyMs, samples: c.durationCount },
    excluded: { denied: c.denied, notApplicable: c.notApplicable, replays: c.replays },
    domainOutcomes: kopie(c.domainOutcomes), errorClasses: kopie(c.errorClasses) });
}

module.exports = { bereken, percentile };
