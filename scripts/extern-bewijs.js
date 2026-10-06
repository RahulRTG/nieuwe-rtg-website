#!/usr/bin/env node
/* ============================================================================
   BEWIJSVERSLAGEN VOOR HET EXTERNE VRIJGAVEDOSSIER -- het meetbare deel.

   Het externe dossier (server/config/external-release.js) eist per controle een
   bewijsbestand met een pinnende hash, getekend door een beoordelaar. Voor
   menselijke rapporten blijft diens beoordeling leidend; machineverslagen
   worden daarnaast door de releasepoort zelf op PASS/commit/control/verzoek
   en, bij geld, op één samenhangende businessketen gecontroleerd. Een mens
   kan een rood of verwisseld machinerapport dus niet alsnog groen tekenen.

   Dit script VOERT de proef uit op de echte host en schrijft wat het zag. De
   herstel-, rollback-, malware- en objectopslagproeven lopen lokaal. Externe
   rails lopen via een onafhankelijke Ed25519-meetrunner die exact commit en
   proef-ID moet terugtekenen. Een los providerwoord `PASS` is nooit genoeg.

   Elk verslag draagt de commit en PASS, FAIL of OPEN. OPEN betekent dat echte
   externe/provider- of mensinvoer ontbreekt; het wordt nooit groen gemaakt.
   ========================================================================== */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const externe = require('./lib/extern-controles');
const externGeld = require('./lib/extern-geldcontroles');
const externeMeter = require('./lib/extern-meter');
const imageVuln = require('./lib/image-vuln-proef');
const lokaal = require('./lib/extern-lokale-controles');

const ROOT = path.join(__dirname, '..');
const DOEL = path.join(ROOT, '.release', 'external-evidence');
const BESTAND = {
  herstel: 'backup-herstel.json',
  rollback: 'deployment-rollback.json',
  malware: 'malware-definitions-scan.json',
  objectopslag: 'object-storage-delivery.json',
  rand: 'tls-ddos-rand.json',
  incident: 'incident-repetitie.json',
  beeldscan: 'image-vulnerability-scan.json',
  mailherstel: 'email-delivery-recovery.json',
  betaling: 'payment-provider-live.json',
  uitbetaling: 'payout-provider-live.json',
  webhook: 'webhook-delivery-replay.json',
  geldlus: 'refund-payout-settlement.json',
  reconciliatie: 'reconciliation.json',
  realtime: 'connection-realtime-turn.json'
};
const CONTROLE = {
  herstel: 'backupHerstel', rollback: 'deploymentRollback',
  malware: 'malwareDefinitionsScan', objectopslag: 'objectStorage',
  rand: 'tlsDdosRand', incident: 'observabilityIncident', beeldscan: 'imageVulnerabilityScan',
  mailherstel: 'emailDeliveryRecovery', betaling: 'paymentProvider', uitbetaling: 'payoutProvider',
  webhook: 'webhookDelivery', geldlus: 'refundPayoutSettlement', reconciliatie: 'reconciliation',
  realtime: 'connectionRealtime'
};
function commitVan(root) {
  const r = cp.spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const sha = String(r.stdout || '').trim();
  return /^[a-f0-9]{40,64}$/.test(sha) ? sha : null;
}

function verslag(soort, commit, van, tot, uitkomst, redenen, gegevens, mensVerklaring) {
  const requestSha256 = gegevens && gegevens.externalMeasurement &&
    gegevens.externalMeasurement.requestSha256 || null;
  return { formaat: 'rtg-extern-bewijsverslag-v1', controle: CONTROLE[soort], commit,
    gemeten: { van: new Date(van).toISOString(), tot: new Date(tot).toISOString(), duurMs: tot - van },
    uitkomst, requestSha256, redenen, gegevens, mensVerklaring: mensVerklaring || null,
    wat_dit_niet_zegt: 'Dit verslag is wat de proef op deze host zag. Het is geen oordeel van een ' +
      'beoordelaar; het externe dossier wordt pas geldig met diens Ed25519-handtekening.' };
}

async function nieuwVerslag(soort, o, werk) {
  const van = o.nu();
  const r = await werk();
  const stand = r && r.stand;
  const uitkomst = stand === 'OK' ? 'PASS' : stand === 'OUT_OF_SCOPE' ? 'OUT_OF_SCOPE' :
    stand === 'OPEN' ? 'OPEN' : 'FAIL';
  return verslag(soort, o.commit, van, o.nu(), uitkomst, (r && r.redenen) || [],
    (r && r.gegevens) || {});
}

