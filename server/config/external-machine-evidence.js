'use strict';

/* Machinebewijs blijft zelfstandig herverifieerbaar nadat een beoordelaar het
   dossier tekent. Deze laag toetst runner-, build- en geldketenprovenance; de
   dossierlaag ernaast bezit alleen bestandshashes en releasebevoegdheid. */
const crypto = require('node:crypto');
const trust = require('./release-trust');
const runnerTrust = require('./evidence-runner-trust');
const { keurRealtimeWaarneming } = require('./connection-realtime-evidence');
const { canon } = require('../kern/bewijsvlak/canon');

const GELD_CONTROLES = Object.freeze(['paymentProvider', 'payoutProvider', 'webhookDelivery',
  'refundPayoutSettlement', 'reconciliation']);
const MACHINE_CONTROLES = Object.freeze([
  'tlsDdosRand', 'backupHerstel', 'deploymentRollback', 'observabilityIncident',
  ...GELD_CONTROLES, 'emailDeliveryRecovery', 'malwareDefinitionsScan',
  'objectStorage', 'imageVulnerabilityScan', 'connectionRealtime'
]);
const RUNNER_CONTROLES = Object.freeze([
  'tlsDdosRand', 'observabilityIncident', ...GELD_CONTROLES,
  'emailDeliveryRecovery', 'connectionRealtime'
]);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function verifieerImageProvenance(rapport, commit, buildAnchor) {
  const g = rapport.gegevens || {};
  const binding = g.candidateProvenance || {};
  const document = binding.document;
  if (!document || document.formaat !== 'rtg-herkomst-v2' ||
      document.ondertekenDomein !== trust.ROLES.BUILD.domain ||
      !document.handtekening || document.handtekening.algoritme !== 'ed25519' ||
      !/^sha256:[a-f0-9]{64}$/.test(String(g.imageDigest || '')) ||
      !/^[a-f0-9]{64}$/.test(String(binding.canonicalSha256 || '')) ||
      !/^[a-f0-9]{64}$/.test(String(binding.buildKeySha256 || '')))
    throw new Error('image-scan-kandidaatherkomst-ontbreekt');
  const zonder = { ...document }; delete zonder.handtekening;
  if (!trust.verify('BUILD', Buffer.from(canon(zonder)), document.handtekening.waarde, buildAnchor.key))
    throw new Error('image-scan-kandidaatherkomst-handtekening-ongeldig');
  if (binding.canonicalSha256 !== sha256(Buffer.from(canon(document))) ||
      binding.buildKeySha256 !== sha256(buildAnchor.bytes))
    throw new Error('image-scan-kandidaatherkomst-hash-wijkt-af');
  if (!document.image || document.image.digest !== g.imageDigest ||
      !document.bron || document.bron.commit !== commit || document.bron.werkboomSchoon !== true ||
      !document.releasebewijs || !g.release ||
      document.releasebewijs.inhoudSha256 !== g.release.inhoudSha256)
    throw new Error('image-scan-digest-is-niet-aan-getekende-kandidaat-gebonden');
}

function verifieerRunnerMeting(g, meting, trustRoot) {
  let anker;
  try { anker = runnerTrust.laad(trustRoot, meting.runnerTrustVersion); }
  catch (e) { throw new Error('runner-trustanker-ongeldig'); }
  if (g.runnerTrustVersion !== anker.version || g.runnerKeySha256 !== anker.sha256)
    throw new Error('runner-trustanker-wijkt-af');
  const ongetekend = { ...meting }; delete ongetekend.signature;
  if (!runnerTrust.verifieer(ongetekend, meting.signature, anker.key))
    throw new Error('runner-handtekening-klopt-niet-bij-gepind-anker');
}

