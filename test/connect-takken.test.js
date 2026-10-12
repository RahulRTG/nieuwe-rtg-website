/* PARTNERAFREKENING OVER STRIPE CONNECT, de zijpaden: de vormkeuring van een
   aanvraag, een herhaald id met andere gegevens, een geweigerde reservering,
   iedere soort melding (onbekend, ander account, ander bedrag, gedeeltelijk
   teruggedraaid), de veeg bij een dichte poort, en elke bevinding die de
   reconciliatie kan schrijven.

   Anders dan test/connect-afrekening.test.js draait dit tegen een Stripe die
   alleen in het geheugen bestaat (geen HTTP) en een vrijgavepoort die we per
   toets open of dicht zetten: het gaat hier om de beslissingen van ONZE kant. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakConnect } = require('../server/betaal/connect');
const { definitief } = require('../server/betaal/connect/afrekening');
const { PAYOUT_STATUS } = require('../server/betaal/connect/melding');
const maakReconciliatie = require('../server/betaal/connect/reconciliatie');
const { maakOpslag } = require('../server/betaal/connect/opslag');
const S = require('../server/betaal/connect/sleutel');

function geheugenStripe() {
  const transfers = new Map(), payouts = new Map();
  let n = 0;
  const zelf = {
    transfers: {
      create: async (b) => { const t = { id: 'tr_' + (++n), amount: b.amount, currency: b.currency, destination: b.destination }; transfers.set(t.id, t); return t; },
      retrieve: async (id) => { if (zelf.storing) throw zelf.storing; return transfers.get(id) || null; },
    },
    payouts: {
      create: async (b) => { const p = { id: 'po_' + (++n), amount: b.amount, status: 'pending' }; payouts.set(p.id, p); return p; },
      retrieve: async (id) => { if (zelf.storing) throw zelf.storing; return payouts.get(id) || null; },
    },
    transfersMap: transfers, payoutsMap: payouts, storing: null,
  };
  return zelf;
}
function poort() {
  const p = { dicht: false, eis(id) { if (p.dicht) { const e = new Error('dicht'); e.code = 'VRIJGAVE_DICHT'; e.vrijgaveCode = id; throw e; } } };
  return p;
}
function wereld(opties = {}) {
  const db = { data: {} };
  const boekingen = [];
  const boekEffect = opties.zonderGrootboek ? null : async (e) => {
    boekingen.push(e);
    if (opties.weiger && opties.weiger(e)) throw new Error('geweigerd door grootboek');
    return opties.uitslag;
  };
  const stripe = opties.zonderStripe ? null : geheugenStripe();
  const vrijgave = poort();
  const audit = opties.audit || (() => {});
  const c = maakConnect({ db, save: () => {}, stripe, vrijgave, boekEffect, audit, nu: () => Date.UTC(2026, 9, 12) });
  return { db, c, stripe, vrijgave, boekingen };
}
const aanvraag = (id, extra) => Object.assign({ id, partner: 'zaak-1', account: 'acct_partner1', centen: 2500, valuta: 'eur', wie: 'user-1' }, extra || {});
const codeIs = (code, status) => e => e.code === code && (status == null || e.status === status);

test('definitief: alleen een 4xx van Stripe, behalve 409 en 429', () => {
  assert.equal(definitief(null), false);
  assert.equal(definitief({}), false);
  assert.equal(definitief({ status: 400 }), true);
  assert.equal(definitief({ status: 404 }), true);
  assert.equal(definitief({ status: 409 }), false);
  assert.equal(definitief({ status: 429 }), false);
  assert.equal(definitief({ status: 500 }), false);
  assert.equal(definitief({ status: '400' }), false);
});

test('keurAanvraag weigert elke vorm die niet klopt, met de juiste status', () => {
  const { c } = wereld();
  const goed = aanvraag('afr-vorm-1');
  assert.doesNotThrow(() => c.keurAanvraag(goed));
  assert.throws(() => c.keurAanvraag(), codeIs('ONGELDIG', 400));
  assert.throws(() => c.keurAanvraag({ ...goed, id: 'x' }), /geldig afrekening-id/);
  assert.throws(() => c.keurAanvraag({ ...goed, account: 'acct_1' }), /verbonden Stripe-account/);
  assert.throws(() => c.keurAanvraag({ ...goed, account: undefined }), /verbonden Stripe-account/);
  for (const centen of [0, 1.5, 10000001, '2500']) assert.throws(() => c.keurAanvraag({ ...goed, centen }), /Bedrag in centen/);
  assert.throws(() => c.keurAanvraag({ ...goed, valuta: 'EUR' }), /drie kleine letters/);
  assert.throws(() => c.keurAanvraag({ ...goed, wie: 'kantoor' }), codeIs('ONGELDIG', 403));
  assert.throws(() => c.keurAanvraag({ ...goed, wie: undefined }), codeIs('ONGELDIG', 403));
  assert.doesNotThrow(() => c.keurAanvraag({ id: goed.id, account: goed.account, centen: 1, wie: 'user-2' }), 'valuta valt terug op eur');
});

test('aanvragen: hetzelfde id is een herhaling, met andere gegevens een botsing', async () => {
  const { c, boekingen } = wereld();
  const eerste = await c.aanvragen(aanvraag('afr-herhaal-1', { reden: 'r'.repeat(400), bevestigdDoor: 'user-7' }));
  assert.equal(eerste.herhaald, false);
  assert.equal(eerste.afrekening.reden.length, 300, 'de reden wordt afgekapt');
  assert.equal(eerste.afrekening.bevestigdDoor, 'user-7');
  assert.equal(eerste.afrekening.op, '2026-10-12T00:00:00.000Z', 'de klok komt van nu()');
  const tweede = await c.aanvragen(aanvraag('afr-herhaal-1'));
  assert.equal(tweede.herhaald, true);
  assert.equal(boekingen.length, 1, 'een herhaling boekt niets');
  for (const anders of [{ account: 'acct_partner2' }, { centen: 2600 }, { valuta: 'usd' }, { partner: 'zaak-2' }, { partner: undefined }])
    await assert.rejects(c.aanvragen(aanvraag('afr-herhaal-1', anders)), codeIs('BOTSING', 409));
});

test('aanvragen: een onbekende bevestiger en een ontbrekende partner of reden worden leeg', async () => {
  const { c } = wereld();
  const { afrekening } = await c.aanvragen({ id: 'afr-leeg-01', account: 'acct_partner1', centen: 5, wie: 'user-3', bevestigdDoor: 'iemand' });
  assert.equal(afrekening.bevestigdDoor, null);
  assert.equal(afrekening.partner, '');
  assert.equal(afrekening.reden, '');
  assert.equal(afrekening.valuta, 'eur');
});

test('aanvragen zonder grootboekkoppeling weigert, en er komt geen record', async () => {
  const { c } = wereld({ zonderGrootboek: true });
  await assert.rejects(c.aanvragen(aanvraag('afr-zonder-1')), codeIs('GROOTBOEK_NIET_GEKOPPELD', 503));
  assert.equal(c.opslag.haal('afr-zonder-1'), null);
});

test('aanvragen bij een dichte poort weigert voordat er iets wordt vastgelegd', async () => {
  const { c, vrijgave } = wereld();
  vrijgave.dicht = true;
  await assert.rejects(c.aanvragen(aanvraag('afr-dicht-1')), codeIs('VRIJGAVE_DICHT'));
  assert.equal(c.opslag.alle().length, 0);
});

test('een geweigerde reservering laat het record als mislukt staan en verstuurt niets', async () => {
  const { c, stripe } = wereld({ weiger: e => e.soort === 'reservering' });
  await assert.rejects(c.aanvragen(aanvraag('afr-weiger-1')), e => e.code === 'RESERVERING_GEWEIGERD' && e.nietVerstuurd === true);
  const rec = c.opslag.haal('afr-weiger-1');
  assert.equal(rec.stand, 'mislukt');
  assert.match(rec.geschiedenis.at(-1).reden, /geweigerd door grootboek/);
  assert.equal(stripe.transfersMap.size, 0);
});

test('een audit die gooit, breekt de aanvraag niet', async () => {
  const { c } = wereld({ audit: () => { throw new Error('auditlog vol'); } });
  const uit = await c.aanvragen(aanvraag('afr-audit-1'));
  assert.equal(uit.afrekening.stand, 'aangevraagd');
});

// ------------------------------------------------------------------ meldingen

async function onderweg(w, id, extra) {
  await w.c.aanvragen(aanvraag(id, extra));
  return w.c.indienen(id);
}
const melding = (id, type, object, account) => ({ id, type, account, data: { object } });

test('verwerk: geen melding, een herhaling en een niet-relevante soort', async () => {
  const { c } = wereld();
  assert.deepEqual(await c.verwerk(null), { genegeerd: 'geen melding' });
  assert.deepEqual(await c.verwerk({ id: 'evt_1' }), { genegeerd: 'geen melding' });
  assert.deepEqual(await c.verwerk({ id: 'evt_1', type: 'charge.succeeded' }), { genegeerd: 'charge.succeeded' });
  assert.deepEqual(await c.verwerk({ id: 'evt_1', type: 'charge.succeeded' }), { herhaald: true });
});

test('verwerk: een melding over iets onbekends wordt een bevinding', async () => {
  const { c } = wereld();
  assert.deepEqual(await c.verwerk(melding('evt_o1', 'payout.paid', { id: 'po_vreemd' })), { onbekend: true });
  assert.deepEqual(await c.verwerk({ id: 'evt_o2', type: 'transfer.created' }), { onbekend: true }, 'zonder data.object');
  assert.deepEqual(await c.verwerk(melding('evt_o3', 'payout.paid', { metadata: { afrekening: 'afr-bestaat-niet' } })), { onbekend: true });
  const b = c.lijst().bevindingen.filter(x => x.soort === 'onbekende-melding');
  assert.equal(b.length, 3);
  assert.equal(b[0].object, 'po_vreemd');
  assert.equal(b[1].object, null);
});

test('verwerk: een payout van een ander account of met een ander bedrag verandert de stand niet', async () => {
  const w = wereld();
  const rec = await onderweg(w, 'afr-afwijk-1');
  assert.equal(rec.stand, 'onderweg');
  assert.deepEqual(await w.c.verwerk(melding('evt_a1', 'payout.paid', { id: rec.payoutId, amount: 2500 }, 'acct_ander9')),
    { bevinding: 'account-wijkt-af' });
  assert.deepEqual(await w.c.verwerk(melding('evt_a2', 'payout.paid', { metadata: { afrekening: 'afr-afwijk-1' }, amount: 1 }, 'acct_partner1')),
    { bevinding: 'bedrag-wijkt-af' });
  assert.equal(w.c.opslag.haal('afr-afwijk-1').stand, 'onderweg');
  const soorten = w.c.lijst().bevindingen.map(b => b.soort);
  assert.ok(soorten.includes('account-wijkt-af') && soorten.includes('bedrag-wijkt-af'));
});

test('verwerk: payout.updated en payout.created volgen de status; een onbekende status doet niets', async () => {
  const w = wereld();
  const rec = await onderweg(w, 'afr-update-1');
  const r1 = await w.c.verwerk(melding('evt_u1', 'payout.updated', { id: rec.payoutId, status: 'weird' }));
  assert.equal(r1.toegepast, null);
  const r2 = await w.c.verwerk(melding('evt_u2', 'payout.created', { id: rec.payoutId, status: 'in_transit' }));
  assert.equal(r2.toegepast, true, 'dezelfde stand is een veilige herhaling');
  const r3 = await w.c.verwerk(melding('evt_u3', 'payout.updated', { id: rec.payoutId, status: 'paid', amount: 2500 }));
  assert.equal(r3.stand, 'betaald');
  const r4 = await w.c.verwerk(melding('evt_u4', 'payout.something', { id: rec.payoutId }));
  assert.equal(r4.toegepast, null);
});

test('verwerk: een payoutmelding na een verloren payout-id legt het id vast en loopt de tussenstappen', async () => {
  const w = wereld();
  await w.c.aanvragen(aanvraag('afr-gemist-1'));
  const rec = w.c.opslag.haal('afr-gemist-1');
  // de transfer staat, maar de payout-id is bij een crash nooit vastgelegd
  rec.transferId = 'tr_handmatig'; rec.stand = 'ingediend';
  const uit = await w.c.verwerk(melding('evt_g1', 'payout.paid', { id: 'po_gemist', metadata: { afrekening: 'afr-gemist-1' } }));
  assert.equal(uit.stand, 'betaald');
  const na = w.c.opslag.haal('afr-gemist-1');
  assert.equal(na.payoutId, 'po_gemist');
  assert.deepEqual(na.geschiedenis.map(g => g.naar), ['aangevraagd', 'onderweg', 'betaald']);
  assert.match(na.geschiedenis.find(g => g.naar === 'onderweg').bron, /tussenstap/);
  assert.ok(w.boekingen.some(b => b.soort === 'afgerekend'));
});

test('verwerk: een overgang die niet bestaat (betaald -> mislukt) wordt een bevinding', async () => {
  const w = wereld();
  const rec = await onderweg(w, 'afr-terug-1');
  await w.c.verwerk(melding('evt_t1', 'payout.paid', { id: rec.payoutId }));
  const uit = await w.c.verwerk(melding('evt_t2', 'payout.failed', { id: rec.payoutId }));
  assert.equal(uit.toegepast, false);
  assert.equal(uit.stand, 'betaald');
  assert.ok(w.c.lijst().bevindingen.some(b => b.soort === 'overgang-geweigerd' && b.naar === 'mislukt'));
});

test('verwerk: transfer.reversed -- geheel draait terug, gedeeltelijk wordt een bevinding', async () => {
  const w = wereld();
  const a = await onderweg(w, 'afr-rev-01');
  const deel = await w.c.verwerk(melding('evt_r1', 'transfer.reversed', { id: a.transferId, amount_reversed: 100 }));
  assert.equal(deel.toegepast, null);
  assert.ok(w.c.lijst().bevindingen.some(b => b.soort === 'gedeeltelijk-teruggedraaid' && b.teruggedraaid === 100));
  const heel = await w.c.verwerk(melding('evt_r2', 'transfer.reversed', { id: a.transferId, reversed: true }));
  assert.equal(heel.stand, 'teruggedraaid');
  assert.ok(w.boekingen.some(b => b.soort === 'teruggeboekt' && b.afrekening === 'afr-rev-01'));
  const anders = await w.c.verwerk(melding('evt_r3', 'transfer.updated', { id: a.transferId }));
  assert.equal(anders.toegepast, null, 'een andere transfermelding verandert niets');
});

// ------------------------------------------------------------------ veeg

test('veeg: een dichte poort laat wachten, een gewone fout komt in de fouten', async () => {
  const w = wereld();
  await w.c.aanvragen(aanvraag('afr-veeg-01'));
  w.vrijgave.dicht = true;
  const dicht = await w.c.veeg();
  assert.deepEqual(dicht.wacht, [{ afrekening: 'afr-veeg-01', code: 'geld.partnerafrekening' }]);
  assert.equal(dicht.ingediend, 0);
  w.vrijgave.dicht = false;
  w.stripe.transfers.create = async () => { throw Object.assign(new Error('time-out'), { status: 503 }); };
  const fout = await w.c.veeg();
  assert.equal(fout.fouten.length, 1);
  assert.match(fout.fouten[0].fout, /geen uitsluitsel over de transfer/);
});

test('veeg zonder Stripe: indienen faalt en wordt als fout genoteerd', async () => {
  const w = wereld({ zonderStripe: true });
  await w.c.aanvragen(aanvraag('afr-geenstripe'));
  const uit = await w.c.veeg();
  assert.equal(uit.bekeken, 1);
  assert.match(uit.fouten[0].fout, /niet geconfigureerd/);
});

test('veeg: haalt de payoutstand op, schrijft een bedragafwijking en ziet een teruggedraaide transfer', async () => {
  const w = wereld();
  const a = await onderweg(w, 'afr-veeg-betaald');
  const b = await onderweg(w, 'afr-veeg-bedrag');
  const c = await onderweg(w, 'afr-veeg-rev');
  const d = await onderweg(w, 'afr-veeg-stil');
  w.stripe.payoutsMap.get(a.payoutId).status = 'paid';
  Object.assign(w.stripe.payoutsMap.get(b.payoutId), { status: 'paid', amount: 1 });
  w.stripe.transfersMap.get(c.transferId).amount_reversed = 2500;
  void d;
  const uit = await w.c.veeg();
  assert.equal(uit.bekeken, 4);
  assert.deepEqual(uit.fouten, []);
  assert.equal(w.c.opslag.haal('afr-veeg-betaald').stand, 'betaald');
  assert.equal(w.c.opslag.haal('afr-veeg-bedrag').stand, 'onderweg', 'een ander bedrag zet niets');
  assert.ok(w.c.lijst().bevindingen.some(x => x.soort === 'bedrag-wijkt-af' && x.bron === 'veeg'));
  assert.equal(w.c.opslag.haal('afr-veeg-rev').stand, 'teruggedraaid');
  assert.equal(w.c.opslag.haal('afr-veeg-stil').stand, 'onderweg');
  // een tweede veeg slaat de teruggedraaide over (niet bekeken) en haalt alleen het effect in
  const nog = await w.c.veeg();
  assert.equal(nog.bekeken, 3);
});

test('veeg: een teruggedraaide afrekening waarvan het effect niet geboekt kan worden, geeft een fout', async () => {
  let weiger = false;
  const w = wereld({ weiger: e => weiger && e.soort === 'teruggeboekt' });
  const a = await onderweg(w, 'afr-veeg-tb01');
  const rec = w.c.opslag.haal(a.id);
  rec.stand = 'teruggedraaid';
  weiger = true;
  const uit = await w.c.veeg();
  assert.equal(uit.bekeken, 0);
  assert.equal(uit.fouten.length, 1);
  assert.match(uit.fouten[0].fout, /geweigerd door grootboek/);
});

test('veeg: een storing bij het ophalen wordt een fout per afrekening', async () => {
  const w = wereld();
  await onderweg(w, 'afr-veeg-storing');
  w.stripe.storing = new Error('netwerk weg');
  const uit = await w.c.veeg();
  assert.deepEqual(uit.fouten, [{ afrekening: 'afr-veeg-storing', fout: 'netwerk weg' }]);
});

// ------------------------------------------------------------------ reconciliatie

function losseOpslag() {
  return maakOpslag({ db: { data: {} }, save: () => {} });
}
const rec = (id, extra) => Object.assign({ id, partner: 'p', account: 'acct_partner1', centen: 1000, valuta: 'eur', stand: 'onderweg',
  transferId: null, payoutId: null, geschiedenis: [] }, extra || {});
const zetEffect = (opslag, id, soort) => opslag.effect(S.economisch(id, soort), { soort });

test('reconciliatie zonder Stripe: alleen het effectjournaal naast de stand', async () => {
  const o = losseOpslag();
  o.bewaar(rec('r-betaald', { stand: 'betaald' }));                      // reservering en afgerekend ontbreken
  o.bewaar(rec('r-mislukt-voor', { stand: 'mislukt' }));                  // nooit gereserveerd: niets te melden
  o.bewaar(rec('r-mislukt-res', { stand: 'mislukt' })); zetEffect(o, 'r-mislukt-res', 'reservering');
  o.bewaar(rec('r-geann-res', { stand: 'geannuleerd' })); zetEffect(o, 'r-geann-res', 'reservering');
  o.bewaar(rec('r-terug', { stand: 'teruggedraaid', transferId: 'tr_9' })); zetEffect(o, 'r-terug', 'reservering');
  o.bewaar(rec('r-zonder-stand', { stand: 'onderweg' })); zetEffect(o, 'r-zonder-stand', 'reservering'); zetEffect(o, 'r-zonder-stand', 'afgerekend');
  o.bewaar(rec('r-goed', { stand: 'betaald' })); zetEffect(o, 'r-goed', 'reservering'); zetEffect(o, 'r-goed', 'afgerekend');
  const uit = await maakReconciliatie({ opslag: o, stripe: null, PAYOUT_STATUS })();
  assert.equal(uit.gecontroleerd, 7);
  assert.equal(uit.sluit, false);
  const per = id => uit.nieuweBevindingen.filter(b => b.afrekening === id).map(b => b.soort + ':' + (b.effect || ''));
  assert.deepEqual(per('r-betaald'), ['effect-ontbreekt:reservering', 'effect-ontbreekt:afgerekend']);
  assert.deepEqual(per('r-mislukt-voor'), []);
  assert.deepEqual(per('r-mislukt-res'), ['effect-ontbreekt:teruggeboekt']);
  assert.deepEqual(per('r-geann-res'), ['effect-ontbreekt:teruggeboekt']);
  assert.deepEqual(per('r-terug'), ['effect-ontbreekt:teruggeboekt']);
  assert.deepEqual(per('r-zonder-stand'), ['effect-zonder-stand:afgerekend']);
  assert.deepEqual(per('r-goed'), []);
  assert.ok(uit.nieuweBevindingen.every(b => b.bron === 'reconciliatie'));
});

test('reconciliatie met Stripe: transfer en payout naast het record', async () => {
  const o = losseOpslag();
  const transfers = {
    tr_goed: { amount: 1000, currency: 'EUR', destination: 'acct_partner1' },
    tr_bedrag: { amount: 999, currency: 'eur', destination: 'acct_partner1' },
    tr_rev: { amount: 1000, currency: 'eur', destination: 'acct_partner1', amount_reversed: 1000 },
    tr_rev2: { amount: 1000, currency: 'eur', destination: 'acct_partner1', reversed: true },
  };
  const payouts = {
    po_goed: { amount: 1000, status: 'in_transit' },
    po_bedrag: { amount: 5, status: 'paid' },
    po_stand: { amount: 1000, status: 'paid' },
    po_onbekend: { amount: 1000, status: 'raar' },
  };
  const stripe = {
    transfers: { retrieve: async id => { if (id === 'tr_kapot') throw new Error('x'.repeat(200)); if (id === 'tr_tekst') throw 'kale fout'; return transfers[id] || null; } },
    payouts: { retrieve: async (id, o2) => { assert.equal(o2.stripeAccount, 'acct_partner1'); if (id === 'po_kapot') throw new Error('weg'); return payouts[id] || null; } },
  };
  const voeg = (id, extra) => { o.bewaar(rec(id, extra)); zetEffect(o, id, 'reservering'); };
  voeg('s-goed', { transferId: 'tr_goed', payoutId: 'po_goed' });
  voeg('s-bedrag', { transferId: 'tr_bedrag' });
  voeg('s-weg', { transferId: 'tr_weg' });
  voeg('s-rev', { transferId: 'tr_rev' });
  voeg('s-rev-al', { transferId: 'tr_rev2', stand: 'teruggedraaid' }); zetEffect(o, 's-rev-al', 'teruggeboekt');
  voeg('s-kapot', { transferId: 'tr_kapot', payoutId: 'po_kapot' });
  voeg('s-tekst', { transferId: 'tr_tekst' });
  voeg('s-pbedrag', { payoutId: 'po_bedrag' });
  voeg('s-pweg', { payoutId: 'po_weg' });
  voeg('s-pstand', { payoutId: 'po_stand' });
  voeg('s-pstand-terug', { payoutId: 'po_stand', stand: 'teruggedraaid' }); zetEffect(o, 's-pstand-terug', 'teruggeboekt');
  voeg('s-ponbekend', { payoutId: 'po_onbekend' });
  const uit = await maakReconciliatie({ opslag: o, stripe, PAYOUT_STATUS })();
  const per = id => uit.nieuweBevindingen.filter(b => b.afrekening === id);
  assert.deepEqual(per('s-goed'), [], 'hoofdletters in de valuta tellen niet');
  assert.equal(per('s-bedrag')[0].soort, 'transfer-wijkt-af');
  assert.equal(per('s-bedrag')[0].gezien.amount, 999);
  assert.equal(per('s-weg')[0].gezien, null);
  assert.deepEqual(per('s-rev').map(b => b.soort), ['stand-wijkt-af']);
  assert.deepEqual(per('s-rev-al'), []);
  const kapot = per('s-kapot');
  assert.deepEqual(kapot.map(b => b.wat), ['transfer', 'payout']);
  assert.equal(kapot[0].fout.length, 120, 'de foutmelding wordt afgekapt');
  assert.equal(per('s-tekst')[0].fout, 'kale fout');
  assert.equal(per('s-pbedrag')[0].soort, 'payout-wijkt-af');
  assert.equal(per('s-pweg')[0].gezien, null);
  assert.deepEqual(per('s-pstand').map(b => [b.soort, b.stripe, b.rtg]), [['stand-wijkt-af', 'betaald', 'onderweg']]);
  assert.deepEqual(per('s-pstand-terug'), []);
  assert.deepEqual(per('s-ponbekend'), []);
});

test('reconciliatie op een schone stand sluit', async () => {
  const o = losseOpslag();
  const uit = await maakReconciliatie({ opslag: o, stripe: null, PAYOUT_STATUS })();
  assert.deepEqual(uit, { gecontroleerd: 0, nieuweBevindingen: [], sluit: true });
});
