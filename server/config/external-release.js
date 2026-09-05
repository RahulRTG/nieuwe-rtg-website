/* Cryptografische grens voor bewijs dat buiten RTG ontstaat.

   Een JSON-veld `status: PASS` is geen bewijs. Deze lezer eist daarom drie
   afzonderlijke, alleen-lezen zaken: het exacte dossier, een detached
   Ed25519-handtekening daarover en de werkelijk gemounte bewijsbestanden die
   het dossier met SHA-256 noemt. De publieke sleutel komt uit de gecommitte
   releaseconfiguratie en nooit uit het dossier zelf. */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const FORMAAT = 'rtg-external-release-v2';
const MAX_DOSSIER_BYTES = 64 * 1024;
const MAX_BEWIJS_BYTES = 32 * 1024 * 1024;
const ALLE_CONTROLES = Object.freeze([
  'tlsDdosRand', 'onafhankelijkePentest', 'juridischeVrijgave',
  'privacyDpia', 'backupHerstel', 'deploymentRollback',
  'observabilityIncident',
  /* Een aanwezige provider- of SMTP-sleutel zegt alleen dat iets is
     geconfigureerd. Deze controles vragen bewijsbytes van een echte,
     releasegebonden levering/proef voordat READY mogelijk is. Een bewust
     uitgeschakelde rail kan dus alleen via een door de releasebeoordelaar
     ondertekend out-of-scopebewijs worden afgedekt, nooit via de env-var zelf. */
  'paymentProvider', 'payoutProvider', 'webhookDelivery',
  'refundPayoutSettlement', 'reconciliation',
  'emailDeliveryRecovery', 'smsDelivery', 'malwareDefinitionsScan',
  'objectStorage', 'imageVulnerabilityScan', 'foundationMinderjarigen'
]);
const FOUNDATION_CONTROLES = Object.freeze([
  'juridischeVrijgave', 'privacyDpia', 'foundationMinderjarigen'
]);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function fout(reden) { return { ok:false, reden }; }
function netteTekst(waarde, min = 1, max = 512) {
  const tekst = typeof waarde === 'string' ? waarde.trim() : '';
  return tekst.length >= min && tekst.length <= max && !/[\0\r\n]/.test(tekst) &&
    !/VUL-IN|PLACEHOLDER|VOORBEELD/i.test(tekst);
}
function geldigMoment(waarde) {
  if (!netteTekst(waarde, 20, 40)) return false;
  const tijd = Date.parse(waarde);
  return Number.isFinite(tijd) && new Date(tijd).toISOString() === waarde;
}
function veiligeBestandsnaam(waarde) {
  return typeof waarde === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(waarde);
}

