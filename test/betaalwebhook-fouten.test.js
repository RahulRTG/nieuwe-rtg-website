/* Failure-injection op de echte kaart-webhookbedrading. Geen provider wordt
   benaderd: de providers zijn deterministische doubles, maar de routes, de
   betaalwaarheid en de betaalopdrachtenrij zijn de productiemodules. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const maakBetaalWaarheid = require('../server/kern/betaalwaarheid');
const maakBetaalopdrachten = require('../server/kern/betaalopdracht');
const { maakSettlement } = require('../server/kern/settlement');
const hangKaartWebhooks = require('../server/opzet/kaartwebhooks');

const stil = { info() {}, warn() {}, error() {}, uitzondering() {} };

function routeTuig({ db, save, betaal, betaalWaarheid, opdrachtenVan, settleFactuur }) {
  const routes = new Map();
  const app = { post(pad, ...handlers) { routes.set(pad, handlers); } };
  const door = () => (_req, _res, next) => next();
  const express = { raw: door, json: door };
  hangKaartWebhooks({
    app, express, db: db || { data: {} }, save: save || (() => {}), log: stil,
    betaal, betaalWaarheid, opdrachtenVan: opdrachtenVan || (() => null),
    settleFactuur: settleFactuur || (async () => ({ ok: true })),
    webhookRem: (_req, _res, next) => next(), webhookPoort: (_req, _res, next) => next()
  });

  return async function post(pad, body, headers) {
    const keten = routes.get(pad);
    assert.ok(keten, 'route is werkelijk gemount: ' + pad);
    const koppen = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    const req = { body, id: 'failure-injection', get: naam => koppen[String(naam).toLowerCase()] };
    const antwoord = { status: 200, body: null, type: null };
    const res = {
      status(code) { antwoord.status = code; return this; },
      type(type) { antwoord.type = type; return this; },
      json(payload) { antwoord.body = payload; return this; },
      send(payload) { antwoord.body = payload; return this; }
    };
    await keten[keten.length - 1](req, res);
    return antwoord;
  };
}

function klok() {
  let n = Date.parse('2026-09-04T10:00:00.000Z');
  return () => new Date(n++).toISOString();
}

function stripeGebeurtenis(id, type, betalingId, status, centen, referentie) {
  return Buffer.from(JSON.stringify({ id, type, data: { object: {
    id: betalingId, status, amount: centen, amount_received: centen, currency: 'eur',
    metadata: referentie ? { referentie } : {}
  } } }));
}

test('Stripe: dubbel en verkeerde volgorde geven de bestelling precies eenmaal vrij', async () => {
  const data = {};
  let domein = 0;
  const betaal = {
    async maakBetaling(o) { return { id: 'pi_stripe_volgorde', status: 'processing',
      aanbieder: 'stripe', bedrag: o.bedrag, valuta: o.valuta }; },
    verifieerWebhook(buf) { return JSON.parse(Buffer.from(buf).toString('utf8')); },
    async maakTerugbetaling() { throw new Error('niet gebruikt'); }
  };
  const waarheid = maakBetaalWaarheid({ d: () => data, save() {}, crypto, betaal, nu: klok(), log: stil });
  waarheid.registreerAfhandeling('bestelling', async () => { domein += 1; });
  const w = waarheid.maak({ actor: 'Ibis', idem: 'stripe-volgorde', soort: 'bestelling',
    bronRef: 'ORDER-S', centen: 2500, valuta: 'eur' });
  await waarheid.begin(w.id, { aanbieder: 'stripe' });
  const post = routeTuig({ betaal, betaalWaarheid: waarheid });

  const mislukt = stripeGebeurtenis('evt_s_fail', 'payment_intent.payment_failed',
    'pi_stripe_volgorde', 'requires_payment_method', 2500, w.id);
  const geslaagd = stripeGebeurtenis('evt_s_ok', 'payment_intent.succeeded',
    'pi_stripe_volgorde', 'succeeded', 2500, w.id);
  const laatMislukt = stripeGebeurtenis('evt_s_laat', 'payment_intent.payment_failed',
    'pi_stripe_volgorde', 'requires_payment_method', 2500, w.id);

  assert.equal((await post('/api/betaal/webhook', mislukt)).status, 200);
  assert.equal(w.status, 'GEWEIGERD');
  assert.equal((await post('/api/betaal/webhook', geslaagd)).status, 200);
  assert.equal((await post('/api/betaal/webhook', geslaagd)).status, 200, 'exacte providerretry');
  assert.equal((await post('/api/betaal/webhook', laatMislukt)).status, 200, 'late oude stand');
  assert.equal(w.status, 'BEVESTIGD');
  assert.equal(domein, 1, 'geen dubbele domein-/ledgerwerking');
});

test('Mollie: elke retry wordt opnieuw bij Mollie opgehaald maar slechts eenmaal geboekt', async () => {
  const data = {};
  let domein = 0, naslagen = 0;
  const betaal = {
    async maakBetaling(o) { return { id: 'tr_mollieretry', status: 'open',
      aanbieder: 'mollie', bedrag: o.bedrag, valuta: o.valuta }; },
    async haalBetaling(_provider, id) { naslagen += 1; return { id, status: 'paid',
      aanbieder: 'mollie', bedrag: 3200, valuta: 'eur' }; },
    async maakTerugbetaling() { throw new Error('niet gebruikt'); },
    verifieerWebhook() { throw new Error('niet gebruikt'); }
  };
  const waarheid = maakBetaalWaarheid({ d: () => data, save() {}, crypto, betaal, nu: klok(), log: stil });
  waarheid.registreerAfhandeling('bestelling', async () => { domein += 1; });
  const w = waarheid.maak({ actor: 'Vos', idem: 'mollie-retry', soort: 'bestelling',
    bronRef: 'ORDER-M', centen: 3200, valuta: 'eur' });
  await waarheid.begin(w.id, { aanbieder: 'mollie' });
  const post = routeTuig({ betaal, betaalWaarheid: waarheid });
  const body = Buffer.from('id=tr_mollieretry');

  assert.equal((await post('/api/betaal/webhook/mollie', body)).status, 200);
  assert.equal((await post('/api/betaal/webhook/mollie', body)).status, 200);
  assert.equal(naslagen, 2, 'het ongetekende bericht zelf wordt nooit vertrouwd');
  assert.equal(w.status, 'BEVESTIGD');
  assert.equal(domein, 1);
});

test('Adyen: HMAC-gecontroleerde CAPTURE-retry boekt maar eenmaal', async () => {
  const data = {};
  let domein = 0, controles = 0;
  const betaal = {
    adyenMerchantAccount: 'RTG_EU', adyenHandmatigeCapture: true,
    async maakBetaling(o) { return { id: 'PL_ADYEN', status: 'active',
      aanbieder: 'adyen', bedrag: o.bedrag, valuta: o.valuta }; },
    verifieerAdyenMelding() { controles += 1; return true; },
    async maakTerugbetaling() { throw new Error('niet gebruikt'); }
  };
  const waarheid = maakBetaalWaarheid({ d: () => data, save() {}, crypto, betaal, nu: klok(), log: stil });
  waarheid.registreerAfhandeling('bestelling', async () => { domein += 1; });
  const w = waarheid.maak({ actor: 'Leeuw', idem: 'adyen-retry', soort: 'bestelling',
    bronRef: 'ORDER-A', centen: 4100, valuta: 'eur' });
  await waarheid.begin(w.id, { aanbieder: 'adyen' });
  const post = routeTuig({ betaal, betaalWaarheid: waarheid });
  const body = { notificationItems: [{ NotificationRequestItem: {
    pspReference: 'PSP_CAPTURE_1', merchantAccountCode: 'RTG_EU', merchantReference: w.id,
    eventCode: 'CAPTURE', success: 'true', amount: { value: 4100, currency: 'EUR' },
    additionalData: { paymentLinkId: 'PL_ADYEN', hmacSignature: 'door-double-gecontroleerd' }
  } }] };

  assert.equal((await post('/api/betaal/webhook/adyen', body)).status, 200);
  assert.equal((await post('/api/betaal/webhook/adyen', body)).status, 200);
  assert.equal(controles, 2, 'ook een retry wordt eerst cryptografisch gecontroleerd');
  assert.equal(w.status, 'BEVESTIGD');
  assert.equal(w.providerPaymentId, 'PSP_CAPTURE_1');
  assert.equal(domein, 1);
});

test('domeinfout geeft 500; dezelfde Stripe-event herstelt zonder dubbel effect', async () => {
  const data = {};
  let pogingen = 0, effect = 0;
  const betaal = {
    async maakBetaling(o) { return { id: 'pi_handler', status: 'processing',
      aanbieder: 'stripe', bedrag: o.bedrag, valuta: o.valuta }; },
    verifieerWebhook(buf) { return JSON.parse(Buffer.from(buf).toString('utf8')); }
  };
  const waarheid = maakBetaalWaarheid({ d: () => data, save() {}, crypto, betaal, nu: klok(), log: stil });
  waarheid.registreerAfhandeling('bestelling', async () => {
    pogingen += 1;
    if (pogingen === 1) throw new Error('domeinopslag tijdelijk dicht');
    effect += 1;
  });
  const w = waarheid.maak({ actor: 'Zwaan', idem: 'handler-retry', soort: 'bestelling',
    bronRef: 'ORDER-H', centen: 1900, valuta: 'eur' });
  await waarheid.begin(w.id, { aanbieder: 'stripe' });
  const post = routeTuig({ betaal, betaalWaarheid: waarheid });
  const evt = stripeGebeurtenis('evt_handler', 'payment_intent.succeeded',
    'pi_handler', 'succeeded', 1900, w.id);

  assert.equal((await post('/api/betaal/webhook', evt)).status, 500);
  assert.equal(data.betaalWaarheidMeldingen.evt_handler.verwerktAt, null);
  assert.equal(w.afgehandeldAt, undefined);
  assert.equal((await post('/api/betaal/webhook', evt)).status, 200);
  assert.equal(pogingen, 2);
  assert.equal(effect, 1);
  assert.ok(w.afgehandeldAt);
  assert.ok(data.betaalWaarheidMeldingen.evt_handler.verwerktAt);
});

test('settlement-resultaat én cleanup-save falen met 500 en behouden herstelcontext', async () => {
  const factuur = { id: 'INV-1', bijdrage: 1, status: 'open' };
  const db = { data: { invoices: [factuur],
    kaartWachtend: { pi_settle: { soort: 'factuur', invoiceId: 'INV-1', own: false } } } };
  let afhandelingen = 0, savePogingen = 0;
  const betaal = { verifieerWebhook(buf) { return JSON.parse(Buffer.from(buf).toString('utf8')); } };
  const betaalWaarheid = { async providerMelding() {}, async providerTerugbetaling() {} };
  /* Eerste echte factuur-save lukt; de direct daaropvolgende cleanup-save
     faalt. Daardoor wordt exact de crashnaad tussen domeineffect en het wissen
     van de herstelcontext geraakt. */
  const save = () => {
    savePogingen += 1;
    if (savePogingen === 2) throw new Error('opslag tijdens cleanup dicht');
  };
  const echteSettlement = maakSettlement({ db, save, accounts: {},
    fonds: { isAbonnement: () => false }, log: stil, dpRegistreerMunt() {} });
  const settleFactuur = async (...invoer) => {
    afhandelingen += 1;
    if (afhandelingen === 1) return { status: 500, error: 'ledger tijdelijk dicht' };
    return echteSettlement(...invoer);
  };
  const post = routeTuig({ db, save, betaal, betaalWaarheid, settleFactuur });
  const evt = stripeGebeurtenis('evt_settle', 'payment_intent.succeeded',
    'pi_settle', 'succeeded', 40);

  assert.equal((await post('/api/betaal/webhook', evt)).status, 500, 'foutresultaat is geen 2xx');
  assert.ok(db.data.kaartWachtend.pi_settle, 'context blijft na handlerfout');
  assert.equal((await post('/api/betaal/webhook', evt)).status, 500, 'cleanup-save is ook geen 2xx');
  assert.ok(db.data.kaartWachtend.pi_settle, 'ook de RAM-mutatie is teruggedraaid');
  assert.equal((await post('/api/betaal/webhook', evt)).status, 200);
  assert.equal(factuur.deelbetaald, 40, 'dezelfde bevestiging telt ook na onzekere cleanup maar eenmaal');
  assert.deepEqual(factuur.betaalBewijzen, [{ id: 'pi_settle', centen: 40 }]);
  assert.equal(db.data.kaartWachtend.pi_settle, undefined);
});