function machineRapport(bytes, naam, commit, status, context = {}) {
  let rapport;
  try { rapport = JSON.parse(bytes.toString('utf8')); }
  catch (e) { throw new Error('machine-rapport-onleesbaar:' + naam); }
  if (!rapport || rapport.formaat !== 'rtg-extern-bewijsverslag-v1' ||
      rapport.controle !== naam || rapport.commit !== commit)
    throw new Error('machine-rapport-provenance-wijkt-af:' + naam);
  if (status === 'OUT_OF_SCOPE') {
    const g = rapport.gegevens || {};
    if (!GELD_CONTROLES.includes(naam) || rapport.uitkomst !== 'OUT_OF_SCOPE' ||
        g.railDisabled !== true || g.serverSidePaymentStop !== true ||
        g.releaseWithoutRail !== true || g.controle !== naam)
      throw new Error('rail-disabled-bewijs-ongeldig:' + naam);
    if (rapport.requestSha256 !== null)
      throw new Error('rail-disabled-bewijs-mag-geen-providerverzoek-claimen:' + naam);
    return rapport;
  }
  if (rapport.uitkomst !== 'PASS') throw new Error('machine-rapport-niet-pass:' + naam);
  if (RUNNER_CONTROLES.includes(naam)) {
    const g = rapport.gegevens || {}, meting = g.externalMeasurement || {};
    if (!/^[a-f0-9]{64}$/.test(String(rapport.requestSha256 || '')) ||
        rapport.requestSha256 !== meting.requestSha256 ||
        meting.format !== runnerTrust.MEASUREMENT_FORMAT || meting.control !== naam ||
        meting.commit !== commit || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/.test(String(meting.correlationId || '')) ||
        meting.runnerTrustVersion !== g.runnerTrustVersion ||
        !/^[a-f0-9]{64}$/.test(String(g.runnerKeySha256 || '')) ||
        !/^[a-f0-9]{64}$/.test(String(g.responseSha256 || '')) ||
        sha256(Buffer.from(canon(meting))) !== g.responseSha256)
      throw new Error('runner-rapport-verzoek-of-provenance-ongeldig:' + naam);
    verifieerRunnerMeting(g, meting, context.trustRoot);
    if (naam === 'connectionRealtime') {
      try { keurRealtimeWaarneming(meting.observations); }
      catch (e) { throw new Error('machine-realtime-bewijs-ongeldig:' + String(e.message || e)); }
    }
  } else if (rapport.requestSha256 !== null) {
    throw new Error('lokaal-machine-rapport-heeft-onverwacht-providerverzoek:' + naam);
  }
  if (naam === 'imageVulnerabilityScan')
    verifieerImageProvenance(rapport, commit, context.buildAnchor);
  return rapport;
}

function geldKeten(rapporten) {
  const geld = GELD_CONTROLES.map(naam => rapporten.get(naam));
  const uit = new Set(geld.map(r => r.uitkomst));
  if (uit.size !== 1) throw new Error('geldketen-mengt-live-en-uitgeschakelde-rail');
  if (uit.has('OUT_OF_SCOPE')) return 'RAIL_DISABLED';
  if (!uit.has('PASS')) throw new Error('geldketen-is-niet-pass');
  const metingen = geld.map(r => r.gegevens.externalMeasurement);
  const obs = metingen.map(m => m.observations || {});
  const zelfde = (waarden, reden) => {
    if (new Set(waarden.map(String)).size !== 1) throw new Error(reden);
    return waarden[0];
  };
  zelfde(metingen.map(m => m.correlationId), 'geldketen-correlation-wijkt-af');
  zelfde(obs.map(o => o.chainIdSha256), 'geldketen-business-chain-wijkt-af');
  zelfde(obs.map(o => o.provider), 'geldketen-provider-wijkt-af');
  const [betaling, uitbetaling, webhook, sluiting, reconciliatie] = obs;
  if (betaling.paymentRefSha256 !== sluiting.paymentRefSha256 ||
      uitbetaling.payoutRefSha256 !== sluiting.payoutRefSha256)
    throw new Error('geldketen-referenties-wijken-af');
  if (betaling.amountMinor !== sluiting.refundAmountMinor ||
      uitbetaling.amountMinor !== sluiting.payoutAmountMinor ||
      betaling.currency !== sluiting.currency || uitbetaling.currency !== sluiting.currency)
    throw new Error('geldketen-bedragen-of-valuta-wijken-af');
  if (webhook.providerItemManifestVersion !== 'rtg-provider-items-v1' ||
      reconciliatie.providerItemManifestVersion !== 'rtg-provider-items-v1' ||
      webhook.providerItemManifestSha256 !== reconciliatie.providerItemManifestSha256 ||
      webhook.providerItemManifestItems !== reconciliatie.providerItemManifestItems ||
      reconciliatie.providerItems !== reconciliatie.providerItemManifestItems)
    throw new Error('geldketen-provideritemmanifest-wijkt-af');
  return 'LIVE';
}

module.exports = { GELD_CONTROLES, MACHINE_CONTROLES, RUNNER_CONTROLES,
  machineRapport, geldKeten, verifieerImageProvenance, verifieerRunnerMeting };
