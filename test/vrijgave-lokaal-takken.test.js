/* DE RANDEN VAN DE LOKALE REGEL, DE PROVIDERGEZONDHEID EN DE AUTORISATIE-AS
   (server/kern/vrijgave/lokaal.js, antwoord.js en autorisatie.js).

   lokaal.js: iedere reden waarom een niet-productie-installatie toch NIET als
   lokaal telt (poortwachter, een eigen APP_URL, eigen TLS, een bind die niet
   de loopback is) en een storing in de lokaal-lezing die niets stil "bewezen"
   maakt. antwoord.js: per provider welke sleutels samen pas gezond zijn.
   autorisatie.js: een vermogen dat gooit, een land dat meegaat, en een besluit
   dat op een neprail niet van toepassing is. Alle omgevingen zijn objecten in
   de toets; process.env wordt niet aangeraakt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { lokaleInstallatie, sandboxMag, stand } = require('../server/kern/vrijgave/lokaal');
const { providerUitOmgeving, CODES, ZIN, STATUS } = require('../server/kern/vrijgave/antwoord');
const maakAutorisatie = require('../server/kern/vrijgave/autorisatie');
const { LOKAAL_BEVESTIGD } = require('../server/config/omgeving');

test('de stand: niet gezet of leeg is development, al het andere telt letterlijk', () => {
  assert.equal(stand({}), 'development');
  assert.equal(stand({ NODE_ENV: '' }), 'development');
  assert.equal(stand({ NODE_ENV: 'test' }), 'test');
  assert.equal(sandboxMag({ NODE_ENV: '' }).ja, true);
  assert.deepEqual(sandboxMag({ NODE_ENV: 'staging' }), { ja: false, waarom: 'onbekende NODE_ENV' });
  assert.deepEqual(lokaleInstallatie({ NODE_ENV: 'staging' }), { ja: false, waarom: 'onbekende NODE_ENV' });
});

test('niet lokaal ondanks development: een poortwachter, een eigen adres of eigen TLS', () => {
  const dev = x => Object.assign({ NODE_ENV: 'development' }, x);
  assert.deepEqual(lokaleInstallatie(dev({ RTG_CLUSTER_KEY: 'sleutel' })),
    { ja: false, waarom: 'er staat een poortwachter voor die naar buiten luistert' });
  assert.equal(lokaleInstallatie(dev({ RTG_DOMAINS: 'member,social' })).ja, false);
  assert.deepEqual(lokaleInstallatie(dev({ APP_URL: 'http://rtg.intern' })),
    { ja: false, waarom: 'APP_URL noemt een adres dat niet aantoonbaar lokaal is' });
  for (const x of [{ RTG_TLS: '1' }, { RTG_ACME: '1' }])
    assert.deepEqual(lokaleInstallatie(dev(x)), { ja: false, waarom: 'de installatie draagt zelf TLS naar buiten' });
  /* Een sandbox mag op zo'n besloten proefinstallatie wel -- dat is een andere vraag. */
  assert.equal(sandboxMag(dev({ RTG_CLUSTER_KEY: 'sleutel' })).ja, true);
});

test('een bind die niet de loopback is, of niet te bepalen is, maakt het niet lokaal; ::1 wel', () => {
  const dev = x => Object.assign({ NODE_ENV: 'development' }, x);
  assert.deepEqual(lokaleInstallatie(dev({ RTG_BIND: '0.0.0.0' })),
    { ja: false, waarom: 'APP_URL is niet gezet, en RTG_BIND is niet de loopback' });
  /* Bevestigd lokaal netwerk: de bind levert een host, maar geen loopback. */
  assert.equal(lokaleInstallatie(dev({ RTG_BIND: '0.0.0.0', RTG_LOKAAL_NETWERK: LOKAAL_BEVESTIGD })).ja, false);
  assert.equal(lokaleInstallatie(dev({ RTG_BIND: '::1' })).ja, true);
  assert.equal(lokaleInstallatie(dev({})).waarom, 'luistert op de loopback (127.0.0.1)');
});

test('een storing in de lokaal-lezing maakt niets stil bewezen: de bindvraag beslist dan', () => {
  /* De eerste twee lezingen van RTG_DOMAINS gooien (de openbaar-vraag en de
     bewezen-lokaal-vraag), daarna is hij leeg. */
  let keer = 0;
  const env = { NODE_ENV: 'development' };
  Object.defineProperty(env, 'RTG_DOMAINS', { enumerable: true, get() { keer++; if (keer <= 2) throw new Error('stuk'); return undefined; } });
  const r = lokaleInstallatie(env);
  assert.ok(keer >= 3, 'alle drie de vragen zijn gesteld');
  assert.deepEqual(r, { ja: true, waarom: 'luistert op de loopback (127.0.0.1)' });
  /* En als ook de bind niet de loopback is, valt hij terug op de algemene reden. */
  let k2 = 0;
  const env2 = { NODE_ENV: 'development', RTG_BIND: '0.0.0.0' };
  Object.defineProperty(env2, 'RTG_DOMAINS', { enumerable: true, get() { k2++; if (k2 <= 2) throw new Error('stuk'); return undefined; } });
  assert.deepEqual(lokaleInstallatie(env2), { ja: false, waarom: 'niet aantoonbaar lokaal' });
});

