'use strict';

const { hash, id, kopie, bevries } = require('./canon');
const { FINALITY_TRANSITIONS, overgangMag } = require('./v3-finality');
const { evalueer } = require('./v3-claim-evaluator');

function maakResolver(opties) {
  const o = opties || {}, store = o.store, profiles = o.profiles, authorities = o.authorities,
    nu = o.nu || (() => new Date().toISOString());
  if (!store || !profiles || !authorities) throw new Error('bewijsvlak v3: resolver mist store, profiles of authorities');

  const lijnKey = (subjectRef, profile) => hash({ subjectRef: subjectRef || {},
    requirementProfile: { id: profile.id, version: profile.version, digest: profile.profileDigest } });
  function head(subjectRef, profile) {
    const key = lijnKey(subjectRef, profile);
    const lijn = store.list('claims').filter(c => lijnKey(c.subjectRef, {
      id: c.requirementProfile.id, version: c.requirementProfile.version,
      profileDigest: c.requirementProfile.digest
    }) === key);
    if (!lijn.length) return null;
    const gebruikt = new Set(lijn.map(c => c.previousClaimId).filter(Boolean));
    const koppen = lijn.filter(c => !gebruikt.has(c.claimId));
    if (koppen.length !== 1) {
      const error = new Error('bewijsvlak v3: claimlijn heeft geen unieke actuele kop');
      error.code = 'CLAIM_LINEAGE_FORK';
      throw error;
    }
    return koppen[0];
  }

  function resolveClaim(input) {
    const i = input || {}, profile = profiles.get(i.profileId, i.profileVersion);
    if (!profile) throw new Error('bewijsvlak v3: onbekend requirement-profiel');
    const at = String(i.effectiveAt || nu()), derivedAt = String(i.derivedAt || nu());
    const refs = [...new Set((i.evidenceRefs || []).map(String))].sort();
    const bewijs = refs.map(x => store.get('evidence', x));
    if (bewijs.some(x => !x)) throw new Error('bewijsvlak v3: claim verwijst naar onbekend bewijs');
    const subject = JSON.stringify(i.subjectRef || {});
    if (bewijs.some(e => JSON.stringify(e.subjectRef) !== subject)) throw new Error('bewijsvlak v3: bewijs hoort bij ander subject');
    const result = evalueer(profile, bewijs, at, authorities);
    const actueel = head(i.subjectRef, profile);
    const vorige = i.previousClaimId ? store.get('claims', i.previousClaimId) : actueel;
    if (i.previousClaimId && !vorige) throw new Error('bewijsvlak v3: eerdere claim ontbreekt');
    if (vorige && (lijnKey(vorige.subjectRef, {
      id: vorige.requirementProfile.id, version: vorige.requirementProfile.version,
      profileDigest: vorige.requirementProfile.digest
    }) !== lijnKey(i.subjectRef, profile)))
      throw new Error('bewijsvlak v3: eerdere claim hoort bij ander subject of profiel');
    if (actueel && vorige && actueel.claimId !== vorige.claimId) {
      const error = new Error('bewijsvlak v3: eerdere claim is niet de actuele kop');
      error.code = 'CLAIM_STALE_REVISION';
      throw error;
    }
    if (!overgangMag(vorige && vorige.finality, result.finality, result)) {
      const error = new Error('bewijsvlak v3: finality-overgang ' + vorige.finality + ' -> ' + result.finality + ' is niet toegestaan');
      error.code = 'FINALITY_TRANSITION_DENIED';
      throw error;
    }
    const basis = { schemaVersion: 3, claimType: profile.claimType, subjectRef: kopie(i.subjectRef),
      requirementProfile: { id: profile.id, version: profile.version, digest: profile.profileDigest },
      resolver: kopie(profile.resolver), evidenceRefs: refs, effectiveAt: at, derivedAt,
      finality: result.finality, completeness: result, previousClaimId: vorige ? vorige.claimId : null };
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
    const result = evalueer(profile, evidence, claim.effectiveAt, authorities);
    const basis = kopie(claim); delete basis.claimId; delete basis.derivationDigest;
    basis.finality = result.finality; basis.completeness = result;
    return { ok: hash(basis) === claim.derivationDigest, expectedDigest: claim.derivationDigest,
      actualDigest: hash(basis), finality: result.finality };
  }
  return Object.freeze({ derive: resolveClaim, reproduce, current: (subjectRef, profileId, profileVersion) => {
    const profile = profiles.get(profileId, profileVersion);
    return profile ? head(subjectRef, profile) : null;
  }, evaluate: (profile, evidence, at) => evalueer(profile, evidence, at, authorities) });
}

module.exports = { FINALITY_TRANSITIONS, overgangMag, maakResolver, evalueer };
