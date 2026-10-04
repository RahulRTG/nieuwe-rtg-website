/* Duurzame capabilitymetingen. Technische betrouwbaarheid, beleidsweigeringen
   en bedrijfsuitkomsten blijven drie verschillende feiten. Er worden alleen
   begrensde tellers en histogrammen bewaard, nooit actors, invoer of fouten. */
'use strict';

const klok = require('../../lib/klok');
const { hash, bevries, kopie } = require('./canon');
const sloProfiles = require('./slo-profiles');
const metricsSlo = require('./metrics-slo');

// Uitkomsten, buckets, retentie en de lege telling: ./metrics-vorm.js.
const { OUTCOMES, LATENCY_BUCKETS_MS, RETENTION_DAYS, DAG_MS, tijdMs, iso, dag, label,
  legeCapability } = require('./metrics-vorm');

function maakMeter(opties) {
  const o = opties || {}, vasteState = o.state || {};
  const stateFor = typeof o.stateFor === 'function' ? o.stateFor : () => vasteState;
  const nu = o.nu || (() => klok.nu());
  const save = typeof o.save === 'function' ? o.save : () => {};
  const capabilityExists = typeof o.capabilityExists === 'function' ? o.capabilityExists : () => true;
  function state() {
    const s = stateFor();
    if (!s || typeof s !== 'object') throw new Error('capabilitymeting: state ontbreekt');
    s.version = 1;
    s.startedAt = s.startedAt || iso(tijdMs(nu()));
    s.buckets = s.buckets || {};
    s.keys = s.keys || {};
    s.sequence = Number(s.sequence) || 0;
    return s;
  }
  state();

  function ruim(s, nowMs, undo) {
    const grens = nowMs - RETENTION_DAYS * DAG_MS;
    for (const key of Object.keys(s.buckets)) if (tijdMs(key + 'T00:00:00.000Z') < grens) {
      undo.buckets.push([key, s.buckets[key]]); delete s.buckets[key];
    }
    for (const [key, v] of Object.entries(s.keys)) if (tijdMs(v.at) < grens) {
      undo.keys.push([key, v]); delete s.keys[key];
    }
  }

  function herstel(s, undo) {
    s.sequence = undo.sequence;
    if (undo.bucketBestond) s.buckets[undo.bucketId] = undo.bucket;
    else delete s.buckets[undo.bucketId];
    if (undo.keyId) {
      if (undo.keyBestond) s.keys[undo.keyId] = undo.key;
      else delete s.keys[undo.keyId];
    }
    for (const [key, value] of undo.buckets) s.buckets[key] = value;
    for (const [key, value] of undo.keys) s.keys[key] = value;
  }

  function recordMeting(invoer) {
    const s = state();
    const i = invoer || {}, capability = String(i.capability || '');
    if (!capabilityExists(capability)) throw new Error('capabilitymeting: onbekende capability ' + capability);
    const outcome = label(i.outcome);
    if (!OUTCOMES.includes(outcome)) throw new Error('capabilitymeting: onbekende uitkomst ' + outcome);
    const atMs = tijdMs(i.at || nu()), at = iso(atMs);
    const keyValue = i.measurementKey || i.idempotencyKey || null;
    const keyId = keyValue ? hash({ capability, key: String(keyValue) }) : null;
    const semantics = hash({ capability, outcome,
      domainOutcome: label(i.domainOutcome, 'UNSPECIFIED'), errorClass: label(i.errorClass, 'NONE') });
    if (keyId && s.keys[keyId]) {
      if (s.keys[keyId].semantics !== semantics)
        throw new Error('capabilitymeting: dezelfde measurementsleutel heeft een andere betekenis');
      const replayBucketId = dag(atMs);
      const undo = { sequence: s.sequence, bucketId: replayBucketId,
        bucketBestond: Object.prototype.hasOwnProperty.call(s.buckets, replayBucketId),
        bucket: s.buckets[replayBucketId], keyId: null, buckets: [], keys: [] };
      const replayBucket = s.buckets[replayBucketId] = undo.bucketBestond
        ? kopie(undo.bucket) : { firstAt: at, lastAt: at, capabilities: {} };
      const replayCapability = replayBucket.capabilities[capability] =
        replayBucket.capabilities[capability] || legeCapability();
      replayCapability.replays++;
      replayBucket.lastAt = replayBucket.lastAt > at ? replayBucket.lastAt : at;
      ruim(s, atMs, undo);
      try { save(); } catch (error) { herstel(s, undo); throw error; }
      return bevries({ ok: true, replay: true, measurementId: s.keys[keyId].measurementId,
        capability, outcome, at: s.keys[keyId].at });
    }

    const bucketId = dag(atMs);
    const undo = { sequence: s.sequence, bucketId,
      bucketBestond: Object.prototype.hasOwnProperty.call(s.buckets, bucketId),
      bucket: s.buckets[bucketId], keyId,
      keyBestond: !!keyId && Object.prototype.hasOwnProperty.call(s.keys, keyId),
      key: keyId ? s.keys[keyId] : undefined, buckets: [], keys: [] };
    const bucket = s.buckets[bucketId] = undo.bucketBestond
      ? kopie(undo.bucket) : { firstAt: at, lastAt: at, capabilities: {} };
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
    const measurementId = 'measurement_' + hash({ capability, at, sequence: ++s.sequence, outcome }).slice(0, 24);
    if (keyId) s.keys[keyId] = { measurementId, at, semantics };
    ruim(s, atMs, undo);
    try { save(); } catch (error) { herstel(s, undo); throw error; }
    return bevries({ ok: true, replay: false, measurementId, capability, outcome, at,
      durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : null,
      measurementHash: hash({ measurementId, capability, outcome, at, durationMs: Number.isFinite(durationMs) ? durationMs : null }) });
  }

  function aggregate(capability, windowDays, nowValue) {
    const s = state();
    const nowMs = tijdMs(nowValue || nu()), grens = nowMs - (Number(windowDays) || 30) * DAG_MS;
    const uit = legeCapability();
    for (const [bucketId, bucket] of Object.entries(s.buckets)) {
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
    const s = state();
    const profile = sloProfiles.haal(profileId);
    const nowMs = tijdMs(nowValue || nu());
    return metricsSlo.bereken({ capability, profileId, profile, nowMs,
      startedAt: tijdMs(s.startedAt), aggregate, buckets: LATENCY_BUCKETS_MS, iso });
  }

  function timer(meta) {
    const basis = { ...(meta || {}) }, gestart = process.hrtime.bigint(); let klaar = null;
    return Object.freeze({
      finish(resultaat) {
        if (klaar) return klaar;
        const durationMs = Number(process.hrtime.bigint() - gestart) / 1e6;
        klaar = recordMeting({ ...basis, ...(resultaat || {}), durationMs });
        return klaar;
      }
    });
  }

  return Object.freeze({ record: recordMeting, timer, aggregate, stand,
    standAll: (contracts, nowValue) => (contracts || []).map(c => stand(c.id, c.slo.profile, nowValue)),
    snapshot: () => kopie(state()), buckets: LATENCY_BUCKETS_MS.slice(), outcomes: OUTCOMES.slice() });
}

module.exports = { maakMeter, OUTCOMES, LATENCY_BUCKETS_MS, RETENTION_DAYS };
