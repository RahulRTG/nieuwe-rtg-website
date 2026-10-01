/* DE BEWIJSVERSLAGEN VOOR HET EXTERNE DOSSIER (scripts/extern-bewijs.js).

   Wat hier beproefd wordt is het OORDEEL van elk verslag, niet de host: een
   verslag mag alleen PASS zeggen als het de proef werkelijk zag slagen, en een
   stap die alleen een mens kan zetten laat hem OPEN en nooit PASS. De ClamAV-
   kant draait tegen een nagemaakte clamd die het echte INSTREAM- en VERSION-
   protocol spreekt, zodat de echte client (server/kern/clamd.js) meedoet.

   Draai los: node --test test/extern-bewijs.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const crypto = require('node:crypto');
const bewijs = require('../scripts/extern-bewijs');
const meter = require('../scripts/lib/extern-meter');
const imageProef = require('../scripts/lib/image-vuln-proef');
const imageHerkomst = require('../scripts/imageherkomst');
const { maakClamd } = require('../server/kern/clamd');
const extern = require('../server/config/external-release');

const NU = Date.parse('2026-09-27T10:00:00Z');

/* Een clamd die VERSION beantwoordt met de gegeven definitiedatum en elke
   INSTREAM met de EICAR-reeks erin als besmet meldt -- tenzij `blind`. */
