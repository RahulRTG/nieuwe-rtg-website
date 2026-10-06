'use strict';

function weigerLegacyLedgerinhoud(blobs) {
  const waarden = blobs instanceof Map ? blobs.values() : Object.values(blobs);
  for (const bestaand of waarden) {
    if (!bestaand || (!Object.prototype.hasOwnProperty.call(bestaand, 'content') &&
      (!bestaand.metadata || bestaand.metadata.metadataDigest))) continue;
    const fout = new Error('bewijsvlak ledger: legacy raw evidence vereist expliciete offline archivering/migratie');
    fout.code = 'LEGACY_RAW_EVIDENCE_REQUIRES_MIGRATION';
    throw fout;
  }
}

module.exports = { weigerLegacyLedgerinhoud };
