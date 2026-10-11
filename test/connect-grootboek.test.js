/* STRIPE CONNECT AAN HET ECHTE GROOTBOEK, DUURZAAM, EN ONDER TWEE HANDTEKENINGEN.

   test/connect-afrekening.test.js beproeft de connectlaag met een nagemaakt
   grootboek (een Map). Hier gaat het om de drie integratiepunten die daar met
   opzet openbleven:

     1. DE GROOTBOEKKOPPELING (kern/pay/vrijgavepoort.js `maakConnectBoeking`,
        gekoppeld in server/opzet/kernlaag4b.js): een echte RTG Pay. Elke
        economische gebeurtenis (reservering, afgerekend, teruggeboekt) boekt
        hoogstens EEN effect op haar eigen sleutel -- ook als hij twee keer wordt
        aangeboden, ook van twee kanten tegelijk -- en het grootboek sluit.
     2. DUURZAAM (server/betaal/connect/opslag.js `vast()`): bevestigt de opslag
        niet, dan gaat er niets naar Stripe en wordt er niets gereserveerd.
     3. DE TWEEDE HANDTEKENING (server/routes/kantoren/connect.js): de route
        vraagt een tweede mens; de aanvrager kan zichzelf niet bevestigen; een
        noodstop tussen aanvraag en bevestiging houdt hem alsnog tegen en de
        handtekening is daarna opgebruikt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { nepStripe } = require('./nep-stripe');
const { proefVrijgave } = require('../scripts/lib/proefvrijgave');

const nep = nepStripe();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-connect-grootboek-'));
/* Toets 3 bouwt het standaardexemplaar, en dat legt duurzaam vast via server/db:
   een eigen datamap, nooit die van de werkboom. */
process.env.RTG_DATA_DIR = path.join(TMP, 'data');
let stripe;
test.before(async () => {
  const basis = await nep.start();
  process.env.NODE_ENV = 'test';
  process.env.STRIPE_BASE_URL = basis;
  process.env.STRIPE_SECRET_KEY = 'sk_test_nep';
  stripe = require('../server/stripe')('sk_test_nep');
});
test.after(async () => { await nep.stop(); fs.rmSync(TMP, { recursive: true, force: true }); });

const { maakConnect } = require('../server/betaal/connect');
const S = require('../server/betaal/connect/sleutel');
const { maakConnectBoeking, CONNECT_ONDERWEG } = require('../server/kern/pay/vrijgavepoort');

/* Een open poort voor Connect: in deze proefwereld lokaal, met de drie
   capabilities uitdrukkelijk AAN en alleen het bewijs ingespoten. */
function openPoort() {
  const { maakVrijgave } = require('../server/kern/vrijgave');
  const { maakStand } = require('../server/kern/vrijgave/stand');
  const v = maakVrijgave({ stand: maakStand({ bestand: path.join(fs.mkdtempSync(path.join(TMP, 'v-')), 's.json') }),
    openbaar: () => false, lokaal: () => false, bewijs: { oordeel: () => ({ geverifieerd: true, reden: 'proefbewijs' }) },
    bevoegd: { mag: () => ({ mag: true, via: 'proef' }) }, providerGezond: () => ({ gezond: true }) });
  for (const b of ['provider.stripe', 'provider.stripe_connect'])
    assert.ok(v.besluitVastleggen(b, { wie: 'user-1', bron: 'proefcontract', sha256: 'a'.repeat(64), reden: 'getekend in de proef', stapOmhoog: true }).ok);
  for (const id of ['geld.provider.stripe', 'geld.provider.stripe_connect', 'geld.partnerafrekening'])
    assert.ok(v.zet(id, 'enabled', { wie: 'user-1', reden: 'aan in de proef', stapOmhoog: true }).ok);
  return v;
}

function payWereld() {
  const db = { data: {} };
  const pay = require('../server/kern/pay')({ db, save: () => {}, bijeen: async (w) => w(), vrijgave: proefVrijgave(),
    payBoekingenVoegToe: require('../server/kern/pay/loshistorie')(db), crypto, betaal: { AANBIEDER: 'simulatie' },
    keyVanCodenaam: () => ({ key: 'proef' }), sseToCustomer: () => {}, schoon: (x) => String(x || ''),
    betaaldienstKosten: () => 0, betaalOpdrachten: { registreerTeruggang() {}, maak: () => ({}), dienIn: async () => ({}) },
    betaalWaarheid: { maak() {}, begin() {}, van() {}, registreerAfhandeling() {} } }).pay;
  return { db, pay };
}
/* Een zaak met saldo: een lid betaalt haar (de echte weg, kern/pay/zaakbetaling.js). */
async function zaakMetSaldo(pay, zaak, centen) {
  assert.equal((await pay.oplaadAfronden({ codenaam: 'Lid', centen, ref: 'start-' + zaak })).ok, true);
  const b = await pay.betaalZaak({ codenaam: 'Lid', supplierCode: zaak, centen, idem: 'vul-' + zaak });
  assert.equal(b.ok, true, JSON.stringify(b));
}
const aanvraag = (id, extra) => Object.assign({ id, partner: 'ZAAK1', account: 'acct_grootboek1', centen: 2500, valuta: 'eur', wie: 'user-1' }, extra || {});

