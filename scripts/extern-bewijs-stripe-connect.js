#!/usr/bin/env node
/* ============================================================================
   STRIPE CONNECT-KWALIFICATIE IN DE SANDBOX, GEBONDEN AAN DE BEVROREN RELEASE.

   WAT DIT IS. De partnerafrekening (server/betaal/connect/) is getoetst tegen
   een nagemaakte Stripe (test/nep-stripe.js). Dat bewijst onze kant en niets
   over Stripe. Dit script loopt dezelfde modules -- van DEZE commit -- tegen de
   echte Stripe-sandbox:

     1. geld op het platformsaldo (een testbetaling met pm_card_bypassPending,
        zodat het saldo meteen beschikbaar is)
     2. een terugbetaling op die betaling (de refundrondgang)
     3. een partnerafrekening: transfer naar het verbonden testaccount en een
        payout van zijn saldo, met de afgeleide idempotentiesleutels
     4. dezelfde transfer nog eens met dezelfde sleutel: Stripe moet HETZELFDE
        object teruggeven (geen tweede transfer)
     5. wachten tot Stripe de payout `paid` meldt
     6. de webhookrondgang: de bevroren RC (RTG_EVIDENCE_RC_URL) moet de
        payout.paid-melding van Stripe hebben ontvangen en geverifieerd -- dat
        lezen we af aan zijn eigen bevindingenlijst, met een boardroomsessie
     7. de reconciliatie: Stripe naast het effectjournaal; moet sluiten

   EN HET BINDT. Het verslag draagt de commit en de inhoudshash uit een
   GEVERIFIEERD release-bewijs.json (dezelfde verificatie als de productiepoort:
   server/config/foundation-vrijgave.js `commitUitBewijs`), plus het image-id als
   dat is meegegeven. Een verslag van commit A kan zo nooit voor B gelden.

   WAT DIT NIET IS. Geen vervanging van de LIVE geldmeting (`npm run
   extern:bewijs -- uitbetaling`, getekend door de onafhankelijke meetrunner) en
   geen getekend dossier: een beoordelaar neemt dit verslag op in het externe
   dossier (server/config/external-release.js) en tekent dat. Pas dan opent de
   bewijsas van de vrijgavepoort.

   ZONDER SANDBOXSLEUTELS, NETWERK OF RELEASEBINDING: uitgang 3 en de woorden
   EXTERNAL EVIDENCE REQUIRED. Er wordt dan NOOIT een bestand geschreven, en
   zeker geen geslaagd. Een livesleutel (sk_live_) wordt geweigerd: een
   kwalificatie verplaatst geen echt geld.

   Invoer (omgeving):
     STRIPE_SANDBOX_SECRET_KEY          sk_test_...
     STRIPE_SANDBOX_CONNECT_ACCOUNT     acct_... (een verbonden TESTaccount)
     RTG_EVIDENCE_RC_URL                https-adres van de bevroren RC
     RTG_EVIDENCE_RC_TOKEN              boardroomsessie op die RC
     RTG_EVIDENCE_IMAGE_ID              optioneel: het image-id van de RC
     RTG_EVIDENCE_MAX_MINOR             bedrag in centen, 100..10000 (standaard 500)
   ========================================================================== */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const NAAM = 'stripe-connect-sandbox.json';
const NODIG = 'EXTERNAL EVIDENCE REQUIRED';
const h = v => crypto.createHash('sha256').update(String(v)).digest('hex');

function weiger(redenen) {
  const e = new Error(NODIG + ': ' + redenen.join('; ')); e.nodig = true; return e;
}

