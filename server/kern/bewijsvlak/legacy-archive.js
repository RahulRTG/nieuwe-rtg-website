/* Bestandsarchief voor de expliciete V2-evidence-migratie.

   De cryptografische primitive wordt geïnjecteerd. De standalone CLI laadt
   server/kluis pas nadat RTG_ENC_KEY gecontroleerd is; deze module valt dus
   nooit stil terug op een eerder, zonder sleutel geladen process-global. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canon, hash } = require('./canon');

const FORMAT = 'rtg-trust-evidence-legacy-archive-v1';

function fout(code, melding) { return Object.assign(new Error(melding), { code }); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

function absoluut(pad, naam) {
  if (typeof pad !== 'string' || !pad || !path.isAbsolute(pad) || path.resolve(pad) !== pad || pad === path.parse(pad).root)
    throw fout('LEGACY_ARCHIVE_PATH_INVALID', naam + ' moet een expliciet absoluut, genormaliseerd pad zijn.');
  return pad;
}

function binnen(kind, ouder) {
  const relatief = path.relative(ouder, kind);
  return relatief === '' || (!relatief.startsWith('..' + path.sep) && relatief !== '..' && !path.isAbsolute(relatief));
}

function verzekerMapZonderLinks(map) {
  const doel = absoluut(map, 'RTG_EVIDENCE_ARCHIVE_DIR');
  const parsed = path.parse(doel), delen = doel.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let huidig = parsed.root;
  for (const deel of delen) {
    huidig = path.join(huidig, deel);
    try {
      const stat = fs.lstatSync(huidig);
      if (stat.isSymbolicLink()) throw fout('LEGACY_ARCHIVE_SYMLINK', 'Archiefpad bevat een symbolische link.');
      if (!stat.isDirectory()) throw fout('LEGACY_ARCHIVE_PATH_INVALID', 'Archiefpad bevat een niet-mapcomponent.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try { fs.mkdirSync(huidig, { mode: 0o700 }); }
      catch (maakFout) { if (maakFout.code !== 'EEXIST') throw maakFout; }
      const stat = fs.lstatSync(huidig);
      if (stat.isSymbolicLink() || !stat.isDirectory())
        throw fout('LEGACY_ARCHIVE_SYMLINK', 'Archiefpad wisselde tijdens het aanmaken.');
    }
  }
  const eind = fs.lstatSync(doel);
  if ((eind.mode & 0o077) !== 0)
    throw fout('LEGACY_ARCHIVE_PERMISSIONS', 'Archiefmap moet uitsluitend toegankelijk zijn voor de eigenaar (0700).');
  if (typeof process.getuid === 'function' && Number.isInteger(eind.uid) && eind.uid !== process.getuid())
    throw fout('LEGACY_ARCHIVE_OWNER', 'Archiefmap heeft niet de huidige proceseigenaar.');
  return fs.realpathSync(doel);
}

function veiligeDoelmap(archiveDir, dataDir) {
  const archiefPad = absoluut(archiveDir, 'RTG_EVIDENCE_ARCHIVE_DIR');
  if (dataDir) {
    const dataPad = absoluut(path.resolve(dataDir), 'RTG_DATA_DIR');
    if (binnen(archiefPad, dataPad) || binnen(dataPad, archiefPad))
      throw fout('LEGACY_ARCHIVE_NOT_SEPARATE', 'Evidence-archief en primaire datamap moeten gescheiden paden zijn.');
  }
  const archief = verzekerMapZonderLinks(archiefPad);
  if (dataDir) {
    const dataPad = absoluut(path.resolve(dataDir), 'RTG_DATA_DIR');
    let dataWerkelijk = dataPad;
    try { dataWerkelijk = fs.realpathSync(dataPad); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (binnen(archief, dataWerkelijk) || binnen(dataWerkelijk, archief))
      throw fout('LEGACY_ARCHIVE_NOT_SEPARATE', 'Evidence-archief en primaire datamap moeten gescheiden paden zijn.');
  }
  return archief;
}

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
  return { document, cipherDigest: sha256(cipher), payloadDigest: hash(document) };
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
      hash(document) !== receipt.archivePayloadDigest || sha256(cipher) !== receipt.archiveCipherDigest)
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

function archiveer(opties) {
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

module.exports = { FORMAT, archiveer, verifieerReceipt, veiligeDoelmap };