test('providergezondheid: pas gezond met sleutel EN terugmeldgeheim, en bewust uit gaat voor alles', () => {
  const pg = env => providerUitOmgeving(env);
  const vol = { STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'wh', STRIPE_CONNECT_WEBHOOK_SECRET: 'cw',
    MOLLIE_API_KEY: 'm', ADYEN_API_KEY: 'a', ADYEN_HMAC_KEY: 'h' };
  for (const p of ['stripe', 'stripe_connect', 'mollie', 'adyen']) assert.deepEqual(pg(vol)(p), { gezond: true }, p);
  assert.deepEqual(pg(vol)('paypal'), { gezond: false, reden: 'onbekende provider' });
  for (const p of ['stripe', 'stripe_connect', 'mollie', 'adyen'])
    assert.match(pg(Object.assign({ RTG_BETALEN_UIT: '1' }, vol))(p).reden, /RTG_BETALEN_UIT/);
  assert.equal(pg({ STRIPE_SECRET_KEY: 'sk' })('stripe').reden, 'Stripe-sleutel of webhookgeheim ontbreekt');
  assert.equal(pg({ STRIPE_WEBHOOK_SECRET: 'wh' })('stripe').gezond, false);
  assert.equal(pg({ STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'wh' })('stripe_connect').reden,
    'Stripe-sleutel of Connect-webhookgeheim ontbreekt');
  assert.equal(pg({ MOLLIE_API_KEY: '' })('mollie').reden, 'Mollie-sleutel ontbreekt', 'een lege sleutel is geen sleutel');
  assert.equal(pg({ ADYEN_API_KEY: 'a' })('adyen').reden, 'Adyen-sleutel of HMAC-sleutel ontbreekt');
  assert.equal(pg({ ADYEN_API_KEY: 1, ADYEN_HMAC_KEY: 'h' })('adyen').gezond, false, 'alleen een tekst telt');
});

test('de buitenkant: iedere code heeft een zin, en alleen de twee aanvragercodes zijn 403', () => {
  for (const c of CODES) assert.equal(typeof ZIN[c], 'string', c);
  assert.deepEqual(Object.keys(STATUS).sort(), ['geen-recht', 'niet-geautoriseerd']);
});

test('autorisatie: zonder beleid ja, een vermogen zonder laag, met een gooiende of weigerende laag, en met land', () => {
  const st = { besluit: n => (n === 'emoney.b3' ? { wie: 'user-1' } : null) };
  const vragen = [];
  const mag = (uit) => ({ mag: (v, o) => { vragen.push([v, o]); if (uit instanceof Error) throw uit; return uit; } });
  assert.deepEqual(maakAutorisatie({ st, k: {} })({ id: 'x' }, {}, false), { ok: true, reden: '' });
  assert.equal(maakAutorisatie({ st, k: { bevoegd: {} } })({ bevoegdheid: { vermogen: 'V' } }, {}).reden, 'bevoegdheidslaag-niet-gekoppeld');
  assert.equal(maakAutorisatie({ st, k: { bevoegd: mag(new Error('stuk')) } })({ bevoegdheid: { vermogen: 'V' } }, {}).reden,
    'bevoegdheid:V:onbekend');
  assert.equal(maakAutorisatie({ st, k: { bevoegd: mag({ mag: false, reden: 'geen vergunning' }) } })({ bevoegdheid: { vermogen: 'V' } }, {}).reden,
    'bevoegdheid:V:geen vergunning');
  assert.equal(maakAutorisatie({ st, k: { bevoegd: mag({ mag: 'ja' }) } })({ bevoegdheid: { vermogen: 'V' } }, {}).code, 'niet-geautoriseerd');
  const ja = maakAutorisatie({ st, k: { bevoegd: mag({ mag: true }) } })({ bevoegdheid: { vermogen: 'V', besluit: 'emoney.b3' } }, { land: 'BE' });
  assert.deepEqual(ja, { ok: true, reden: 'bevoegdheid:V:ja,besluit:emoney.b3' });
  assert.deepEqual(vragen[vragen.length - 1], ['V', { land: 'BE' }]);
});

test('autorisatie: een providercontract valt op een actieve sandbox weg, een besluit over RTG zelf niet', () => {
  const st = { besluit: () => null };
  const a = maakAutorisatie({ st, k: {} });
  assert.deepEqual(a({ bevoegdheid: { besluit: 'provider.stripe' } }, {}, true),
    { ok: true, reden: 'besluit:provider.stripe:niet-van-toepassing-op-neprail' });
  assert.deepEqual(a({ bevoegdheid: { besluit: 'provider.stripe' } }, {}, 'ja'),
    { ok: false, code: 'compliance-ontbreekt', reden: 'besluit-ontbreekt:provider.stripe' }, 'alleen precies true');
  assert.equal(a({ bevoegdheid: { besluit: 'emoney.b3' } }, {}, true).reden, 'besluit-ontbreekt:emoney.b3');
});
