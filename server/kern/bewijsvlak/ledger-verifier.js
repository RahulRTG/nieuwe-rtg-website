'use strict';

const { hash, kopie } = require('./canon');

function verifieerLedger(regels, boundary) {
  const vorigePerBoundary = new Map(); let laatste = null, aantal = 0;
  for (const regel of regels) {
    if (boundary && regel.boundary !== boundary) continue;
    const vorige = vorigePerBoundary.get(regel.boundary) || null;
    const body = kopie(regel), ontvangen = body.hash;
    delete body.hash;
    if (body.previousHash !== (vorige ? vorige.hash : null))
      return { ok: false, code: 'CHAIN_BREAK', at: regel.evidenceRecordId };
    if (hash(body) !== ontvangen)
      return { ok: false, code: 'HASH_MISMATCH', at: regel.evidenceRecordId };
    vorigePerBoundary.set(regel.boundary, regel); laatste = regel; aantal++;
  }
  return { ok: true, records: aantal, lastHash: boundary
    ? ((vorigePerBoundary.get(boundary) || {}).hash || null) : (laatste ? laatste.hash : null) };
}

module.exports = { verifieerLedger };
