/* PARTNERAFREKENING OVER STRIPE CONNECT (server/betaal/connect/), tegen een
   nagemaakte Stripe (test/nep-stripe.js).

   Wat hier wordt nagetrokken is ONZE kant: de standentabel, de sleutels, de
   twee poorten, en wat er gebeurt bij dubbele, te late, vervalste en verloren
   meldingen, bij een crash halverwege en bij een noodstop tijdens het werk. Dat
   Stripe zich gedraagt zoals deze nagemaakte versie, bewijst deze toets NIET --
   dat doet alleen scripts/extern-bewijs-stripe-connect.js tegen een echte
   sandbox.

   De vrijgavepoort is hier de ECHTE evaluator (server/kern/vrijgave/), met
   alleen het bewijs, de bevoegdheid en de providergezondheid ingespoten: zo
   raakt een fout in de poort ook deze toetsen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { nepStripe } = require('./nep-stripe');

const nep = nepStripe();
let Stripe, stripe;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-connect-'));
test.before(async () => {
  const basis = await nep.start();
  process.env.NODE_ENV = 'test';
  process.env.STRIPE_BASE_URL = basis;     // server/stripe.js leest dit alleen onder NODE_ENV=test
  Stripe = require('../server/stripe');
  stripe = Stripe('sk_test_nep');
});
test.after(async () => { await nep.stop(); fs.rmSync(TMP, { recursive: true, force: true }); });

const { maakConnect } = require('../server/betaal/connect');
const S = require('../server/betaal/connect/sleutel');
const { maakVrijgave } = require('../server/kern/vrijgave');
const { maakStand } = require('../server/kern/vrijgave/stand');

let teller = 0;
function poort({ open = ['geld.provider.stripe', 'geld.provider.stripe_connect', 'geld.partnerafrekening'] } = {}) {
  const stand = maakStand({ bestand: path.join(TMP, 'stand-' + (++teller) + '.json') });
  const v = maakVrijgave({ stand, openbaar: () => false,
    bewijs: { oordeel: () => ({ geverifieerd: true, reden: 'proefbewijs' }) },
    bevoegd: { mag: () => ({ mag: true, via: 'proef' }) },
    providerGezond: () => ({ gezond: true }) });
  for (const b of ['provider.stripe', 'provider.stripe_connect'])
    assert.ok(v.besluitVastleggen(b, { wie: 'user-1', bron: 'proefdossier-1', sha256: 'a'.repeat(64), reden: 'proef van het besluit', stapOmhoog: true }).ok);
  for (const id of open) assert.ok(v.zet(id, 'enabled', { wie: 'user-1', reden: 'proef van de vrijgave', stapOmhoog: true }).ok, id);
  return v;
}
function wereld(opties = {}) {
  const db = { data: {} };
  const grootboek = new Map(), boekingen = [];
  const boekEffect = opties.zonderGrootboek ? null : (e) => {
    boekingen.push(e);
    if (opties.weigerReservering && e.soort === 'reservering') throw new Error('te weinig partnersaldo');
    if (!grootboek.has(e.sleutel)) grootboek.set(e.sleutel, e);
  };
  const vrijgave = opties.vrijgave || poort();
  const c = maakConnect({ db, save: () => {}, stripe, vrijgave, boekEffect });
  return { db, c, grootboek, boekingen, vrijgave };
}
const aanvraag = (id, extra) => Object.assign({ id, partner: 'zaak-1', account: 'acct_partner1', centen: 2500, valuta: 'eur', wie: 'user-1' }, extra || {});
const verzoekenNaar = (pad) => nep.verzoeken.filter(v => v.methode === 'POST' && v.pad === pad);

test('de gelukkige weg: transfer, payout met Stripe-Account, betaald; effecten precies een keer', async () => {
  const { c, grootboek, boekingen } = wereld();
  const voorT = verzoekenNaar('/v1/transfers').length, voorP = verzoekenNaar('/v1/payouts').length;
  c.aanvragen(aanvraag('afr-gelukkig-1'));
  const rec = await c.indienen('afr-gelukkig-1');
  assert.equal(rec.stand, 'onderweg');
  const t = verzoekenNaar('/v1/transfers').slice(voorT), p = verzoekenNaar('/v1/payouts').slice(voorP);
  assert.equal(t.length, 1); assert.equal(p.length, 1);
  assert.equal(t[0].idem, S.idemTransfer('afr-gelukkig-1'), 'de transfer draagt de afgeleide sleutel');
  assert.equal(p[0].idem, S.idemPayout('afr-gelukkig-1'));
  assert.equal(p[0].account, 'acct_partner1', 'de payout gaat met de Stripe-Account-kop');
  assert.equal(t[0].body.destination, 'acct_partner1');
  const po = nep.payouts.get(rec.payoutId); po.status = 'paid';
  c.verwerk(nep.gebeurtenis('payout.paid', po, 'acct_partner1'));
  assert.equal(c.opslag.haal('afr-gelukkig-1').stand, 'betaald');
  assert.equal(grootboek.get(S.economisch('afr-gelukkig-1', 'afgerekend')).centen, 2500);
  assert.equal(boekingen.filter(b => b.afrekening === 'afr-gelukkig-1').length, 2, 'reservering en afgerekend, verder niets');
});

test('dezelfde melding twee keer, en een herhaalde aanvraag: geen tweede effect, geen tweede transfer', async () => {
  const { c, boekingen } = wereld();
  c.aanvragen(aanvraag('afr-dubbel-1'));
  assert.equal(c.aanvragen(aanvraag('afr-dubbel-1')).herhaald, true);
  assert.throws(() => c.aanvragen(aanvraag('afr-dubbel-1', { centen: 9999 })), e => e.code === 'BOTSING',
    'hetzelfde id met een ander bedrag is een andere gebeurtenis');
  const voor = verzoekenNaar('/v1/transfers').length;
  const rec = await c.indienen('afr-dubbel-1');
  await c.indienen('afr-dubbel-1');
  assert.equal(verzoekenNaar('/v1/transfers').length - voor, 1, 'een tweede indiening maakte een tweede transfer');
  const po = nep.payouts.get(rec.payoutId); po.status = 'paid';
  const evt = nep.gebeurtenis('payout.paid', po, 'acct_partner1');
  c.verwerk(evt);
  assert.equal(c.verwerk(evt).herhaald, true);
  assert.equal(boekingen.filter(b => b.afrekening === 'afr-dubbel-1' && b.soort === 'afgerekend').length, 1);
});

test('te laat en in de verkeerde volgorde: payout.failed na betaald verandert niets en wordt een bevinding', async () => {
  const { c } = wereld();
  c.aanvragen(aanvraag('afr-volgorde-1'));
  const rec = await c.indienen('afr-volgorde-1');
  const po = nep.payouts.get(rec.payoutId);
  c.verwerk(nep.gebeurtenis('payout.paid', Object.assign({}, po, { status: 'paid' }), 'acct_partner1'));
  c.verwerk(nep.gebeurtenis('payout.failed', Object.assign({}, po, { status: 'failed' }), 'acct_partner1'));
  assert.equal(c.opslag.haal('afr-volgorde-1').stand, 'betaald');
  assert.ok(c.opslag.bevindingen().some(b => b.soort === 'overgang-geweigerd' && b.afrekening === 'afr-volgorde-1'));
});

test('een melding vooruit over een gemiste stap: payout.paid terwijl de payout-id nooit is vastgelegd', async () => {
  const { c } = wereld();
  c.aanvragen(aanvraag('afr-sprong-1'));
  const rec = await c.indienen('afr-sprong-1');
  /* Simuleer de crash: het record weet de payout niet. */
  const payoutId = rec.payoutId; rec.payoutId = null; rec.stand = 'ingediend'; c.opslag.bewaar(rec);
  const po = Object.assign({}, nep.payouts.get(payoutId), { status: 'paid' });
  c.verwerk(nep.gebeurtenis('payout.paid', po, 'acct_partner1'));
  const na = c.opslag.haal('afr-sprong-1');
  assert.equal(na.stand, 'betaald'); assert.equal(na.payoutId, payoutId);
  assert.deepEqual(na.geschiedenis.slice(-2).map(g => g.naar), ['onderweg', 'betaald'], 'langs de tussenstap, niet eroverheen');
});

