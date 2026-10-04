/* De vaste vorm van een capabilitymeting: de uitkomsten, de latentiebuckets,
   de bewaartermijn en een lege telling. Afgesplitst uit ./metrics.js, dat over
   de omvanggrens ging; hier staat geen state en geen opslag. */
'use strict';

const klok = require('../../lib/klok');

const OUTCOMES = Object.freeze(['SUCCEEDED', 'FAILED', 'DEGRADED', 'DENIED', 'NOT_APPLICABLE']);
const LATENCY_BUCKETS_MS = Object.freeze([1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000]);
const RETENTION_DAYS = 40;
const DAG_MS = 86400000;

function tijdMs(waarde) {
  if (typeof waarde === 'number' && Number.isFinite(waarde)) return waarde;
  const n = Date.parse(waarde || '');
  return Number.isFinite(n) ? n : klok.nu();
}
function iso(ms) { return new Date(ms).toISOString(); }
function dag(ms) { return iso(ms).slice(0, 10); }
function label(waarde, terugval) {
  const s = String(waarde || terugval || '').toUpperCase().replace(/[^A-Z0-9_.:-]/g, '_').slice(0, 80);
  return s || terugval;
}
function legeCapability() {
  return { attempts: 0, eligible: 0, succeeded: 0, failed: 0, degraded: 0,
    denied: 0, notApplicable: 0, replays: 0, durationCount: 0,
    durationBuckets: new Array(LATENCY_BUCKETS_MS.length).fill(0), durationSumMs: 0,
    domainOutcomes: {}, errorClasses: {}, firstAt: null, lastAt: null };
}

module.exports = { OUTCOMES, LATENCY_BUCKETS_MS, RETENTION_DAYS, DAG_MS, tijdMs, iso, dag, label, legeCapability };
