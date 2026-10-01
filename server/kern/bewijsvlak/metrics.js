/* Duurzame capabilitymetingen. Technische betrouwbaarheid, beleidsweigeringen
   en bedrijfsuitkomsten blijven drie verschillende feiten. Er worden alleen
   begrensde tellers en histogrammen bewaard, nooit actors, invoer of fouten. */
'use strict';

const klok = require('../../lib/klok');
const { hash, bevries, kopie } = require('./canon');
const sloProfiles = require('./slo-profiles');
const metricsSlo = require('./metrics-slo');

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

function maakMeter(opties) {
  const o = opties || {}, state = o.state || {};
  const nu = o.nu || (() => klok.nu());
  const save = typeof o.save === 'function' ? o.save : () => {};
  const capabilityExists = typeof o.capabilityExists === 'function' ? o.capabilityExists : () => true;
  state.version = 1;
  state.startedAt = state.startedAt || iso(tijdMs(nu()));
  state.buckets = state.buckets || {};
  state.keys = state.keys || {};
  state.sequence = Number(state.sequence) || 0;

  function ruim(nowMs) {
    const grens = nowMs - RETENTION_DAYS * DAG_MS;
    for (const key of Object.keys(state.buckets)) if (tijdMs(key + 'T00:00:00.000Z') < grens) delete state.buckets[key];
    for (const [key, v] of Object.entries(state.keys)) if (tijdMs(v.at) < grens) delete state.keys[key];
  }

  function record(invoer) {
    const i = invoer || {}, capability = String(i.capability || '');
    if (!capabilityExists(capability)) throw new Error('capabilitymeting: onbekende capability ' + capability);
    const outcome = label(i.outcome);
    if (!OUTCOMES.includes(outcome)) throw new Error('capabilitymeting: onbekende uitkomst ' + outcome);
    const atMs = tijdMs(i.at || nu()), at = iso(atMs);
    const keyValue = i.measurementKey || i.idempotencyKey || null;
    const keyId = keyValue ? hash({ capability, key: String(keyValue) }) : null;
    const semantics = hash({ capability, outcome,
      domainOutcome: label(i.domainOutcome, 'UNSPECIFIED'), errorClass: label(i.errorClass, 'NONE') });
    if (keyId && state.keys[keyId]) {
      if (state.keys[keyId].semantics !== semantics)
        throw new Error('capabilitymeting: dezelfde measurementsleutel heeft een andere betekenis');
      const replayBucketId = dag(atMs);
      const replayBucket = state.buckets[replayBucketId] = state.buckets[replayBucketId] ||
        { firstAt: at, lastAt: at, capabilities: {} };
      const replayCapability = replayBucket.capabilities[capability] =
        replayBucket.capabilities[capability] || legeCapability();
      replayCapability.replays++;
      replayBucket.lastAt = replayBucket.lastAt > at ? replayBucket.lastAt : at;
      ruim(atMs); save();
      return bevries({ ok: true, replay: true, measurementId: state.keys[keyId].measurementId,
        capability, outcome, at: state.keys[keyId].at });
    }

    const bucketId = dag(atMs);
    const bucket = state.buckets[bucketId] = state.buckets[bucketId] ||
      { firstAt: at, lastAt: at, capabilities: {} };
    const c = bucket.capabilities[capability] = bucket.capabilities[capability] || legeCapability();
    c.attempts++;
    if (outcome === 'SUCCEEDED') { c.succeeded++; c.eligible++; }
    else if (outcome === 'FAILED') { c.failed++; c.eligible++; }
    else if (outcome === 'DEGRADED') { c.degraded++; c.eligible++; }
    else if (outcome === 'DENIED') c.denied++;
    else c.notApplicable++;
    if (i.replay) c.replays++;

    const durationMs = Number(i.durationMs);
    if (['SUCCEEDED', 'FAILED', 'DEGRADED'].includes(outcome) &&
      Number.isFinite(durationMs) && durationMs >= 0) {
      c.durationCount++; c.durationSumMs += durationMs;
      for (let n = 0; n < LATENCY_BUCKETS_MS.length; n++) if (durationMs <= LATENCY_BUCKETS_MS[n]) c.durationBuckets[n]++;
    }
    const domainOutcome = label(i.domainOutcome, 'UNSPECIFIED');
    c.domainOutcomes[domainOutcome] = (c.domainOutcomes[domainOutcome] || 0) + 1;
    if (i.errorClass) {
      const errorClass = label(i.errorClass, 'UNKNOWN');
      c.errorClasses[errorClass] = (c.errorClasses[errorClass] || 0) + 1;
    }
    c.firstAt = c.firstAt || at; c.lastAt = at;
    bucket.firstAt = bucket.firstAt < at ? bucket.firstAt : at;
    bucket.lastAt = bucket.lastAt > at ? bucket.lastAt : at;
    const measurementId = 'measurement_' + hash({ capability, at, sequence: ++state.sequence, outcome }).slice(0, 24);
    if (keyId) state.keys[keyId] = { measurementId, at, semantics };
    ruim(atMs); save();
    return bevries({ ok: true, replay: false, measurementId, capability, outcome, at,
      durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : null,
      measurementHash: hash({ measurementId, capability, outcome, at, durationMs: Number.isFinite(durationMs) ? durationMs : null }) });
  }

  function aggregate(capability, windowDays, nowValue) {
    const nowMs = tijdMs(nowValue || nu()), grens = nowMs - (Number(windowDays) || 30) * DAG_MS;
    const uit = legeCapability();
    for (const [bucketId, bucket] of Object.entries(state.buckets)) {
      if (tijdMs(bucketId + 'T23:59:59.999Z') < grens) continue;
      const c = bucket.capabilities && bucket.capabilities[capability]; if (!c) continue;
      for (const k of ['attempts', 'eligible', 'succeeded', 'failed', 'degraded', 'denied', 'notApplicable', 'replays', 'durationCount', 'durationSumMs'])
        uit[k] += Number(c[k]) || 0;
      for (let n = 0; n < LATENCY_BUCKETS_MS.length; n++) uit.durationBuckets[n] += Number(c.durationBuckets[n]) || 0;
      for (const [k, v] of Object.entries(c.domainOutcomes || {})) uit.domainOutcomes[k] = (uit.domainOutcomes[k] || 0) + v;
      for (const [k, v] of Object.entries(c.errorClasses || {})) uit.errorClasses[k] = (uit.errorClasses[k] || 0) + v;
      if (!uit.firstAt || c.firstAt < uit.firstAt) uit.firstAt = c.firstAt;
      if (!uit.lastAt || c.lastAt > uit.lastAt) uit.lastAt = c.lastAt;
    }
    return uit;
  }

  function stand(capability, profileId, nowValue) {
    const profile = sloProfiles.haal(profileId);
    const nowMs = tijdMs(nowValue || nu());
    return metricsSlo.bereken({ capability, profileId, profile, nowMs,
      startedAt: tijdMs(state.startedAt), aggregate, buckets: LATENCY_BUCKETS_MS, iso });
  }

  function timer(meta) {
    const basis = { ...(meta || {}) }, gestart = process.hrtime.bigint(); let klaar = null;
    return Object.freeze({
      finish(resultaat) {
        if (klaar) return klaar;
        const durationMs = Number(process.hrtime.bigint() - gestart) / 1e6;
        klaar = record({ ...basis, ...(resultaat || {}), durationMs });
        return klaar;
      }
    });
  }

  return Object.freeze({ record, timer, aggregate, stand,
    standAll: (contracts, nowValue) => (contracts || []).map(c => stand(c.id, c.slo.profile, nowValue)),
    snapshot: () => kopie(state), buckets: LATENCY_BUCKETS_MS.slice(), outcomes: OUTCOMES.slice() });
}

module.exports = { maakMeter, OUTCOMES, LATENCY_BUCKETS_MS, RETENTION_DAYS };