test('1 de echte grootboekkoppeling: reserveren, afrekenen en terugboeken, elk precies een keer, en het grootboek sluit', async () => {
  const { pay } = payWereld();
  await zaakMetSaldo(pay, 'ZAAK1', 10000);
  const boek = maakConnectBoeking(pay);
  const c = maakConnect({ db: { data: {} }, save: () => {}, stripe, vrijgave: openPoort(), boekEffect: boek });
  const zaak = () => pay.saldoVan(pay.rekPartner('ZAAK1'));
  const z0 = zaak();
  await c.aanvragen(aanvraag('afr-gb-1'));
  assert.equal(zaak(), z0 - 2500, 'de reservering ging van het partnersaldo af');
  assert.equal(pay.saldoVan(CONNECT_ONDERWEG), 2500, 'en staat onderweg');
  const rec = await c.indienen('afr-gb-1');
  assert.equal(rec.stand, 'onderweg');
  const po = nep.payouts.get(rec.payoutId); po.status = 'paid';
  const evt = nep.gebeurtenis('payout.paid', po, 'acct_grootboek1');
  /* Dezelfde melding twee keer, waarvan een keer GELIJKTIJDIG met een veeg. */
  await Promise.all([c.verwerk(evt), c.veeg()]);
  await c.verwerk(evt);
  assert.equal(pay.saldoVan(CONNECT_ONDERWEG), 0, 'na afrekenen staat er niets meer onderweg');
  assert.equal(pay.saldoVan('extern:uitbetaald'), 2500, 'precies een keer afgerekend');
  /* Het effect rechtstreeks nog eens aanbieden, met dezelfde sleutel: geen tweede boeking. */
  const n = pay.boekingenVan(pay.rekPartner('ZAAK1')).length;
  await boek({ sleutel: S.economisch('afr-gb-1', 'reservering'), soort: 'reservering', afrekening: 'afr-gb-1', partner: 'ZAAK1', centen: 2500 });
  assert.equal(pay.boekingenVan(pay.rekPartner('ZAAK1')).length, n, 'een herhaald effect boekte opnieuw');
  assert.equal(zaak(), z0 - 2500);
  /* Een tweede afrekening die Stripe definitief weigert: de reservering komt terug. */
  await c.aanvragen(aanvraag('afr-gb-2', { centen: 1000 }));
  nep.knop.weiger = { status: 400, bericht: 'Insufficient funds in Stripe account.' };
  assert.equal((await c.indienen('afr-gb-2')).stand, 'mislukt');
  assert.equal(zaak(), z0 - 2500, 'de geweigerde afrekening kwam terug op het partnersaldo');
  assert.equal(pay.saldoVan(CONNECT_ONDERWEG), 0);
  assert.equal(pay.sluitcontrole().klopt, true);
  assert.equal((await c.reconciliatie()).sluit, true, 'de reconciliatie ziet ieder effect precies een keer');
});

test('1b te weinig partnersaldo: de reservering weigert, en Stripe ziet niets', async () => {
  const { pay } = payWereld();
  await zaakMetSaldo(pay, 'ZAAK2', 500);
  const c = maakConnect({ db: { data: {} }, save: () => {}, stripe, vrijgave: openPoort(), boekEffect: maakConnectBoeking(pay) });
  const voor = nep.verzoeken.length;
  await assert.rejects(c.aanvragen(aanvraag('afr-gb-3', { partner: 'ZAAK2' })), e => e.code === 'RESERVERING_GEWEIGERD');
  assert.equal(nep.verzoeken.length, voor);
  assert.equal(pay.saldoVan(pay.rekPartner('ZAAK2')), 500);
});

test('2 duurzaam: bevestigt de opslag niet, dan wordt er niets gereserveerd en gaat er niets naar Stripe', async () => {
  const { pay } = payWereld();
  await zaakMetSaldo(pay, 'ZAAK3', 10000);
  let weigert = true;
  const vastleggen = async () => (weigert ? { status: 503, error: 'niet vastgelegd' } : null);
  const c = maakConnect({ db: { data: {} }, save: () => {}, stripe, vrijgave: openPoort(), boekEffect: maakConnectBoeking(pay), vastleggen });
  const voor = nep.verzoeken.length;
  await assert.rejects(c.aanvragen(aanvraag('afr-gb-4', { partner: 'ZAAK3' })), e => e.code === 'NIET_VASTGELEGD');
  assert.equal(pay.saldoVan(pay.rekPartner('ZAAK3')), 10000, 'er werd gereserveerd zonder vastgelegd record');
  weigert = false;
  await c.aanvragen(aanvraag('afr-gb-5', { partner: 'ZAAK3' }));
  weigert = true;
  await assert.rejects(c.indienen('afr-gb-5'), e => e.code === 'NIET_VASTGELEGD');
  assert.equal(nep.verzoeken.length, voor, 'Stripe werd gebeld terwijl de opslag niets bevestigde');
  weigert = false;
  assert.equal((await c.indienen('afr-gb-5')).stand, 'onderweg', 'met een werkende opslag gaat hij gewoon');
});