function invoer(env, root) {
  const mis = [];
  const sleutel = String(env.STRIPE_SANDBOX_SECRET_KEY || '');
  if (!sleutel) mis.push('STRIPE_SANDBOX_SECRET_KEY ontbreekt');
  else if (!sleutel.startsWith('sk_test_')) mis.push('alleen een sandboxsleutel (sk_test_) is toegestaan');
  const account = String(env.STRIPE_SANDBOX_CONNECT_ACCOUNT || '');
  if (!/^acct_[A-Za-z0-9]{6,}$/.test(account)) mis.push('STRIPE_SANDBOX_CONNECT_ACCOUNT (acct_...) ontbreekt');
  const rc = String(env.RTG_EVIDENCE_RC_URL || '');
  if (!/^https:\/\//.test(rc)) mis.push('RTG_EVIDENCE_RC_URL (https-adres van de bevroren RC) ontbreekt');
  if (!env.RTG_EVIDENCE_RC_TOKEN) mis.push('RTG_EVIDENCE_RC_TOKEN (boardroomsessie op de RC) ontbreekt');
  const max = env.RTG_EVIDENCE_MAX_MINOR ? Number(env.RTG_EVIDENCE_MAX_MINOR) : 500;
  if (!Number.isSafeInteger(max) || max < 100 || max > 10000) mis.push('RTG_EVIDENCE_MAX_MINOR moet tussen 100 en 10000 liggen');
  /* De binding: zonder geverifieerd releasebewijs weten we niet OP WELKE code
     dit verslag zou slaan -- en dan is het geen bewijs. */
  let commit = null, inhoudSha256 = null;
  try {
    commit = require('../server/config/foundation-vrijgave').commitUitBewijs(root);
    if (commit) inhoudSha256 = JSON.parse(fs.readFileSync(path.join(root, 'release-bewijs.json'), 'utf8')).inhoudSha256 || null;
  } catch (e) { commit = null; }
  if (!commit || !/^[a-f0-9]{64}$/.test(String(inhoudSha256 || ''))) mis.push('geen geverifieerd release-bewijs.json voor de draaiende code (bevroren RC)');
  if (mis.length) throw weiger(mis);
  return { sleutel, account, rc: rc.replace(/\/+$/, ''), token: env.RTG_EVIDENCE_RC_TOKEN, max, commit, inhoudSha256,
    imageId: env.RTG_EVIDENCE_IMAGE_ID ? String(env.RTG_EVIDENCE_IMAGE_ID).slice(0, 200) : null };
}

async function wacht(fn, ms, stap = 3000) {
  const tot = Date.now() + ms;
  for (;;) { const r = await fn(); if (r) return r; if (Date.now() > tot) return null; await new Promise(x => setTimeout(x, stap)); }
}

async function kwalificeer(cfg) {
  const stripe = require('../server/stripe')(cfg.sleutel);
  const { maakConnect } = require('../server/betaal/connect');
  const S = require('../server/betaal/connect/sleutel');
  const journaal = new Map();
  /* De vrijgavepoort is hier BEWUST een open stub: dit script kwalificeert de
     rail VOORDAT de poort open mag, en mag dus niet zelf van die poort afhangen.
     Daarom draait het uitsluitend met een sandboxsleutel (zie invoer()). */
  const open = { eis: () => ({ beschikbaar: true }) };
  const c = maakConnect({ db: { data: {} }, save: () => {}, stripe, vrijgave: open,
    boekEffect: e => { if (!journaal.has(e.sleutel)) journaal.set(e.sleutel, e); } });
  const id = 'kwal-' + cfg.commit.slice(0, 12) + '-' + Date.now();
  const stappen = [];
  const stap = (naam, ok, extra) => { stappen.push(Object.assign({ stap: naam, ok: !!ok }, extra || {})); if (!ok) throw new Error('stap ' + naam + ' mislukt'); };

  const pi = await stripe.paymentIntents.create({ amount: cfg.max * 2, currency: 'eur', payment_method: 'pm_card_bypassPending',
    confirm: 'true', 'payment_method_types[]': 'card', metadata: { kwalificatie: id } }, { idempotencyKey: 'kwal-pi-' + h(id).slice(0, 40) });
  stap('betaling', pi && pi.status === 'succeeded', { ref: h(pi && pi.id) });
  const rf = await stripe.refunds.create({ payment_intent: pi.id, amount: cfg.max }, { idempotencyKey: 'kwal-rf-' + h(id).slice(0, 40) });
  stap('terugbetaling', rf && ['succeeded', 'pending'].includes(rf.status), { ref: h(rf && rf.id), status: rf && rf.status });

  c.aanvragen({ id, partner: 'kwalificatie', account: cfg.account, centen: cfg.max, valuta: 'eur', wie: 'user-0' });
  const rec = await c.indienen(id);
  stap('transfer-en-payout', rec.transferId && rec.payoutId, { transfer: h(rec.transferId), payout: h(rec.payoutId) });
  const nogEens = await stripe.transfers.create({ amount: cfg.max, currency: 'eur', destination: cfg.account,
    transfer_group: 'rtg-' + id, metadata: { afrekening: id } }, { idempotencyKey: S.idemTransfer(id) });
  stap('idempotente-herhaling', nogEens.id === rec.transferId, { zelfdeObject: nogEens.id === rec.transferId });

  const betaald = await wacht(async () => {
    const p = await stripe.payouts.retrieve(rec.payoutId, { stripeAccount: cfg.account });
    return p && p.status === 'paid' ? p : null;
  }, 15 * 60 * 1000);
  stap('payout-betaald', !!betaald);
  await c.veeg();
  stap('stand', c.opslag.haal(id).stand === 'betaald', { stand: c.opslag.haal(id).stand });

  const rondgang = await wacht(async () => {
    const r = await fetch(cfg.rc + '/api/office/connect/afrekeningen', { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.token }, body: '{}' });
    if (r.status !== 200) return null;
    const l = await r.json();
    const gezien = [...(l.afrekeningen || []).map(a => a.payoutId), ...(l.bevindingen || []).map(b => b.object)];
    return gezien.includes(rec.payoutId) ? true : null;
  }, 10 * 60 * 1000, 10000);
  stap('webhookrondgang', !!rondgang, { uitleg: 'de RC ontving en verifieerde de payoutmelding van Stripe' });

  const rec2 = await c.reconciliatie();
  stap('reconciliatie', rec2.sluit, { bevindingen: rec2.nieuweBevindingen.length });
  return { stappen, effecten: [...journaal.values()].map(e => e.soort) };
}

