/* TrustEvidence-export; geen pruning/WORM-claim. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { canon, hash, kopie, bevries } = require('./canon');
const legacy = require('./legacy-v2-migration');
const capaciteit = require('./capacity-watermark');
const bestanden = require('./runtime-evidence-files');
const verifier = require('./runtime-evidence-verifier');
const { FORMAT, RECEIPT_FORMAT, fout, adres, eisKluis, leesArtefact,
  leesReceipt, receiptPastBij } = verifier;
const { veiligeMap, schrijfNoClobber } = bestanden;

function bron(source) {
  if (!source || !source.trustEvidence || typeof source.trustEvidence !== 'object' ||
      Array.isArray(source.trustEvidence))
    throw fout('EVIDENCE_EXPORT_SOURCE_INVALID', 'Een geldige read-only trust-evidencebron ontbreekt.');
  if (!/^(json|sqlite|postgres)$/.test(String(source.store || '')))
    throw fout('EVIDENCE_EXPORT_SOURCE_INVALID', 'De bronopslag is niet exporteerbaar.');
  const revision = source.sourceRevision;
  if (revision != null && !(Number.isSafeInteger(revision) && revision >= 0) &&
      !/^[a-f0-9]{64}$/.test(String(revision)))
    throw fout('EVIDENCE_EXPORT_SOURCE_INVALID', 'De bronrevisie heeft geen veilige vorm.');
  return { store: source.store, revision: revision == null ? null : revision };
}

function maakPlan(source, opties) {
  const o = opties || {}, sourceMeta = bron(source), root = source.trustEvidence;
  if (legacy.legacyEntries(root).length)
    throw fout('LEGACY_RAW_EVIDENCE_REQUIRES_MIGRATION',
      'Legacy raw evidence moet eerst met de expliciete V2-migratie worden gearchiveerd.');
  const capacity = capaciteit.meet(root, o.capacity), stateDigest = hash(root);
  const archiveId = adres(stateDigest, capacity.profile.digest, sourceMeta.store);
  const capturedAt = String(o.now || new Date().toISOString());
  if (!Number.isFinite(Date.parse(capturedAt)))
    throw fout('EVIDENCE_EXPORT_TIME_INVALID', 'Het exporttijdstip is ongeldig.');
  const document = bevries({ format: FORMAT, schemaVersion: 1, archiveId,
    capturedAt, source: sourceMeta,
    stateDigest, capacity, state: kopie(root) });
  return bevries({ archiveId, fileName: archiveId + '.rtge', receiptFile: archiveId + '.receipt.json',
    stateDigest, source: sourceMeta, capacity, document });
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

function archiveerRuntimeEvidence(opties) {
  const o = opties || {}, kluis = o.kluis, plan = o.plan || maakPlan(o.source, o);
  eisKluis(kluis);
  const map = veiligeMap(o.directory, o.dataDirectory);
  const bestand = path.join(map, plan.fileName), receiptPath = path.join(map, plan.receiptFile);
  if (!fs.existsSync(bestand)) {
    const cipher = kluis.versleutelBestand(Buffer.from(canon(plan.document), 'utf8'), plan.fileName);
    if (!Buffer.isBuffer(cipher) || !cipher.subarray(0, 7).equals(Buffer.from('RTGENC2')))
      throw fout('EVIDENCE_EXPORT_ENCRYPTION_FAILED', 'Evidence-export werd niet bestandsnaamgebonden versleuteld.');
    try { schrijfNoClobber(bestand, cipher, 0o600); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const verified = leesArtefact(bestand, plan.fileName, kluis, plan);
  let receipt;
  if (fs.existsSync(receiptPath)) receipt = leesReceipt(receiptPath, plan);
  else {
    const basis = receiptBasis(plan, verified);
    const kandidaat = bevries({ ...basis, receiptDigest: hash(basis) });
    try { schrijfNoClobber(receiptPath, Buffer.from(canon(kandidaat) + '\n', 'utf8'), 0o600); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    receipt = leesReceipt(receiptPath, plan);
  }
  receiptPastBij(receipt, plan, verified, receiptBasis);
  return bevries(kopie(receipt));
}

function verifieerRuntimeEvidence(opties) {
  return verifier.verifieerRuntimeEvidence(opties, receiptBasis);
}

module.exports = { FORMAT, RECEIPT_FORMAT, maakPlan, archiveer: archiveerRuntimeEvidence,
  verifieer: verifieerRuntimeEvidence, veiligeMap };
