/* Formaat, content-adres en receipt van de TrustEvidence-export.

   Afgesplitst uit ./runtime-evidence-export.js, dat over de omvanggrens ging.
   Een receipt zegt uitsluitend wat er is geverifieerd: niets gesnoeid, geen
   capaciteit vrijgemaakt en geen WORM- of offsite-belofte. */
'use strict';

const fs = require('node:fs');
const rtgjson = require('../../lib/rtgjson');
const { canon, hash } = require('./canon');
const { veiligBestand } = require('./runtime-evidence-files');

const FORMAT = 'rtg-runtime-evidence-export-v1';
const RECEIPT_FORMAT = 'rtg-runtime-evidence-export-receipt-v1';
const ID_RE = /^runtime_evidence_[a-f0-9]{64}$/;

function fout(code, melding) { return Object.assign(new Error(melding), { code }); }

function adres(stateDigest, capacityProfileDigest, sourceStore) {
  const addressDigest = hash({ format: FORMAT, stateDigest, capacityProfileDigest, sourceStore });
  return 'runtime_evidence_' + addressDigest;
}

function receiptBasis(plan, verified) {
  return { format: RECEIPT_FORMAT, schemaVersion: 1, archiveId: plan.archiveId,
    archiveFile: plan.fileName, stateDigest: plan.stateDigest,
    archivePayloadDigest: verified.payloadDigest, archiveCipherDigest: verified.cipherDigest,
    exportedAt: verified.document.capturedAt, source: verified.document.source,
    capacity: verified.document.capacity, archiveVerified: true,
    productionMutated: false, pruned: false, capacityFreed: false,
    retention: { encrypted: true, authenticated: true, contentAddressed: true,
      worm: false, offsite: false, operatorManaged: true } };
}

function geldigeReceipt(receipt, plan) {
  if (!receipt || receipt.format !== RECEIPT_FORMAT || receipt.schemaVersion !== 1 ||
      !/^[a-f0-9]{64}$/.test(String(receipt.receiptDigest || '')) ||
      !/^[a-f0-9]{64}$/.test(String(receipt.stateDigest || '')) || !receipt.capacity ||
      !receipt.capacity.profile || !/^[a-f0-9]{64}$/.test(String(receipt.capacity.profile.digest || '')) ||
      !receipt.source || !/^(json|sqlite|postgres)$/.test(String(receipt.source.store || ''))) return false;
  const basis = { ...receipt }; delete basis.receiptDigest;
  if (hash(basis) !== receipt.receiptDigest || !ID_RE.test(String(receipt.archiveId || '')) ||
      receipt.archiveFile !== receipt.archiveId + '.rtge' ||
      receipt.archiveId !== adres(receipt.stateDigest,
        receipt.capacity && receipt.capacity.profile && receipt.capacity.profile.digest,
        receipt.source && receipt.source.store)) return false;
  return (!plan || (receipt.archiveId === plan.archiveId &&
    receipt.archiveFile === plan.fileName && receipt.stateDigest === plan.stateDigest)) &&
    receipt.archiveVerified === true && receipt.productionMutated === false && receipt.pruned === false &&
    receipt.capacityFreed === false && receipt.retention && receipt.retention.worm === false &&
    receipt.retention.offsite === false;
}

function leesReceipt(bestand, plan) {
  veiligBestand(bestand, 'Evidence-exportreceipt');
  let receipt;
  try { receipt = rtgjson.parse(fs.readFileSync(bestand, 'utf8'), { maxDiepte: 64 }); }
  catch (error) { throw fout('EVIDENCE_EXPORT_RECEIPT_INVALID', 'Evidence-exportreceipt is onleesbaar.'); }
  if (!geldigeReceipt(receipt, plan))
    throw fout('EVIDENCE_EXPORT_RECEIPT_INVALID', 'Evidence-exportreceipt verifieert niet.');
  return receipt;
}

function receiptPastBij(receipt, plan, verified) {
  const basis = { ...receipt }; delete basis.receiptDigest;
  const verwacht = receiptBasis(plan, verified);
  if (canon(basis) !== canon(verwacht) || receipt.receiptDigest !== hash(verwacht))
    throw fout('EVIDENCE_EXPORT_RECEIPT_INVALID',
      'Receipt en geauthenticeerd evidence-artefact verschillen.');
}

module.exports = { FORMAT, RECEIPT_FORMAT, ID_RE, fout, adres, receiptBasis, geldigeReceipt, leesReceipt,
  receiptPastBij };
