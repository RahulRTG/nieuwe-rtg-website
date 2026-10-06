/* Expliciete migratie van het oude V2-bewijsformaat.

   De runtime doet dit met opzet NIET automatisch. Oude records bevatten de
   volledige domeinpayload; die moet eerst aantoonbaar buiten de primaire
   datastore zijn gearchiveerd. Dit bestand is puur: het maakt een plan en
   past dat via de transactionele collectiepoort toe. De CLI verzorgt het
   versleutelde archief vóór deze mutatie. */
'use strict';

const { hash, kopie, bevries } = require('./canon');

const MIGRATION_ID = 'trust-evidence-v2-raw-to-digest-v1';
const ID_RE = /^[a-zA-Z0-9:._-]{1,220}$/;
const DIGEST_RE = /^[a-f0-9]{64}$/;

function fout(code, melding) {
  return Object.assign(new Error(melding), { code });
}

function eigen(object, sleutel) {
  return !!object && Object.prototype.hasOwnProperty.call(object, sleutel);
}

function veiligeTekst(waarde, maximum) {
  if (waarde == null) return null;
  const tekst = String(waarde);
  return /^[a-zA-Z0-9:._-]+$/.test(tekst) && tekst.length <= (maximum || 180) ? tekst : null;
}

function veiligeRef(waarde) {
  if (!waarde) return null;
  if (typeof waarde === 'string') return veiligeTekst(waarde);
  if (typeof waarde !== 'object' || Array.isArray(waarde)) return null;
  const uit = {}, refId = veiligeTekst(waarde.id);
  if (refId) uit.id = refId;
  if (Number.isSafeInteger(Number(waarde.version)) && Number(waarde.version) > 0)
    uit.version = Number(waarde.version);
  if (DIGEST_RE.test(String(waarde.digest || ''))) uit.digest = String(waarde.digest);
  return Object.keys(uit).length ? uit : null;
}

function projecteerMetadata(metadata) {
  const m = metadata == null ? {} : kopie(metadata);
  if (!m || typeof m !== 'object' || Array.isArray(m))
    throw fout('LEGACY_METADATA_INVALID', 'Legacy evidence bevat ongeldige metadata.');
  const subject = m.subjectRef || m.domainRef || null;
  const capabilityRef = veiligeRef(m.capabilityRef || m.capability);
  const publiek = {
    kind: veiligeTekst(m.kind),
    classification: veiligeTekst(m.classification),
    purpose: veiligeTekst(m.purpose),
    capabilityRef,
    subjectRefDigest: hash(subject),
    authorityRefDigest: hash(m.authorityRef || m.authority || null),
    metadataDigest: hash(m)
  };
  return Object.fromEntries(Object.entries(publiek).filter(([, waarde]) => waarde != null));
}

function isLegacy(blob) {
  return !!blob && typeof blob === 'object' && !Array.isArray(blob) &&
    (eigen(blob, 'content') || (!!blob.metadata && !blob.metadata.metadataDigest));
}

function blobsVan(root) {
  if (!root || typeof root !== 'object' || Array.isArray(root))
    throw fout('LEGACY_ROOT_INVALID', 'Trust-evidence heeft een ongeldige hoofdvorm.');
  if (root.blobs == null) return {};
  if (!root.blobs || typeof root.blobs !== 'object' || Array.isArray(root.blobs))
    throw fout('LEGACY_BLOBS_INVALID', 'Trust-evidence blobs hebben een ongeldige vorm.');
  return root.blobs;
}

function descriptor(evidenceId, blob) {
  if (!ID_RE.test(evidenceId))
    throw fout('LEGACY_EVIDENCE_ID_INVALID', 'Legacy evidence bevat een ongeldige identifier.');
  if (!blob || typeof blob !== 'object' || Array.isArray(blob))
    throw fout('LEGACY_BLOB_INVALID', 'Legacy evidence bevat een ongeldig record.');
  if (blob.evidenceId != null && blob.evidenceId !== evidenceId)
    throw fout('LEGACY_EVIDENCE_ID_MISMATCH', 'Legacy evidence-id en opslagsleutel verschillen.');
  const digest = String(blob.contentDigest || blob.digest || '');
  if (!DIGEST_RE.test(digest))
    throw fout('LEGACY_DIGEST_INVALID', 'Legacy evidence mist een geldige inhoudsdigest.');
  if (blob.digest != null && String(blob.digest) !== digest)
    throw fout('LEGACY_DIGEST_CONFLICT', 'Legacy evidence bevat conflicterende digests.');
  if (eigen(blob, 'content') && hash(blob.content) !== digest)
    throw fout('LEGACY_CONTENT_DIGEST_MISMATCH', 'Legacy evidence-inhoud komt niet overeen met haar digest.');
  return bevries({ schemaVersion: 2, evidenceId, digest, contentDigest: digest,
    metadata: projecteerMetadata(blob.metadata) });
}

function legacyEntries(root) {
  return Object.entries(blobsVan(root)).filter(([, blob]) => isLegacy(blob))
    .sort(([a], [b]) => a.localeCompare(b));
}

function bestaandeReceipt(root) {
  if (!root || root.migrations == null) return null;
  if (!root.migrations || typeof root.migrations !== 'object' || Array.isArray(root.migrations))
    throw fout('LEGACY_MIGRATIONS_INVALID', 'Trust-evidence heeft ongeldige migratiemetadata.');
  const receipt = root.migrations[MIGRATION_ID] || null;
  if (receipt && !receiptGeldig(receipt))
    throw fout('LEGACY_RECEIPT_INVALID', 'Het bestaande legacy-migratiereceipt is ongeldig.');
  return receipt;
}

