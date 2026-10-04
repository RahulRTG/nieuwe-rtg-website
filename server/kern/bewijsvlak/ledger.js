/* Append-only bewijs. De ledger bewaart verklaringen en digests, geen kopie van
   de domeinpayload. Elke trust boundary heeft zijn eigen hashketen. */
'use strict';

const klok = require('../../lib/klok');
const { hash, id, kopie, bevries } = require('./canon');

// Grenzen, veilige verwijzingen en de metadatabinding: ./ledger-vorm.js.
const { DEFAULT_LIMITS, limiet, capaciteitFout, veiligeRef, evidenceRef, metadataBinding } = require('./ledger-vorm');

function maakLedger(opties) {
  const o = opties || {};
  const vasteRegels = o.regels || [], vasteBlobs = o.blobs || {};
  const regels = () => typeof o.regelsFor === 'function' ? o.regelsFor() : vasteRegels;
  const blobs = () => typeof o.blobsFor === 'function' ? o.blobsFor() : vasteBlobs;
  const limits = Object.freeze({ records: limiet(o.limits && o.limits.records, DEFAULT_LIMITS.records, 'records'),
    evidence: limiet(o.limits && o.limits.evidence, DEFAULT_LIMITS.evidence, 'evidence') });
  const nu = o.nu || (() => klok.datum().toISOString());
  const save = typeof o.save === 'function' ? o.save : () => {};
  const transaction = o.transaction || null;
  const heeftBlob = sleutel => blobs() instanceof Map
    ? blobs().has(sleutel) : Object.prototype.hasOwnProperty.call(blobs(), sleutel);
  const zetBlob = (sleutel, waarde) => blobs() instanceof Map
    ? blobs().set(sleutel, waarde) : (blobs()[sleutel] = waarde);
  const haalBlob = sleutel => blobs() instanceof Map ? blobs().get(sleutel) : blobs()[sleutel];
  const blobAantal = () => blobs() instanceof Map ? blobs().size : Object.keys(blobs()).length;

  if (regels().length > limits.records) throw capaciteitFout('records', limits.records);
  if (blobAantal() > limits.evidence) throw capaciteitFout('evidence', limits.evidence);
  for (const bestaand of (blobs() instanceof Map ? blobs().values() : Object.values(blobs()))) {
    if (bestaand && (Object.prototype.hasOwnProperty.call(bestaand, 'content') ||
      (bestaand.metadata && !bestaand.metadata.metadataDigest))) {
      const fout = new Error('bewijsvlak ledger: legacy raw evidence vereist expliciete offline archivering/migratie');
      fout.code = 'LEGACY_RAW_EVIDENCE_REQUIRES_MIGRATION';
      throw fout;
    }
  }

  function laatsteVoorBoundary(boundary) {
    if (transaction) {
      const gepland = transaction.pending(op => op.type === 'ledger-append' &&
        op.record.boundary === boundary);
      if (gepland.length) return gepland[gepland.length - 1].record;
    }
    const lijst = regels();
    for (let i = lijst.length - 1; i >= 0; i--) if (lijst[i].boundary === boundary) return lijst[i];
    return null;
  }

  function bewijs(inhoud, metadata) {
    if (transaction && transaction.active()) {
      const error = new Error('bewijsvlak ledger: V2-blobbewijs mag niet midden in een V3-transactie schrijven');
      error.code = 'MIXED_EVIDENCE_TRANSACTION';
      throw error;
    }
    const digest = hash(inhoud);
    const binding = metadataBinding(metadata);
    const evidenceId = 'evidence_' + hash({ contentDigest: digest, ...binding.idBinding });
    if (!heeftBlob(evidenceId)) {
      if (blobAantal() >= limits.evidence) throw capaciteitFout('evidence', limits.evidence);
      zetBlob(evidenceId, bevries({ schemaVersion: 2, evidenceId,
        digest, contentDigest: digest, metadata: binding.publiek }));
      save();
    }
    return bevries({ evidenceId, digest });
  }

  function generatie(invoer) {
    const g = { inputs: (invoer && invoer.inputs || []).slice().sort(),
      contracts: (invoer && invoer.contracts || []).slice().sort(),
      environment: (invoer && invoer.environment) || 'runtime', at: nu() };
    return bevries({ generationId: id('gen', g), ...g });
  }

  function append(invoer) {
    const i = kopie(invoer || {});
    if (!i.boundary || !/^[a-zA-Z0-9:._-]{1,180}$/.test(i.boundary))
      throw new Error('bewijsvlak ledger: boundary ontbreekt of is ongeldig');
    const pendingCount = transaction ? transaction.pending(op => op.type === 'ledger-append').length : 0;
    const lijst = regels();
    if (lijst.length + pendingCount >= limits.records) throw capaciteitFout('records', limits.records);
    const vorige = laatsteVoorBoundary(i.boundary);
    const body = {
      evidenceRecordId: i.evidenceRecordId || id('record', { boundary: i.boundary, at: nu(),
        n: lijst.length + pendingCount, claim: i.claimId }),
      boundary: i.boundary,
      at: i.at || nu(),
      chainId: i.chainId || null,
      stepId: i.stepId || null,
      claimId: i.claimId || null,
      generationId: i.generationId || null,
      kind: i.kind || 'observation',
      decision: i.decision || null,
      reasonCodes: Array.isArray(i.reasonCodes) ? i.reasonCodes.map(x => String(x).slice(0, 180)) : [],
      evidenceRefs: Array.isArray(i.evidenceRefs) ? i.evidenceRefs.map(evidenceRef) : [],
      contractRef: veiligeRef(i.contractRef),
      policyRef: veiligeRef(i.policyRef),
      inputHash: i.inputHash || null,
      previousHash: vorige ? vorige.hash : null
    };
    body.hash = hash(body);
    const vast = bevries(body);
    if (transaction && transaction.active()) {
      transaction.stage({ type: 'ledger-append', key: 'ledger:' + vast.evidenceRecordId,
        record: vast,
        validate() {
          if (lijst.length >= limits.records) throw capaciteitFout('records', limits.records);
        },
        apply() {
          const huidig = laatsteZonderTransactie(lijst, vast.boundary);
          if ((huidig ? huidig.hash : null) !== vast.previousHash)
            throw new Error('bewijsvlak ledger: gelijktijdige ketenwijziging');
          lijst.push(vast);
        },
        rollback() {
          const laatsteRegel = lijst[lijst.length - 1];
          if (laatsteRegel && laatsteRegel.hash === vast.hash) lijst.pop();
        }
      });
      return vast;
    }
    lijst.push(vast);
    try { save(); }
    catch (error) { if (lijst[lijst.length - 1] === vast) lijst.pop(); throw error; }
    return vast;
  }

  function laatsteZonderTransactie(lijst, boundary) {
    for (let i = lijst.length - 1; i >= 0; i--) if (lijst[i].boundary === boundary) return lijst[i];
    return null;
  }

  function verify(boundary) {
    const vorigePerBoundary = new Map(); let laatste = null, aantal = 0;
    for (const regel of regels()) {
      if (boundary && regel.boundary !== boundary) continue;
      const vorige = vorigePerBoundary.get(regel.boundary) || null;
      const body = kopie(regel), ontvangen = body.hash;
      delete body.hash;
      if (body.previousHash !== (vorige ? vorige.hash : null))
        return { ok: false, code: 'CHAIN_BREAK', at: regel.evidenceRecordId };
      if (hash(body) !== ontvangen) return { ok: false, code: 'HASH_MISMATCH', at: regel.evidenceRecordId };
      vorigePerBoundary.set(regel.boundary, regel); laatste = regel; aantal++;
    }
    return { ok: true, records: aantal, lastHash: boundary
      ? ((vorigePerBoundary.get(boundary) || {}).hash || null) : (laatste ? laatste.hash : null) };
  }

  function lijst(filter) {
    const f = filter || {};
    return regels().filter(r => (!f.boundary || r.boundary === f.boundary) &&
      (!f.chainId || r.chainId === f.chainId) && (!f.claimId || r.claimId === f.claimId))
      .slice(-(f.limit || 100)).map(kopie);
  }

  return Object.freeze({ bewijs, generatie, append, verify, lijst,
    capacity: () => bevries({ records: { used: regels().length, limit: limits.records },
      evidence: { used: blobAantal(), limit: limits.evidence } }),
    haalBewijs: evidenceId => heeftBlob(evidenceId) ? kopie(haalBlob(evidenceId)) : null });
}

module.exports = { DEFAULT_LIMITS, maakLedger };
