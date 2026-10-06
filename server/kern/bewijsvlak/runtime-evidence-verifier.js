'use strict';

const fs = require('node:fs');
const rtgjson = require('../../lib/rtgjson');
const { canon, hash, kopie, bevries } = require('./canon');
const capaciteit = require('./capacity-watermark');
const { sha256, veiligeMap, veiligBestand } = require('./runtime-evidence-files');

const FORMAT = 'rtg-runtime-evidence-export-v1';
const RECEIPT_FORMAT = 'rtg-runtime-evidence-export-receipt-v1';
const ID_RE = /^runtime_evidence_[a-f0-9]{64}$/;
function fout(code, melding) { return Object.assign(new Error(melding), { code }); }

function adres(stateDigest, capacityProfileDigest, sourceStore) {
  const addressDigest = hash({ format: FORMAT, stateDigest, capacityProfileDigest, sourceStore });
  return 'runtime_evidence_' + addressDigest;
}

function hermeet(document) {
  const c = document && document.capacity, p = c && c.profile, x = c && c.collections;
  if (!p || !x) return null;
  return capaciteit.meet(document.state, { warningBps: p.warningBps, criticalBps: p.criticalBps,
    limits: { v2: { records: x['v2.records'] && x['v2.records'].limit,
      evidence: x['v2.evidence'] && x['v2.evidence'].limit },
    v3: { evidence: x['v3.evidence'] && x['v3.evidence'].limit,
      claims: x['v3.claims'] && x['v3.claims'].limit,
      decisions: x['v3.decisions'] && x['v3.decisions'].limit,
      conflicts: x['v3.conflicts'] && x['v3.conflicts'].limit,
      reconciliations: x['v3.reconciliations'] && x['v3.reconciliations'].limit } } });
}

function eisKluis(kluis) {
  if (!kluis || kluis.AAN !== true || typeof kluis.versleutelBestand !== 'function' ||
      typeof kluis.ontsleutelBestand !== 'function')
    throw fout('EVIDENCE_EXPORT_KEY_REQUIRED', 'Een actieve RTG_ENC_KEY is verplicht voor de export.');
}

function leesArtefact(bestand, fileName, kluis, verwacht) {
  veiligBestand(bestand, 'Evidence-export');
  const cipher = fs.readFileSync(bestand); let document;
  try { document = rtgjson.parse(kluis.ontsleutelBestand(cipher, fileName).toString('utf8'), { maxDiepte: 512 }); }
  catch (error) { throw fout('EVIDENCE_EXPORT_VERIFY_FAILED', 'Evidence-export kon niet geauthenticeerd worden.'); }
  let recalculatedCapacity = null;
  try { recalculatedCapacity = document && document.state ? hermeet(document) : null; }
  catch (error) { throw fout('EVIDENCE_EXPORT_VERIFY_FAILED', 'Evidence-export bevat ongeldige capaciteit.'); }
  if (!document || !document.capacity || !document.capacity.profile || !document.source ||
      document.format !== FORMAT || !ID_RE.test(String(document.archiveId || '')) ||
      document.archiveId !== verwacht.archiveId || document.stateDigest !== verwacht.stateDigest ||
      hash(document.state) !== document.stateDigest || hash(document.capacity) !== hash(recalculatedCapacity) ||
      document.capacity.profile.digest !== verwacht.capacity.profile.digest ||
      document.source.store !== verwacht.source.store ||
      document.archiveId !== adres(document.stateDigest, document.capacity.profile.digest, document.source.store))
    throw fout('EVIDENCE_EXPORT_VERIFY_FAILED', 'Evidence-export komt niet overeen met de content-addressed bron.');
  return { document, payloadDigest: hash(document), cipherDigest: sha256(cipher) };
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
      receipt.archiveId !== adres(receipt.stateDigest, receipt.capacity.profile.digest, receipt.source.store)) return false;
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

function receiptPastBij(receipt, plan, verified, receiptBasis) {
  const basis = { ...receipt }; delete basis.receiptDigest;
  const verwacht = receiptBasis(plan, verified);
  if (canon(basis) !== canon(verwacht) || receipt.receiptDigest !== hash(verwacht))
    throw fout('EVIDENCE_EXPORT_RECEIPT_INVALID', 'Receipt en geauthenticeerd evidence-artefact verschillen.');
}

function verifieerRuntimeEvidence(opties, receiptBasis) {
  const o = opties || {}, kluis = o.kluis, archiveId = String(o.archiveId || '');
  eisKluis(kluis);
  if (!ID_RE.test(archiveId)) throw fout('EVIDENCE_EXPORT_ID_INVALID', 'Evidence-export-id is ongeldig.');
  const map = veiligeMap(o.directory, o.dataDirectory), plan = {
    archiveId, fileName: archiveId + '.rtge', receiptFile: archiveId + '.receipt.json' };
  const receipt = leesReceipt(require('node:path').join(map, plan.receiptFile));
  plan.stateDigest = receipt.stateDigest; plan.source = receipt.source; plan.capacity = receipt.capacity;
  if (!geldigeReceipt(receipt, plan))
    throw fout('EVIDENCE_EXPORT_RECEIPT_INVALID', 'Evidence-exportreceipt hoort niet bij de gevraagde export.');
  const verified = leesArtefact(require('node:path').join(map, plan.fileName), plan.fileName, kluis, plan);
  receiptPastBij(receipt, plan, verified, receiptBasis);
  return bevries(kopie(receipt));
}

module.exports = { FORMAT, RECEIPT_FORMAT, ID_RE, fout, adres, eisKluis,
  leesArtefact, geldigeReceipt, leesReceipt, receiptPastBij,
  verifieerRuntimeEvidence };