function payoutOpdrachten({ save, teruggang, afwikkeling }) {
  const data = {};
  const op = maakBetaalopdrachten({
    d: () => data, save, crypto, nu: (() => { let n = 1000; return () => n++; })(), log: stil,
    railInzenden: async o => ({ id: 'po_' + o.ledgerRef.toLowerCase(), status: 'pending' })
  });
  op.registreerTeruggang('sepa-uit', teruggang);
  if (afwikkeling) op.registreerAfwikkeling('sepa-uit', afwikkeling);
  return { data, op };
}

function payoutEvent(id, type, settlementRef) {
  return Buffer.from(JSON.stringify({ id, type, data: { object: { id: settlementRef,
    failure_message: type === 'payout.failed' ? 'account_closed' : undefined } } }));
}

function payoutRoutes(op) {
  const betaal = { verifieerWebhook(buf) { return JSON.parse(Buffer.from(buf).toString('utf8')); } };
  return routeTuig({ betaal, opdrachtenVan: () => op,
    betaalWaarheid: { async providerMelding() {}, async providerTerugbetaling() {} } });
}

test('payout paid/failed en hun dubbelen kunnen ledger of finalisatie nooit omkeren', async () => {
  const terugEffecten = new Set();
  const finalizeEffecten = new Set();
  const { op } = payoutOpdrachten({ save() {},
    teruggang: async o => { terugEffecten.add(o.id); return { ok: true, boeking: { id: 'TERUG-' + o.id } }; },
    afwikkeling: async o => { finalizeEffecten.add(o.id); return { ok: true }; } });
  const mislukt = op.maak({ soort: 'sepa-uit', centen: 3000, ledgerRef: 'FAIL', idemSleutel: 'fail' });
  const betaald = op.maak({ soort: 'sepa-uit', centen: 4500, ledgerRef: 'PAID', idemSleutel: 'paid' });
  await op.dienIn(mislukt);
  await op.dienIn(betaald);
  const post = payoutRoutes(op);

  assert.equal((await post('/api/betaal/webhook', payoutEvent('evt_pf', 'payout.failed', mislukt.settlementRef))).status, 200);
  assert.equal((await post('/api/betaal/webhook', payoutEvent('evt_pf', 'payout.failed', mislukt.settlementRef))).status, 200);
  assert.equal((await post('/api/betaal/webhook', payoutEvent('evt_pf_laat', 'payout.paid', mislukt.settlementRef))).status, 200);
  assert.equal(op.vind(mislukt.id).status, 'TERUGGEBOEKT');
  assert.equal(terugEffecten.size, 1);
  assert.equal(finalizeEffecten.has(mislukt.id), false, 'late paid finaliseert teruggeboekt geld niet');

  assert.equal((await post('/api/betaal/webhook', payoutEvent('evt_pp', 'payout.paid', betaald.settlementRef))).status, 200);
  assert.equal((await post('/api/betaal/webhook', payoutEvent('evt_pp', 'payout.paid', betaald.settlementRef))).status, 200);
  assert.equal((await post('/api/betaal/webhook', payoutEvent('evt_pp_laat', 'payout.failed', betaald.settlementRef))).status, 200);
  assert.equal(op.vind(betaald.id).status, 'AFGEWIKKELD');
  assert.equal(finalizeEffecten.has(betaald.id), true);
  assert.equal(finalizeEffecten.size, 1);
  assert.equal(terugEffecten.size, 1, 'late failed draait definitief betaald geld niet om');
});