test('3 de tweede handtekening op de kantoorroute: een tweede mens, nooit de aanvrager, en een noodstop ertussen wint', async () => {
  const db = { data: {} };
  const { pay } = payWereld();
  await zaakMetSaldo(pay, 'ZAAK4', 10000);
  const v = openPoort();
  const connectMod = require('../server/betaal/connect');
  connectMod.koppelGrootboek(maakConnectBoeking(pay));
  const dienst = connectMod.standaard({ db, save: () => {}, vrijgave: v });
  const tweedeHand = require('../server/kern/kantoor/tweedehandtekening')({ db, save: () => {} });
  const routes = new Map();
  const ctx = { app: { post: (pad, ...h) => routes.set(pad, h[h.length - 1]) },
    boardroomAuth: (q, r, n) => n(), veilig: async (res, f) => { const u = await f(); res.status((u && u.status) || 200).json(u); },
    afdelingen: { audit() {} }, db, save: () => {}, tweedeHand, boardroomUser: () => ({ id: 1 }),
    zwaar: { eis: async () => ({ ok: true }), sessieSleutel: () => 's', stuur() {} } };
  require('../server/routes/kantoren/connect')(ctx);
  const roep = async (pad, body, officeKey) => {
    const uit = { status: 200, body: null };
    const res = { status(s) { uit.status = s; return res; }, json(b) { uit.body = b; return res; } };
    await routes.get(pad)({ body, officeKey, id: 'req-1', get: () => '' }, res);
    return uit;
  };
  const lijf = { id: 'afr-twee-1', partner: 'ZAAK4', account: 'acct_tweede1', centen: 3000 };
  const voorT = nep.transfers.size;
  const a = await roep('/api/office/connect/afrekening', lijf, 'user-1');
  assert.equal(a.status, 202, JSON.stringify(a.body));
  assert.equal(a.body.needsAuth, true);
  assert.equal(dienst.opslag.haal('afr-twee-1'), null, 'een aanvraag is nog geen afrekening');
  assert.equal(nep.transfers.size, voorT, 'er ging iets naar Stripe op een handtekening');
  const zelf = await tweedeHand.bevestig({ id: a.body.aanvraag.id, door: 'user-1' });
  assert.equal(zelf.status, 403, 'de aanvrager bevestigde zichzelf');
  const twee = await tweedeHand.bevestig({ id: a.body.aanvraag.id, door: 'user-2' });
  assert.equal(twee.ok, true, JSON.stringify(twee));
  const rec = dienst.opslag.haal('afr-twee-1');
  assert.equal(rec.aangevraagdDoor, 'user-1'); assert.equal(rec.bevestigdDoor, 'user-2');
  assert.equal(nep.transfers.size, voorT + 1, 'precies een transfer na twee handtekeningen');
  /* Een tweede aanvraag, en tussen aanvraag en bevestiging valt de noodstop. */
  const b = await roep('/api/office/connect/afrekening', Object.assign({}, lijf, { id: 'afr-twee-2' }), 'user-1');
  assert.equal(b.status, 202);
  assert.ok(v.zet('geld.partnerafrekening', 'emergency_disabled', { wie: 'user-3', reden: 'noodstop tussen de handtekeningen' }).ok);
  const na = await tweedeHand.bevestig({ id: b.body.aanvraag.id, door: 'user-2' });
  assert.equal(na.status, 503, 'de noodstop tussen aanvraag en bevestiging hield hem niet tegen: ' + JSON.stringify(na));
  assert.equal(dienst.opslag.haal('afr-twee-2'), null);
  assert.equal(nep.transfers.size, voorT + 1);
  assert.equal((await tweedeHand.bevestig({ id: b.body.aanvraag.id, door: 'user-2' })).status, 404, 'de handtekening is opgebruikt');
  /* En met de noodstop aan komt er niet eens een aanvraag. */
  const c = await roep('/api/office/connect/afrekening', Object.assign({}, lijf, { id: 'afr-twee-3' }), 'user-1');
  assert.equal(c.status, 503);
  assert.equal(tweedeHand.open().aanvragen.length, 0);
});
