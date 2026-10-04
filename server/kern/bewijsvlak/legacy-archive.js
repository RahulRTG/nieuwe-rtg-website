/* Bestandsarchief voor de expliciete V2-evidence-migratie.

   De cryptografische primitive wordt geïnjecteerd. De standalone CLI laadt
   server/kluis pas nadat RTG_ENC_KEY gecontroleerd is; deze module valt dus
   nooit stil terug op een eerder, zonder sleutel geladen process-global. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canon, hash } = require('./canon');
const { veiligeDoelmap } = require('./legacy-archive-path');

const FORMAT = 'rtg-trust-evidence-legacy-archive-v1';

function fout(code, melding) { return Object.assign(new Error(melding), { code }); }
function legacyArchiveSha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

function leesEnVerifieer(bestand, fileName, verwacht, kluis) {
  const stat = fs.lstatSync(bestand);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1)
    throw fout('LEGACY_ARCHIVE_FILE_UNSAFE', 'Evidence-archief is geen enkel regulier bestand.');
  if ((stat.mode & 0o077) !== 0)
    throw fout('LEGACY_ARCHIVE_PERMISSIONS', 'Evidence-archief is toegankelijk buiten de eigenaar.');
  const cipher = fs.readFileSync(bestand);
  let document;
  try { document = JSON.parse(kluis.ontsleutelBestand(cipher, fileName).toString('utf8')); }
  catch (error) { throw fout('LEGACY_ARCHIVE_VERIFY_FAILED', 'Evidence-archief kon niet geauthenticeerd en gelezen worden.'); }
  if (!document || document.format !== FORMAT || document.migrationId !== verwacht.migrationId ||
      document.planId !== verwacht.planId || document.legacySetDigest !== verwacht.legacySetDigest ||
      document.count !== verwacht.count || hash(document.entries) !== verwacht.legacySetDigest)
    throw fout('LEGACY_ARCHIVE_VERIFY_FAILED', 'Evidence-archief hoort niet bij het actuele migratieplan.');
  if (canon(document.entries) !== canon(verwacht.entries))
    throw fout('LEGACY_ARCHIVE_VERIFY_FAILED', 'Evidence-archief bevat niet exact de geplande legacy records.');
  return { document, cipherDigest: legacyArchiveSha256(cipher), payloadDigest: hash(document) };
}

function verifieerReceipt(opties) {
  const o = opties || {}, receipt = o.receipt, kluis = o.kluis;
  if (!receipt || receipt.migrationId == null || !/^[a-zA-Z0-9:._-]{1,220}$/.test(String(receipt.archiveId || '')) ||
      receipt.archiveFile !== receipt.archiveId + '.rtga')
    throw fout('LEGACY_RECEIPT_INVALID', 'Het legacy-migratiereceipt bevat geen veilige archiefverwijzing.');
  if (!kluis || kluis.AAN !== true || typeof kluis.ontsleutelBestand !== 'function')
    throw fout('LEGACY_ARCHIVE_KEY_REQUIRED', 'Een actieve RTG_ENC_KEY is verplicht voor archiefverificatie.');
  const map = veiligeDoelmap(o.directory, o.dataDirectory), bestand = path.join(map, receipt.archiveFile);
  let stat;
  try { stat = fs.lstatSync(bestand); }
  catch (error) { throw fout('LEGACY_ARCHIVE_MISSING', 'Het evidence-archief uit de receipt ontbreekt.'); }
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o077) !== 0)
    throw fout('LEGACY_ARCHIVE_FILE_UNSAFE', 'Het evidence-archief uit de receipt is geen veilig regulier bestand.');
  const cipher = fs.readFileSync(bestand);
  let document;
  try { document = JSON.parse(kluis.ontsleutelBestand(cipher, receipt.archiveFile).toString('utf8')); }
  catch (error) { throw fout('LEGACY_ARCHIVE_VERIFY_FAILED', 'Evidence-archief kon niet geauthenticeerd en gelezen worden.'); }
  if (!document || document.format !== FORMAT || document.migrationId !== receipt.migrationId ||
      document.planId !== receipt.planId || document.legacySetDigest !== receipt.legacySetDigest ||
      document.count !== receipt.migratedCount || hash(document.entries) !== receipt.legacySetDigest ||
      hash(document) !== receipt.archivePayloadDigest || legacyArchiveSha256(cipher) !== receipt.archiveCipherDigest)
    throw fout('LEGACY_ARCHIVE_VERIFY_FAILED', 'Evidence-archief komt niet overeen met het migratiereceipt.');
  return Object.freeze({ verified: true, archiveId: receipt.archiveId,
    fileName: receipt.archiveFile, legacySetDigest: receipt.legacySetDigest,
    payloadDigest: receipt.archivePayloadDigest, cipherDigest: receipt.archiveCipherDigest });
}

function schrijfTempEnKoppel(doel, bytes) {
  const map = path.dirname(doel), tmp = path.join(map, '.' + path.basename(doel) +
    '.tmp-' + process.pid + '-' + crypto.randomBytes(8).toString('hex'));
  let fd;
  try {
    fd = fs.openSync(tmp, 'wx', 0o600);
    let offset = 0;
    while (offset < bytes.length) offset += fs.writeSync(fd, bytes, offset);
    fs.fsyncSync(fd); fs.closeSync(fd); fd = null;
    fs.linkSync(tmp, doel); // no-clobber: twee migrators mogen elkaar niet overschrijven
    try { const dfd = fs.openSync(map, 'r'); try { fs.fsyncSync(dfd); } finally { fs.closeSync(dfd); } } catch (error) {}
  } finally {
    if (fd != null) try { fs.closeSync(fd); } catch (error) {}
    try { fs.unlinkSync(tmp); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function archiveerLegacy(opties) {
  const o = opties || {}, plan = o.plan, kluis = o.kluis;
  if (!plan || !plan.needed || !plan.archive)
    throw fout('LEGACY_ARCHIVE_PLAN_INVALID', 'Een geldig legacy-migratieplan ontbreekt.');
  if (!kluis || kluis.AAN !== true || typeof kluis.versleutelBestand !== 'function' ||
      typeof kluis.ontsleutelBestand !== 'function')
    throw fout('LEGACY_ARCHIVE_KEY_REQUIRED', 'Een actieve RTG_ENC_KEY is verplicht voor het evidence-archief.');
  const map = veiligeDoelmap(o.directory, o.dataDirectory);
  const archiveId = 'legacy_archive_' + hash({ migrationId: plan.migrationId,
    legacySetDigest: plan.legacySetDigest }).slice(0, 32);
  const fileName = archiveId + '.rtga', doel = path.join(map, fileName);
  if (!fs.existsSync(doel)) {
    const plat = Buffer.from(canon(plan.archive), 'utf8');
    const cipher = kluis.versleutelBestand(plat, fileName);
    if (!Buffer.isBuffer(cipher) || !cipher.subarray(0, 7).equals(Buffer.from('RTGENC2')))
      throw fout('LEGACY_ARCHIVE_ENCRYPTION_FAILED', 'Evidence-archief werd niet bestandsnaamgebonden versleuteld.');
    try { schrijfTempEnKoppel(doel, cipher); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const verified = leesEnVerifieer(doel, fileName, plan.archive, kluis);
  try { fs.chmodSync(doel, 0o400); } catch (error) {
    throw fout('LEGACY_ARCHIVE_PERMISSIONS', 'Evidence-archief kon niet read-only worden gemaakt.');
  }
  return Object.freeze({ verified: true, archiveId, fileName,
    legacySetDigest: plan.legacySetDigest, payloadDigest: verified.payloadDigest,
    cipherDigest: verified.cipherDigest });
}

module.exports = { FORMAT, archiveer: archiveerLegacy, verifieerReceipt, veiligeDoelmap };
