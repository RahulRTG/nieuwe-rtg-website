'use strict';

const { hash, id, kopie, bevries } = require('./canon');

const RANK = Object.freeze({ UNKNOWN: 0, UNVERIFIED: 1, SOURCE_ATTESTED: 2,
  CROSS_VERIFIED: 3, RECONCILED: 4 });

function actief(e, at) {
  const t = Date.parse(at), from = Date.parse(e.effectiveFrom), until = e.effectiveUntil && Date.parse(e.effectiveUntil);
  return from <= t && (!until || until > t);
}
function bevoegd(e, req, at) {
  const t = Date.parse(at), a = e.authority || {}, from = Date.parse(a.validFrom), until = a.validUntil && Date.parse(a.validUntil);
  return e.factType === req.factType && e.truthClass === req.truthClass &&
    Array.isArray(a.scopes) && a.scopes.includes(req.scope) && from <= t && (!until || until > t);
}
function conflicten(evidence) {
  const perFact = new Map(), uit = [];
  for (const e of evidence) {
    const key = e.factType + '|' + e.subjectRef.domain + '|' + e.subjectRef.type + '|' + e.subjectRef.id;
    if (!perFact.has(key)) perFact.set(key, []);
    perFact.get(key).push(e);
  }
  for (const [key, lijst] of perFact) {
    const waarden = new Set(lijst.map(e => e.valueDigest));
    if (waarden.size > 1) uit.push({ key, evidenceRefs: lijst.map(e => e.evidenceId).sort(), valueDigests: [...waarden].sort() });
  }
  return uit;
}

function evalueer(profile, evidence, at) {
  const geldig = evidence.filter(e => actief(e, at)), conflict = conflicten(geldig);
  const required = [], present = [], missing = [], unauthorized = [], expired = [];
  for (const req of profile.requirements) {
    const fact = evidence.filter(e => e.factType === req.factType && e.truthClass === req.truthClass);
    const actueel = fact.filter(e => actief(e, at));
    const auth = actueel.filter(e => bevoegd(e, req, at)).filter(e => !req.maxAgeMs ||
      Date.parse(at) - Date.parse(e.observedAt) <= req.maxAgeMs);
    const item = { requirementId: req.id, factType: req.factType, minimum: req.min };
    required.push(item);
    if (auth.length >= req.min) present.push({ ...item, evidenceRefs: auth.map(e => e.evidenceId).sort() });
    else missing.push(item);
    unauthorized.push(...actueel.filter(e => !bevoegd(e, req, at)).map(e => e.evidenceId));
    expired.push(...fact.filter(e => !actief(e, at) || (req.maxAgeMs && Date.parse(at) - Date.parse(e.observedAt) > req.maxAgeMs))
      .map(e => e.evidenceId));
  }
  const classes = new Set(present.flatMap(p => p.evidenceRefs).map(x => geldig.find(e => e.evidenceId === x)).filter(Boolean).map(e => e.truthClass));
  let finality = missing.length ? (present.length ? 'SOURCE_ATTESTED' : 'UNKNOWN') : profile.completeFinality;
  const correction = geldig.find(e => profile.correctionFacts.includes(e.factType));
  if (correction && /reversed$/i.test(correction.factType)) finality = 'REVERSED';
  else if (correction && /cancelled$/i.test(correction.factType)) finality = 'CANCELLED';
  else if (correction || conflict.length) finality = 'DISPUTED';
  else if (!missing.length && finality !== 'RECONCILED' && classes.size > 1) finality = 'CROSS_VERIFIED';
  return bevries({ finality, required, present, missing, unauthorized: [...new Set(unauthorized)].sort(),
    expired: [...new Set(expired)].sort(), conflicting: conflict,
    complete: missing.length === 0 && conflict.length === 0 });
}

function maakResolver(opties) {
  const o = opties || {}, store = o.store, profiles = o.profiles, nu = o.nu || (() => new Date().toISOString());
  if (!store || !profiles) throw new Error('bewijsvlak v3: resolver mist store of profiles');

  function derive(input) {
    const i = input || {}, profile = profiles.get(i.profileId, i.profileVersion);
    if (!profile) throw new Error('bewijsvlak v3: onbekend requirement-profiel');
    const at = String(i.effectiveAt || nu()), derivedAt = String(i.derivedAt || nu());
    const refs = [...new Set((i.evidenceRefs || []).map(String))].sort();
    const bewijs = refs.map(x => store.get('evidence', x));
    if (bewijs.some(x => !x)) throw new Error('bewijsvlak v3: claim verwijst naar onbekend bewijs');
    const subject = JSON.stringify(i.subjectRef || {});
    if (bewijs.some(e => JSON.stringify(e.subjectRef) !== subject)) throw new Error('bewijsvlak v3: bewijs hoort bij ander subject');
    const result = evalueer(profile, bewijs, at);
    const vorige = i.previousClaimId ? store.get('claims', i.previousClaimId) : null;
    if (i.previousClaimId && !vorige) throw new Error('bewijsvlak v3: eerdere claim ontbreekt');
    if (vorige && RANK[result.finality] < RANK[vorige.finality] &&
      !bewijs.some(e => profile.correctionFacts.includes(e.factType)))
      throw new Error('bewijsvlak v3: finality mag niet stil teruglopen');
    const basis = { schemaVersion: 3, claimType: profile.claimType, subjectRef: kopie(i.subjectRef),
      requirementProfile: { id: profile.id, version: profile.version, digest: profile.profileDigest },
      resolver: kopie(profile.resolver), evidenceRefs: refs, effectiveAt: at, derivedAt,
      finality: result.finality, completeness: result, previousClaimId: i.previousClaimId || null };
    basis.derivationDigest = hash(basis);
    basis.claimId = id('claim_v3', basis);
    const claim = store.put('claims', basis.claimId, bevries(basis));
    for (const c of result.conflicting) {
      const body = { schemaVersion: 3, subjectRef: kopie(i.subjectRef), claimId: claim.claimId,
        detectedAt: derivedAt, evidenceRefs: c.evidenceRefs, valueDigests: c.valueDigests };
      body.conflictId = id('conflict_v3', body); store.put('conflicts', body.conflictId, body);
    }
    return claim;
  }

  function reproduce(claimId) {
    const claim = store.get('claims', claimId);
    if (!claim) return { ok: false, code: 'CLAIM_NOT_FOUND' };
    const profile = profiles.get(claim.requirementProfile.id, claim.requirementProfile.version);
    if (!profile || profile.profileDigest !== claim.requirementProfile.digest)
      return { ok: false, code: 'PROFILE_MISMATCH' };
    if (profile.resolver.artifactDigest !== claim.resolver.artifactDigest)
      return { ok: false, code: 'RESOLVER_MISMATCH' };
    const evidence = claim.evidenceRefs.map(x => store.get('evidence', x));
    if (evidence.some(x => !x)) return { ok: false, code: 'EVIDENCE_MISSING' };
    const result = evalueer(profile, evidence, claim.effectiveAt);
    const basis = kopie(claim); delete basis.claimId; delete basis.derivationDigest;
    basis.finality = result.finality; basis.completeness = result;
    return { ok: hash(basis) === claim.derivationDigest, expectedDigest: claim.derivationDigest,
      actualDigest: hash(basis), finality: result.finality };
  }
  return Object.freeze({ derive, reproduce, evaluate: evalueer });
}

module.exports = { RANK, maakResolver, evalueer };
