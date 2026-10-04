'use strict';

const { kopie, bevries } = require('./canon');
const retention = require('./v3-source-retention');

function actief(e, at) {
  const t = Date.parse(at), from = Date.parse(e.effectiveFrom), until = e.effectiveUntil && Date.parse(e.effectiveUntil);
  return from <= t && (!until || until > t);
}
function evidenceBevoegd(e, req, at, authorities) {
  const t = Date.parse(at), a = e.authority || {}, from = Date.parse(a.validFrom), until = a.validUntil && Date.parse(a.validUntil);
  return e.factType === req.factType && e.truthClass === req.truthClass &&
    Array.isArray(a.scopes) && a.scopes.includes(req.scope) && from <= t && (!until || until > t) &&
    !!authorities && authorities.verifyStored(e, req.authorityContract);
}
function waardeConflicten(evidence) {
  const perFact = new Map(), uit = [];
  for (const e of evidence) {
    const key = e.factType + '|' + e.subjectRef.domain + '|' + e.subjectRef.type + '|' + e.subjectRef.id;
    if (!perFact.has(key)) perFact.set(key, []);
    perFact.get(key).push(e);
  }
  for (const [key, lijst] of perFact) {
    const waarden = new Set(lijst.map(e => e.valueDigest));
    if (waarden.size > 1) uit.push({ key, evidenceRefs: lijst.map(e => e.evidenceId).sort(),
      valueDigests: [...waarden].sort() });
  }
  return uit;
}
function retentionVan(evidence, req, at) {
  const result = retention.inspect(evidence, req, at);
  return { evidence, result, debt: result.debt.map(item => ({ ...item,
    requirementId: req.id || req.factType, evidenceRef: evidence.evidenceId })) };
}
function retentionConflicten(items) {
  return items.flatMap(item => item.result.conflicts.map(conflict => ({
    key: 'source-retention|' + (item.requirementId || '') + '|' + item.evidence.evidenceId + '|' + conflict.role,
    evidenceRefs: [item.evidence.evidenceId],
    valueDigests: [conflict.expectedDigest, conflict.observedDigest].filter(Boolean).sort()
  })));
}
function beoordeel(req, evidence, at, authorities) {
  const fact = evidence.filter(e => e.factType === req.factType && e.truthClass === req.truthClass);
  const actueel = fact.filter(e => actief(e, at));
  const bevoegdActueel = actueel.filter(e => evidenceBevoegd(e, req, at, authorities));
  const vers = bevoegdActueel.filter(e => !req.maxAgeMs ||
    Date.parse(at) - Date.parse(e.observedAt) <= req.maxAgeMs);
  const inspected = vers.map(e => ({ requirementId: req.id || req.factType,
    ...retentionVan(e, req, at) }));
  return { fact, actueel, bevoegdActueel, inspected,
    accepted: inspected.filter(x => x.result.ok).map(x => x.evidence),
    mismatch: inspected.filter(x => x.result.conflicts.length),
    blocking: !!req.retention && req.retention.critical && vers.length > 0 &&
      inspected.filter(x => x.result.ok).length < (req.min || 1),
    unauthorized: actueel.filter(e => !evidenceBevoegd(e, req, at, authorities)).map(e => e.evidenceId),
    expired: fact.filter(e => !actief(e, at) || (req.maxAgeMs &&
      Date.parse(at) - Date.parse(e.observedAt) > req.maxAgeMs)).map(e => e.evidenceId) };
}

function evalueer(profile, evidence, at, authorities) {
  const geldig = evidence.filter(e => actief(e, at));
  const required = [], present = [], missing = [], unauthorized = [], expired = [], geaccepteerd = [];
  const retentionChecks = [], evidenceDebt = [], retentionMismatch = [];
  let criticalRetentionGap = false;
  for (const req of profile.requirements) {
    const check = beoordeel(req, evidence, at, authorities);
    const item = { requirementId: req.id, factType: req.factType, minimum: req.min,
      authorityContract: kopie(req.authorityContract), retention: kopie(req.retention) };
    required.push(item); retentionChecks.push(...check.inspected);
    evidenceDebt.push(...check.inspected.flatMap(x => x.debt));
    retentionMismatch.push(...check.mismatch); criticalRetentionGap ||= check.blocking;
    if (check.accepted.length >= req.min) present.push({ ...item,
      evidenceRefs: check.accepted.map(e => e.evidenceId).sort() });
    else missing.push(item);
    geaccepteerd.push(...check.accepted); unauthorized.push(...check.unauthorized); expired.push(...check.expired);
  }
  const correctionEvidence = [];
  let correctionRetentionGap = false;
  for (const correction of profile.corrections || []) {
    const candidates = geldig.filter(e => e.factType === correction.factType && e.truthClass === correction.truthClass);
    const auth = candidates.filter(e => evidenceBevoegd(e, correction, at, authorities));
    const checks = auth.map(e => ({ requirementId: correction.factType,
      ...retentionVan(e, correction, at) }));
    const accepted = checks.filter(x => x.result.ok).map(x => x.evidence);
    correctionEvidence.push(...accepted); geaccepteerd.push(...accepted); retentionChecks.push(...checks);
    evidenceDebt.push(...checks.flatMap(x => x.debt));
    retentionMismatch.push(...checks.filter(x => x.result.conflicts.length));
    correctionRetentionGap ||= !!correction.retention && correction.retention.critical && auth.length > 0 && !accepted.length;
    unauthorized.push(...candidates.filter(e => !evidenceBevoegd(e, correction, at, authorities)).map(e => e.evidenceId));
  }
  const uniek = [...new Map(geaccepteerd.map(e => [e.evidenceId, e])).values()];
  const conflict = waardeConflicten(uniek).concat(retentionConflicten(retentionMismatch));
  const classes = new Set(present.flatMap(p => p.evidenceRefs)
    .map(ref => geldig.find(e => e.evidenceId === ref)).filter(Boolean).map(e => e.truthClass));
  let finality = missing.length ? (present.length ? 'SOURCE_ATTESTED' : 'UNKNOWN') : profile.completeFinality;
  const correction = correctionEvidence[0];
  if (conflict.length) finality = 'DISPUTED';
  else if (correction && /reversed$/i.test(correction.factType)) finality = 'REVERSED';
  else if (correction && /cancelled$/i.test(correction.factType)) finality = 'CANCELLED';
  else if (correction) finality = 'DISPUTED';
  else if (criticalRetentionGap || correctionRetentionGap) finality = 'UNKNOWN';
  else if (!missing.length && finality !== 'RECONCILED' && classes.size > 1) finality = 'CROSS_VERIFIED';
  const retentionStatus = retentionChecks.map(x => ({ requirementId: x.requirementId,
    evidenceRef: x.evidence.evidenceId, statuses: x.result.statuses })).sort((a, b) =>
    (a.requirementId + a.evidenceRef).localeCompare(b.requirementId + b.evidenceRef));
  return bevries({ finality, required, present, missing,
    unauthorized: [...new Set(unauthorized)].sort(), expired: [...new Set(expired)].sort(),
    conflicting: conflict, correctionRefs: correctionEvidence.map(e => e.evidenceId).sort(),
    retention: retentionStatus, evidenceDebt,
    complete: missing.length === 0 && conflict.length === 0 && !criticalRetentionGap && !correctionRetentionGap });
}

module.exports = { evalueer };
