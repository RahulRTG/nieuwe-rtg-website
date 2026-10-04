'use strict';

const { hash, bevries, kopie } = require('./canon');

const STANDEN = Object.freeze(['SAFE_AUTO', 'REVIEW', 'BLOCKED', 'UNKNOWN']);

function plan(invoer) {
  const i = invoer || {};
  if (!i.change || !i.from || !i.to || typeof i.classify !== 'function')
    throw new Error('bewijsvlak migratie: change, from, to en classify zijn verplicht');
  const entities = (i.entities || []).map(entity => {
    let uit;
    try { uit = i.classify(kopie(entity), { from: i.from, to: i.to, change: i.change }); }
    catch (e) { uit = { state: 'UNKNOWN', reasons: ['CLASSIFIER_ERROR'] }; }
    const state = uit && STANDEN.includes(uit.state) ? uit.state : 'UNKNOWN';
    return bevries({ ref: kopie(entity.ref || entity), state,
      reasons: (uit && uit.reasons) || (state === 'UNKNOWN' ? ['NO_CLASSIFICATION'] : []),
      inputHash: hash(entity), previewHash: !uit || uit.preview === undefined ? null : hash(uit.preview),
      evidenceRefs: (uit && uit.evidenceRefs) || [] });
  });
  const counts = Object.fromEntries(STANDEN.map(s => [s, entities.filter(e => e.state === s).length]));
  const besluit = counts.BLOCKED ? 'DENY' : (counts.UNKNOWN || counts.REVIEW ? 'REVIEW' : 'ALLOW');
  const kern = { format: 'rtg-migration-plan-v1', change: i.change, from: i.from, to: i.to,
    contractSetHash: i.contractSetHash || null, entities, counts, decision: besluit };
  return bevries({ ...kern, planHash: hash(kern) });
}

function verifyMigratie(p) {
  if (!p || p.format !== 'rtg-migration-plan-v1') return { ok: false, reason: 'FORMAT_UNKNOWN' };
  const kern = kopie(p), ontvangen = kern.planHash; delete kern.planHash;
  if (hash(kern) !== ontvangen) return { ok: false, reason: 'PLAN_HASH_MISMATCH' };
  if (p.entities.some(e => !STANDEN.includes(e.state))) return { ok: false, reason: 'STATE_UNKNOWN' };
  return { ok: true, executable: p.decision === 'ALLOW', planHash: ontvangen };
}

module.exports = { STANDEN, plan, verify: verifyMigratie };