test('een melding van een ander account of met een ander bedrag verandert niets', async () => {
  const { c } = wereld();
  c.aanvragen(aanvraag('afr-vals-1'));
  const rec = await c.indienen('afr-vals-1');
  const po = Object.assign({}, nep.payouts.get(rec.payoutId), { status: 'paid' });
  c.verwerk(nep.gebeurtenis('payout.paid', po, 'acct_iemandanders'));
  c.verwerk(nep.gebeurtenis('payout.paid', Object.assign({}, po, { amount: 1 }), 'acct_partner1'));
  assert.equal(c.opslag.haal('afr-vals-1').stand, 'onderweg');
  const soorten = c.opslag.bevindingen().filter(b => b.afrekening === 'afr-vals-1').map(b => b.soort);
  assert.ok(soorten.includes('account-wijkt-af')); assert.ok(soorten.includes('bedrag-wijkt-af'));
});

test('crash na het versturen: het antwoord gaat verloren, de veeg haalt het in met DEZELFDE sleutel, een transfer', async () => {
  const { c } = wereld();
  c.aanvragen(aanvraag('afr-crash-1'));
  const voor = nep.transfers.size;
  nep.knop.faalNaUitvoeren = 2;        // ook de ingebouwde herhaling van de http-client gaat verloren
  await assert.rejects(c.indienen('afr-crash-1'), e => e.code === 'OPNIEUW');
  assert.equal(c.opslag.haal('afr-crash-1').stand, 'aangevraagd', 'zonder antwoord geen stand');
  nep.knop.faalNaUitvoeren = 0;
  /* Herstart: een NIEUW exemplaar van de dienst op dezelfde opslag. */
  const herstart = maakConnect({ db: null, save: () => {}, stripe, vrijgave: poort(), opslag: c.opslag,
    boekEffect: () => {} });
  const v = await herstart.veeg();
  assert.equal(v.fouten.length, 0, JSON.stringify(v.fouten));
  assert.equal(nep.transfers.size - voor, 1, 'de herhaling maakte een tweede transfer');
  assert.equal(c.opslag.haal('afr-crash-1').stand, 'onderweg');
});

