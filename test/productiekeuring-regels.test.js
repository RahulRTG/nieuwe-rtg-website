'use strict';
/* De productiekeuring per deelregel: elke regel moet AFGAAN op de stand die hij
   verbiedt en STIL blijven op de stand die hij toestaat.

   De bestaande toetsen (productie, adyen-config, mollie-config, alarmweg,
   opslagpoort) gaan door valideer() of keur() als geheel en kijken naar een of
   twee meldingen. Daardoor bleef het grootste deel van de regels in
   server/config/productie-*.js onbeproefd: een regel die nooit afgaat, of een
   die altijd afgaat, zou daar niet opvallen. Hier wordt elke deelkeuring los
   aangeroepen met precies de omgeving die haar regel raakt, en telt alleen een
   melding die het verwachte woord draagt. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { keurGeld, stand, geldigIban } = require('../server/config/productie-geld');
const { keurAi } = require('../server/config/productie-ai');
const { keurCommunicatie } = require('../server/config/productie-communicatie');
const { keurIdentiteit } = require('../server/config/productie-identiteit');
const { keurInvulplekken, HANDMATIG } = require('../server/config/productie-invoer');
const { keurLokaleBouwstanden } = require('../server/config/productie-lokaal');
const { keurMedia } = require('../server/config/productie-media');
const { keurMotor, geldigeUrl } = require('../server/config/productie-motor');
const { keurPin } = require('../server/config/productie-pin');

function draai(keuring, env, ...rest) {
  const fouten = [], waarschuwingen = [];
  const uit = keuring(env, fouten, waarschuwingen, ...rest);
  return { fouten, waarschuwingen, uit };
}
const heeft = (lijst, patroon) => lijst.some((x) => patroon.test(x));

test('1. geld: een uitgeschakelde betaalrail weigert elk geheim dat iets kan bereiken', () => {
  const schoon = draai(keurGeld, { RTG_BETALEN_UIT: '1' });
  assert.deepEqual(schoon.fouten, []);
  assert.ok(heeft(schoon.waarschuwingen, /fail-closed/));

  for (const geheim of ['STRIPE_SECRET_KEY', 'MOLLIE_API_KEY', 'ADYEN_API_KEY', 'STRIPE_WEBHOOK_SECRET',
    'ADYEN_HMAC_KEY', 'MUNT_PROVIDER_KEY', 'MUNT_WEBHOOK_SECRET']) {
    const r = draai(keurGeld, { RTG_BETALEN_UIT: '1', [geheim]: 'x' });
    assert.ok(heeft(r.fouten, /botst met ingestelde betaalgeheimen/), geheim);
  }
  assert.ok(heeft(draai(keurGeld, { RTG_BETALEN_UIT: '1', STRIPE_DEMO_BEWUST: '1' }).fouten, /niet meer ondersteund/));
  assert.ok(heeft(draai(keurGeld, { RTG_BETALEN_UIT: '1', MUNT_AAN: '1' }).fouten, /MUNT_AAN=1/));
});

test('2. geld: zonder echte provider en zonder uit-vlag start productie niet', () => {
  const r = draai(keurGeld, {});
  assert.ok(heeft(r.fouten, /ontbreken in productie/));
  assert.ok(heeft(r.waarschuwingen, /RTF_IBAN niet gezet/));
  assert.ok(heeft(draai(keurGeld, { STRIPE_DEMO_BEWUST: '1' }).fouten, /Gebruik Magnaat Test/));
});

test('3. geld: elke provider eist zijn eigen tweede helft', () => {
  const stripe = draai(keurGeld, { STRIPE_SECRET_KEY: 'sk', RTF_IBAN: 'x' });
  assert.ok(heeft(stripe.fouten, /STRIPE_WEBHOOK_SECRET/));
  assert.ok(!heeft(stripe.fouten, /ontbreken in productie/));
  assert.ok(!heeft(stripe.waarschuwingen, /RTF_IBAN/));
  assert.ok(!heeft(draai(keurGeld, { STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'wh' }).fouten, /STRIPE_WEBHOOK_SECRET/));

  assert.ok(heeft(draai(keurGeld, { MOLLIE_API_KEY: 'm' }).fouten, /MOLLIE_API_KEY gezet zonder APP_URL/));
  assert.deepEqual(draai(keurGeld, { MOLLIE_API_KEY: 'm', APP_URL: 'https://a.example', RTF_IBAN: 'x' }).fouten, []);

  const adyenLeeg = draai(keurGeld, { ADYEN_API_KEY: 'a' }).fouten;
  for (const p of [/ADYEN_MERCHANT_ACCOUNT/, /geldige ADYEN_HMAC_KEY/, /ADYEN_API_KEY gezet zonder APP_URL/, /live ADYEN_CHECKOUT_BASE_URL/])
    assert.ok(heeft(adyenLeeg, p), String(p));
  const adyenGoed = draai(keurGeld, { ADYEN_API_KEY: 'a', ADYEN_MERCHANT_ACCOUNT: 'RTG', ADYEN_HMAC_KEY: 'ab'.repeat(32),
    APP_URL: 'https://a.example', ADYEN_CHECKOUT_BASE_URL: 'https://x-checkout-live.adyenpayments.com/checkout/v72', RTF_IBAN: 'x' });
  assert.deepEqual(adyenGoed.fouten, []);
});

test('4. geld: munt-acceptatie eist een aanbieder en een webhook-secret, allebei hard', () => {
  const kaal = draai(keurGeld, { STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'w', MUNT_AAN: '1' }).fouten;
  assert.ok(heeft(kaal, /MUNT_PROVIDER_KEY/));
  assert.ok(heeft(kaal, /MUNT_WEBHOOK_SECRET/));
  const vol = draai(keurGeld, { STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'w', MUNT_AAN: '1',
    MUNT_PROVIDER_KEY: 'p', MUNT_WEBHOOK_SECRET: 's' }).fouten;
  assert.ok(!heeft(vol, /MUNT_/));
});

test('5. geld: de stand en de IBAN-controle zijn een meting en geen bewering', () => {
  assert.equal(geldigIban('NL91 ABNA 0417 1643 00'), true);
  assert.equal(geldigIban('NL91ABNA0417164301'), false);
  assert.equal(geldigIban('kapot'), false);
  assert.equal(geldigIban(undefined), false);

  const leeg = stand();
  assert.equal(leeg.betalingenUit, false);
  assert.equal(leeg.inkomendGeconfigureerd, false);
  assert.equal(leeg.releaseZonderRail, false);
  assert.equal(leeg.uitgaandGeconfigureerd, false);

  const drie = stand({ STRIPE_SECRET_KEY: 's', MOLLIE_API_KEY: 'm', ADYEN_API_KEY: 'a', RTF_IBAN: 'NL91ABNA0417164300' });
  assert.deepEqual(drie.inkomendProviders, ['stripe', 'mollie', 'adyen']);
  assert.equal(drie.inkomendGeconfigureerd, true);
  assert.equal(drie.foundationRekeningGeconfigureerd, true);

  // een beperkte release zonder rail vraagt BEIDE vlaggen; een ontbrekende provider alleen is het nooit
  assert.equal(stand({ RTG_RELEASE_ZONDER_RAIL: '1' }).releaseZonderRail, false);
  assert.equal(stand({ RTG_BETALEN_UIT: '1' }).releaseZonderRail, false);
  const beperkt = stand({ RTG_BETALEN_UIT: '1', RTG_RELEASE_ZONDER_RAIL: '1', STRIPE_SECRET_KEY: 's' });
  assert.equal(beperkt.releaseZonderRail, true);
  assert.equal(beperkt.inkomendGeconfigureerd, false);
});

test('6. AI: uit betekent uit, extern uit laat lokaal staan, en een lokaal model wordt bij naam genoemd', () => {
  const geen = draai(keurAi, {});
  assert.deepEqual(geen.fouten, []);
  assert.ok(heeft(geen.waarschuwingen, /Geen modelprovider/));

  const uitLeeg = draai(keurAi, { RTG_AI_UIT: '1' });
  assert.deepEqual(uitLeeg.fouten, []);
  assert.ok(heeft(uitLeeg.waarschuwingen, /bewust uit/));
  assert.ok(heeft(draai(keurAi, { RTG_AI_UIT: '1', OPENAI_API_KEY: 'k' }).fouten, /RTG_AI_UIT=1 botst/));
  for (const sleutel of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'])
    assert.ok(heeft(draai(keurAi, { RTG_EXTERNE_AI_UIT: '1', [sleutel]: 'k' }).fouten, /RTG_EXTERNE_AI_UIT=1 botst/), sleutel);

  const extern = draai(keurAi, { ANTHROPIC_API_KEY: 'k' });
  assert.deepEqual(extern.fouten, []);
  assert.equal(extern.waarschuwingen.length, 0);

  const lokaalZonderModel = draai(keurAi, { LOCAL_AI_URL: 'http://127.0.0.1:11434' });
  assert.ok(heeft(lokaalZonderModel.fouten, /LOCAL_AI_MODEL ontbreekt/));
  assert.ok(heeft(lokaalZonderModel.waarschuwingen, /eerste provider/));
  assert.ok(heeft(lokaalZonderModel.waarschuwingen, /LOCAL_AI_CONTEXT ontbreekt/));

  const lokaalVol = draai(keurAi, { LOCAL_AI_BASE_URL: 'http://127.0.0.1:11434', LOCAL_AI_MODEL: 'm',
    LOCAL_AI_CONTEXT: '8192', RTG_EXTERNE_AI_UIT: '1' });
  assert.ok(!heeft(lokaalVol.fouten, /LOCAL_AI_MODEL/));
  assert.ok(!heeft(lokaalVol.waarschuwingen, /LOCAL_AI_CONTEXT ontbreekt/));
  assert.ok(heeft(lokaalVol.waarschuwingen, /externe AI staat bewust uit/));
});

test('7. identiteit: het eigenaarsadres moet echt en bereikbaar zijn, en isolatie moet handhaven', () => {
  assert.ok(heeft(draai(keurIdentiteit, {}).fouten, /RTG_OWNER_EMAIL ontbreekt/));
  assert.ok(heeft(draai(keurIdentiteit, { RTG_OWNER_EMAIL: ' Rahul@RTG.example ' }).fouten, /voorbeeldadres/));
  assert.ok(heeft(draai(keurIdentiteit, { RTG_OWNER_EMAIL: 'geen-adres' }).fouten, /geen geldig e-mailadres/));
  assert.ok(heeft(draai(keurIdentiteit, { RTG_OWNER_EMAIL: 'e@voorbeeld.nl' }).fouten, /RTG_ISOLATIE_AFDWINGEN/));
  assert.deepEqual(draai(keurIdentiteit, { RTG_OWNER_EMAIL: 'e@voorbeeld.nl', RTG_ISOLATIE_AFDWINGEN: '1' }).fouten, []);
});

test('8. invoer: een achtergebleven VUL-IN wordt per veld genoemd', () => {
  assert.deepEqual(draai(keurInvulplekken, {}).fouten, []);
  for (const naam of HANDMATIG) {
    const r = draai(keurInvulplekken, { [naam]: 'https://vul-in.example' });
    assert.equal(r.fouten.length, 1, naam);
    assert.ok(r.fouten[0].startsWith(naam + ' '), naam);
  }
  assert.ok(Object.isFrozen(HANDMATIG));
});

test('9. lokale bouwstanden: elke ontwikkelvlag blokkeert productie', () => {
  const schoon = draai(keurLokaleBouwstanden, {});
  assert.deepEqual(schoon.fouten, []);
  assert.equal(schoon.uit, false);
  const gevallen = [
    [{ RTG_DEMO: '1' }, /RTG_DEMO=1/], [{ RTG_MAGNAAT_TEST: '1' }, /RTG_MAGNAAT_TEST=1/],
    [{ RTG_GEZIN_REM_UIT: '1' }, /RTG_GEZIN_REM_UIT=1/], [{ RTG_DEV_LINKS: '1' }, /RTG_DEV_LINKS=1/],
    [{ RTG_LIEG: '/api/x' }, /RTG_LIEG/], [{ RTG_STAATLOG: '1' }, /RTG_STAATLOG/], [{ RTG_STAATLOG: '2' }, /RTG_STAATLOG/],
    [{ RTG_VERRAAD: ' ,schrijf-faalt' }, /RTG_VERRAAD/], [{ RTG_KLOK: '2026-01-01' }, /RTG_KLOK/],
    [{ RTG_DUURZAAM: 'UIT' }, /RTG_DUURZAAM=uit/],
    [{ SMTP_SANDBOX: '1' }, /SMTP_SANDBOX=1/], [{ SMS_SANDBOX: '1' }, /SMS_SANDBOX=1/],
    [{ STRIPE_CONNECT_SANDBOX: '1' }, /STRIPE_CONNECT_SANDBOX=1/], [{ SEPA_SANDBOX: '1' }, /SEPA_SANDBOX=1/]
  ];
  for (const [env, patroon] of gevallen) {
    const r = draai(keurLokaleBouwstanden, env);
    assert.equal(r.fouten.length, 1, JSON.stringify(env));
    assert.ok(heeft(r.fouten, patroon), JSON.stringify(env));
  }
  // lege of uitgezette waarden zijn geen vlag
  for (const env of [{ RTG_STAATLOG: '0' }, { RTG_VERRAAD: ' , ' }, { RTG_KLOK: '  ' }, { RTG_DUURZAAM: 'aan' }])
    assert.deepEqual(draai(keurLokaleBouwstanden, env).fouten, [], JSON.stringify(env));
});

test('10. lokale bouwstanden: een private beta mag alleen lokaal staan', () => {
  const lokaal = draai(keurLokaleBouwstanden, { RTG_PRIVATE_BETA: '1', APP_URL: 'http://localhost:3000' });
  assert.equal(lokaal.uit, true);
  assert.ok(!heeft(lokaal.fouten, /RTG_PRIVATE_BETA/));
  const publiek = draai(keurLokaleBouwstanden, { RTG_PRIVATE_BETA: '1', APP_URL: 'https://rtg.voorbeeld.nl' });
  assert.equal(publiek.uit, true);
  assert.ok(heeft(publiek.fouten, /RTG_PRIVATE_BETA=1 mag alleen/));
});

test('11. media: een gedeelde runtime eist s3, en een onbekende backend wordt geweigerd', () => {
  assert.equal(draai(keurMedia, {}).uit, null);
  assert.deepEqual(draai(keurMedia, {}).fouten, []);
  assert.deepEqual(draai(keurMedia, { RTG_MEDIA_BACKEND: 'disk' }).fouten, []);
  assert.ok(heeft(draai(keurMedia, { RTG_MEDIA_BACKEND: 'ftp' }).fouten, /exact "disk" of "s3"/));
  assert.ok(heeft(draai(keurMedia, { DATABASE_URL: 'postgresql://db' }).fouten, /B2B2C-media vereist/));
  assert.ok(heeft(draai(keurMedia, { PG_URL: 'postgresql://db', RTG_MEDIA_BACKEND: 'disk' }).fouten, /B2B2C-media vereist/));
  const halfS3 = draai(keurMedia, { RTG_MEDIA_BACKEND: ' S3 ' });
  assert.equal(halfS3.uit, null);
  assert.ok(heeft(halfS3.fouten, /S3-mediastore is niet productieklaar/));
});

test('12. motor: elke stand heeft een gesloten lijst waarden', () => {
  assert.deepEqual(draai(keurMotor, {}).fouten, []);
  const fout = draai(keurMotor, { RTG_MAGNAAT_RUST: 'aan', RTG_MOTOR_GELD: 'half', RTG_RUST_ALLES_UIT: 'ja',
    RTG_CAPABILITY_RUST_MODE: 'turbo', RTG_CAPABILITY_RUST_CANARY_PCT: '150' }).fouten;
  for (const p of [/RTG_MAGNAAT_RUST moet/, /RTG_MOTOR_GELD heeft een onbekende/, /RTG_RUST_ALLES_UIT moet/,
    /RTG_CAPABILITY_RUST_MODE moet/, /CANARY_PCT moet/])
    assert.ok(heeft(fout, p), String(p));
  assert.ok(heeft(draai(keurMotor, { RTG_CAPABILITY_RUST_CANARY_PCT: 'veel' }).fouten, /CANARY_PCT/));
  assert.ok(!heeft(draai(keurMotor, { RTG_CAPABILITY_RUST_CANARY_PCT: '25' }).fouten, /CANARY_PCT/));
  // shadow is de Engelse spelling van schaduw en wordt geaccepteerd, maar eist dan wel een binary
  const shadow = draai(keurMotor, { RTG_CAPABILITY_RUST_MODE: 'shadow' }).fouten;
  assert.ok(!heeft(shadow, /moet uit, schaduw/));
  assert.ok(heeft(shadow, /vereist RTG_CAPABILITY_RUST_BIN/));
  // een binary zonder mode zet de mode op motor, en een relatief pad is in productie fout
  const relatief = draai(keurMotor, { RTG_CAPABILITY_RUST_BIN: 'bin/rust' }).fouten;
  assert.ok(heeft(relatief, /absoluut pad naar de gebouwde/));
  assert.ok(!heeft(relatief, /vereist RTG_CAPABILITY_RUST_BIN/));
  assert.deepEqual(draai(keurMotor, { RTG_CAPABILITY_RUST_BIN: '/opt/rust' }).fouten, []);
  assert.ok(heeft(draai(keurMotor, { RTG_RUST_ALLES_UIT: '1' }).waarschuwingen, /RTG_RUST_ALLES_UIT=1/));
});

test('13. motor: geld op de motor eist een url, een sleutelpad, een genesis en een token', () => {
  const kaal = draai(keurMotor, { RTG_MOTOR_GELD: 'motor' }).fouten;
  for (const p of [/RTG_MOTOR_GELD_URL of RTG_MOTOR_SHADOW/, /STATE_KEY_FILE/, /EXPECT_GENESIS/, /RTG_MOTOR_TOKEN/])
    assert.ok(heeft(kaal, p), String(p));
  const vol = draai(keurMotor, { RTG_MOTOR_GELD: 'MOTOR', RTG_MOTOR_GELD_URL: 'http://motor:8080',
    RTG_MOTOR_STATE_KEY_FILE: '/run/sleutel', RTG_MOTOR_EXPECT_GENESIS: 'g-' + 'a'.repeat(32),
    RTG_MOTOR_TOKEN: 't'.repeat(16) }).fouten;
  assert.deepEqual(vol, []);

  assert.ok(heeft(draai(keurMotor, { RTG_MAGNAAT_RUST: 'motor', RTG_MOTOR_TOKEN: 't'.repeat(16) }).fouten, /RTG_MOTOR_REKEN_URL/));
  assert.ok(!heeft(draai(keurMotor, { RTG_MAGNAAT_RUST: 'motor', RTG_MOTOR_SHADOW: 'https://m.example',
    RTG_MOTOR_TOKEN: 't'.repeat(16) }).fouten, /RTG_MOTOR_REKEN_URL/));
  assert.ok(heeft(draai(keurMotor, { RTG_MOTOR_SHADOW: 'https://m.example', RTG_MOTOR_TOKEN: 'kort' }).fouten, /RTG_MOTOR_TOKEN/));
});

test('14. motor: een echte geldrail eist de motor, en een motor-url draagt geen inloggegevens', () => {
  assert.ok(heeft(draai(keurMotor, { STRIPE_SECRET_KEY: 's' }).fouten, /echte geldrail vereist/));
  assert.ok(heeft(draai(keurMotor, { MUNT_PROVIDER_KEY: 'p' }).fouten, /echte geldrail vereist/));
  assert.ok(!heeft(draai(keurMotor, { STRIPE_SECRET_KEY: 's', RTG_BETALEN_UIT: '1' }).fouten, /echte geldrail/));
  for (const naam of ['RTG_MOTOR_REKEN_URL', 'RTG_MOTOR_GELD_URL', 'RTG_MOTOR_SHADOW'])
    assert.ok(heeft(draai(keurMotor, { [naam]: 'https://wie:wat@m.example', RTG_MOTOR_TOKEN: 't'.repeat(16) }).fouten,
      new RegExp(naam + ' moet een geldige')), naam);
  assert.equal(geldigeUrl('https://m.example'), true);
  assert.equal(geldigeUrl('ftp://m.example'), false);
  assert.equal(geldigeUrl('https://a:b@m.example'), false);
  assert.equal(geldigeUrl('geen url'), false);
});

test('15. pin: zonder Redis een waarschuwing, en enterprise zonder Redis een fout', () => {
  const kaal = draai(keurPin, {});
  assert.deepEqual(kaal.fouten, []);
  assert.ok(heeft(kaal.waarschuwingen, /REDIS_URL niet gezet/));
  assert.ok(heeft(draai(keurPin, { RTG_PIN_ENTERPRISE: '1' }).fouten, /RTG_PIN_ENTERPRISE=1 vereist/));
  const vol = draai(keurPin, { RTG_PIN_ENTERPRISE: '1', REDIS_URL: 'redis://r' });
  assert.deepEqual(vol.fouten, []);
  assert.deepEqual(vol.waarschuwingen, []);
});

test('16. communicatie: mail, publieke persoonlijke mail en herstel-sms hebben elk hun eigen eis', () => {
  const beta = draai(keurCommunicatie, {}, true);
  assert.deepEqual(beta.fouten, []);
  assert.ok(heeft(beta.waarschuwingen, /private beta/));

  const oud = draai(keurCommunicatie, { SMTP_HOST: 'mail' }, false).fouten;
  assert.ok(heeft(oud, /SMTP_HOST wordt niet door de verzendlaag gelezen/));
  assert.ok(heeft(draai(keurCommunicatie, {}, false).fouten, /Geen echte mailprovider/));
  assert.ok(heeft(draai(keurCommunicatie, {}, false).fouten, /RTG_HERSTEL_SMS_UIT_BEWUST/));
  assert.ok(!heeft(draai(keurCommunicatie, { RTG_HERSTEL_SMS_UIT_BEWUST: '1' }, false).fouten, /RTG_HERSTEL_SMS_UIT_BEWUST/));

  assert.ok(heeft(draai(keurCommunicatie, { SMTP_URL: 'smtp://m' }, true).waarschuwingen, /DKIM/));
  assert.ok(!heeft(draai(keurCommunicatie, { SMTP_URL: 'smtp://m', MAIL_PROVIDER_DKIM: '1' }, true).waarschuwingen, /ondertekent smarthost-mail/));
  assert.ok(!heeft(draai(keurCommunicatie, { SMTP_URL: 'smtp://m', DKIM_PRIVATE_KEY: 'k', MAIL_DOMEIN: 'rtg.nl' }, true).waarschuwingen,
    /ondertekent smarthost-mail/));
});

test('17. communicatie: publieke persoonlijke mail eist ontvangst, DKIM en uitlijning', () => {
  const kaal = draai(keurCommunicatie, { RTG_MAIL_PUBLIEK_BASIS: 'post.rtg.nl' }, true).fouten;
  for (const p of [/zonder SMTP-provider/, /zonder inkomende mailroute/, /vereist provider-DKIM/])
    assert.ok(heeft(kaal, p), String(p));

  const ses = draai(keurCommunicatie, { SMTP_URL: 'smtp://m', RTG_MAIL_PUBLIEK_BASIS: 'post.rtg.nl',
    MAIL_INBOUND_PROVIDER: 'AWS-SES', SES_INBOUND_SECRET: 'kort', MAIL_PROVIDER_DKIM: '1' }, true);
  assert.ok(heeft(ses.fouten, /SES_INBOUND_SECRET/));
  assert.ok(heeft(ses.waarschuwingen, /MX, SPF en DMARC/));

  const scheef = draai(keurCommunicatie, { SMTP_URL: 'smtp://m', RTG_MAIL_PUBLIEK_BASIS: '.post.rtg.nl.',
    MAIL_IN_POORT: '2525', DKIM_PRIVATE_KEY: 'k', MAIL_DOMEIN: 'ander.nl' }, true).fouten;
  assert.ok(heeft(scheef, /lijnen niet uit/));
  const uitgelijnd = draai(keurCommunicatie, { SMTP_URL: 'smtp://m', RTG_MAIL_PUBLIEK_BASIS: 'post.rtg.nl',
    MAIL_IN_POORT: '2525', DKIM_PRIVATE_KEY: 'k', MAIL_DOMEIN: 'rtg.nl' }, true).fouten;
  assert.deepEqual(uitgelijnd, []);

  const twee = draai(keurCommunicatie, { SMTP_URL: 'smtp://m', RTG_MAIL_PUBLIEK_BASIS: 'rtg.nl', RTF_MAIL_PUBLIEK_DOMEIN: 'rtf.nl',
    MAIL_IN_POORT: '2525', DKIM_PRIVATE_KEY: 'k', MAIL_DOMEIN: 'rtg.nl' }, true).fouten;
  assert.ok(heeft(twee, /Twee publieke afzenderdomeinen/));
  assert.ok(!heeft(draai(keurCommunicatie, { SMTP_URL: 'smtp://m', RTG_MAIL_PUBLIEK_BASIS: 'rtg.nl', RTF_MAIL_PUBLIEK_DOMEIN: 'rtf.nl',
    MAIL_IN_POORT: '2525', MAIL_PROVIDER_DKIM: '1' }, true).fouten, /Twee publieke/));
});

test('18. communicatie: publieke productie eist een eigen TURN-keten en geen Google-STUN', () => {
  const kaal = draai(keurCommunicatie, { SMTP_URL: 'smtp://m', RTG_HERSTEL_SMS_UIT_BEWUST: '1' }, false).fouten;
  assert.ok(heeft(kaal, /TURN_URL ontbreekt/));
  assert.ok(heeft(kaal, /TURN-authenticatie ontbreekt/));
  assert.ok(heeft(draai(keurCommunicatie, { STUN_FALLBACK_GOOGLE: '1' }, false).fouten, /STUN_FALLBACK_GOOGLE=1/));
  assert.ok(!heeft(draai(keurCommunicatie, { STUN_FALLBACK_GOOGLE: '1' }, true).fouten, /STUN_FALLBACK_GOOGLE/));
});
