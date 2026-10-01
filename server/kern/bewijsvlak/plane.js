/* RTG Trust & Evidence Plane. Eén control protocol, geen nieuwe domeineigenaar.
   In shadow mode worden verschillen bewezen maar verandert geen productbesluit. */
'use strict';

const context = require('./context');
const { maakLedger } = require('./ledger');
const { maakClaims } = require('./claims');
const { maakRegister } = require('./capabilities');
const { maakTransport } = require('./transport');
const retry = require('./retry');
const migration = require('./migration');
const compatibility = require('./compatibility');
const { maakGraaf } = require('./provenance');
const { maakMeter } = require('./metrics');
const constitution = require('./constitution');
const contracts = require('./contracts');
const { maakV3 } = require('./v3-plane');
const { hash, kopie, bevries } = require('./canon');

function maakPlane(opties) {
  const o = opties || {}, state = o.state || {};
  state.ledger = state.ledger || [];
  state.blobs = state.blobs || {};
  state.outbox = state.outbox || [];
  state.inbox = state.inbox || [];
  state.metrics = state.metrics || {};
  state.v3 = state.v3 || {};
  const ledger = maakLedger({ regels: state.ledger, blobs: o.blobs || state.blobs, save: o.save, nu: o.nu });
  const claims = maakClaims({ ledger, issuer: o.issuer || 'rtg:platform' });
  const registry = maakRegister(o.contracts || contracts);
  const metrics = maakMeter({ state: state.metrics, save: o.save, nu: o.nu,
    capabilityExists: id => !!registry.haal(id) });
  const transport = maakTransport({ outbox: state.outbox, inbox: state.inbox, save: o.save, nu: o.nu });
  const provenance = maakGraaf(state.provenance || {});
  const mode = o.mode || 'shadow';
  const v3 = maakV3({ state: state.v3, save: o.save, nu: o.nu, ledger, mode,
    profiles: o.requirementProfiles });

  function observe(invoer) {
    const i = invoer || {}, ctx = i.context || context.huidige() || context.maak({ phase: i.phase });
    const c = registry.haal(i.capability);
    if (!c) return { ok: false, shadow: mode === 'shadow', code: 'CAPABILITY_UNKNOWN' };
    const evidence = ledger.bewijs(i.evidence || { observed: true }, {
      kind: i.evidenceKind || 'domain-observation', classification: c.privacy.classification,
      domainRef: kopie(i.subjectRef)
    });
    const generation = ledger.generatie({ inputs: [evidence.digest], contracts: [c.id + '@' + c.version], environment: i.environment || 'runtime' });
    const made = claims.maak({ boundary: i.boundary || 'platform', context: ctx,
      issuer: i.issuer || 'rtg:' + c.owner, predicate: i.predicate || c.id,
      subjectRef: i.subjectRef, phase: c.phase, state: i.state || 'PROVEN',
      scope: i.scope || c.privacy.purpose, value: i.value,
      contract: { id: c.id, version: c.version },
      policy: i.policy || { id: c.policy.id, version: c.policy.version, decision: 'SHADOW' },
      evidenceRefs: [evidence], generationId: generation.generationId,
      reasonCodes: i.reasonCodes || [] });
    return { ok: true, shadow: mode === 'shadow', claim: made.claim, evidence: made.record, generation };
  }

  function compare(invoer) {
    const i = invoer || {}, zelfde = i.currentDecision === i.shadowDecision;
    const observed = observe({ capability: i.capability, subjectRef: i.subjectRef,
      predicate: 'shadow.decision.compare', value: { same: zelfde },
      evidence: { currentDecision: i.currentDecision, shadowDecision: i.shadowDecision },
      policy: i.policy, state: zelfde ? 'PROVEN' : 'REJECTED', reasonCodes: zelfde ? [] : ['SHADOW_DIVERGENCE'] });
    return { ...observed, same: zelfde, enforced: mode === 'enforce' };
  }

  function measure(invoer) {
    const i = invoer || {}, ctx = i.context || context.huidige() || context.maak({ phase: i.phase });
    const receipt = metrics.record(i);
    if (!receipt.replay) ledger.append({ boundary: i.boundary || 'platform:capability-metrics',
      chainId: ctx.chainId, stepId: ctx.stepId, kind: 'capability.measurement',
      decision: receipt.outcome, reasonCodes: i.errorClass ? [String(i.errorClass).slice(0, 80)] : [],
      inputHash: receipt.measurementHash,
      contractRef: { id: receipt.capability, version: (registry.haal(receipt.capability) || {}).version || 1 } });
    return receipt;
  }

  function timer(meta) {
    const gestart = process.hrtime.bigint(); let klaar = null;
    return Object.freeze({ finish(resultaat) {
      if (klaar) return klaar;
      klaar = measure({ ...(meta || {}), ...(resultaat || {}),
        durationMs: Number(process.hrtime.bigint() - gestart) / 1e6 });
      return klaar;
    } });
  }

  function slo(capability, nowValue) {
    const c = registry.haal(capability);
    return c ? metrics.stand(c.id, c.slo.profile, nowValue)
      : { capability, oordeel: 'onvoldoende gemeten', reasons: ['CAPABILITY_UNKNOWN'] };
  }

  function why(vraag) {
    const v = { ...(vraag || {}) };
    if (!v.slo && v.id) v.slo = slo(v.id);
    const r = registry.resolve(v);
    return bevries({ capability: r.id, version: r.version || null, decision: r.decision,
      state: r.state, reasons: r.reasons, fallback: r.fallback || null,
      contractHash: r.version ? hash(registry.haal(r.id, r.version)) : null });
  }

  return Object.freeze({ version: 3, mode, context, ledger, claims, registry, transport, provenance, metrics, v3,
    retry, migration, compatibility, constitution, observe, compare, measure, timer, slo, why,
    snapshot: () => ({ version: 3, mode, contracts: registry.publiek(),
      ledgerRecords: state.ledger.length, transport: transport.stand(),
      capabilitySlo: metrics.standAll(registry.publiek()), trust: v3.snapshot() }) });
}

module.exports = { maakPlane };