test('twee processen tegelijk: zelfde sleutel, een transfer, een payout', async () => {
  const { c } = wereld();
  c.aanvragen(aanvraag('afr-tegelijk-1'));
  const tweede = maakConnect({ db: null, save: () => {}, stripe, vrijgave: poort(), opslag: c.opslag, boekEffect: () => {} });
  const voorT = nep.transfers.size, voorP = nep.payouts.size;
  nep.knop.vertraging = 30;
  await Promise.allSettled([c.indienen('afr-tegelijk-1'), tweede.indienen('afr-tegelijk-1')]);
  nep.knop.vertraging = 0;
  await c.veeg();
  assert.equal(nep.transfers.size - voorT, 1);
  assert.equal(nep.payouts.size - voorP, 1);
});

test('een definitieve weigering van Stripe: mislukt, en de reservering komt terug', async () => {
  const { c, grootboek } = wereld();
  c.aanvragen(aanvraag('afr-weiger-1'));
  nep.knop.weiger = { status: 400, bericht: 'Insufficient funds in Stripe account.' };
  const rec = await c.indienen('afr-weiger-1');
  assert.equal(rec.stand, 'mislukt');
  assert.ok(grootboek.has(S.economisch('afr-weiger-1', 'teruggeboekt')), 'het geld is nooit vertrokken, dus terug');
});