async function nepClamd({ versieDatum, blind = false } = {}) {
  const srv = net.createServer(sok => {
    let buf = Buffer.alloc(0);
    sok.on('data', stuk => {
      buf = Buffer.concat([buf, stuk]);
      if (buf.toString('latin1').startsWith('zVERSION\0'))
        return sok.end('ClamAV 1.3.1/27410/' + versieDatum + '\0');
      if (!buf.toString('latin1').startsWith('zINSTREAM\0')) return;
      if (!buf.subarray(buf.length - 4).equals(Buffer.alloc(4))) return;
      const raak = !blind && buf.toString('latin1').includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');
      sok.end(raak ? 'stream: Eicar-Test-Signature FOUND\0' : 'stream: OK\0');
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, clamd: () => maakClamd({ host: '127.0.0.1', port: srv.address().port, timeout: 2000 }) };
}

const basis = extra => Object.assign({ env: {}, commit: 'a'.repeat(40), nu: () => NU }, extra);

test('alle dossierproducenten horen bij echte releasecontroles, inclusief TURN', () => {
  for (const naam of Object.values(bewijs.CONTROLE))
    assert.ok(extern.ALLE_CONTROLES.includes(naam), naam);
  assert.equal(bewijs.CONTROLE.realtime, 'connectionRealtime');
  assert.equal(extern.ALLE_CONTROLES.includes('connectionRealtime'), true,
    'publieke voice/video mag niet READY worden op alleen TURN-configuratiestringen');
});

test('malware: actuele definities, EICAR geraakt en schoon door is PASS', async () => {
  const { srv, clamd } = await nepClamd({ versieDatum: 'Sat Sep 26 08:20:00 2026' });
  try {
    const uit = await bewijs.voer('malware', null, basis({ clamd }));
    assert.equal(uit.uitkomst, 'PASS', JSON.stringify(uit.redenen));
    assert.equal(uit.gegevens.eicar.verdict, 'besmet');
    assert.equal(uit.gegevens.schoon.verdict, 'schoon');
    assert.equal(uit.gegevens.leeftijdDagen, 1);
    assert.equal(uit.commit, 'a'.repeat(40));
  } finally { srv.close(); }
});

test('malware: oude definities of een scanner die EICAR mist is FAIL, met de reden', async () => {
  const oud = await nepClamd({ versieDatum: 'Mon Sep 14 08:20:00 2026' });
  try {
    const uit = await bewijs.voer('malware', null, basis({ clamd: oud.clamd }));
    assert.equal(uit.uitkomst, 'FAIL');
    assert.ok(uit.redenen.some(r => /13 dagen oud/.test(r)), uit.redenen.join('; '));
  } finally { oud.srv.close(); }
  const blind = await nepClamd({ versieDatum: 'Sat Sep 26 08:20:00 2026', blind: true });
  try {
    const uit = await bewijs.voer('malware', null, basis({ clamd: blind.clamd }));
    assert.equal(uit.uitkomst, 'FAIL');
    assert.ok(uit.redenen.some(r => /EICAR-proef werd NIET herkend/.test(r)));
  } finally { blind.srv.close(); }
  const geen = await bewijs.voer('malware', null, basis({ clamd: () => null }));
  assert.equal(geen.uitkomst, 'FAIL', 'zonder scanner is er niets om PASS over te zeggen');
});

test('objectopslag volgt de echte mediaproef, en een ontbrekende opslag is FAIL', async () => {
  const ok = await bewijs.voer('objectopslag', null, basis({ beproefMedia: async () => ({ ok: true, bytes: 96,
    sha256: 'b'.repeat(64), tweeInstanties: true, verwijderd: true }) }));
  assert.equal(ok.uitkomst, 'PASS');
  const weg = await bewijs.voer('objectopslag', null, basis({ beproefMedia: async () => ({ ok: false,
    reden: 'de gedeelde S3-mediastore is niet geconfigureerd' }) }));
  assert.equal(weg.uitkomst, 'FAIL');
  assert.match(weg.redenen[0], /niet geconfigureerd/);
});

function staten(voor, set) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rollbackproef-'));
  const staat = path.join(map, 'staat'), rollbackStaat = path.join(map, 'terug');
  if (voor) fs.writeFileSync(staat, voor.join('\n') + '\n');
  if (set) fs.writeFileSync(rollbackStaat, set.join('\n') + '\n');
  return { map, staat, rollbackStaat };
}

test('rollback: alleen een ECHTE wissel naar de bewezen set is PASS', async () => {
  const nieuw = ['img@sha256:1', 'bak@sha256:1', 'c'.repeat(64)], oud = ['img@sha256:0', 'bak@sha256:0', 'd'.repeat(64)];
  const s = staten(nieuw, oud);
  try {
    const draai = () => { fs.writeFileSync(s.staat, oud.join('\n') + '\n'); return { status: 0 }; };
    const uit = await bewijs.voer('rollback', null, basis({ staat: s.staat, rollbackStaat: s.rollbackStaat, draai }));
    assert.equal(uit.uitkomst, 'PASS', JSON.stringify(uit.redenen));
    assert.deepEqual(uit.gegevens.na, oud);
    const nogmaals = await bewijs.voer('rollback', null, basis({ staat: s.staat, rollbackStaat: s.rollbackStaat, draai }));
    assert.equal(nogmaals.uitkomst, 'FAIL', 'wie al op de rollbackset stond, heeft niets teruggezet');
    const kapot = await bewijs.voer('rollback', null, basis({ staat: s.staat, rollbackStaat: s.rollbackStaat,
      draai: () => ({ status: 65 }) }));
    assert.equal(kapot.uitkomst, 'FAIL');
  } finally { fs.rmSync(s.map, { recursive: true, force: true }); }
});

test('herstel: zonder de twee mensverklaringen OPEN, met beide PASS, en een mislukte route FAIL', async () => {
  const ok = () => ({ status: 0 });
  const zonder = await bewijs.voer('herstel', '20260815T030000Z', basis({ draai: ok }));
  assert.equal(zonder.uitkomst, 'OPEN');
  assert.equal(zonder.mensVerklaring, null);
  assert.equal(zonder.redenen.length, 2);
  const met = await bewijs.voer('herstel', '20260815T030000Z', basis({ draai: ok,
    env: { RTG_HERSTEL_LOGIN_GEZIEN: 'Beheerder A', RTG_HERSTEL_NAAM_GEZIEN: 'Beheerder A' } }));
  assert.equal(met.uitkomst, 'PASS');
  assert.equal(met.mensVerklaring.inlogGezienDoor, 'Beheerder A');
  const mis = await bewijs.voer('herstel', '20260815T030000Z', basis({ draai: () => ({ status: 1 }),
    env: { RTG_HERSTEL_LOGIN_GEZIEN: 'A', RTG_HERSTEL_NAAM_GEZIEN: 'A' } }));
  assert.equal(mis.uitkomst, 'FAIL', 'een mensverklaring maakt een mislukte route niet goed');
  const stempel = await bewijs.voer('herstel', 'gisteren', basis({ draai: ok }));
  assert.equal(stempel.uitkomst, 'FAIL');
});

test('het verslag komt met zijn hash op de plek die het dossier leest', async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-extern-'));
  try {
    const uit = await bewijs.voer('objectopslag', null, basis({ beproefMedia: async () => ({ ok: false, reden: 'x' }) }));
    const w = bewijs.schrijf('objectopslag', uit, map);
    assert.equal(path.basename(w.pad), 'object-storage-delivery.json');
    const bytes = fs.readFileSync(w.pad);
    assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'), w.sha256);
    assert.equal(JSON.parse(bytes).formaat, 'rtg-extern-bewijsverslag-v1');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

function externeMeting(control, observations) {
  return { stand:'OK', runnerTrustVersion:'v1', runnerKeySha256:'9'.repeat(64), responseSha256:'8'.repeat(64),
    meting:{ format:meter.FORMAAT, runnerTrustVersion:'v1', control, commit:'a'.repeat(40), correlationId:'proef-12345678',
      requestSha256:'7'.repeat(64),
      measurementId:'meter-12345678', startedAt:new Date(NU).toISOString(),
      finishedAt:new Date(NU).toISOString(), observations, signature:Buffer.alloc(64).toString('base64') } };
}

test('de externe runner wordt cryptografisch aan controle, commit en proef-ID gebonden', async () => {
  const paar = crypto.generateKeyPairSync('ed25519');
  const publiek = paar.publicKey.export({ type:'spki', format:'pem' }).toString();
  const teken = (req, wijzig) => {
    const body = { format:meter.FORMAAT, runnerTrustVersion:req.runnerTrustVersion,
      control:req.control, commit:req.commit,
      correlationId:req.correlationId, measurementId:'meter-12345678',
      requestSha256:req.requestSha256, startedAt:req.requestedAt, finishedAt:req.requestedAt,
      observations:{ measured:true } };
    const signature = crypto.sign(null, meter.signaturePayload(body), paar.privateKey).toString('base64');
    return { ...body, signature, ...(wijzig || {}) };
  };
  const opties = { commit:'a'.repeat(40), nu:() => NU, randomUUID:() => 'proef-12345678',
    runnerPublicKey:publiek, runnerCall:req => teken(req) };
  const ok = await meter.meet('observabilityIncident', { test:true }, opties);
  assert.equal(ok.stand, 'OK', JSON.stringify(ok.redenen));
  assert.match(ok.meting.requestSha256, /^[a-f0-9]{64}$/);
  assert.equal(ok.meting.signature.length > 80, true, 'de verifieerbare attestatie blijft in het bewijs');

  const verkeerdeCommit = await meter.meet('observabilityIncident', {}, {
    ...opties, runnerCall:req => teken(req, { commit:'b'.repeat(40) }) });
  assert.equal(verkeerdeCommit.stand, 'FAIL');
  const verkeerdVerzoek = await meter.meet('observabilityIncident', {}, {
    ...opties, runnerCall:req => {
      const antwoord = teken(req);
      const body = { ...antwoord, requestSha256:'0'.repeat(64) }; delete body.signature;
      return { ...body, signature:crypto.sign(null, meter.signaturePayload(body), paar.privateKey).toString('base64') };
    } });
  assert.equal(verkeerdVerzoek.stand, 'FAIL', 'een geldig getekend antwoord voor een ander verzoek is geen bewijs');
  const extraGeheim = await meter.meet('observabilityIncident', {}, {
    ...opties, runnerCall:req => teken(req, { rawProviderSecret:'mag-nooit-in-bewijs' }) });
  assert.equal(extraGeheim.stand, 'FAIL', 'onbekende velden worden vóór opslag geweigerd');
  const ongetekend = await meter.meet('observabilityIncident', {}, {
    ...opties, runnerCall:req => ({ ...teken(req), signature:'' }) });
  assert.equal(ongetekend.stand, 'FAIL');
});

test('de meetrunner gebruikt alleen een versiegebonden gecommit trustanker', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-runner-trust-'));
  t.after(() => fs.rmSync(root, { recursive:true, force:true }));
  fs.mkdirSync(path.join(root, 'deploy'), { recursive:true });
  const paar = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(path.join(root, 'deploy', 'evidence-runner-v1.pub'),
    paar.publicKey.export({ type:'spki', format:'pem' }));
  const env = { RTG_EVIDENCE_RUNNER_URL:'https://runner.rtg.example/probe',
    RTG_EVIDENCE_RUNNER_TOKEN:'x'.repeat(32), RTG_EVIDENCE_RUNNER_TRUST_VERSION:'v1' };
  const cfg = meter.configuratie(env, root);
  assert.equal(cfg.runnerTrustVersion, 'v1');
  assert.match(cfg.sleutelSha256, /^[a-f0-9]{64}$/);
  assert.match(meter.configuratie({ ...env,
    RTG_EVIDENCE_RUNNER_PUBLIC_KEY_FILE:'/tmp/losse-sleutel.pub' }, root).fout,
  /niet toegestaan/, 'een runtimepad mag het gecommitte trustanker niet vervangen');
  assert.match(meter.configuratie({ ...env, RTG_EVIDENCE_RUNNER_TRUST_VERSION:'v2' }, root).fout,
    /gepin/, 'een niet-gecommitte ankerversie faalt gesloten');
});

test('TLS/rand en incident worden pas PASS na echte externe waarnemingen', async () => {
  const randObs = { probeBounded:true, vantageCount:3, distinctNetworkCount:3, tlsTrustedAll:true,
    edgeProtectionActive:true, originDirectReachable:false, mitigationObserved:true, requests:600,
    availabilityRatio:.999, providerConfigObserved:true };
  const rand = await bewijs.voer('rand', null, basis({ env:{ APP_URL:'https://app.rtg.example' },
    tlsProef:async () => ({ appUrl:'https://app.rtg.example', tls:{ fingerprint256:'AA:BB' } }),
    meetExtern:async control => externeMeting(control, randObs) }));
  assert.equal(rand.uitkomst, 'PASS', rand.redenen.join('; '));
  const oorsprongOpen = await bewijs.voer('rand', null, basis({ env:{}, tlsProef:async()=>({}) }));
  assert.equal(oorsprongOpen.uitkomst, 'OPEN');
  const lek = await bewijs.voer('rand', null, basis({ env:{ APP_URL:'https://app.rtg.example' },
    tlsProef:async () => ({ appUrl:'https://app.rtg.example', tls:{ fingerprint256:'AA:BB' } }),
    meetExtern:async control => externeMeting(control,{ ...randObs, rawOriginToken:'mag-niet-bewaren' }) }));
  assert.equal(lek.uitkomst, 'FAIL');
  assert.equal(JSON.stringify(lek).includes('mag-niet-bewaren'), false, 'verworpen runnerinhoud lekt niet in rood bewijs');

  const incidentObs = { alarmReceived:true, markerMatched:true, incidentCreated:true,
    acknowledged:true, resolved:true, deliveryLatencyMs:120, acknowledgementLatencyMs:900,
    recoveryLatencyMs:2400 };
  const incident = await bewijs.voer('incident', null, basis({ env:{}, uuid:()=>'proef-12345678',
    beproefAlarm:async (_e,opties) => ({ ok:true, status:204, doelSha256:'7'.repeat(64), marker:opties.door }),
    meetExtern:async (control,_input,extra) => {
      assert.equal(extra.correlationId, 'proef-12345678'); return externeMeting(control, incidentObs);
    } }));
  assert.equal(incident.uitkomst, 'PASS', incident.redenen.join('; '));
  const nietOntvangen = await bewijs.voer('incident', null, basis({ env:{}, uuid:()=>'proef-12345678',
    beproefAlarm:async () => ({ ok:false, reden:'collector onbereikbaar' }) }));
  assert.equal(nietOntvangen.uitkomst, 'FAIL');
});

test('e-mailherstel bewijst route, inbox, link en mailauthenticatie zonder adres te publiceren', async () => {
  const email = 'release-proef@rtg.example';
  const obs = { delivered:true, recipientMatched:true, subjectMatched:true, resetLinkPresent:true,
    resetLinkHttps:true, resetLinkOriginMatched:true, recoveryPageStatus:200, spf:'pass', dkim:'pass',
    dmarc:'pass', deliveryLatencyMs:2300, messageIdSha256:'6'.repeat(64) };
  const uit = await bewijs.voer('mailherstel', null, basis({
    env:{ APP_URL:'https://app.rtg.example', RTG_EVIDENCE_RECOVERY_EMAIL:email },
    uuid:()=>'proef-12345678', startRecovery:async x => { assert.equal(x.email,email); return { status:200,ok:true }; },
    meetExtern:async (control,input) => { assert.equal(input.recipient,email); return externeMeting(control,obs); }
  }));
  assert.equal(uit.uitkomst, 'PASS', uit.redenen.join('; '));
  assert.equal(JSON.stringify(uit.gegevens).includes(email), false, 'adres staat alleen gehasht in het verslag');
  const geenAccount = await bewijs.voer('mailherstel', null, basis({ env:{ APP_URL:'https://app.rtg.example' } }));
  assert.equal(geenAccount.uitkomst, 'OPEN');
});

test('de vijf geldcontroles delen één begrensde liveketen en weigeren façadebewijs', async () => {
  const chain = 'release-money-chain-2026-001';
  const chainHash = crypto.createHash('sha256').update(chain).digest('hex');
  const env = { RTG_EVIDENCE_MONEY_CHAIN_ID:chain, RTG_EVIDENCE_MONEY_AUTHORIZATION_REF:'CAB-2048',
    RTG_EVIDENCE_MONEY_MAX_MINOR:'500', RTG_EVIDENCE_MONEY_CURRENCY:'eur' };
  const common = { live:true, rtgOperationObserved:true, providerObserved:true, idempotent:true,
    chainIdSha256:chainHash, provider:'stripe' };
  const itemManifest = { providerItemManifestVersion:'rtg-provider-items-v1',
    providerItemManifestSha256:'9'.repeat(64), providerItemManifestItems:3 };
  const per = {
    paymentProvider:{ ...common, paymentRefSha256:'1'.repeat(64), providerRetrieved:true,
      status:'succeeded', amountMinor:100, currency:'eur' },
    payoutProvider:{ ...common, payoutRefSha256:'2'.repeat(64), providerRetrieved:true,
      destinationVerified:true, status:'paid', amountMinor:100, currency:'eur' },
    webhookDelivery:{ ...common, ...itemManifest, eventRefSha256:'3'.repeat(64), signatureVerified:true,
      firstDeliveryAccepted:true, replayAttempted:true, replayDeduplicated:true,
      businessMutationCount:1, deliveryAttempts:2 },
    refundPayoutSettlement:{ ...common, paymentRefSha256:'1'.repeat(64), refundRefSha256:'4'.repeat(64),
      payoutRefSha256:'2'.repeat(64), refundStatus:'refunded', payoutStatus:'settled',
      refundAmountMinor:100, payoutAmountMinor:100, currency:'eur', doubleMutation:false },
    reconciliation:{ ...common, ...itemManifest, statementRefSha256:'5'.repeat(64), providerItems:3, ledgerItems:3,
      matchedItems:3, unmatchedProvider:0, unmatchedLedger:0, amountDeltaMinor:0,
      unknownOutcomes:0, reconciled:true }
  };
  const soorten = { betaling:'paymentProvider', uitbetaling:'payoutProvider', webhook:'webhookDelivery',
    geldlus:'refundPayoutSettlement', reconciliatie:'reconciliation' };
  for (const [soort,control] of Object.entries(soorten)) {
    const uit = await bewijs.voer(soort, null, basis({ env,
      meetExtern:async (naam,input,extra) => { assert.equal(naam,control); assert.equal(input.chainId,chain);
        assert.equal(extra.correlationId, 'money-'+chainHash.slice(0,48));
        return externeMeting(naam,per[naam]); } }));
    assert.equal(uit.uitkomst, 'PASS', soort + ': ' + uit.redenen.join('; '));
  }
  const replayLeugen = { ...per.webhookDelivery, businessMutationCount:2 };
  const rood = await bewijs.voer('webhook', null, basis({ env,
    meetExtern:async c => externeMeting(c,replayLeugen) }));
  assert.equal(rood.uitkomst, 'FAIL');
  const zonderAutorisatie = await bewijs.voer('betaling', null, basis({ env:{},
    meetExtern:async () => { throw new Error('mag niet worden aangeroepen'); } }));
  assert.equal(zonderAutorisatie.uitkomst, 'OPEN');
  const railUit = await bewijs.voer('betaling', null, basis({ env:{ RTG_BETALEN_UIT:'1',
    RTG_RELEASE_ZONDER_RAIL:'1' }, meetExtern:async()=>{ throw new Error('rail mag niet worden geraakt'); } }));
  assert.equal(railUit.uitkomst, 'OUT_OF_SCOPE');
  assert.equal(railUit.gegevens.serverSidePaymentStop, true);
});

test('TURN-bewijs vereist twee netwerken, relay-only en echte bytes in beide richtingen', async () => {
  const obs = { distinctNetworkCount:2, networkASNsHashed:['1'.repeat(64),'2'.repeat(64)],
    turnCredentialsShortLived:true, relayCandidateA:true, relayCandidateB:true,
    selectedPairRelayOnly:true, connected:true, bytesAToB:65536, bytesBToA:70000,
    disconnectedCleanly:true };
  const goed = await bewijs.voer('realtime', null, basis({ env:{ APP_URL:'https://app.rtg.example' },
    meetExtern:async c => externeMeting(c,obs) }));
  assert.equal(goed.uitkomst, 'PASS', goed.redenen.join('; '));
  const geenRelay = await bewijs.voer('realtime', null, basis({ env:{ APP_URL:'https://app.rtg.example' },
    meetExtern:async c => externeMeting(c,{ ...obs, selectedPairRelayOnly:false }) }));
  assert.equal(geenRelay.uitkomst, 'FAIL');
});

test('imagescan bindt scanner, verse database en exacte image-digest aan de commit', () => {
  const digest = 'd'.repeat(64), commit = 'a'.repeat(40);
  const build = crypto.generateKeyPairSync('ed25519');
  const sbomBytes = Buffer.from('{"components":[]}');
  const provenanceDocument = imageHerkomst.maakHerkomst({ image:'registry.example/rtg:candidate',
    digest:'sha256:'+digest, sbomBytes, sbomComponenten:0,
    bewijs:{ inhoudSha256:'e'.repeat(64), bestandAantal:120 },
    bron:{ commit, werkboomSchoon:true }, gemaakt:new Date(NU).toISOString() });
  provenanceDocument.handtekening = { algoritme:'ed25519',
    waarde:imageHerkomst.teken(provenanceDocument, build.privateKey) };
  const buildPublicKey = build.publicKey.export({ type:'spki', format:'pem' });
  function spawn(_cmd,args) {
    if (args[0] === '--version') return { status:0, stdout:'Version: 1.0\nUpdatedAt: 2026-09-27T09:00:00Z\n', stderr:'' };
    if (args[0] === 'run') return { status:0, stdout:JSON.stringify({ formaat:'rtg-release-bewijs-v1',
      bron:{ commit, gewijzigd:false }, inhoudSha256:'e'.repeat(64), bestandAantal:120 }), stderr:'' };
    return { status:0, stdout:JSON.stringify({ Results:[{ Vulnerabilities:[] }] }), stderr:'' };
  }
  const groen = imageProef.voer({ env:{ RTG_CANDIDATE_IMAGE:'registry.example/rtg@sha256:'+digest,
    RTG_IMAGE_SCANNER:'trivy' }, commit, nu:() => NU, spawnSync:spawn,
    provenanceDocument, buildPublicKey });
  assert.equal(groen.stand, 'OK', groen.redenen.join('; '));
  assert.equal(groen.gegevens.imageDigest, 'sha256:'+digest);
  const tag = imageProef.voer({ env:{ RTG_CANDIDATE_IMAGE:'registry.example/rtg:latest' }, commit, nu:()=>NU, spawnSync:spawn });
  assert.equal(tag.stand, 'FAIL');
  const kwetsbaar = imageProef.voer({ env:{ RTG_CANDIDATE_IMAGE:'registry.example/rtg@sha256:'+digest,
    RTG_IMAGE_SCANNER:'trivy' }, commit, nu:() => NU, provenanceDocument, buildPublicKey,
    spawnSync:(cmd,args) => {
      if (args[0] === '--version' || args[0] === 'run') return spawn(cmd,args);
      return { status:0, stdout:JSON.stringify({ Results:[{ Vulnerabilities:[{ Severity:'CRITICAL' }] }] }), stderr:'' };
    } });
  assert.equal(kwetsbaar.stand, 'FAIL');
  const andereDigest = imageProef.voer({ env:{ RTG_CANDIDATE_IMAGE:'registry.example/rtg@sha256:'+'f'.repeat(64),
    RTG_IMAGE_SCANNER:'trivy' }, commit, nu:() => NU, spawnSync:spawn,
    provenanceDocument, buildPublicKey });
  assert.equal(andereDigest.stand, 'FAIL', 'de scanner mag geen andere digest dan de getekende kandidaat bewijzen');
});