test('payout-opslagfout en mislukte teruggang geven non-2xx en herstellen bij retry', async () => {
  let foutVolgendeSave = false;
  const terug = new Set();
  const a = payoutOpdrachten({
    save() { if (foutVolgendeSave) { foutVolgendeSave = false; throw new Error('payout-opslag dicht'); } },
    teruggang: async o => { terug.add(o.id); return { ok: true }; }
  });
  const o = a.op.maak({ soort: 'sepa-uit', centen: 1200, ledgerRef: 'STORE', idemSleutel: 'store' });
  await a.op.dienIn(o);
  const postA = payoutRoutes(a.op);
  foutVolgendeSave = true;
  assert.equal((await postA('/api/betaal/webhook', payoutEvent('evt_store', 'payout.failed', o.settlementRef))).status, 500);
  assert.equal(a.op.vind(o.id).status, 'INGEDIEND', 'niet alleen in RAM mislukt laten staan');
  assert.equal((await postA('/api/betaal/webhook', payoutEvent('evt_store', 'payout.failed', o.settlementRef))).status, 200);
  assert.equal(a.op.vind(o.id).status, 'TERUGGEBOEKT');
  assert.equal(terug.size, 1);

  let terugPogingen = 0;
  const terugNaFout = new Set();
  const b = payoutOpdrachten({ save() {}, teruggang: async opdracht => {
    terugPogingen += 1;
    if (terugPogingen === 1) return { error: 'ledger tijdelijk dicht' };
    terugNaFout.add(opdracht.id);
    return { ok: true };
  } });
  const p = b.op.maak({ soort: 'sepa-uit', centen: 1400, ledgerRef: 'REVERSE', idemSleutel: 'reverse' });
  await b.op.dienIn(p);
  const postB = payoutRoutes(b.op);
  assert.equal((await postB('/api/betaal/webhook', payoutEvent('evt_reverse', 'payout.failed', p.settlementRef))).status, 500);
  assert.equal(b.op.vind(p.id).status, 'MISLUKT');
  assert.equal((await postB('/api/betaal/webhook', payoutEvent('evt_reverse', 'payout.failed', p.settlementRef))).status, 200);
  assert.equal(b.op.vind(p.id).status, 'TERUGGEBOEKT');
  assert.equal(terugPogingen, 2);
  assert.equal(terugNaFout.size, 1);
});

