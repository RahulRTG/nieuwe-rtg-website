'use strict';
const fs = require('node:fs'), path = require('node:path');
const native = require('./native-artifact');
const { REL } = require('./native-kandidaat');
const { canoniek } = require('../imageherkomst');

function directory(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || fs.realpathSync(value) !== value ||
      !fs.lstatSync(value).isDirectory()) throw Error('Hostpad is geen vaste echte directory.');
  return value;
}
function configuration(root) {
  const c = JSON.parse(fs.readFileSync(path.join(root, REL.nativeHost)));
  if (c.schema !== 'rtg-native-host-v1' || c.platform !== 'darwin' || c.arch !== 'arm64' ||
      c.service !== 'nl.rtg.server' || !Number.isInteger(c.port) || c.port < 1024 || c.port > 65535)
    throw Error('Ongeldige native hostconfiguratie.');
  directory(c.store); directory(c.dataDirectory);
  if (c.dataDirectory === c.store || c.dataDirectory.startsWith(c.store + path.sep))
    throw Error('Runtimegegevens moeten buiten de releasestore staan.');
  for (const name of ['launcher', 'launchAgent']) {
    if (!c[name] || !path.isAbsolute(c[name].path) || native.hashFile(c[name].path) !== c[name].sha256)
      throw Error('Native hostconfiguratie gewijzigd: ' + name);
  }
  return c;
}
function authorizedSelection(promotion, selection) {
  if (promotion.formaat !== 'rtg-native-promotie-v1') throw Error('Geen native promotie.');
  const candidate = promotion.kandidaat;
  if (selection === 'candidate') return { commit:promotion.commit, digest:candidate.artifact.digest, archive:REL.nativeArchive,
    attestation:REL.nativeAttestation };
  if (selection === 'rollback') return { commit:candidate.rollback.previousCommit, digest:candidate.rollback.previousDigest,
    archive:REL.nativePrevious, attestation:REL.nativePreviousAttestation };
  throw Error('Onbekende native selectiestand.');
}
function authorized(root, commit, selection) {
  if (selection === 'rollback') return rollbackAuthorization(root, commit);
  // Een cijfer/READY-veld alleen is niet genoeg: herbereken alle bestaande
  // productiegates en controleer daarna de ondertekende, bytegebonden promotie.
  const decision = require('../productie-status').maak(root, 'native');
  if (decision.commit !== commit || decision.PRODUCTION_STATUS !== 'READY')
    throw Error('Native promotie geblokkeerd: ' + decision.blokkades.join(' '));
  const promotion = require('./productie-promotie').controleer(root, commit);
  const config = configuration(root), selected = authorizedSelection(promotion, selection);
  const archive = path.join(root, selected.archive);
  const attestation = JSON.parse(fs.readFileSync(path.join(root, selected.attestation)));
  const artifact = native.verify(archive, attestation, root, selected.commit);
  if ('sha256:' + artifact.archiveSha256 !== selected.digest) throw Error('Niet-geautoriseerde native artifactselectie.');
  return { config, selected, artifact, attestation, archive, promotion };
}
function rollbackAuthorization(root, commit) {
  // Een kapotte kandidaat mag het eerder geautoriseerde herstel niet blokkeren.
  // Verifieer daarom de oorspronkelijke PROMOTION en uitsluitend het daarin
  // vastgezette vorige pakket en hostconfig; geen nieuwe READY voor de storing.
  const trust = require('../../server/config/release-trust');
  const bytes = require('./productie-promotie').leesRegulier(path.join(root, '.release/productie-promotie.json'));
  const signature = fs.readFileSync(path.join(root, '.release/productie-promotie.sig'), 'ascii').trim();
  const promotion = JSON.parse(bytes);
  if (!/^[a-f0-9]{40}$/.test(commit || '') || promotion.commit !== commit ||
      promotion.formaat !== 'rtg-native-promotie-v1' || promotion.ondertekenDomein !== trust.ROLES.PROMOTION.domain ||
      !trust.verify('PROMOTION', bytes, signature, trust.anchors(root).PROMOTION.key) ||
      !require('./native-kandidaat').geldig(promotion.kandidaat)) throw Error('Geen geldige native rollback-authority.');
  const config = configuration(root);
  if (promotion.bewijzen?.nativeHost?.sha256 !== native.hashFile(path.join(root, REL.nativeHost)))
    throw Error('Rollback-hostconfiguratie wijkt af van de promotie.');
  const selected = authorizedSelection(promotion, 'rollback'), archive = path.join(root, selected.archive);
  const attestation = JSON.parse(fs.readFileSync(path.join(root, selected.attestation)));
  const artifact = native.verify(archive, attestation, root, selected.commit);
  if ('sha256:' + artifact.archiveSha256 !== selected.digest) throw Error('Rollback-artifact wijkt af van de promotie.');
  return { config, selected, artifact, attestation, archive, promotion };
}
function writePointer(store, value) {
  directory(store);
  const target = path.join(store, 'current.json');
  if (fs.existsSync(target) && (!fs.lstatSync(target).isFile() || fs.lstatSync(target).isSymbolicLink()))
    throw Error('Actieve verwijzing is geen regulier bestand.');
  const temp = path.join(store, '.current-' + require('node:crypto').randomUUID());
  const fd = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(fd, canoniek(value) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temp, target);
  const dir = fs.openSync(store, 'r'); try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
}
function select(root, commit, selection) {
  const a = authorized(root, commit, selection);
  const release = native.stage(a.archive, a.attestation, root, a.selected.commit, a.config.store);
  const pointer = { schema:'rtg-native-pointer-v1', authorityCommit:commit, selection,
    commit:a.selected.commit, digest:a.selected.digest,
    promotionSha256:native.hashFile(path.join(root, '.release/productie-promotie.json')) };
  writePointer(a.config.store, pointer);
  return { ...a, release, pointer };
}
function current(root) {
  const config = configuration(root);
  const pointer = JSON.parse(fs.readFileSync(path.join(config.store, 'current.json')));
  if (pointer.schema !== 'rtg-native-pointer-v1') throw Error('Onbekende native verwijzing.');
  const a = authorized(root, pointer.authorityCommit, pointer.selection);
  if (pointer.commit !== a.selected.commit || pointer.digest !== a.selected.digest ||
      pointer.promotionSha256 !== native.hashFile(path.join(root, '.release/productie-promotie.json')))
    throw Error('Native verwijzing valt buiten de getekende promotie.');
  const release = path.join(config.store, a.artifact.archiveSha256);
  native.verifyInstalled(release, a.artifact.manifest);
  return { ...a, release, pointer };
}
module.exports = { configuration, authorizedSelection, authorized, rollbackAuthorization, writePointer, select, current };