function leesRegulier(bestand, maximum) {
  const vlaggen = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  let fd;
  try {
    const voor = fs.lstatSync(bestand);
    if (!voor.isFile() || voor.isSymbolicLink() || voor.size < 1 || voor.size > maximum)
      throw new Error('geen begrensd regulier bestand');
    fd = fs.openSync(bestand, vlaggen);
    const tijdens = fs.fstatSync(fd);
    if (!tijdens.isFile() || tijdens.size !== voor.size) throw new Error('bestand veranderde tijdens openen');
    const bytes = fs.readFileSync(fd);
    const na = fs.fstatSync(fd);
    if (na.size !== tijdens.size || bytes.length !== tijdens.size)
      throw new Error('bestand veranderde tijdens lezen');
    return bytes;
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}

function controleerStructuur(dossier, releaseCommit, vereisteControles, opties = {}) {
  if (!dossier || typeof dossier !== 'object' || Array.isArray(dossier) ||
      dossier.formaat !== FORMAAT || dossier.geslaagd !== true) return fout('dossier-niet-groen');
  const commit = String(dossier.commit || '').toLowerCase();
  const verwacht = String(releaseCommit || '').toLowerCase();
  if (!/^[a-f0-9]{40,64}$/.test(commit) || !/^[a-f0-9]{40,64}$/.test(verwacht) || commit !== verwacht)
    return fout('releasecommit-wijkt-af');
  if (!netteTekst(dossier.goedgekeurdDoor, 3, 160) || !geldigMoment(dossier.goedgekeurdAt))
    return fout('goedkeuring-ongeldig');
  for (const naam of vereisteControles) {
    const controle = dossier.controles && dossier.controles[naam];
    if (!controle || controle.status !== 'PASS') return fout('controle-niet-pass:' + naam);
    if (!controle.bewijs || typeof controle.bewijs !== 'object' ||
        !veiligeBestandsnaam(controle.bewijs.bestand) ||
        !/^[a-f0-9]{64}$/i.test(String(controle.bewijs.sha256 || '')))
      return fout('bewijs-ongeldig:' + naam);
  }
  const foundation = dossier.controles && dossier.controles.foundationMinderjarigen;
  if (vereisteControles.includes('foundationMinderjarigen')) {
    const open = foundation && foundation.vrijgave === 'OPEN' &&
      foundation.leeftijdscontrole === 'PASS' && foundation.moderatie === 'PASS';
    const gesloten = foundation && foundation.vrijgave === 'GESLOTEN' &&
      foundation.leeftijdscontrole === 'NIET_VRIJGEGEVEN' &&
      foundation.moderatie === 'NIET_VRIJGEGEVEN';
    if ((!open && !gesloten) || (opties.eisFoundationOpen === true && !open))
      return fout('foundationvoorwaarden-niet-pass');
  }
  return { ok:true, commit };
}

function controleerBestanden({ dossierPad, handtekeningPad, bewijsRoot, sleutelPad,
  releaseCommit, vereisteControles = ALLE_CONTROLES, eisFoundationOpen = false } = {}) {
  try {
    const dossierBytes = leesRegulier(dossierPad, MAX_DOSSIER_BYTES);
    let dossier;
    try { dossier = JSON.parse(dossierBytes.toString('utf8')); }
    catch (e) { return fout('dossier-onleesbaar'); }
    const structuur = controleerStructuur(dossier, releaseCommit, vereisteControles,
      { eisFoundationOpen });
    if (!structuur.ok) return structuur;

    const sleutelBytes = leesRegulier(sleutelPad, 16 * 1024);
    let sleutel;
    try { sleutel = crypto.createPublicKey(sleutelBytes); }
    catch (e) { return fout('vertrouwenssleutel-ongeldig'); }
    if (sleutel.asymmetricKeyType !== 'ed25519') return fout('vertrouwenssleutel-niet-ed25519');
    const handtekeningTekst = leesRegulier(handtekeningPad, 1024).toString('ascii').trim();
    if (!/^[A-Za-z0-9+/]{86}==$/.test(handtekeningTekst)) return fout('handtekening-ongeldig');
    const handtekening = Buffer.from(handtekeningTekst, 'base64');
    if (handtekening.length !== 64 || !crypto.verify(null, dossierBytes, sleutel, handtekening))
      return fout('handtekening-klopt-niet');

    const bewijsMapStat = fs.lstatSync(bewijsRoot);
    if (!bewijsMapStat.isDirectory() || bewijsMapStat.isSymbolicLink())
      return fout('bewijsmap-onbruikbaar');
    const bestanden = [];
    for (const naam of vereisteControles) {
      const bewijs = dossier.controles[naam].bewijs;
      const bytes = leesRegulier(path.join(bewijsRoot, bewijs.bestand), MAX_BEWIJS_BYTES);
      const echt = sha256(bytes);
      if (echt !== String(bewijs.sha256).toLowerCase()) return fout('bewijsbytes-wijken-af:' + naam);
      bestanden.push({ controle:naam, bestand:bewijs.bestand, sha256:echt, bytes:bytes.length });
    }
    const foundation = dossier.controles && dossier.controles.foundationMinderjarigen;
    return { ok:true, reden:'ondertekend-bewijs-geldig', commit:structuur.commit,
      dossierSha256:sha256(dossierBytes), handtekeningSha256:sha256(Buffer.from(handtekeningTekst, 'ascii')),
      sleutelSha256:sha256(sleutelBytes), bewijsBestanden:bestanden,
      foundation:foundation ? { vrijgave:foundation.vrijgave,
        leeftijdscontrole:foundation.leeftijdscontrole, moderatie:foundation.moderatie } : null };
  } catch (e) {
    if (e && ['ENOENT', 'ENOTDIR'].includes(e.code)) return fout('bewijsbestand-ontbreekt');
    return fout('bewijsbestand-onbruikbaar');
  }
}

function padenVoorDossier(dossierPad, root) {
  const basis = path.dirname(dossierPad);
  return { dossierPad, handtekeningPad:path.join(basis, 'external-release.sig'),
    bewijsRoot:path.join(basis, 'external-evidence'),
    sleutelPad:path.join(root, 'deploy', 'release-sleutel.pub') };
}

function controleerReleaseRoot(root, releaseCommit) {
  const dossierPad = path.join(root, '.release', 'external-release.json');
  return controleerBestanden({ ...padenVoorDossier(dossierPad, root), releaseCommit,
    vereisteControles:ALLE_CONTROLES });
}

function samenvatting(controle) {
  if (!controle || !controle.ok) return { ok:false, reden:(controle && controle.reden) || 'controle-ontbreekt' };
  return { ok:true, reden:controle.reden, commit:controle.commit,
    dossierSha256:controle.dossierSha256, handtekeningSha256:controle.handtekeningSha256,
    sleutelSha256:controle.sleutelSha256, bewijsBestanden:controle.bewijsBestanden,
    foundation:controle.foundation };
}

function foundationReleaseBlokkades(controle, runtime) {
  const uit = [];
  const f = controle && controle.foundation || {};
  const open = f.vrijgave === 'OPEN' && f.leeftijdscontrole === 'PASS' && f.moderatie === 'PASS';
  const gesloten = f.vrijgave === 'GESLOTEN' && f.leeftijdscontrole === 'NIET_VRIJGEGEVEN' &&
    f.moderatie === 'NIET_VRIJGEGEVEN';
  if (!open && !gesloten)
    uit.push('Het externe dossier legt de Foundation-minderjarigenstand niet geldig vast.');
  if (!runtime || typeof runtime.aangevraagd !== 'boolean' ||
      typeof runtime.vrijgegeven !== 'boolean') {
    uit.push('Go-livebewijs mist de server-side Foundation-minderjarigenstand.');
    return uit;
  }
  if (runtime.aangevraagd && (!runtime.vrijgegeven || !open))
    uit.push('Beschermde Foundation-functies zijn aangevraagd zonder volledige externe vrijgave.');
  if (!runtime.aangevraagd && runtime.vrijgegeven)
    uit.push('Foundation meldt vrijgave zonder dat de server-side featuregate is aangevraagd.');
  return uit;
}

module.exports = { FORMAAT, MAX_DOSSIER_BYTES, MAX_BEWIJS_BYTES, ALLE_CONTROLES,
  FOUNDATION_CONTROLES, sha256, netteTekst, geldigMoment, veiligeBestandsnaam,
  leesRegulier, controleerStructuur, controleerBestanden, padenVoorDossier,
  controleerReleaseRoot, samenvatting, foundationReleaseBlokkades };
