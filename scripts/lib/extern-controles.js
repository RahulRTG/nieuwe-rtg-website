/* Inhoudelijke poorten voor externe releaseproeven. De runner levert alleen
   ondertekende waarnemingen; dit bestand beslist lokaal of die waarnemingen de
   controle werkelijk dragen. Onbekende velden worden geweigerd zodat een
   providerreferentie of e-mailadres niet per ongeluk in het dossier belandt. */
'use strict';

const crypto = require('node:crypto');

const HASH = /^[a-f0-9]{64}$/;
const hash = waarde => crypto.createHash('sha256').update(String(waarde)).digest('hex');
const geheel = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;

function alleen(o, namen) {
  const vreemd = Object.keys(o || {}).filter(k => !namen.includes(k));
  if (vreemd.length) throw new Error('de waarneming bevat onbekende velden');
}
function ja(v, naam) { if (v !== true) throw new Error(naam + ' is niet daadwerkelijk gemeten'); }
function h(v, naam) { if (!HASH.test(String(v || ''))) throw new Error(naam + ' mist een SHA-256-verwijzing'); }
function meta(r) { return { runnerTrustVersion:r.runnerTrustVersion,
  runnerKeySha256:r.runnerKeySha256, responseSha256:r.responseSha256,
  externalMeasurement:r.meting }; }
function verworpen(r) { const m=r.meting||{}; return { runnerTrustVersion:r.runnerTrustVersion,
  runnerKeySha256:r.runnerKeySha256,
  responseSha256:r.responseSha256, rejectedMeasurement:{ control:m.control, commit:m.commit,
    correlationId:m.correlationId, measurementId:m.measurementId, startedAt:m.startedAt, finishedAt:m.finishedAt } }; }
function uitslag(r, keur) {
  if (!r || r.stand !== 'OK') return { stand:(r && r.stand) || 'FAIL',
    redenen:(r && r.redenen) || ['de externe meetrunner gaf geen uitslag'] };
  try { keur(r.meting.observations); return { stand:'OK', redenen:[], gegevens:meta(r) }; }
  catch (e) { return { stand:'FAIL', redenen:[String(e && e.message || e).slice(0, 400)], gegevens:verworpen(r) }; }
}
function id(o) { return (o.uuid || crypto.randomUUID)(); }

async function tlsRand(o) {
  const appUrl = String(o.env.APP_URL || '');
  if (!appUrl) return { stand:'OPEN', redenen:['APP_URL ontbreekt'] };
  let tls;
  try { tls = await o.tlsProef({ appUrl, eisReleaseCommit:true, releaseCommit:o.commit }); }
  catch (e) { return { stand:'FAIL', redenen:['de publieke TLS-proef faalde: ' + String(e.message || e)] }; }
  const r = await o.meetExtern('tlsDdosRand', { appUrl:tls.appUrl,
    tlsFingerprintSha256:hash(tls.tls && tls.tls.fingerprint256),
    probe:'bounded-edge-resilience-v1', maxRequests:1000 });
  const uit = uitslag(r, x => {
    alleen(x, ['probeBounded','vantageCount','distinctNetworkCount','tlsTrustedAll','edgeProtectionActive',
      'originDirectReachable','mitigationObserved','requests','availabilityRatio','providerConfigObserved']);
    ja(x.probeBounded, 'begrensde randproef');
    if (!geheel(x.vantageCount, 2, 100) || !geheel(x.distinctNetworkCount, 2, 100))
      throw new Error('de randproef kwam niet vanaf minstens twee onafhankelijke netwerken');
    ja(x.tlsTrustedAll, 'TLS vanaf alle meetpunten'); ja(x.edgeProtectionActive, 'randbescherming');
    if (x.originDirectReachable !== false) throw new Error('de origin is rechtstreeks bereikbaar of dat is niet uitgesloten');
    ja(x.mitigationObserved, 'mitigatie'); ja(x.providerConfigObserved, 'providerconfiguratie');
    if (!geheel(x.requests, 100, 1000) || typeof x.availabilityRatio !== 'number' || x.availabilityRatio < .99 || x.availabilityRatio > 1)
      throw new Error('de begrensde randproef mist voldoende verzoeken of beschikbaarheid');
  });
  uit.gegevens = { ...(uit.gegevens || {}), publiekeTls:tls };
  return uit;
}