test('payout mislukt NA de transfer: geen terugboeking, wel een bevinding (het geld staat bij de partner)', async () => {
  const { c, grootboek } = wereld();
  c.aanvragen(aanvraag('afr-saldo-1'));
  const rec = await c.indienen('afr-saldo-1');
  c.verwerk(nep.gebeurtenis('payout.failed', Object.assign({}, nep.payouts.get(rec.payoutId), { status: 'failed' }), 'acct_partner1'));
  assert.equal(c.opslag.haal('afr-saldo-1').stand, 'mislukt');
  assert.equal(grootboek.has(S.economisch('afr-saldo-1', 'teruggeboekt')), false);
  assert.ok(c.opslag.bevindingen().some(b => b.soort === 'saldo-bij-partner' && b.afrekening === 'afr-saldo-1'));
  /* Wordt de transfer daarna teruggedraaid, dan komt het geld wel terug. */
  const t = nep.transfers.get(rec.transferId); t.reversed = true; t.amount_reversed = t.amount;
  c.verwerk(nep.gebeurtenis('transfer.reversed', t));
  assert.equal(c.opslag.haal('afr-saldo-1').stand, 'teruggedraaid');
  assert.ok(grootboek.has(S.economisch('afr-saldo-1', 'teruggeboekt')));
});

test('noodstop tijdens het werk: geen nieuw effect, de stand loopt door, en heraanzetten speelt niets opnieuw af', async () => {
  const v = poort();
  const { c, boekingen } = wereld({ vrijgave: v });
  c.aanvragen(aanvraag('afr-nood-1'));
  const rec = await c.indienen('afr-nood-1');
  c.aanvragen(aanvraag('afr-nood-2'));
  assert.ok(v.zet('geld.partnerafrekening', 'emergency_disabled', { wie: 'user-2', reden: 'noodstop tijdens de proef' }).ok,
    'uitzetten vraagt geen passkey');
  const voorT = nep.transfers.size;
  const veeg = await c.veeg();
  assert.ok(veeg.wacht.some(w => w.afrekening === 'afr-nood-2' && w.code === 'tijdelijk-uit'), 'de wachtende afrekening wacht');
  assert.equal(nep.transfers.size, voorT, 'tijdens de noodstop ging er een nieuwe transfer uit');
  assert.throws(() => c.aanvragen(aanvraag('afr-nood-3')), e => e.code === 'VRIJGAVE_DICHT');
  // de stand van wat al onderweg was, loopt gewoon door
  const po = nep.payouts.get(rec.payoutId); po.status = 'paid';
  const evt = nep.gebeurtenis('payout.paid', po, 'acct_partner1');
  c.verwerk(evt);
  assert.equal(c.opslag.haal('afr-nood-1').stand, 'betaald');
  const geschiedenis = JSON.stringify(c.opslag.haal('afr-nood-1').geschiedenis);
  // weer aan: de wachtende gaat precies een keer, de oude melding doet niets
  assert.ok(v.zet('geld.partnerafrekening', 'enabled', { wie: 'user-1', reden: 'noodstop voorbij in de proef', stapOmhoog: true }).ok);
  await c.veeg();
  c.verwerk(evt);
  assert.equal(nep.transfers.size - voorT, 1, 'alleen de wachtende afrekening ging alsnog');
  assert.equal(JSON.stringify(c.opslag.haal('afr-nood-1').geschiedenis), geschiedenis, 'de geschiedenis is herschreven');
  assert.equal(boekingen.filter(b => b.afrekening === 'afr-nood-1' && b.soort === 'afgerekend').length, 1);
});

test('beide poorten zijn nodig: partnerafrekening aan maar Stripe Connect uit is dicht, en Stripe ziet niets', async () => {
  const v = poort({ open: ['geld.provider.stripe', 'geld.partnerafrekening'] });
  const { c } = wereld({ vrijgave: v });
  const voor = nep.verzoeken.length;
  assert.throws(() => c.aanvragen(aanvraag('afr-poort-1')), e => e.code === 'VRIJGAVE_DICHT' && e.vrijgaveCode === 'provider-niet-beschikbaar');
  assert.equal(nep.verzoeken.length, voor);
});

