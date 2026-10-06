'use strict';

const fs = require('node:fs');
const path = require('node:path');
function fout(code, melding) { return Object.assign(new Error(melding), { code }); }

function absoluut(pad, naam) {
  if (typeof pad !== 'string' || !pad || !path.isAbsolute(pad) || path.resolve(pad) !== pad ||
      pad === path.parse(pad).root)
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
    try { dataWerkelijk = fs.realpathSync(dataPad); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (binnen(archief, dataWerkelijk) || binnen(dataWerkelijk, archief))
      throw fout('LEGACY_ARCHIVE_NOT_SEPARATE', 'Evidence-archief en primaire datamap moeten gescheiden paden zijn.');
  }
  return archief;
}

module.exports = { veiligeDoelmap };