test('payout paid antwoordt pas 2xx nadat de interne finalisatie is hersteld', async () => {
  let pogingen = 0;
  const effecten = new Set();
  const { op } = payoutOpdrachten({ save() {}, teruggang: async () => ({ ok: true }),
    afwikkeling: async opdracht => {
      pogingen += 1;
      if (pogingen === 1) return { error: 'settlement-ledger tijdelijk dicht' };
      effecten.add(opdracht.id);
      return { ok: true };
    } });
  const o = op.maak({ soort: 'sepa-uit', centen: 5100, ledgerRef: 'FINALIZE', idemSleutel: 'finalize' });
  await op.dienIn(o);
  const post = payoutRoutes(op);
  const evt = payoutEvent('evt_finalize', 'payout.paid', o.settlementRef);

  assert.equal((await post('/api/betaal/webhook', evt)).status, 500);
  assert.equal(op.vind(o.id).status, 'AFGEWIKKELD', 'de externe waarheid blijft behouden');
  assert.match(op.vind(o.id).afwikkelFout, /tijdelijk dicht/);
  assert.equal((await post('/api/betaal/webhook', evt)).status, 200);
  assert.equal((await post('/api/betaal/webhook', evt)).status, 200);
  assert.equal(pogingen, 2);
  assert.equal(effecten.size, 1);
  assert.ok(op.vind(o.id).afwikkelingVerwerktAt);
});