test('ook als het register de afhankelijkheid kwijtraakt, vraagt de afrekening Stripe Connect zelf', () => {
  /* Het register zegt dat partnerafrekening van stripe_connect afhangt; de
     connectlaag vraagt beide toch zelf. Hier is dat register met opzet kapot
     (de afhankelijkheid weg): dan moet de tweede, eigen vraag hem tegenhouden. */
  const reg = require('../server/kern/vrijgave/register');
  const kapot = reg.REGISTER.map(c => c.id === 'geld.partnerafrekening' ? Object.assign({}, c, { afhankelijk: [] }) : c);
  const register = { REGISTER: kapot, vind: id => kapot.find(c => c.id === id) || null };
  const stand = maakStand({ bestand: path.join(TMP, 'stand-kapot.json') });
  const v = maakVrijgave({ stand, register, openbaar: () => false, bewijs: { oordeel: () => ({ geverifieerd: true, reden: 'proef' }) },
    bevoegd: { mag: () => ({ mag: true }) }, providerGezond: () => ({ gezond: true }) });
  assert.ok(v.zet('geld.partnerafrekening', 'enabled', { wie: 'user-1', reden: 'proef met kapot register', stapOmhoog: true }).ok);
  assert.equal(v.beoordeel('geld.partnerafrekening', { recht: true }).beschikbaar, true, 'het kapotte register laat hem alleen door');
  const { c } = wereld({ vrijgave: v });
  assert.throws(() => c.aanvragen(aanvraag('afr-kapot-1')), e => e.code === 'VRIJGAVE_DICHT', 'de tweede poort ontbrak');
});

test('zonder grootboekkoppeling, of met een geweigerde reservering, gaat er niets naar Stripe', () => {
  const voor = nep.verzoeken.length;
  assert.throws(() => wereld({ zonderGrootboek: true }).c.aanvragen(aanvraag('afr-gb-1')), e => e.code === 'GROOTBOEK_NIET_GEKOPPELD');
  const w = wereld({ weigerReservering: true });
  assert.throws(() => w.c.aanvragen(aanvraag('afr-gb-2')), e => e.code === 'RESERVERING_GEWEIGERD' && e.nietVerstuurd);
  assert.equal(w.c.opslag.haal('afr-gb-2').stand, 'mislukt');
  assert.equal(nep.verzoeken.length, voor);
});

test('de reconciliatie ziet een verschil tussen Stripe en RTG, en corrigeert niets', async () => {
  const { c } = wereld();
  c.aanvragen(aanvraag('afr-rec-1'));
  const rec = await c.indienen('afr-rec-1');
  let r = await c.reconciliatie();
  assert.equal(r.nieuweBevindingen.filter(b => b.afrekening === 'afr-rec-1').length, 0, 'een kloppende afrekening is stil');
  nep.payouts.get(rec.payoutId).amount = 2400;      // Stripe zegt iets anders
  r = await c.reconciliatie();
  assert.ok(r.nieuweBevindingen.some(b => b.afrekening === 'afr-rec-1' && b.soort === 'payout-wijkt-af'));
  assert.equal(c.opslag.haal('afr-rec-1').centen, 2500, 'het bedrag van RTG is niet stil aangepast');
  assert.equal(c.opslag.haal('afr-rec-1').stand, 'onderweg');
});

test('de standentabel is gesloten', () => {
  const T = require('../server/betaal/connect/toestand');
  assert.equal(T.mag('betaald', 'onderweg').mag, false);
  assert.equal(T.mag('mislukt', 'betaald').mag, false);
  assert.equal(T.mag('teruggedraaid', 'betaald').mag, false);
  assert.equal(T.mag('onderweg', 'onderweg').zelfde, true);
  assert.equal(T.mag('aangevraagd', 'vliegend').mag, false);
  assert.deepEqual(T.pad('ingediend', 'betaald'), ['onderweg', 'betaald']);
  assert.equal(T.pad('betaald', 'onderweg'), null);
});