function maakPlan(root, opties) {
  const o = opties || {}, entries = legacyEntries(root), receipt = bestaandeReceipt(root);
  if (!entries.length) return bevries({ migrationId: MIGRATION_ID, needed: false,
    alreadyMigrated: !!receipt, receipt: receipt ? kopie(receipt) : null });
  if (receipt)
    throw fout('LEGACY_MIGRATION_INCONSISTENT', 'Migratiereceipt bestaat terwijl legacy evidence achterbleef.');

  const originals = entries.map(([evidenceId, blob]) => ({ evidenceId, blob: kopie(blob) }));
  const descriptors = {};
  for (const [evidenceId, blob] of entries) descriptors[evidenceId] = descriptor(evidenceId, blob);
  const legacySetDigest = hash(originals);
  const sourceStore = veiligeTekst(o.sourceStore || 'unknown', 40) || 'unknown';
  const planId = 'migration-plan_' + hash({ migrationId: MIGRATION_ID, legacySetDigest, sourceStore });
  const archive = bevries({ format: 'rtg-trust-evidence-legacy-archive-v1', migrationId: MIGRATION_ID,
    planId, sourceStore, createdAt: String(o.now || new Date().toISOString()),
    legacySetDigest, count: originals.length, entries: originals });
  return bevries({ migrationId: MIGRATION_ID, needed: true, planId, sourceStore,
    legacySetDigest, count: originals.length, descriptors, archive });
}

function maakReceipt(plan, archive, completedAt) {
  if (!plan || !plan.needed || !archive || archive.verified !== true)
    throw fout('LEGACY_ARCHIVE_UNVERIFIED', 'Legacy evidence mag niet zonder geverifieerd archief worden gemigreerd.');
  if (archive.legacySetDigest !== plan.legacySetDigest)
    throw fout('LEGACY_ARCHIVE_MISMATCH', 'Het geverifieerde archief hoort niet bij dit migratieplan.');
  const basis = { schemaVersion: 1, migrationId: MIGRATION_ID, planId: plan.planId,
    legacySetDigest: plan.legacySetDigest, migratedCount: plan.count,
    sourceStore: plan.sourceStore, archiveId: archive.archiveId,
    archiveFile: archive.fileName, archivePayloadDigest: archive.payloadDigest,
    archiveCipherDigest: archive.cipherDigest,
    completedAt: String(completedAt || new Date().toISOString()) };
  return bevries({ ...basis, receiptDigest: hash(basis) });
}

function receiptGeldig(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a) || !DIGEST_RE.test(String(a.receiptDigest || ''))) return false;
  const controle = { ...a }; delete controle.receiptDigest;
  return hash(controle) === a.receiptDigest;
}

function zelfdeReceipt(a, b) {
  if (!receiptGeldig(a) || !b) return false;
  return a.migrationId === b.migrationId && a.planId === b.planId &&
    a.legacySetDigest === b.legacySetDigest && a.archivePayloadDigest === b.archivePayloadDigest &&
    a.archiveCipherDigest === b.archiveCipherDigest && a.archiveId === b.archiveId &&
    a.archiveFile === b.archiveFile;
}

async function voerUit(opties) {
  const o = opties || {}, plan = o.plan;
  if (!plan || !plan.needed) return { changed: false, receipt: plan && plan.receipt || null };
  if (typeof o.bewerkCollectie !== 'function')
    throw fout('LEGACY_TRANSACTION_MISSING', 'De transactionele collectiepoort ontbreekt.');
  const receipt = maakReceipt(plan, o.archive, o.completedAt);
  const resultaat = await o.bewerkCollectie('trustEvidence', root => {
    const huidigReceipt = bestaandeReceipt(root);
    const entries = legacyEntries(root);
    if (!entries.length) {
      if (zelfdeReceipt(huidigReceipt, receipt)) return { changed: false, receipt: kopie(huidigReceipt) };
      throw fout('LEGACY_MIGRATION_STALE', 'Trust-evidence veranderde na het archiveren; niets gemigreerd.');
    }
    const huidigPlan = maakPlan(root, { sourceStore: plan.sourceStore,
      now: plan.archive && plan.archive.createdAt });
    if (huidigPlan.legacySetDigest !== plan.legacySetDigest ||
        huidigPlan.planId !== plan.planId || huidigReceipt)
      throw fout('LEGACY_MIGRATION_STALE', 'Trust-evidence veranderde na het archiveren; niets gemigreerd.');
    for (const [evidenceId] of entries) root.blobs[evidenceId] = kopie(huidigPlan.descriptors[evidenceId]);
    root.migrations = root.migrations || {};
    root.migrations[MIGRATION_ID] = kopie(receipt);
    if (legacyEntries(root).length)
      throw fout('LEGACY_MIGRATION_INCOMPLETE', 'Niet alle legacy evidence kon veilig worden gemigreerd.');
    return { changed: true, receipt: kopie(receipt) };
  });
  return resultaat || { changed: true, receipt };
}

module.exports = { MIGRATION_ID, isLegacy, legacyEntries, maakPlan, maakReceipt, voerUit };