function verslag(cfg, uitkomst, gegevens, redenen) {
  return { formaat: 'rtg-stripe-connect-sandbox-v1', commit: cfg.commit, inhoudSha256: cfg.inhoudSha256,
    imageId: cfg.imageId, gemeten: new Date().toISOString(), uitkomst, redenen: redenen || [], gegevens,
    wat_dit_niet_zegt: 'Sandboxkwalificatie van deze commit tegen Stripe test mode. Geen live geldmeting en geen ' +
      'getekend dossier: een beoordelaar neemt dit op in het externe dossier en tekent dat.' };
}

async function main({ env = process.env, root = ROOT, uit = path.join(ROOT, '.release', 'external-evidence') } = {}) {
  const cfg = invoer(env, root);              // gooit EXTERNAL EVIDENCE REQUIRED
  let v;
  try { v = verslag(cfg, 'PASS', await kwalificeer(cfg)); }
  catch (e) { v = verslag(cfg, 'FAIL', null, [String(e && e.message || e).slice(0, 400)]); }
  fs.mkdirSync(uit, { recursive: true, mode: 0o700 });
  const bytes = Buffer.from(JSON.stringify(v, null, 2) + '\n');
  fs.writeFileSync(path.join(uit, NAAM), bytes, { mode: 0o600 });
  return { verslag: v, sha256: h(bytes), pad: path.join(uit, NAAM) };
}

if (require.main === module) {
  main().then(r => {
    console.log('[stripe-connect] ' + r.verslag.uitkomst + '  ' + path.relative(ROOT, r.pad) + '  sha256 ' + r.sha256);
    if (r.verslag.uitkomst !== 'PASS') process.exitCode = 1;
  }).catch(e => {
    console.error('[stripe-connect] ' + e.message);
    process.exitCode = e.nodig ? 3 : 1;
  });
}

module.exports = { main, invoer, NODIG, NAAM };
