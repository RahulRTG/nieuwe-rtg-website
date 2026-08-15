'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maak = require('../server/kern/betaalregie');

function regie(env, actief, uit) {
  const data = {};
  let saves = 0;
  const betaal = { BETALEN_AAN: !uit, mogelijkheden: () => uit
    ? { standaard: 'uit', rails: [], uit: true }
    : { rails: actief ? [{ id: actief, echt: true }] : [{ id: 'demo', echt: false }] } };
  const r = maak({ d: () => data, save: () => { saves++; }, betaal, env: env || {}, nu: () => '2026-08-14T10:00:00.000Z' });
  return { r, data, saves: () => saves };
}

test('toont drie providers, maar nooit de geheime waarden', () => {
  const sleutel = 'sk_live_DIT_MAG_NOOIT_IN_HET_ANTWOORD';
  const { r } = regie({ STRIPE_SECRET_KEY: sleutel, APP_URL: 'https://app.rahultravelgroup.com' });
  const beeld = r.overzicht();
  assert.deepEqual(beeld.providers.map(x => x.id), ['stripe', 'mollie', 'adyen']);
  assert.equal(beeld.providers[0].werkt, 'onvolledig');
  assert.equal(JSON.stringify(beeld).includes(sleutel), false);
  assert.equal(beeld.problemen.some(x => x.code === 'GEEN-ECHTE-PROVIDER'), true);
});

test('bewust uit is een gezonde toestand en vraagt niet om een provider', () => {
  const { r } = regie({ RTG_BETALEN_UIT: '1' }, null, true);
  const beeld = r.overzicht();
  assert.equal(beeld.betalingenUit, true);
  assert.equal(beeld.gezond, true);
  assert.equal(beeld.problemen.some(x => x.code === 'GEEN-ECHTE-PROVIDER'), false);
});

test('IT kan koppelen en beproeven, maar niet zelf live zetten', () => {
  const { r, data } = regie({}, null);
  r.zetFase('mollie', 'aanvraag', 'IT-team', '', 'it');
  assert.equal(data.betaalRegie.providers.mollie.fase, 'aanvraag');
  assert.throws(() => r.zetFase('mollie', 'live', 'IT-team', '', 'it'), /eigenaar/);
  const proef = r.proef('mollie', 'IT-team');
  assert.equal(proef.ok, false);
  assert.equal(data.betaalRegie.audit.length, 2);
});

test('eigenaar kan pas na complete, actieve koppeling live vrijgeven', () => {
  const env = { STRIPE_SECRET_KEY: 'sk_live_veilig', STRIPE_WEBHOOK_SECRET: 'whsec_veilig',
    APP_URL: 'https://app.rahultravelgroup.com' };
  const { r, data } = regie(env, 'stripe');
  assert.equal(r.proef('stripe', 'Eigenaar').ok, true);
  r.kiesVoorkeur('stripe', 'Eigenaar');
  const beeld = r.zetFase('stripe', 'live', 'Eigenaar', 'goedgekeurd', 'eigenaar');
  assert.equal(data.betaalRegie.providers.stripe.fase, 'live');
  assert.equal(beeld.voorkeur, 'stripe');
  assert.equal(beeld.providers[0].gereed, true);
});

test('Adyen gebruikt exact de live Checkout-URL en een geldige HMAC-sleutel', () => {
  const env = { ADYEN_API_KEY:'AQE_veilig', ADYEN_MERCHANT_ACCOUNT:'RahulTravelGroupECOM',
    ADYEN_HMAC_KEY:'a'.repeat(64),
    ADYEN_CHECKOUT_BASE_URL:'https://rtg-checkout-live.adyenpayments.com/checkout/v72',
    APP_URL:'https://app.rahultravelgroup.com' };
  const { r } = regie(env, 'adyen');
  assert.equal(r.overzicht().providers.find(x => x.id === 'adyen').gereed, true);
  env.ADYEN_CHECKOUT_BASE_URL = 'https://checkout-test.adyen.com/v72';
  assert.equal(r.overzicht().providers.find(x => x.id === 'adyen').gereed, false);
});

test('Financien krijgt provider-onafhankelijke betaalcijfers en controleproblemen', () => {
  const { r, data } = regie({}, null);
  data.betaalWaarheid = {
    a: { id:'BW-A', provider:'stripe', status:'BEVESTIGD', centen:1299, terugbetaaldCenten:0, bijgewerktAt:'2026-08-14T09:00:00Z' },
    b: { id:'BW-B', provider:'mollie', status:'CONTROLE_NODIG', centen:500, terugbetaaldCenten:0, bijgewerktAt:'2026-08-14T10:00:00Z' },
    c: { id:'BW-C', provider:'adyen', status:'TERUGBETAALD', centen:2000, terugbetaaldCenten:2000, bijgewerktAt:'2026-08-13T10:00:00Z' }
  };
  const beeld = r.overzicht();
  assert.equal(beeld.cijfers.totaal, 3);
  assert.equal(beeld.cijfers.bevestigdCenten, 3299);
  assert.equal(beeld.cijfers.terugbetaaldCenten, 2000);
  assert.equal(beeld.cijfers.controleNodig, 1);
  assert.equal(beeld.cijfers.recent[0].id, 'BW-B');
  assert.equal(beeld.problemen.some(x => x.code === 'BETALING-CONTROLE'), true);
});
