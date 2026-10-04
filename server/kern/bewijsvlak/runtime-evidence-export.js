/* TrustEvidence-export; geen pruning/WORM-claim. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const rtgjson = require('../../lib/rtgjson');
const { canon, hash, kopie, bevries } = require('./canon');
const legacy = require('./legacy-v2-migration');
const capaciteit = require('./capacity-watermark');
const bestanden = require('./runtime-evidence-files');

// Formaat, adres en receipt: ./runtime-evidence-receipt.js.
const { FORMAT, RECEIPT_FORMAT, ID_RE, fout, adres, receiptBasis, geldigeReceipt, leesReceipt,
  receiptPastBij } = require('./runtime-evidence-receipt');
const { sha256, veiligeMap, veiligBestand, schrijfNoClobber } = bestanden;

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

function eisKluis(kluis) {
  if (!kluis || kluis.AAN !== true || typeof kluis.versleutelBestand !== 'function' ||
      typeof kluis.ontsleutelBestand !== 'function')
    throw fout('EVIDENCE_EXPORT_KEY_REQUIRED', 'Een actieve RTG_ENC_KEY is verplicht voor de export.');
}

function archiveer(opties) {
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
  receiptPastBij(receipt, plan, verified);
  return bevries(kopie(receipt));
}

function verifieerExport(opties) {
  const o = opties || {}, kluis = o.kluis, archiveId = String(o.archiveId || '');
  eisKluis(kluis);
  if (!ID_RE.test(archiveId)) throw fout('EVIDENCE_EXPORT_ID_INVALID', 'Evidence-export-id is ongeldig.');
  const map = veiligeMap(o.directory, o.dataDirectory), plan = {
    archiveId, fileName: archiveId + '.rtge', receiptFile: archiveId + '.receipt.json' };
  const receipt = leesReceipt(path.join(map, plan.receiptFile));
  plan.stateDigest = receipt.stateDigest;
  plan.source = receipt.source; plan.capacity = receipt.capacity;
  if (!geldigeReceipt(receipt, plan))
    throw fout('EVIDENCE_EXPORT_RECEIPT_INVALID', 'Evidence-exportreceipt hoort niet bij de gevraagde export.');
  const verified = leesArtefact(path.join(map, plan.fileName), plan.fileName, kluis, plan);
  receiptPastBij(receipt, plan, verified);
  return bevries(kopie(receipt));
}

module.exports = { FORMAT, RECEIPT_FORMAT, maakPlan, archiveer, verifieer: verifieerExport, veiligeMap };