test('crash tussen echte ledger-teruggang en opdracht-save boekt hoofdsom en tarief niet dubbel', async () => {
  const data = {};
  const ledger = [];
  let foutVolgendeSave = false, boekingen = 0;
  const save = () => {
    if (foutVolgendeSave) { foutVolgendeSave = false; throw new Error('opdracht-save na ledger dicht'); }
  };
  const op = maakBetaalopdrachten({ d: () => data, save, crypto,
    nu: (() => { let n = 9000; return () => n++; })(), log: stil,
    railInzenden: async () => ({ id: 'po_bank_crash', status: 'pending' }) });
  require('../server/kern/bank/uitgang')({
    opdrachten: op, grootboek: () => ledger, rekMeta: () => null, seintje() {},
    async boekAsync(boeking) {
      boekingen += 1;
      const rij = Object.assign({ id: 'BB-TERUG-' + boekingen }, boeking);
      ledger.push(rij);
      /* Beide ledgerregels mogen landen; de eerstvolgende save is dan die van
         de opdrachtstatus TERUGGEBOEKT, precies de crashnaad onder proef. */
      foutVolgendeSave = true;
      return { ok: true, boeking: rij };
    }
  });
  const o = op.maak({ soort: 'sepa-uit', centen: 7000, tariefCenten: 80,
    bron: 'NL00RTGB0000000001', ledgerRef: 'BB-HEEN-1', idemSleutel: 'bank-crash' });
  await op.dienIn(o);
  const post = payoutRoutes(op);
  const evt = payoutEvent('evt_bank_crash', 'payout.failed', o.settlementRef);

  assert.equal((await post('/api/betaal/webhook', evt)).status, 500);
  assert.equal(op.vind(o.id).status, 'MISLUKT');
  assert.equal(ledger.length, 2, 'hoofdsom en tarief zijn al echt teruggeboekt');
  assert.equal((await post('/api/betaal/webhook', evt)).status, 200);
  assert.equal(op.vind(o.id).status, 'TERUGGEBOEKT');
  assert.equal(ledger.length, 2, 'retry herkent beide regels op de oorspronkelijke ledgerRef');
  assert.deepEqual(ledger.map(x => x.soort).sort(), ['sepa-terug', 'tarief-terug']);
});