/* ---------- schrijven ---------- */
function schrijf(soort, uit, map = DOEL) {
  fs.mkdirSync(map, { recursive: true, mode: 0o700 });
  const bytes = Buffer.from(JSON.stringify(uit, null, 2) + '\n');
  const pad = path.join(map, BESTAND[soort]);
  fs.writeFileSync(pad, bytes, { mode: 0o600 });
  return { pad, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
}

function standaard(root = ROOT, env = process.env) {
  const commit = commitVan(root);
  const nu = () => Date.now();
  return {
    env, commit, nu, uuid: () => crypto.randomUUID(),
    clamd: () => require('../server/kern/clamd').maakClamd({}),
    beproefMedia: e => require('./lib/golive-uitgangen').beproefMedia(e),
    beproefAlarm: (e, opties) => require('./lib/golive-uitgangen').beproefAlarm(e, opties),
    tlsProef: opties => require('./lib/publieke-tls-proef').voerPubliekeTlsProef(opties),
    meetExtern: (controle, input, extra) => externeMeter.meet(controle, input,
      { env, commit, nu, root, ...(extra || {}) }),
    startRecovery: async ({ appUrl, email, correlationId }) => {
      const u = new URL(appUrl);
      if (u.protocol !== 'https:' || u.username || u.password) throw new Error('APP_URL moet publieke HTTPS zijn');
      const r = await require('../server/lib/http').vraag({ url:u.origin + '/api/auth/forgot', method:'POST',
        json:{ email }, headers:{ 'x-rtg-evidence-correlation':correlationId }, timeout:30000, maxRetries:0 });
      let body = {}; try { body = r.json(); } catch (e) {}
      return { status:r.status, ok:body && body.ok === true };
    },
    scanImage: () => imageVuln.voer({ env, commit, nu }),
    draai: (cmd, args) => cp.spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env }),
    staat: path.join(root, '.rtg-live-release'),
    rollbackStaat: path.join(root, '.rtg-live-rollback')
  };
}

async function voer(soort, arg, o) {
  if (soort === 'malware') return lokaal.malware(o, verslag);
  if (soort === 'objectopslag') return lokaal.objectopslag(o, verslag);
  if (soort === 'rollback') return lokaal.rollback(o, verslag);
  if (soort === 'herstel') return lokaal.herstel(o, arg, verslag);
  if (soort === 'rand') return nieuwVerslag(soort, o, () => externe.tlsRand(o));
  if (soort === 'incident') return nieuwVerslag(soort, o, () => externe.incident(o));
  if (soort === 'beeldscan') return nieuwVerslag(soort, o, () => o.scanImage());
  if (soort === 'mailherstel') return nieuwVerslag(soort, o, () => externe.emailHerstel(o));
  if (soort === 'betaling') return nieuwVerslag(soort, o, () => externGeld.geld('paymentProvider', o));
  if (soort === 'uitbetaling') return nieuwVerslag(soort, o, () => externGeld.geld('payoutProvider', o));
  if (soort === 'webhook') return nieuwVerslag(soort, o, () => externGeld.geld('webhookDelivery', o));
  if (soort === 'geldlus') return nieuwVerslag(soort, o, () => externGeld.geld('refundPayoutSettlement', o));
  if (soort === 'reconciliatie') return nieuwVerslag(soort, o, () => externGeld.geld('reconciliation', o));
  if (soort === 'realtime') return nieuwVerslag(soort, o, () => externe.realtime(o));
  throw new Error('Onbekende proef. Kies uit: ' + Object.keys(BESTAND).join(', '));
}

if (require.main === module) {
  const [soort, arg] = process.argv.slice(2);
  voer(soort, arg, standaard()).then(uit => {
    const w = schrijf(soort, uit);
    console.log('[extern-bewijs] ' + CONTROLE[soort] + ': ' + uit.uitkomst);
    for (const r of uit.redenen) console.log('  - ' + r);
    console.log('  verslag: ' + path.relative(ROOT, w.pad) + '  sha256 ' + w.sha256);
    if (uit.uitkomst === 'FAIL') process.exitCode = 1;
    if (uit.uitkomst === 'OPEN') process.exitCode = 2;
  }).catch(e => { console.error('[extern-bewijs] ' + e.message); process.exitCode = 1; });
}

module.exports = { voer, schrijf, definitieDatum:lokaal.definitieDatum, BESTAND, CONTROLE,
  MAX_DEFINITIE_DAGEN:lokaal.MAX_DEFINITIE_DAGEN, EICAR:lokaal.EICAR,
  standaard };
