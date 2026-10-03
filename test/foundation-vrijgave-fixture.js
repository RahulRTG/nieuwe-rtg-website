'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const extern = require('../server/config/external-release');
const releaseBewijs = require('../scripts/release-bewijs');
const trust = require('../server/config/release-trust');
const runnerTrust = require('../server/config/evidence-runner-trust');
const meter = require('../scripts/lib/extern-meter');
const imageHerkomst = require('../scripts/imageherkomst');
const { canon } = require('../server/kern/bewijsvlak/canon');
const { trustFixture } = require('./release-trust-fixture');

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
  imageVulnerabilityScan:'image-vulnerability-scan', connectionRealtime:'connection-realtime-turn',
  foundationMinderjarigen:'foundation'
});

function machineBewijs(naam, commit, status = 'PASS', sleutels = {}) {
  if (status === 'OUT_OF_SCOPE') return Buffer.from(JSON.stringify({
    formaat:'rtg-extern-bewijsverslag-v1', controle:naam, commit,
    gemeten:{ van:'2026-09-04T12:00:00.000Z', tot:'2026-09-04T12:00:00.000Z', duurMs:0 },
    uitkomst:'OUT_OF_SCOPE', requestSha256:null, redenen:[],
    gegevens:{ railDisabled:true, serverSidePaymentStop:true, releaseWithoutRail:true, controle:naam }
  }) + '\n');
  const rapport = { formaat:'rtg-extern-bewijsverslag-v1', controle:naam, commit,
    gemeten:{ van:'2026-09-04T12:00:00.000Z', tot:'2026-09-04T12:00:00.000Z', duurMs:0 },
    uitkomst:'PASS', requestSha256:null, redenen:[], gegevens:{} };
  if (extern.RUNNER_CONTROLES.includes(naam)) {
    const requestSha256 = crypto.createHash('sha256').update('request:' + naam).digest('hex');
    const common = { live:true, rtgOperationObserved:true, providerObserved:true, idempotent:true,
      chainIdSha256:'1'.repeat(64), provider:'stripe' };
    const itemManifest = { providerItemManifestVersion:'rtg-provider-items-v1',
      providerItemManifestSha256:'9'.repeat(64), providerItemManifestItems:3 };
    const money = {
      paymentProvider:{ ...common, paymentRefSha256:'2'.repeat(64), providerRetrieved:true,
        status:'succeeded', amountMinor:100, currency:'eur' },
      payoutProvider:{ ...common, payoutRefSha256:'3'.repeat(64), providerRetrieved:true,
        destinationVerified:true, status:'paid', amountMinor:100, currency:'eur' },
      webhookDelivery:{ ...common, ...itemManifest, eventRefSha256:'4'.repeat(64), signatureVerified:true,
        firstDeliveryAccepted:true, replayAttempted:true, replayDeduplicated:true,
        businessMutationCount:1, deliveryAttempts:2 },
      refundPayoutSettlement:{ ...common, paymentRefSha256:'2'.repeat(64),
        refundRefSha256:'5'.repeat(64), payoutRefSha256:'3'.repeat(64),
        refundStatus:'refunded', payoutStatus:'settled', refundAmountMinor:100,
        payoutAmountMinor:100, currency:'eur', doubleMutation:false },
      reconciliation:{ ...common, ...itemManifest, statementRefSha256:'6'.repeat(64), providerItems:3,
        ledgerItems:3, matchedItems:3, unmatchedProvider:0, unmatchedLedger:0,
        amountDeltaMinor:0, unknownOutcomes:0, reconciled:true }
    };
    const realtime = { distinctNetworkCount:2,
      networkASNsHashed:['7'.repeat(64), '8'.repeat(64)], turnCredentialsShortLived:true,
      relayCandidateA:true, relayCandidateB:true, selectedPairRelayOnly:true,
      connected:true, bytesAToB:65536, bytesBToA:65536, disconnectedCleanly:true };
    const meting = { format:runnerTrust.MEASUREMENT_FORMAT, runnerTrustVersion:'v1', control:naam, commit,
      correlationId:extern.GELD_CONTROLES.includes(naam) ? 'money-proof-12345678' : 'proof-'+naam,
      requestSha256, measurementId:'meter-'+naam,
      startedAt:'2026-09-04T12:00:00.000Z', finishedAt:'2026-09-04T12:00:01.000Z',
      observations:money[naam] || (naam === 'connectionRealtime' ? realtime : {}) };
    meting.signature = crypto.sign(null, meter.signaturePayload(meting),
      sleutels.runner.privateKey).toString('base64');
    const runnerPem = sleutels.runner.publicKey.export({ type:'spki', format:'pem' });
    rapport.requestSha256 = requestSha256;
    rapport.gegevens = { runnerTrustVersion:'v1', runnerKeySha256:extern.sha256(runnerPem),
      responseSha256:crypto.createHash('sha256').update(canon(meting)).digest('hex'),
      externalMeasurement:meting };
  }
  if (naam === 'imageVulnerabilityScan') {
    const digest = 'sha256:' + 'd'.repeat(64);
    const document = imageHerkomst.maakHerkomst({ image:'registry.example/rtg:candidate', digest,
      sbomBytes:Buffer.from('{"components":[]}'), sbomComponenten:0,
      bewijs:{ inhoudSha256:'e'.repeat(64), bestandAantal:1 },
      bron:{ commit, werkboomSchoon:true }, gemaakt:'2026-09-04T12:00:00.000Z' });
    document.handtekening = { algoritme:'ed25519',
      waarde:imageHerkomst.teken(document, sleutels.build.privateKey) };
    const buildPem = sleutels.build.publicKey.export({ type:'spki', format:'pem' });
    rapport.gegevens = { imageDigest:digest, release:{ inhoudSha256:'e'.repeat(64), bestandAantal:1 },
      candidateProvenance:{ canonicalSha256:extern.sha256(Buffer.from(canon(document))),
        buildKeySha256:extern.sha256(buildPem), document } };
  }
  return Buffer.from(JSON.stringify(rapport) + '\n');
}

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
    formaat:extern.FORMAAT, ondertekenDomein:trust.ROLES.EVIDENCE.domain, geslaagd:true, commit,
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
  const trustKeys = trustFixture(root, { EVIDENCE:sleutels,
    ...(opties.buildKeys ? { BUILD:opties.buildKeys } : {}) });
  const runnerKeys = opties.runnerKeys || crypto.generateKeyPairSync('ed25519');
  sleutels.runner = runnerKeys;
  fs.writeFileSync(path.join(root, runnerTrust.relatiefPad('v1')),
    runnerKeys.publicKey.export({ type:'spki', format:'pem' }));
  const dossier = groenDossier(commit);
  if (opties.moneyDisabled)
    for (const naam of extern.GELD_CONTROLES) dossier.controles[naam].status = 'OUT_OF_SCOPE';
  if (opties.wijzigDossier) opties.wijzigDossier(dossier);
  const hashes = {};
  for (const [controle, naam] of Object.entries(BESTANDSNAMEN)) {
    const status = dossier.controles[controle].status;
    const bytes = extern.MACHINE_CONTROLES.includes(controle)
      ? machineBewijs(controle, commit, status,
        { runner:runnerKeys, build:trustKeys.BUILD })
      : Buffer.from('extern bewijs voor ' + naam + '\n');
    fs.writeFileSync(path.join(bewijsMap, naam + '.bewijs'), bytes);
    hashes[naam] = extern.sha256(bytes);
    dossier.controles[controle].bewijs.sha256 = hashes[naam];
  }
  const dossierBytes = Buffer.from(JSON.stringify(dossier, null, 2) + '\n');
  fs.writeFileSync(path.join(releaseMap, 'external-release.json'), dossierBytes);
  const tekenSleutel = opties.tekenSleutel || sleutels.privateKey;
  fs.writeFileSync(path.join(releaseMap, 'external-release.sig'),
    trust.sign('EVIDENCE', dossierBytes, tekenSleutel) + '\n');
  if (opties.runtimeBewijs !== false) maakRuntimeBewijs(root, opties.runtimeCommit || commit);
  return { dossier, dossierBytes, bewijsMap, sleutels, trustKeys, runnerKeys };
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