test('gedeeltelijke Stripe-refunds zijn idempotent; cross-provider refund boekt nul cent', async () => {
  const data = {};
  let refundNr = 0;
  const betaal = {
    async maakBetaling(o) {
      const adyen = o.referentie && String(o.referentie).includes('ADYEN');
      return { id: adyen ? 'PL_MISMATCH' : 'pi_refunds', status: adyen ? 'active' : 'processing',
        aanbieder: adyen ? 'adyen' : 'stripe', bedrag: o.bedrag, valuta: o.valuta };
    },
    async maakTerugbetaling(o) { refundNr += 1; return { id: 're_deel_' + refundNr,
      status: 'pending', aanbieder: o.aanbieder, bedrag: o.bedrag, valuta: o.valuta }; },
    verifieerWebhook(buf) { return JSON.parse(Buffer.from(buf).toString('utf8')); },
    verifieerAdyenMelding() { return true; }, adyenMerchantAccount: 'RTG_EU', adyenHandmatigeCapture: true
  };
  const waarheid = maakBetaalWaarheid({ d: () => data, save() {}, crypto, betaal, nu: klok(), log: stil });
  waarheid.registreerAfhandeling('bestelling', async () => {});
  const stripe = waarheid.maak({ actor: 'Arend', idem: 'refunds', soort: 'bestelling',
    bronRef: 'ORDER-STRIPE', centen: 3000, valuta: 'eur' });
  await waarheid.begin(stripe.id, { aanbieder: 'stripe' });
  const post = routeTuig({ betaal, betaalWaarheid: waarheid });
  await post('/api/betaal/webhook', stripeGebeurtenis('evt_refund_pay', 'payment_intent.succeeded',
    'pi_refunds', 'succeeded', 3000, stripe.id));

  await waarheid.terugbetalen(stripe.id, { idem: 'deel-een', centen: 1000 });
  const refundEen = Buffer.from(JSON.stringify({ id: 'evt_refund_1', type: 'refund.updated', data: { object: {
    id: 're_deel_1', status: 'succeeded', payment_intent: 'pi_refunds', amount: 1000,
    currency: 'eur', metadata: { referentie: stripe.id }
  } } }));
  assert.equal((await post('/api/betaal/webhook', refundEen)).status, 200);
  assert.equal((await post('/api/betaal/webhook', refundEen)).status, 200);
  assert.equal(stripe.terugbetaaldCenten, 1000);
  assert.equal(stripe.terugbetalingen.length, 1);

  await waarheid.terugbetalen(stripe.id, { idem: 'deel-twee', centen: 500 });
  const refundTwee = Buffer.from(JSON.stringify({ id: 'evt_refund_2', type: 'refund.updated', data: { object: {
    id: 're_deel_2', status: 'succeeded', payment_intent: 'pi_refunds', amount: 500,
    currency: 'eur', metadata: { referentie: stripe.id }
  } } }));
  assert.equal((await post('/api/betaal/webhook', refundTwee)).status, 200);
  assert.equal(stripe.terugbetaaldCenten, 1500);
  assert.equal(stripe.terugbetalingen.length, 2);
  assert.equal(stripe.status, 'GEDEELTELIJK_TERUGBETAALD');

  const adyen = waarheid.maak({ actor: 'Arend', idem: 'mismatch', soort: 'bestelling',
    bronRef: 'ORDER-ADYEN', centen: 2200, valuta: 'eur' });
  await waarheid.begin(adyen.id, { aanbieder: 'adyen' });
  const adyenCapture = { notificationItems: [{ NotificationRequestItem: {
    pspReference: 'PSP_MISMATCH', merchantAccountCode: 'RTG_EU', merchantReference: adyen.id,
    eventCode: 'CAPTURE', success: 'true', amount: { value: 2200, currency: 'EUR' },
    additionalData: { paymentLinkId: 'PL_MISMATCH', hmacSignature: 'ok' }
  } }] };
  assert.equal((await post('/api/betaal/webhook/adyen', adyenCapture)).status, 200);
  const foutProvider = Buffer.from(JSON.stringify({ id: 'evt_cross_provider', type: 'refund.updated', data: { object: {
    id: 're_stripe_op_adyen', status: 'succeeded', payment_intent: 'pi_niet_adyen', amount: 700,
    currency: 'eur', metadata: { referentie: adyen.id }
  } } }));
  assert.equal((await post('/api/betaal/webhook', foutProvider)).status, 200,
    'semantische mismatch is terminal en gaat zichtbaar naar controle');
  assert.equal(adyen.status, 'CONTROLE_NODIG');
  assert.equal(adyen.blokkade, 'terugbetaalprovider-wijkt-af');
  assert.equal(adyen.terugbetaaldCenten, 0);
  assert.equal((adyen.terugbetalingen || []).length, 0);
  assert.ok(data.betaalWaarheidMeldingen.evt_cross_provider.verwerktAt);
});
