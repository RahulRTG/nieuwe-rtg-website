/* Bestandsschild voor runtime-evidence-exporten. Geen WORM-claim: dit levert
   veilige paden, owner-only rechten, no-clobber en duurzame lokale writes. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function fout(code, melding) { return Object.assign(new Error(melding), { code }); }
function runtimeFileSha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function binnen(kind, ouder) {
  const relatief = path.relative(ouder, kind);
  return relatief === '' || (!relatief.startsWith('..' + path.sep) && relatief !== '..' && !path.isAbsolute(relatief));
}

function absoluut(pad, naam) {
  if (typeof pad !== 'string' || !pad || !path.isAbsolute(pad) || path.resolve(pad) !== pad ||
      pad === path.parse(pad).root)
    throw fout('EVIDENCE_EXPORT_PATH_INVALID', naam + ' moet een expliciet absoluut, genormaliseerd pad zijn.');
  return pad;
}

function veiligeMap(directory, dataDirectory) {
  const doel = absoluut(directory, 'RTG_EVIDENCE_EXPORT_DIR');
  const parsed = path.parse(doel), delen = doel.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let huidig = parsed.root;
  for (const deel of delen) {
    huidig = path.join(huidig, deel);
    try {
      const stat = fs.lstatSync(huidig);
      if (stat.isSymbolicLink() || !stat.isDirectory())
        throw fout('EVIDENCE_EXPORT_PATH_UNSAFE', 'Exportpad bevat een link of niet-mapcomponent.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try { fs.mkdirSync(huidig, { mode: 0o700 }); }
      catch (maakFout) { if (maakFout.code !== 'EEXIST') throw maakFout; }
      const stat = fs.lstatSync(huidig);
      if (stat.isSymbolicLink() || !stat.isDirectory())
        throw fout('EVIDENCE_EXPORT_PATH_UNSAFE', 'Exportpad wisselde tijdens het aanmaken.');
    }
  }
  const stat = fs.lstatSync(doel);
  if ((stat.mode & 0o777) !== 0o700)
    throw fout('EVIDENCE_EXPORT_PERMISSIONS', 'Exportmap moet modus 0700 hebben.');
  if (typeof process.getuid === 'function' && Number.isInteger(stat.uid) && stat.uid !== process.getuid())
    throw fout('EVIDENCE_EXPORT_OWNER', 'Exportmap heeft niet de huidige proceseigenaar.');
  const werkelijk = fs.realpathSync(doel);
  if (dataDirectory) {
    const data = absoluut(path.resolve(dataDirectory), 'RTG_DATA_DIR');
    let dataWerkelijk = data;
    try { dataWerkelijk = fs.realpathSync(data); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (binnen(werkelijk, dataWerkelijk) || binnen(dataWerkelijk, werkelijk))
      throw fout('EVIDENCE_EXPORT_NOT_SEPARATE', 'Evidence-export en primaire datamap moeten gescheiden zijn.');
  }
  return werkelijk;
}

function veiligBestand(bestand, soort) {
  let stat;
  try { stat = fs.lstatSync(bestand); }
  catch (error) {
    if (error.code === 'ENOENT') throw fout('EVIDENCE_EXPORT_MISSING', soort + ' ontbreekt.');
    throw error;
  }
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1)
    throw fout('EVIDENCE_EXPORT_FILE_UNSAFE', soort + ' is geen enkel regulier bestand.');
  if ((stat.mode & 0o777) !== 0o400)
    throw fout('EVIDENCE_EXPORT_PERMISSIONS', soort + ' moet modus 0400 hebben.');
  return stat;
}

function schrijfNoClobber(doel, bytes, mode) {
  const map = path.dirname(doel), tmp = path.join(map, '.' + path.basename(doel) +
    '.tmp-' + process.pid + '-' + crypto.randomBytes(8).toString('hex'));
  let fd;
  try {
    fd = fs.openSync(tmp, 'wx', mode || 0o600);
    let offset = 0;
    while (offset < bytes.length) offset += fs.writeSync(fd, bytes, offset);
    fs.fsyncSync(fd); fs.closeSync(fd); fd = null;
    fs.linkSync(tmp, doel);
    fs.chmodSync(doel, 0o400);
    try { const dfd = fs.openSync(map, 'r'); try { fs.fsyncSync(dfd); } finally { fs.closeSync(dfd); } }
    catch (error) {}
  } finally {
    if (fd != null) try { fs.closeSync(fd); } catch (error) {}
    try { fs.unlinkSync(tmp); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

module.exports = { sha256: runtimeFileSha256, veiligeMap, veiligBestand, schrijfNoClobber };
