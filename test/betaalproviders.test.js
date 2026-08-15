'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const ontvangst = require('../server/betaal/ontvangst');
const { isBetaalactie } = require('../server/opzet/betaalstop');

test('Stripe, Mollie en Adyen zijn alle drie kiesbare gehoste klantroutes', async () => {
  const gezien = {};
  const stripe = { checkout: { sessions: {
    async create(p) { gezien.stripe = p; return { id: 'cs_1', status: 'open', payment_status: 'unpaid',
      url: 'https://checkout.stripe.com/c/pay/cs_1' }; }, async retrieve() {} } },
  paymentIntents: {}, refunds: {} };
  const mollie = { payments: { async create(p) { gezien.mollie = p; return { id: 'tr_1', status: 'open',
    _links: { checkout: { href: 'https://mollie.com/checkout/tr_1' } } }; } }, refunds: {} };
  const adyen = { merchantAccount: 'RTG_EU', paymentLinks: { async create(p) { gezien.adyen = p;
    return { id: 'PL-1', status: 'active', url: 'https://pay.adyen.com/PL-1' }; } }, refunds: {} };
  const opslag = new Map();
  const rail = ontvangst({ crypto, stripe, mollie, adyen, standaard: 'stripe',
    get: k => opslag.get(k), set: (k, v) => opslag.set(k, v), env: {} });
  assert.deepEqual(rail.mogelijkheden().rails.map(x => x.id), ['stripe', 'mollie', 'adyen']);
  const basis = { bedrag: 1895, valuta: 'eur', referentie: 'BW-KLANT', omschrijving: 'Avondeten',
    returnUrl: 'https://rtg.example/apps/bestellen.html', webhookUrl: 'https://rtg.example/api/betaal/webhook/mollie' };
  const s = await rail.maakBetaling(Object.assign({}, basis,
    { aanbieder: 'stripe', methode: 'hosted', idempotentieSleutel: 's' }));
  const m = await rail.maakBetaling(Object.assign({}, basis,
    { aanbieder: 'mollie', methode: 'ideal', idempotentieSleutel: 'm' }));
  const a = await rail.maakBetaling(Object.assign({}, basis,
    { aanbieder: 'adyen', methode: 'online', idempotentieSleutel: 'a' }));
  assert.match(s.checkoutUrl, /stripe\.com/);
  assert.match(m.checkoutUrl, /mollie\.com/);
  assert.match(a.checkoutUrl, /adyen\.com/);
  assert.equal(gezien.stripe.client_reference_id, 'BW-KLANT');
  assert.equal(gezien.mollie.metadata.referentie, 'BW-KLANT');
  assert.equal(gezien.adyen.reference, 'BW-KLANT');
  assert.equal(gezien.adyen.merchantAccount, 'RTG_EU');
});

test('bewust uit betekent geen rails en elke geldbeweging weigert fail-closed', async () => {
  const opslag = new Map();
  const rail = ontvangst({ crypto, stripe: null, mollie: null, adyen: null,
    standaard: 'uit', uit: true, get: k => opslag.get(k),
    set: (k, v) => opslag.set(k, v), env: {} });
  assert.deepEqual(rail.mogelijkheden(), {
    standaard: 'uit', rails: [], uit: true,
    uitleg: 'Betalen staat bewust uitgeschakeld; er is geen demo- of echte betaalrail actief.'
  });
  await assert.rejects(() => rail.maakBetaling({ bedrag: 1895 }), /bewust uitgeschakeld/i);
  await assert.rejects(() => rail.haalBetaling('demo', 'demo-1'), /bewust uitgeschakeld/i);
  await assert.rejects(() => rail.maakTerugbetaling({
    aanbieder: 'demo', providerId: 'demo-1', bedrag: 1895 }), /bewust uitgeschakeld/i);
  assert.equal(opslag.size, 0, 'een geweigerde betaalactie laat geen idempotentie- of geldspoor achter');
});

test('de centrale stop dekt betaalroutes maar laat gewone app- en rapportageroutes door', () => {
  const dicht = [
    '/api/pay', '/api/pay/stuur', '/api/betaal/direct', '/api/betaal/webhook/adyen',
    '/api/munt/direct', '/api/bank/overboek', '/api/bank/pas/betaal',
    '/api/booking/pay', '/api/rekening/betaal', '/api/supplier/refund',
    '/api/supplier/tafelticket/afrekenen', '/api/giftcard/buy',
    '/api/wallet/munt/wissel', '/api/office/payroll/betaalbestand'
  ];
  for (const pad of dicht) assert.equal(isBetaalactie('POST', pad), true, pad);
  const open = [
    ['GET', '/api/pay/saldo'], ['POST', '/api/facturen/overzicht'],
    ['POST', '/api/office/payroll/overzicht'], ['POST', '/api/office/payroll/loonrun'],
    ['POST', '/api/booking'], ['POST', '/api/order'],
    ['POST', '/api/bank/afschrift'], ['POST', '/api/supplier/pos/checkout']
  ];
  for (const [methode, pad] of open) assert.equal(isBetaalactie(methode, pad), false, pad);
});

test('ook een interne taak kan het pay-grootboek in de uit-stand niet bewegen', async () => {
  const eerder = process.env.RTG_BETALEN_UIT;
  process.env.RTG_BETALEN_UIT = '1';
  try {
    const db = { data: {} };
    const opdrachten = { registreerTeruggang() {}, maak: () => ({ id: 'nooit' }),
      dienIn: async () => ({ status: 'nooit' }) };
    const { pay } = require('../server/kern/pay')({
      db, save() {}, bijeen: async werk => werk(), crypto, betaal: {},
      keyVanCodenaam: () => null, sseToCustomer() {}, schoon: x => String(x || ''),
      betaaldienstKosten: () => 0, betaalOpdrachten: opdrachten
    });
    const r = await pay.boekAsync({ van: 'extern:test', naar: 'lid:test', centen: 100 });
    assert.equal(r.status, 503);
    assert.equal(r.code, 'betalingen-uit');
    assert.deepEqual(db.data, {});
  } finally {
    if (eerder == null) delete process.env.RTG_BETALEN_UIT;
    else process.env.RTG_BETALEN_UIT = eerder;
  }
});
