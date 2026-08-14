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
