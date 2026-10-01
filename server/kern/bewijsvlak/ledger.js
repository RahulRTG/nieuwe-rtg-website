/* Append-only bewijs. De ledger bewaart verklaringen en digests, geen kopie van
   de domeinpayload. Elke trust boundary heeft zijn eigen hashketen. */
'use strict';

const klok = require('../../lib/klok');
const { hash, id, kopie, bevries } = require('./canon');

function maakLedger(opties) {
  const o = opties || {};
  const regels = o.regels || [];
  const blobs = o.blobs || {};
  const nu = o.nu || (() => klok.datum().toISOString());
  const save = typeof o.save === 'function' ? o.save : () => {};
  const heeftBlob = sleutel => blobs instanceof Map
    ? blobs.has(sleutel) : Object.prototype.hasOwnProperty.call(blobs, sleutel);
  const zetBlob = (sleutel, waarde) => blobs instanceof Map
    ? blobs.set(sleutel, waarde) : (blobs[sleutel] = waarde);
  const haalBlob = sleutel => blobs instanceof Map ? blobs.get(sleutel) : blobs[sleutel];

  function laatste(boundary) {
    for (let i = regels.length - 1; i >= 0; i--) if (regels[i].boundary === boundary) return regels[i];
    return null;
  }

  function bewijs(inhoud, metadata) {
    const digest = hash(inhoud);
    const evidenceId = 'evidence_' + digest;
    if (!heeftBlob(evidenceId)) {
      zetBlob(evidenceId, bevries({ evidenceId, digest,
        metadata: kopie(metadata || {}), content: kopie(inhoud) }));
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
    const vorige = laatste(i.boundary);
    const body = {
      evidenceRecordId: i.evidenceRecordId || id('record', { boundary: i.boundary, at: nu(), n: regels.length, claim: i.claimId }),
      boundary: i.boundary,
      at: i.at || nu(),
      chainId: i.chainId || null,
      stepId: i.stepId || null,
      claimId: i.claimId || null,
      generationId: i.generationId || null,
      kind: i.kind || 'observation',
      decision: i.decision || null,
      reasonCodes: Array.isArray(i.reasonCodes) ? i.reasonCodes.slice() : [],
      evidenceRefs: Array.isArray(i.evidenceRefs) ? i.evidenceRefs.slice() : [],
      contractRef: i.contractRef || null,
      policyRef: i.policyRef || null,
      inputHash: i.inputHash || null,
      previousHash: vorige ? vorige.hash : null
    };
    body.hash = hash(body);
    const vast = bevries(body);
    regels.push(vast);
    save();
    return vast;
  }

  function verify(boundary) {
    const vorigePerBoundary = new Map(); let laatste = null, aantal = 0;
    for (const regel of regels) {
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
    return regels.filter(r => (!f.boundary || r.boundary === f.boundary) &&
      (!f.chainId || r.chainId === f.chainId) && (!f.claimId || r.claimId === f.claimId))
      .slice(-(f.limit || 100)).map(kopie);
  }

  return Object.freeze({ bewijs, generatie, append, verify, lijst,
    haalBewijs: evidenceId => heeftBlob(evidenceId) ? kopie(haalBlob(evidenceId)) : null });
}

module.exports = { maakLedger };
