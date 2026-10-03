/* Capaciteitswaarschuwing voor het Trust & Evidence Plane.

   De harde stops blijven eigendom van ledger.js en v3-store.js. Dit bestand
   verandert geen state en doet ook niet alsof een export capaciteit vrijmaakt.
   Het maakt alleen ruim VOOR de stop machineleesbaar hoeveel ruimte resteert
   en welke evidence debt een operator moet oplossen. */
'use strict';

const { hash, bevries } = require('./canon');
const { DEFAULT_LIMITS: V2_LIMITS } = require('./ledger');
const { DEFAULT_LIMITS: V3_LIMITS, COLLECTIONS: V3_COLLECTIONS } = require('./v3-store');

const PROFILE = Object.freeze({ id: 'trust-evidence-capacity-watermarks', version: 1,
  warningBps: 8000, criticalBps: 9500 });
const VOLGORDE = Object.freeze({ OK: 0, WARNING: 1, CRITICAL: 2, BLOCKED: 3 });

function fout(code, melding) { return Object.assign(new Error(melding), { code }); }

function aantal(waarde, naam, lijst) {
  if (lijst) {
    if (waarde == null) return 0;
    if (!Array.isArray(waarde))
      throw fout('EVIDENCE_CAPACITY_STATE_INVALID', naam + ' heeft geen lijstvorm.');
    return waarde.length;
  }
  if (waarde == null) return 0;
  if (!waarde || typeof waarde !== 'object' || Array.isArray(waarde))
    throw fout('EVIDENCE_CAPACITY_STATE_INVALID', naam + ' heeft geen collectievorm.');
  return Object.keys(waarde).length;
}

function limiet(waarde, naam) {
  const n = Number(waarde);
  if (!Number.isSafeInteger(n) || n < 1)
    throw fout('EVIDENCE_CAPACITY_PROFILE_INVALID', 'Ongeldige capaciteitslimiet voor ' + naam + '.');
  return n;
}

function status(used, limit, profiel) {
  const bps = Math.floor((used * 10000) / limit);
  if (used >= limit) return { status: 'BLOCKED', utilizationBps: bps };
  if (bps >= profiel.criticalBps) return { status: 'CRITICAL', utilizationBps: bps };
  if (bps >= profiel.warningBps) return { status: 'WARNING', utilizationBps: bps };
  return { status: 'OK', utilizationBps: bps };
}

function meet(root, opties) {
  const r = root == null ? {} : root, o = opties || {};
  if (!r || typeof r !== 'object' || Array.isArray(r))
    throw fout('EVIDENCE_CAPACITY_STATE_INVALID', 'Trust-evidence heeft geen geldige hoofdvorm.');
  const profiel = Object.freeze({ ...PROFILE,
    warningBps: Number(o.warningBps == null ? PROFILE.warningBps : o.warningBps),
    criticalBps: Number(o.criticalBps == null ? PROFILE.criticalBps : o.criticalBps) });
  if (!Number.isSafeInteger(profiel.warningBps) || !Number.isSafeInteger(profiel.criticalBps) ||
      profiel.warningBps < 1 || profiel.criticalBps <= profiel.warningBps || profiel.criticalBps > 10000)
    throw fout('EVIDENCE_CAPACITY_PROFILE_INVALID', 'Ongeldige watermerkgrenzen.');

  const v2Limits = { ...V2_LIMITS, ...((o.limits && o.limits.v2) || {}) };
  const v3Limits = { ...V3_LIMITS, ...((o.limits && o.limits.v3) || {}) };
  const v3 = r.v3 == null ? {} : r.v3;
  if (!v3 || typeof v3 !== 'object' || Array.isArray(v3))
    throw fout('EVIDENCE_CAPACITY_STATE_INVALID', 'Trust-evidence V3 heeft geen geldige hoofdvorm.');
  const invoer = [
    ['v2.records', aantal(r.ledger, 'v2.records', true), limiet(v2Limits.records, 'v2.records')],
    ['v2.evidence', aantal(r.blobs, 'v2.evidence', false), limiet(v2Limits.evidence, 'v2.evidence')]
  ];
  for (const naam of V3_COLLECTIONS) invoer.push(['v3.' + naam,
    aantal(v3[naam], 'v3.' + naam, false), limiet(v3Limits[naam], 'v3.' + naam)]);

  const collections = {}, debt = [];
  let highestStatus = 'OK';
  for (const [naam, used, limit] of invoer) {
    const oordeel = status(used, limit, profiel), item = Object.freeze({ used, limit,
      remaining: Math.max(0, limit - used), utilizationBps: oordeel.utilizationBps,
      status: oordeel.status });
    collections[naam] = item;
    if (VOLGORDE[oordeel.status] > VOLGORDE[highestStatus]) highestStatus = oordeel.status;
    if (oordeel.status !== 'OK') debt.push(Object.freeze({
      type: 'EVIDENCE_RETENTION_CAPACITY_DEBT',
      code: oordeel.status === 'BLOCKED' ? 'EVIDENCE_CAPACITY_REACHED'
        : 'EVIDENCE_CAPACITY_' + oordeel.status,
      collection: naam, status: oordeel.status, used, limit,
      remaining: item.remaining, resolvedByExport: false,
      requiredAction: 'EXPORT_VERIFY_AND_PLAN_RETENTION'
    }));
  }
  const profile = Object.freeze({ ...profiel, digest: hash(profiel) });
  return bevries({ schemaVersion: 1, profile, highestStatus,
    exportRecommended: highestStatus !== 'OK', capacityFreedByExport: false,
    collections, evidenceDebt: debt });
}

module.exports = { PROFILE, meet };