async function incident(o) {
  const correlationId = id(o);
  const marker = 'rtg-release-incident:' + o.commit + ':' + correlationId;
  const alarm = await o.beproefAlarm(o.env, { door:marker });
  if (!alarm || alarm.ok !== true) return { stand:'FAIL',
    redenen:[String(alarm && alarm.reden || 'de externe alarmuitgang accepteerde de proef niet')], gegevens:{ alarm:alarm || null } };
  const r = await o.meetExtern('observabilityIncident', { marker, alarmTargetSha256:alarm.doelSha256 }, { correlationId });
  const uit = uitslag(r, x => {
    alleen(x, ['alarmReceived','markerMatched','incidentCreated','acknowledged','resolved',
      'deliveryLatencyMs','acknowledgementLatencyMs','recoveryLatencyMs']);
    for (const k of ['alarmReceived','markerMatched','incidentCreated','acknowledged','resolved']) ja(x[k], k);
    for (const k of ['deliveryLatencyMs','acknowledgementLatencyMs','recoveryLatencyMs'])
      if (!geheel(x[k], 0, 86400000)) throw new Error(k + ' ontbreekt of is ongeldig');
  });
  uit.gegevens = { ...(uit.gegevens || {}), alarm:{ status:alarm.status, doelSha256:alarm.doelSha256 } };
  return uit;
}

async function emailHerstel(o) {
  const appUrl = String(o.env.APP_URL || '');
  const email = String(o.env.RTG_EVIDENCE_RECOVERY_EMAIL || '').trim().toLowerCase();
  if (!appUrl || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { stand:'OPEN', redenen:['APP_URL of RTG_EVIDENCE_RECOVERY_EMAIL ontbreekt/ongeldig'] };
  const correlationId = id(o), begonnen = o.nu();
  const start = await o.startRecovery({ appUrl, email, correlationId });
  if (!start || start.status !== 200 || start.ok !== true)
    return { stand:'FAIL', redenen:['de publieke herstelroute accepteerde de proef niet'], gegevens:{ status:start && start.status } };
  const r = await o.meetExtern('emailDeliveryRecovery', { appUrl, recipient:email,
    recipientSha256:hash(email), requestedAfter:new Date(begonnen).toISOString() }, { correlationId });
  const uit = uitslag(r, x => {
    alleen(x, ['delivered','recipientMatched','subjectMatched','resetLinkPresent','resetLinkHttps',
      'resetLinkOriginMatched','recoveryPageStatus','spf','dkim','dmarc','deliveryLatencyMs','messageIdSha256']);
    for (const k of ['delivered','recipientMatched','subjectMatched','resetLinkPresent','resetLinkHttps','resetLinkOriginMatched']) ja(x[k], k);
    if (x.recoveryPageStatus !== 200) throw new Error('de ontvangen herstellink opent geen echte herstelpagina');
    if (![x.spf,x.dkim,x.dmarc].every(v => v === 'pass')) throw new Error('SPF, DKIM en DMARC zijn niet alle drie PASS');
    if (!geheel(x.deliveryLatencyMs, 0, 3600000)) throw new Error('de bezorgtijd ontbreekt of is ongeldig');
    h(x.messageIdSha256, 'Message-ID');
  });
  uit.gegevens = { ...(uit.gegevens || {}), aanvraag:{ status:start.status, recipientSha256:hash(email) } };
  return uit;
}

async function realtime(o) {
  const appUrl = String(o.env.APP_URL || '');
  if (!appUrl) return { stand:'OPEN', redenen:['APP_URL ontbreekt'] };
  const r = await o.meetExtern('connectionRealtime', { appUrl, forceRelay:true,
    requiredDistinctNetworks:2, bidirectionalPayloadBytes:65536 });
  return uitslag(r, x => {
    alleen(x, ['distinctNetworkCount','networkASNsHashed','turnCredentialsShortLived','relayCandidateA',
      'relayCandidateB','selectedPairRelayOnly','connected','bytesAToB','bytesBToA','disconnectedCleanly']);
    if (x.distinctNetworkCount < 2 || !Array.isArray(x.networkASNsHashed) || x.networkASNsHashed.length < 2 ||
        !x.networkASNsHashed.every(v => HASH.test(String(v)))) throw new Error('de proef liep niet over twee bewezen verschillende netwerken');
    for (const k of ['turnCredentialsShortLived','relayCandidateA','relayCandidateB','selectedPairRelayOnly','connected','disconnectedCleanly']) ja(x[k], k);
    if (!geheel(x.bytesAToB, 65536, 100000000) || !geheel(x.bytesBToA, 65536, 100000000))
      throw new Error('er zijn geen bidirectionele payloadbytes via TURN gemeten');
  });
}

module.exports = { tlsRand, incident, emailHerstel, realtime, _alleen:alleen };
