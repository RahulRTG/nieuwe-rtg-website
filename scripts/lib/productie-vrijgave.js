'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const BRONNEN = Object.freeze({
  suite: '.release/ci-suite.json', schermsuite: '.release/ci-schermsuite-bewijs.json',
  pg: '.release/ci-pg-bewijs.json', kandidaatPg: '.release/pg-bewijs.json',
  releaseGate: '.release/release-gate-bewijs.json',
  staging: '.release/staging-bewijs.json', golive: '.release/golive-bewijs.json',
  bronReleaseBewijs: '.release/bron-release-bewijs.json',
  releaseBewijs: '.release/image-release-bewijs.json', extern: '.release/external-release.json',
  externHandtekening: '.release/external-release.sig',
  liveKandidaat:'.release/live-kandidaat.json',
  kandidaatImageBewijs:'.release/live-kandidaat-image-bewijs.json',
  kandidaatRuntime:'.release/live-kandidaat-runtime-bewijs.json',
  imageSbom:'.release/sbom.json', imageHerkomst:'.release/herkomst.json',
  backupSbom:'.release/sbom-backup.json', backupHerkomst:'.release/herkomst-backup.json'
});

function sha256Bestand(pad) {
  return crypto.createHash('sha256').update(fs.readFileSync(pad)).digest('hex');
}

/* SUITE.json is de getrackte uitvoer van de volledige unitronde. Hij is geen
   image-invoer (zie .dockerignore) en wordt later via READY op bytes gepind.
   Alleen dit ene bekende bewijsbestand mag daarom afwijken; elk ander pad,
   óók documentatie of een onbekend nieuw bestand, houdt een uitrol tegen. */
function onbekendeWijzigingen(porcelain) {
  return String(porcelain || '').split(/\r?\n/).filter(Boolean).filter(regel => {
    const padNaam = regel.slice(3);
    return padNaam !== 'SUITE.json' || padNaam.includes(' -> ');
  });
}

function eisSchoneReleasebron(root = ROOT) {
  const commit = cp.spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const sha = String(commit.stdout || '').trim();
  if (commit.error || commit.status !== 0 || !/^[a-f0-9]{40,64}$/i.test(sha))
    throw new Error('De productiebron is niet aan een leesbare Git-commit gebonden.');
  const status = cp.spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
  if (status.error || status.status !== 0)
    throw new Error('De toestand van de releasebron kon niet betrouwbaar worden vastgesteld.');
  const onbekend = onbekendeWijzigingen(status.stdout);
  if (onbekend.length)
    throw new Error('De productiebron bevat wijzigingen buiten de commit en de vaste bewijsuitvoer: ' +
      onbekend.slice(0, 5).map(r => r.slice(3)).join(', ') + '.');
  return sha;
}

function leesProductiestatus(commit, root = ROOT) {
  const pad = path.join(root, '.release', 'productie-status.json');
  let rapport;
  try { rapport = JSON.parse(fs.readFileSync(pad, 'utf8')); }
  catch (e) { throw new Error('Productiestatus ontbreekt of is onleesbaar; de afbouw heeft geen READY-bewijs gemaakt.'); }
  if (rapport.formaat !== 'rtg-production-status-v1' || rapport.PRODUCTION_STATUS !== 'READY')
    throw new Error('Productiestatus is niet READY.');
  if (String(rapport.commit || '') !== String(commit || ''))
    throw new Error('Productiestatus hoort niet bij de releasecommit.');
  const verwacht = String(rapport.bewijsSha256 || '');
  const zonder = Object.assign({}, rapport); delete zonder.bewijsSha256;
  const echt = crypto.createHash('sha256').update(JSON.stringify(zonder)).digest('hex');
  if (!/^[a-f0-9]{64}$/.test(verwacht) || echt !== verwacht)
    throw new Error('Productiestatus heeft geen geldige SHA-256-pin.');
  for (const [naam, rel] of Object.entries(BRONNEN)) {
    const bron = rapport.bronnen && rapport.bronnen[naam];
    if (!bron || bron.pad !== rel || !/^[a-f0-9]{64}$/.test(String(bron.sha256 || '')))
      throw new Error('Productiestatus mist een vaste bewijsbron: ' + naam + '.');
    let huidig;
    try { huidig = sha256Bestand(path.join(root, rel)); }
    catch (e) { throw new Error('Bewijsbron ontbreekt na de READY-uitspraak: ' + rel + '.'); }
    if (huidig !== bron.sha256)
      throw new Error('Bewijsbron wijzigde na de READY-uitspraak: ' + rel + '.');
  }
  const extern = require('../../server/config/external-release');
  const huidigeExtern = extern.samenvatting(extern.controleerReleaseRoot(root, commit));
  if (JSON.stringify(huidigeExtern) !== JSON.stringify(rapport.externeVrijgave || null))
    throw new Error('Het ondertekende externe dossier of een bewijsbestand wijzigde na de READY-uitspraak.');
  return rapport;
}

module.exports = { BRONNEN, onbekendeWijzigingen, eisSchoneReleasebron, leesProductiestatus };
