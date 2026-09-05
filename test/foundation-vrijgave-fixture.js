'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const extern = require('../server/config/external-release');
const releaseBewijs = require('../scripts/release-bewijs');

const COMMIT = 'a'.repeat(40);
const HASH = 'b'.repeat(64);

const BESTANDSNAMEN = Object.freeze({
  tlsDdosRand:'tls-ddos', onafhankelijkePentest:'pentest',
  juridischeVrijgave:'juridisch', privacyDpia:'dpia',
  backupHerstel:'backup-herstel', deploymentRollback:'deployment-rollback',
  observabilityIncident:'observability-incident', paymentProvider:'payment-provider',
  payoutProvider:'payout-provider', webhookDelivery:'webhook-delivery',
  refundPayoutSettlement:'refund-payout-settlement', reconciliation:'reconciliation',
  emailDeliveryRecovery:'email-delivery-recovery', smsDelivery:'sms-delivery',
  malwareDefinitionsScan:'malware-definitions-scan', objectStorage:'object-storage',
  imageVulnerabilityScan:'image-vulnerability-scan',
  foundationMinderjarigen:'foundation'
});

function groenDossier(commit = COMMIT, hashes = {}) {
  const bewijs = naam => ({ bestand:naam + '.bewijs', sha256:hashes[naam] || HASH });
  const controles = {};
  for (const naam of extern.ALLE_CONTROLES) {
    const bestand = BESTANDSNAMEN[naam];
    controles[naam] = { status:'PASS', bewijs:bewijs(bestand) };
  }
  controles.foundationMinderjarigen = { ...controles.foundationMinderjarigen,
    vrijgave:'OPEN', leeftijdscontrole:'PASS', moderatie:'PASS' };
  return {
    formaat:extern.FORMAAT, geslaagd:true, commit,
    goedgekeurdDoor:'Onafhankelijke beoordelaar', goedgekeurdAt:'2026-09-04T12:00:00.000Z',
    controles
  };
}

function maakGetekendeVrijgave(root, opties = {}) {
  const commit = opties.commit || COMMIT;
  const releaseMap = path.join(root, '.release');
  const bewijsMap = path.join(releaseMap, 'external-evidence');
  const deployMap = path.join(root, 'deploy');
  fs.mkdirSync(bewijsMap, { recursive:true });
  fs.mkdirSync(deployMap, { recursive:true });
  const sleutels = opties.sleutels || crypto.generateKeyPairSync('ed25519');
  const hashes = {};
  for (const naam of Object.values(BESTANDSNAMEN)) {
    const bytes = Buffer.from('extern bewijs voor ' + naam + '\n');
    fs.writeFileSync(path.join(bewijsMap, naam + '.bewijs'), bytes);
    hashes[naam] = extern.sha256(bytes);
  }
  const dossier = groenDossier(commit, hashes);
  if (opties.wijzigDossier) opties.wijzigDossier(dossier);
  const dossierBytes = Buffer.from(JSON.stringify(dossier, null, 2) + '\n');
  fs.writeFileSync(path.join(releaseMap, 'external-release.json'), dossierBytes);
  const tekenSleutel = opties.tekenSleutel || sleutels.privateKey;
  fs.writeFileSync(path.join(releaseMap, 'external-release.sig'),
    crypto.sign(null, dossierBytes, tekenSleutel).toString('base64') + '\n');
  fs.writeFileSync(path.join(deployMap, 'release-sleutel.pub'),
    sleutels.publicKey.export({ type:'spki', format:'pem' }));
  if (opties.runtimeBewijs !== false) maakRuntimeBewijs(root, opties.runtimeCommit || commit);
  return { dossier, dossierBytes, bewijsMap, sleutels };
}

/* Kleine maar volledige runtime-opstelling voor de imagebewijsverifier. Het
   bewijs wordt op de echte imageplaats geschreven; de kopie in `.release` is
   uitsluitend host-side productiestatusinvoer en heeft voor Foundation geen
   gezag. */
function maakRuntimeBewijs(root, commit = COMMIT) {
  const bestanden = {
    'package.json':'{"name":"rtg-vrijgaveproef","version":"1.0.0"}\n',
    'package-lock.json':'{"lockfileVersion":3}\n',
    'server/app.js':'module.exports = true;\n',
    'public/dist/app.js':'runtime-bouw\n',
    'scripts/start.js':'module.exports = true;\n',
    'motor/src/lib.rs':'pub fn proef() {}\n',
    'motor/Cargo.toml':'[package]\nname="proef"\nversion="0.0.0"\n',
    'motor/Cargo.lock':'', 'rtg-motor':'motor-binary', 'rtg-sentinel':'sentinel-binary'
  };
  for (const [rel, inhoud] of Object.entries(bestanden)) {
    const doel = path.join(root, rel);
    fs.mkdirSync(path.dirname(doel), { recursive:true });
    if (!fs.existsSync(doel)) fs.writeFileSync(doel, inhoud);
  }
  const vorig = process.env.RTG_RELEASE_COMMIT;
  process.env.RTG_RELEASE_COMMIT = commit;
  let manifest;
  try { manifest = releaseBewijs.maakManifest(root); }
  finally {
    if (vorig === undefined) delete process.env.RTG_RELEASE_COMMIT;
    else process.env.RTG_RELEASE_COMMIT = vorig;
  }
  manifest.bron.commit = commit;
  manifest.bron.gewijzigd = false;
  const bytes = JSON.stringify(manifest, null, 2) + '\n';
  fs.writeFileSync(path.join(root, 'release-bewijs.json'), bytes);
  fs.writeFileSync(path.join(root, '.release', 'release-bewijs.json'), bytes);
  return manifest;
}

module.exports = { COMMIT, HASH, BESTANDSNAMEN, groenDossier, maakRuntimeBewijs,
  maakGetekendeVrijgave };
