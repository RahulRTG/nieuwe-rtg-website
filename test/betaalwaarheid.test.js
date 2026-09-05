/* De provider-onafhankelijke betaalwaarheid. Deze toetsen bewaken vooral de
   twee gevaarlijke grenzen: een tussenstatus is nooit betaald, en een bedrag
   dat afwijkt wordt nooit stil vrijgegeven. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const maak = require('../server/kern/betaalwaarheid');

function tuig(providerStatus, opties) {
  opties = opties || {};
  const data = {};
  let saves = 0, afgehandeld = 0, terugStatusTijdensCall = null, terugProviderId = null;
  const rail = {
    async maakBetaling(o) { return { id: 'tr_waarheid', status: providerStatus,
      betaalId: opties.betaalId || null,
      aanbieder: opties.provider || (providerStatus === 'processing' || providerStatus === 'requires_capture' ? 'stripe' : 'mollie'),
      bedrag: o.bedrag, valuta: o.valuta, checkoutUrl: 'https://pay.example/checkout' }; },
    async haalBetaling(a, id) { return { id, status: providerStatus, aanbieder: a, bedrag: 2500, valuta: 'eur' }; },
    async maakTerugbetaling(o) {
      terugStatusTijdensCall = Object.values(data.betaalWaarheid)[0].status;
      terugProviderId = o.providerId;
      return { id: 're_1', status: opties.refundStatus || 'refunded', aanbieder: opties.provider || 'mollie' };
    }
  };
  const waarheid = maak({ d: () => data, save: () => { saves++; }, crypto, betaal: rail,
    nu: (() => { let n = 0; return () => new Date(1700000000000 + n++).toISOString(); })() });
  waarheid.registreerAfhandeling('bestelling', async () => { afgehandeld++; });
  return { data, rail, waarheid, saves: () => saves, afgehandeld: () => afgehandeld,
    terugStatus: () => terugStatusTijdensCall, terugProviderId: () => terugProviderId };
}

function herstelTuig() {
  const data = {};
  let nu = Date.parse('2026-09-04T10:00:00.000Z');
  let pogingen = 0;
  const rail = {
    async maakBetaling(o) { return { id: 'tr_herstel', status: 'open', aanbieder: 'mollie',
      bedrag: o.bedrag, valuta: o.valuta }; },
    async haalBetaling() { throw new Error('niet nodig'); },
    async maakTerugbetaling() { throw new Error('niet nodig'); }
  };
  const waarheid = maak({ d: () => data, save() {}, crypto, betaal: rail,
    nu: () => new Date(nu).toISOString(), log: { uitzondering() {} } });
  waarheid.registreerAfhandeling('bestelling', async () => {
    pogingen += 1;
    if (pogingen === 1) throw new Error('database tijdelijk dicht');
  });
  return { data, waarheid, pogingen: () => pogingen, zetNu: x => { nu = x; } };
}

test('dezelfde economische sleutel blijft na een herstart dezelfde betaling', () => {
  const t = tuig('open');
  const a = t.waarheid.maak({ actor: 'Gouden Ibis', idem: 'een', soort: 'bestelling', bronRef: 'rek-1', centen: 2500 });
  const vers = maak({ d: () => t.data, save() {}, crypto, betaal: t.rail });
  const b = vers.maak({ actor: 'Gouden Ibis', idem: 'een', soort: 'bestelling', bronRef: 'rek-1', centen: 2500 });
  assert.equal(b.id, a.id);
  assert.throws(() => vers.maak({ actor: 'Gouden Ibis', idem: 'een', soort: 'bestelling', bronRef: 'rek-1', centen: 2600 }), /andere betaling/);
});

test('processing en requires_capture geven nooit vrij', async () => {
  for (const status of ['processing', 'requires_capture']) {
    const t = tuig(status);
    const w = t.waarheid.maak({ actor: 'Amberen Vos', idem: status, soort: 'bestelling', bronRef: 'r', centen: 2500 });
    const uit = await t.waarheid.begin(w.id, { aanbieder: 'stripe' });
    assert.equal(uit.betaling.definitief, false, status + ' mag niet definitief zijn');
    assert.equal(t.afgehandeld(), 0, status + ' mag het domein niet vrijgeven');
  }
  const staten = require('../server/kern/betaalwaarheid/staten');
  assert.equal(staten.definitiefBetaald(staten.providerStatus('mollie', 'authorized')), false,
    'ook Mollie authorized is nog geen ontvangen geld');
  assert.equal(staten.definitiefBetaald(staten.providerStatus('adyen', 'completed')), false,
    'een afgeronde Adyen-betaallink wacht nog op de ondertekende terugmelding');
  assert.equal(staten.definitiefBetaald(staten.providerStatus('adyen', 'captured')), true);
});

test('alleen een definitieve, bedrag-gelijke providergebeurtenis handelt eenmaal af', async () => {
  const t = tuig('open');
  const w = t.waarheid.maak({ actor: 'Amberen Vos', idem: 'goed', soort: 'bestelling', bronRef: 'r', centen: 2500 });
  await t.waarheid.begin(w.id, { aanbieder: 'mollie' });
  await t.waarheid.providerMelding({ eventId: 'evt-betaald', gebeurtenis: 'payment.paid',
    aanbieder: 'mollie', providerId: 'tr_waarheid', referentie: w.id,
    status: 'paid', bedrag: 2500, valuta: 'eur' });
  assert.equal(t.waarheid.publiek(w).status, 'BEVESTIGD');
  assert.equal(t.afgehandeld(), 1);
  await t.waarheid.providerMelding({ eventId: 'evt-betaald', gebeurtenis: 'payment.paid',
    aanbieder: 'mollie', providerId: 'tr_waarheid', status: 'paid', bedrag: 2500, valuta: 'eur' });
  assert.equal(t.afgehandeld(), 1, 'provider-retry verwerkt de bestelling niet dubbel');
  assert.match(t.waarheid.publiek(w).bewijs, /^[A-F0-9]{16}$/);
});

test('afwijkend bedrag gaat naar controle en nooit naar betaald', async () => {
  const t = tuig('open');
  const w = t.waarheid.maak({ actor: 'Amberen Vos', idem: 'verschil', soort: 'bestelling', bronRef: 'r', centen: 2500 });
  await t.waarheid.begin(w.id, { aanbieder: 'mollie' });
  await t.waarheid.providerMelding({ eventId: 'evt-verkeerd', gebeurtenis: 'payment.paid',
    aanbieder: 'mollie', providerId: 'tr_waarheid', referentie: w.id,
    status: 'paid', bedrag: 2400, valuta: 'eur' });
  assert.equal(t.waarheid.publiek(w).status, 'CONTROLE_NODIG');
  assert.equal(t.afgehandeld(), 0);
});

test('terugbetaling wordt vóór de rail in de duurzame wachtstand gezet', async () => {
  const t = tuig('paid');
  const w = t.waarheid.maak({ actor: 'Amberen Vos', idem: 'refund', soort: 'bestelling', bronRef: 'r', centen: 2500 });
  await t.waarheid.begin(w.id, { aanbieder: 'mollie' });
  const uit = await t.waarheid.terugbetalen(w.id, { centen: 1000, reden: 'Niet geleverd' });
  assert.equal(t.terugStatus(), 'TERUGBETALING_WACHT');
  assert.equal(uit.status, 'GEDEELTELIJK_TERUGBETAALD');
});

test('Adyen bewaart het echte PSP-nummer en boekt een asynchrone refund maar eenmaal', async () => {
  const t = tuig('active', { provider: 'adyen', refundStatus: 'received' });
  const w = t.waarheid.maak({ actor: 'Amberen Vos', idem: 'adyen-refund', soort: 'bestelling', bronRef: 'r', centen: 2500 });
  await t.waarheid.begin(w.id, { aanbieder: 'adyen' });
  await t.waarheid.providerMelding({ eventId: 'adyen-capture', gebeurtenis: 'CAPTURE', aanbieder: 'adyen',
    providerId: 'tr_waarheid', betaalId: '881-psp', referentie: w.id,
    status: 'captured', bedrag: 2500, valuta: 'eur' });
  const wacht = await t.waarheid.terugbetalen(w.id, { centen: 1000, reden: 'Niet geleverd' });
  assert.equal(t.terugProviderId(), '881-psp', 'refund gaat naar PSP-betaling, niet naar de betaallink');
  assert.equal(wacht.status, 'TERUGBETALING_WACHT');
  await t.waarheid.providerTerugbetaling({ eventId: 'adyen-refund', aanbieder: 'adyen',
    providerPaymentId: '881-psp', providerRefundId: '882-refund', centen: 1000, gelukt: true });
  await t.waarheid.providerTerugbetaling({ eventId: 'adyen-refund', aanbieder: 'adyen',
    providerPaymentId: '881-psp', providerRefundId: '882-refund', centen: 1000, gelukt: true });
  assert.equal(t.waarheid.publiek(w).status, 'GEDEELTELIJK_TERUGBETAALD');
  assert.equal(w.terugbetaaldCenten, 1000);
});

test('een domeinfout geeft geen vals webhook-succes en herstelt duurzaam in de ronde', async () => {
  const t = herstelTuig();
  const w = t.waarheid.maak({ actor: 'Amberen Vos', idem: 'herstel', soort: 'bestelling', bronRef: 'r', centen: 2500 });
  await t.waarheid.begin(w.id, { aanbieder: 'mollie' });
  await assert.rejects(t.waarheid.providerMelding({ eventId: 'evt-herstel', gebeurtenis: 'payment.paid',
    aanbieder: 'mollie', providerId: 'tr_herstel', status: 'paid', bedrag: 2500, valuta: 'eur' }),
  e => e && e.code === 'BETAAL_AFHANDELING_MISLUKT');
  assert.equal(w.status, 'BEVESTIGD');
  assert.equal(w.afgehandeldAt, undefined);
  assert.equal(t.data.betaalWaarheidMeldingen['evt-herstel'].verwerktAt, null);
  assert.equal(t.data.betaalWaarheidMeldingen['evt-herstel'].betalingId, w.id);

  const teVroeg = await t.waarheid.ronde({ tot: Date.parse('2026-09-04T10:00:30.000Z') });
  assert.deepEqual(teVroeg, { ok: true, bekeken: 0, gelukt: 0, mislukt: 0, meldingen: 0 });
  t.zetNu(Date.parse('2026-09-04T10:01:01.000Z'));
  const hersteld = await t.waarheid.ronde();
  assert.equal(hersteld.gelukt, 1);
  assert.equal(hersteld.meldingen, 1);
  assert.equal(t.pogingen(), 2);
  assert.ok(w.afgehandeldAt);
  assert.ok(t.data.betaalWaarheidMeldingen['evt-herstel'].verwerktAt);
});

test('een ontbrekende afhandelaar blijft zichtbaar en wordt nooit stil verwerkt', async () => {
  const data = {};
  const waarheid = maak({ d: () => data, save() {}, crypto,
    betaal: { async maakBetaling(o) { return { id:'tr_wees', status:'paid', aanbieder:'mollie', bedrag:o.bedrag, valuta:o.valuta }; } },
    nu: () => '2026-09-04T10:00:00.000Z', log: { uitzondering() {} } });
  const w = waarheid.maak({ actor:'Ibis', idem:'wees', soort:'onbekend', bronRef:'r', centen:100 });
  await assert.rejects(waarheid.begin(w.id, { aanbieder:'mollie' }), /nog niet veilig/);
  assert.equal(w.status, 'BEVESTIGD');
  assert.equal(w.afgehandeldAt, undefined);
  assert.equal(w.afhandelingPogingen, 1);
  assert.equal((w.gebeurtenissen || []).some(x => x.soort === 'PROVIDER_FOUT'), false,
    'een bevestigde betaling met domeinfout is geen providerfout');
});

test('een lopende refund reserveert het bedrag en voorkomt samen meer terugbetalen dan ontvangen', async () => {
  let los;
  const data = {};
  const rail = {
    async maakBetaling(o) { return { id:'tr_reserveer', status:'paid', aanbieder:'mollie', bedrag:o.bedrag, valuta:o.valuta }; },
    async maakTerugbetaling() { return new Promise(resolve => { los = resolve; }); }
  };
  const waarheid = maak({ d: () => data, save() {}, crypto, betaal: rail,
    nu: () => '2026-09-04T10:00:00.000Z' });
  waarheid.registreerAfhandeling('bestelling', async () => {});
  const w = waarheid.maak({ actor:'Ibis', idem:'reserveer', soort:'bestelling', bronRef:'r', centen:2500 });
  await waarheid.begin(w.id, { aanbieder:'mollie' });
  const eerste = waarheid.terugbetalen(w.id, { idem:'refund-een', centen:2000, reden:'deel een' });
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(waarheid.terugbetalen(w.id, { idem:'refund-twee', centen:1000, reden:'deel twee' }),
    /loopt al een terugbetaling/);
  assert.equal(w.terugbetaaldCenten, 0);
  assert.equal(w.terugbetaalOpdrachten[0].status, 'VASTGELEGD');
  los({ id:'re_reserveer', status:'refunded', aanbieder:'mollie', bedrag:2000, valuta:'eur' });
  await eerste;
  assert.equal(w.terugbetaaldCenten, 2000);
  await assert.rejects(waarheid.terugbetalen(w.id, { idem:'refund-twee', centen:1000 }), /Ongeldig/);
});

test('een refund-retry gebruikt dezelfde duurzame opdracht en dezelfde providersleutel', async () => {
  const data = {};
  const sleutels = [];
  let poging = 0;
  const rail = {
    async maakBetaling(o) { return { id:'tr_retry', status:'paid', aanbieder:'mollie', bedrag:o.bedrag, valuta:o.valuta }; },
    async maakTerugbetaling(o) {
      sleutels.push(o.idempotentieSleutel); poging += 1;
      if (poging === 1) throw new Error('antwoord verloren');
      return { id:'re_retry', status:'refunded', aanbieder:'mollie', bedrag:o.bedrag, valuta:o.valuta };
    }
  };
  const waarheid = maak({ d: () => data, save() {}, crypto, betaal: rail,
    nu: () => '2026-09-04T10:00:00.000Z' });
  waarheid.registreerAfhandeling('bestelling', async () => {});
  const w = waarheid.maak({ actor:'Ibis', idem:'refund-retry', soort:'bestelling', bronRef:'r', centen:2500 });
  await waarheid.begin(w.id, { aanbieder:'mollie' });
  await assert.rejects(waarheid.terugbetalen(w.id, { idem:'vaste-refund', centen:1000 }), /antwoord verloren/);
  const uit = await waarheid.terugbetalen(w.id, { idem:'vaste-refund', centen:1000 });
  assert.equal(uit.status, 'GEDEELTELIJK_TERUGBETAALD');
  assert.equal(w.terugbetaalOpdrachten.length, 1);
  assert.deepEqual(sleutels, [sleutels[0], sleutels[0]]);
  assert.equal(w.terugbetaaldCenten, 1000);
});

test('een providerrefund met verkeerde valuta wordt niet geboekt', async () => {
  const t = tuig('paid');
  const w = t.waarheid.maak({ actor:'Ibis', idem:'refund-valuta', soort:'bestelling', bronRef:'r', centen:2500 });
  await t.waarheid.begin(w.id, { aanbieder:'mollie' });
  await t.waarheid.providerTerugbetaling({ eventId:'refund-usd', aanbieder:'mollie',
    providerPaymentId:'tr_waarheid', providerRefundId:'re_usd', centen:1000, valuta:'usd', gelukt:true });
  assert.equal(w.status, 'CONTROLE_NODIG');
  assert.equal(w.terugbetaaldCenten, 0);
  assert.equal(w.blokkade, 'terugbetaalvaluta-wijkt-af');
});

test('een refund van een andere provider kan niet via de RTG-referentie boeken', async () => {
  const t = tuig('paid');
  const w = t.waarheid.maak({ actor:'Ibis', idem:'refund-provider', soort:'bestelling', bronRef:'r', centen:2500 });
  await t.waarheid.begin(w.id, { aanbieder:'mollie' });
  await t.waarheid.providerTerugbetaling({ eventId:'stripe-tegen-mollie', aanbieder:'stripe',
    providerPaymentId:'pi_onbekend', referentie:w.id, providerRefundId:'re_verkeerd',
    centen:1000, valuta:'eur', gelukt:true });
  assert.equal(w.status, 'CONTROLE_NODIG');
  assert.equal(w.terugbetaaldCenten, 0, 'een providernaam is onderdeel van de geldidentiteit');
  assert.equal(w.blokkade, 'terugbetaalprovider-wijkt-af');
  assert.ok(t.data.betaalWaarheidMeldingen['stripe-tegen-mollie'].verwerktAt,
    'een semantische mismatch wordt niet eindeloos opnieuw aangeboden');
});

test('webhooks in verkeerde volgorde geven alleen de definitieve geldwaarheid vrij', async () => {
  const t = tuig('processing', { provider:'stripe', betaalId:'pi_volgorde' });
  const w = t.waarheid.maak({ actor:'Ibis', idem:'volgorde', soort:'bestelling', bronRef:'r', centen:2500 });
  await t.waarheid.begin(w.id, { aanbieder:'stripe' });
  await t.waarheid.providerMelding({ eventId:'evt-mislukt', gebeurtenis:'payment_intent.payment_failed',
    aanbieder:'stripe', providerId:'pi_volgorde', status:'requires_payment_method', bedrag:2500, valuta:'eur' });
  assert.equal(w.status, 'GEWEIGERD');
  assert.equal(t.afgehandeld(), 0);
  await t.waarheid.providerMelding({ eventId:'evt-geslaagd', gebeurtenis:'payment_intent.succeeded',
    aanbieder:'stripe', providerId:'pi_volgorde', status:'succeeded', bedrag:2500, valuta:'eur' });
  assert.equal(w.status, 'BEVESTIGD');
  assert.equal(t.afgehandeld(), 1);
  await t.waarheid.providerMelding({ eventId:'evt-laat-mislukt', gebeurtenis:'payment_intent.payment_failed',
    aanbieder:'stripe', providerId:'pi_volgorde', status:'requires_payment_method', bedrag:2500, valuta:'eur' });
  assert.equal(w.status, 'BEVESTIGD', 'een late foutmelding draait bevestigd geld niet terug');
  assert.equal(t.afgehandeld(), 1);
});

test('een mislukte eind-save laat de domeinafhandeling niet vals als duurzaam klaar staan', async () => {
  const betaling = { id:'BW-SAVE', status:'BEVESTIGD', soort:'bestelling', gebeurtenissen:[],
    centen:100, valuta:'eur', terugbetaaldCenten:0 };
  const data = { betaalWaarheid: { [betaling.id]: betaling } };
  let saves = 0, handelingen = 0;
  const waarheid = maak({ d: () => data, crypto, betaal:{},
    nu: () => '2026-09-04T10:00:00.000Z', log:{ uitzondering(){} },
    save() { saves += 1; if (saves === 1) throw new Error('schijf tijdelijk dicht'); } });
  waarheid.registreerAfhandeling('bestelling', async () => { handelingen += 1; });
  const eerste = await waarheid.ronde({ tot:Date.parse('2026-09-04T10:00:00.000Z') });
  assert.equal(eerste.mislukt, 1);
  assert.equal(betaling.afgehandeldAt, undefined);
  assert.equal(betaling.afhandelingPogingen, 1);
  const tweede = await waarheid.ronde({ tot:Date.parse('2026-09-04T10:02:00.000Z') });
  assert.equal(tweede.gelukt, 1);
  assert.equal(handelingen, 2, 'de handler moet idempotent zijn en wordt na de onzekere save opnieuw aangeroepen');
  assert.ok(betaling.afgehandeldAt);
});
