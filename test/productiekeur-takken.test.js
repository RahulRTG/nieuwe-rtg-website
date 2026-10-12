/* DE PRODUCTIEKEURING TAK VOOR TAK (server/config/productie.js).

   Wat dit bestand vasthoudt, per regel van het productiedeel: de
   versleutelingssleutel (ontbrekend of te kort), de twee kluissleutels
   (ontbrekend of te kort), de standaard-demopass en een te korte clustersleutel,
   APP_URL (ontbrekend, onleesbaar, http buiten private beta, met pad of
   credentials), de alarmering (geen webhook is in publieke productie een fout en
   in private beta een waarschuwing; een geweigerde webhook is altijd een fout;
   de eigen storingenwebhook eist een sleutel en krijgt een waarschuwing) en de
   SENTRY_DSN-waarschuwing. De keuring is een pure functie van de omgeving; hier
   wordt alleen gekeken of een melding er wel of niet staat. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { keur } = require('../server/config/productie');

const SLEUTEL = 'f'.repeat(64);
const BASIS = {
  NODE_ENV: 'production', RTG_ENC_KEY: SLEUTEL, RTG_VAULT_KEY: SLEUTEL, RTG_SECRET_KEY: SLEUTEL,
  APP_URL: 'https://rtg-proef.nl/', ERR_WEBHOOK_URL: 'https://alarm.rtg-proef.nl/haak'
};
function doe(extra, zonder = []) {
  const env = Object.assign({}, BASIS, extra);
  for (const k of zonder) delete env[k];
  const fouten = [], waarschuwingen = [];
  keur(env, fouten, waarschuwingen);
  return { fouten, waarschuwingen };
}
const heeft = (lijst, re) => lijst.some(m => re.test(m));

test('de basis: geen van de meldingen uit dit deel', () => {
  const { fouten, waarschuwingen } = doe({});
  for (const re of [/RTG_ENC_KEY/, /RTG_VAULT_KEY/, /RTG_SECRET_KEY/, /DEMO_PASS/, /RTG_CLUSTER_KEY/, /APP_URL/, /ERR_WEBHOOK/])
    assert.equal(heeft(fouten, re), false, String(re));
  assert.equal(heeft(waarschuwingen, /SENTRY_DSN|storingenontvangst/), false);
  /* De andere deelkeuringen melden wel van alles; deze lijst is dus niet leeg. */
  assert.ok(fouten.length > 0);
});

test('versleuteling at rest: ontbrekend en te kort zijn twee verschillende fouten', () => {
  const geen = doe({}, ['RTG_ENC_KEY']).fouten;
  assert.equal(heeft(geen, /RTG_ENC_KEY ontbreekt/), true);
  assert.equal(heeft(geen, /RTG_ENC_KEY is te kort/), false);
  const kort = doe({ RTG_ENC_KEY: 'kort' }).fouten;
  assert.equal(heeft(kort, /RTG_ENC_KEY is te kort/), true);
  assert.equal(heeft(kort, /RTG_ENC_KEY ontbreekt/), false);
});

test('de kluissleutels: elk apart, ontbrekend of te kort', () => {
  const geen = doe({}, ['RTG_VAULT_KEY', 'RTG_SECRET_KEY']).fouten;
  assert.equal(heeft(geen, /RTG_VAULT_KEY ontbreekt: .*identiteitskluis/), true);
  assert.equal(heeft(geen, /RTG_SECRET_KEY ontbreekt: .*sessietokens/), true);
  const kort = doe({ RTG_VAULT_KEY: 'a'.repeat(31), RTG_SECRET_KEY: 'b'.repeat(32) }).fouten;
  assert.equal(heeft(kort, /RTG_VAULT_KEY is te kort/), true);
  assert.equal(heeft(kort, /RTG_SECRET_KEY/), false, 'precies 32 tekens is genoeg');
});

test('zwakke geheimen: de standaard-demopass en een korte clustersleutel', () => {
  assert.equal(heeft(doe({ DEMO_PASS: 'Imran' }).fouten, /DEMO_PASS/), true);
  assert.equal(heeft(doe({ DEMO_PASS: 'iets-anders' }).fouten, /DEMO_PASS/), false);
  assert.equal(heeft(doe({ RTG_CLUSTER_KEY: 'kort' }).fouten, /RTG_CLUSTER_KEY is te kort/), true);
  assert.equal(heeft(doe({ RTG_CLUSTER_KEY: 'c'.repeat(16) }).fouten, /RTG_CLUSTER_KEY/), false);
});

test('APP_URL: ontbrekend, onleesbaar, http, en meer dan de domeinroot', () => {
  assert.equal(heeft(doe({}, ['APP_URL']).fouten, /APP_URL ontbreekt/), true);
  assert.equal(heeft(doe({ APP_URL: 'geen adres' }).fouten, /APP_URL is geen geldig absoluut adres/), true);
  assert.equal(heeft(doe({ APP_URL: 'http://rtg-proef.nl/' }).fouten, /https-adres/), true);
  assert.equal(heeft(doe({ APP_URL: 'http://rtg-proef.nl/', RTG_PRIVATE_BETA: '1' }).fouten, /https-adres/), false,
    'in private beta mag http');
  for (const url of ['https://u:p@rtg-proef.nl/', 'https://rtg-proef.nl/pad', 'https://rtg-proef.nl/?q=1',
    'https://rtg-proef.nl/#a', 'https://gebruiker@rtg-proef.nl/'])
    assert.equal(heeft(doe({ APP_URL: url }).fouten, /uitsluitend de domeinroot/), true, url);
  assert.equal(heeft(doe({ APP_URL: 'https://rtg-proef.nl' }).fouten, /APP_URL/), false);
});

test('alarmering: geen webhook is een fout in publieke productie en een waarschuwing in private beta', () => {
  const publiek = doe({}, ['ERR_WEBHOOK_URL']);
  assert.equal(heeft(publiek.fouten, /ERR_WEBHOOK_URL niet gezet/), true);
  assert.equal(heeft(publiek.waarschuwingen, /ERR_WEBHOOK_URL niet gezet/), false);
  const beta = doe({ RTG_PRIVATE_BETA: '1' }, ['ERR_WEBHOOK_URL']);
  assert.equal(heeft(beta.waarschuwingen, /ERR_WEBHOOK_URL niet gezet/), true);
  assert.equal(heeft(beta.fouten, /ERR_WEBHOOK_URL niet gezet/), false);
});

test('alarmering: een geweigerde webhook is een fout, ook met de interne uitzondering', () => {
  const plat = doe({ ERR_WEBHOOK_URL: 'http://127.0.0.1/haak' }).fouten;
  assert.equal(heeft(plat, /ERR_WEBHOOK_URL is gezet maar wordt geweigerd/), true);
  const intern = doe({ ERR_WEBHOOK_URL: 'ftp://alarm.intern/haak', ERR_WEBHOOK_INTERN: '1' }).fouten;
  assert.equal(heeft(intern, /ERR_WEBHOOK_URL is gezet maar wordt geweigerd \(alleen http\(s\)\)/), true);
  const internGoed = doe({ ERR_WEBHOOK_URL: 'http://alarm.intern/haak', ERR_WEBHOOK_INTERN: '1' }).fouten;
  assert.equal(heeft(internGoed, /ERR_WEBHOOK_URL/), false);
});

test('de eigen storingenwebhook: een sleutel van 64 hex, en altijd de waarschuwing', () => {
  const eigen = 'https://rtg-proef.nl/api/webhooks/storingen';
  const zonder = doe({ ERR_WEBHOOK_URL: eigen });
  assert.equal(heeft(zonder.fouten, /ERR_WEBHOOK_SECRET moet/), true);
  assert.equal(heeft(zonder.waarschuwingen, /Eigen storingenontvangst/), true);
  const met = doe({ ERR_WEBHOOK_URL: eigen, ERR_WEBHOOK_SECRET: 'a'.repeat(64) });
  assert.equal(heeft(met.fouten, /ERR_WEBHOOK_SECRET/), false);
  assert.equal(heeft(met.waarschuwingen, /Eigen storingenontvangst/), true);
  /* Met een query is het niet het eigen endpoint. */
  assert.equal(heeft(doe({ ERR_WEBHOOK_URL: eigen + '?x=1' }).waarschuwingen, /Eigen storingenontvangst/), false);
});

test('SENTRY_DSN: alleen een waarschuwing als er geen echte alarmering is', () => {
  assert.equal(heeft(doe({ SENTRY_DSN: 'https://x@sentry.io/1' }, ['ERR_WEBHOOK_URL']).waarschuwingen, /SENTRY_DSN/), true);
  assert.equal(heeft(doe({ SENTRY_DSN: 'https://x@sentry.io/1' }).waarschuwingen, /SENTRY_DSN/), false);
});

/* ---------------------------------------------------------------------------
   DE DEELKEURINGEN DIE keur() AANROEPT. Dezelfde ingang, een omgeving per
   onderwerp; de datamap is een lege tijdelijke map zodat een lokale db.json in
   de werkmap de uitkomst niet kan kleuren (er wordt alleen in gekeken, nooit
   in geschreven).
   ------------------------------------------------------------------------- */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const PROEFMAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-productiekeur-'));
test.after(() => fs.rmSync(PROEFMAP, { recursive: true, force: true }));
const deel = (extra, zonder) => doe(Object.assign({ RTG_DATA_DIR: PROEFMAP }, extra), zonder);

test('geld: betalingen uit botst met elk betaalgeheim, met MUNT_AAN en met de oude demovlag', () => {
  const { fouten, waarschuwingen } = deel({ RTG_BETALEN_UIT: '1', STRIPE_SECRET_KEY: 'sk_x', MUNT_AAN: '1', STRIPE_DEMO_BEWUST: '1' });
  assert.equal(heeft(fouten, /RTG_BETALEN_UIT=1 botst met ingestelde betaalgeheimen/), true);
  assert.equal(heeft(fouten, /RTG_BETALEN_UIT=1 botst met MUNT_AAN=1/), true);
  assert.equal(heeft(fouten, /STRIPE_DEMO_BEWUST wordt niet meer ondersteund/), true);
  assert.equal(heeft(waarschuwingen, /RTG_BETALEN_UIT=1: alle betaalrails/), true);
  const schoon = deel({ RTG_BETALEN_UIT: '1' });
  assert.equal(heeft(schoon.fouten, /RTG_BETALEN_UIT=1 botst/), false);
  assert.equal(heeft(schoon.fouten, /ontbreken in produc/), false, 'bewust uit eist geen provider');
});

test('geld: elke provider met zijn eigen ontbrekende stukken', () => {
  const { fouten, waarschuwingen } = deel({ STRIPE_SECRET_KEY: 'sk_x', MOLLIE_API_KEY: 'm', ADYEN_API_KEY: 'a',
    MUNT_AAN: '1', STRIPE_DEMO_BEWUST: '1' }, ['APP_URL']);
  for (const re of [/STRIPE_SECRET_KEY gezet zonder STRIPE_WEBHOOK_SECRET/, /MOLLIE_API_KEY gezet zonder APP_URL/,
    /ADYEN_API_KEY gezet zonder ADYEN_MERCHANT_ACCOUNT/, /ADYEN_API_KEY gezet zonder geldige ADYEN_HMAC_KEY/,
    /ADYEN_API_KEY gezet zonder APP_URL/, /ADYEN_API_KEY gezet zonder geldige live ADYEN_CHECKOUT_BASE_URL/,
    /MUNT_AAN=1 zonder MUNT_PROVIDER_KEY/, /MUNT_AAN=1 zonder MUNT_WEBHOOK_SECRET/, /STRIPE_DEMO_BEWUST/])
    assert.equal(heeft(fouten, re), true, String(re));
  assert.equal(heeft(fouten, /ontbreken in produc/), false);
  assert.equal(heeft(waarschuwingen, /RTF_IBAN niet gezet/), true);
  const compleet = deel({ ADYEN_API_KEY: 'a', ADYEN_MERCHANT_ACCOUNT: 'RTG', ADYEN_HMAC_KEY: 'A'.repeat(64),
    ADYEN_CHECKOUT_BASE_URL: 'https://abc-checkout-live.adyenpayments.com/checkout/v71', RTF_IBAN: 'NL91ABNA0417164300' });
  assert.equal(heeft(compleet.fouten, /ADYEN/), false);
  assert.equal(heeft(compleet.waarschuwingen, /RTF_IBAN/), false);
});

test('AI: elke combinatie van uit, extern en lokaal krijgt zijn eigen melding', () => {
  const lokaalZonderModel = deel({ LOCAL_AI_URL: 'http://127.0.0.1:11434' });
  assert.equal(heeft(lokaalZonderModel.fouten, /LOCAL_AI_MODEL ontbreekt/), true);
  assert.equal(heeft(lokaalZonderModel.waarschuwingen, /LOCAL_AI_CONTEXT ontbreekt/), true);
  assert.equal(heeft(lokaalZonderModel.waarschuwingen, /Lokale AI is de eerste provider/), true);
  const botsing = deel({ RTG_AI_UIT: '1', RTG_EXTERNE_AI_UIT: '1', ANTHROPIC_API_KEY: 'x' });
  assert.equal(heeft(botsing.fouten, /RTG_AI_UIT=1 botst/), true);
  assert.equal(heeft(botsing.fouten, /RTG_EXTERNE_AI_UIT=1 botst/), true);
  assert.equal(heeft(deel({ RTG_AI_UIT: '1' }).waarschuwingen, /RTG_AI_UIT=1: alle modelverrijking/), true);
  const alleenLokaal = deel({ LOCAL_AI_BASE_URL: 'http://127.0.0.1:11434', LOCAL_AI_MODEL: 'm', LOCAL_AI_CONTEXT: '8192', RTG_EXTERNE_AI_UIT: '1' });
  assert.equal(heeft(alleenLokaal.waarschuwingen, /externe AI staat bewust uit/), true);
  assert.equal(heeft(alleenLokaal.fouten, /LOCAL_AI_MODEL/), false);
  assert.equal(heeft(deel({}).waarschuwingen, /Geen modelprovider ingesteld/), true);
  assert.equal(heeft(deel({ OPENAI_API_KEY: 'x' }).waarschuwingen, /Geen modelprovider/), false);
});

test('lokale bouwstanden: elke proefvlag is in productie een fout', () => {
  const { fouten } = deel({ RTG_DEMO: '1', RTG_MAGNAAT_TEST: '1', RTG_GEZIN_REM_UIT: '1', RTG_DEV_LINKS: '1',
    RTG_LIEG: 'pad', RTG_STAATLOG: '2', RTG_VERRAAD: ' ,schrijf-verloren', RTG_KLOK: '2026-01-01', RTG_DUURZAAM: 'UIT' });
  for (const re of [/RTG_DEMO=1/, /RTG_MAGNAAT_TEST=1/, /RTG_GEZIN_REM_UIT=1/, /RTG_DEV_LINKS=1/, /RTG_LIEG/,
    /RTG_STAATLOG/, /RTG_VERRAAD/, /RTG_KLOK/, /RTG_DUURZAAM=uit/])
    assert.equal(heeft(fouten, re), true, String(re));
  const stil = deel({ RTG_STAATLOG: 'false', RTG_VERRAAD: ' , ', RTG_DUURZAAM: 'aan' }).fouten;
  assert.equal(heeft(stil, /RTG_STAATLOG|RTG_VERRAAD|RTG_DUURZAAM/), false);
});

test('private beta: alleen met een lokaal adres, en dan waarschuwingen in plaats van fouten', () => {
  assert.equal(heeft(deel({ RTG_PRIVATE_BETA: '1' }).fouten, /RTG_PRIVATE_BETA=1 mag alleen met een lokaal APP_URL/), true);
  const lokaal = deel({ RTG_PRIVATE_BETA: '1', APP_URL: 'http://localhost:3000' }, ['ERR_WEBHOOK_URL']);
  assert.equal(heeft(lokaal.fouten, /RTG_PRIVATE_BETA/), false);
  assert.equal(heeft(lokaal.waarschuwingen, /RTG_PRIVATE_BETA=1: alleen lokaal bouwen/), true);
  assert.equal(heeft(lokaal.waarschuwingen, /Geen mailprovider in private beta/), true);
  assert.equal(heeft(lokaal.fouten, /SMS-provider/), false);
});

test('de Rust-motor: onbekende standen, ontbrekende adressen, token en binaire paden', () => {
  const raar = deel({ RTG_MAGNAAT_RUST: 'aan', RTG_MOTOR_GELD: 'half', RTG_RUST_ALLES_UIT: '2',
    RTG_CAPABILITY_RUST_MODE: 'vol', RTG_CAPABILITY_RUST_CANARY_PCT: '150' }).fouten;
  for (const re of [/RTG_MAGNAAT_RUST moet/, /RTG_MOTOR_GELD heeft een onbekende stand/, /RTG_RUST_ALLES_UIT moet 0 of 1/])
    assert.equal(heeft(raar, re), true, String(re));
  const motor = deel({ RTG_MAGNAAT_RUST: 'motor', RTG_MOTOR_GELD: 'motor', RTG_CAPABILITY_RUST_BIN: 'relatief/bin',
    RTG_RUST_ALLES_UIT: '1', RTG_MOTOR_REKEN_URL: 'ftp://x' });
  assert.equal(heeft(motor.fouten, /RTG_MOTOR_GELD=motor vereist RTG_MOTOR_GELD_URL/), true);
  assert.equal(heeft(motor.fouten, /RTG_MOTOR_TOKEN ontbreekt/), true);
  assert.equal(heeft(motor.fouten, /moet een geldige HTTP\(S\)-URL zonder inloggegevens/), true);
  assert.equal(heeft(motor.waarschuwingen, /RTG_RUST_ALLES_UIT=1/), true);
  const zonderReken = deel({ RTG_MAGNAAT_RUST: 'motor', RTG_MOTOR_TOKEN: 't'.repeat(16) }).fouten;
  assert.equal(heeft(zonderReken, /RTG_MAGNAAT_RUST=motor vereist RTG_MOTOR_REKEN_URL/), true);
  assert.equal(heeft(zonderReken, /RTG_MOTOR_TOKEN/), false);
  assert.equal(heeft(motor.fouten, /RTG_CAPABILITY_RUST_BIN moet in productie een absoluut pad/), true);
  assert.equal(heeft(deel({ RTG_CAPABILITY_RUST_MODE: 'shadow' }).fouten, /vereist RTG_CAPABILITY_RUST_BIN/), true);
  const geldrail = deel({ STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'w' }).fouten;
  assert.equal(heeft(geldrail, /Een echte geldrail vereist RTG_MOTOR_GELD=motor/), true);
  assert.equal(heeft(deel({ STRIPE_SECRET_KEY: 'sk', RTG_BETALEN_UIT: '1' }).fouten, /Een echte geldrail/), false);
});

test('identiteit, pin, media en opslag', () => {
  assert.equal(heeft(deel({ RTG_OWNER_EMAIL: 'geen-adres' }).fouten, /RTG_OWNER_EMAIL is geen geldig e-mailadres/), true);
  assert.equal(heeft(deel({ RTG_OWNER_EMAIL: 'eigenaar@rtg-proef.nl', RTG_ISOLATIE_AFDWINGEN: '1' }).fouten,
    /RTG_OWNER_EMAIL|RTG_ISOLATIE_AFDWINGEN/), false);
  assert.equal(heeft(deel({ RTG_PIN_ENTERPRISE: '1' }).fouten, /RTG_PIN_ENTERPRISE=1 vereist REDIS_URL/), true);
  assert.equal(heeft(deel({ REDIS_URL: 'redis://cache:6379' }).waarschuwingen, /REDIS_URL niet gezet/), false);
  assert.equal(heeft(deel({ RTG_MEDIA_BACKEND: 'nfs' }).fouten, /RTG_MEDIA_BACKEND moet exact/), true);
  assert.equal(heeft(deel({ RTG_MEDIA_BACKEND: 's3' }).fouten, /S3-mediastore is niet productieklaar/), true);
  assert.equal(heeft(deel({ DATABASE_URL: 'postgres://db:5432/rtg', RTG_STORE: 'postgres' }).fouten, /B2B2C-media vereist/), true);
  assert.equal(heeft(deel({ RTG_STORE: 'onzin' }).fouten, /RTG_STORE=|opslagstand/), true);
});

test('communicatie: het oude mailveld, publieke persoonlijke mail en DKIM', () => {
  assert.equal(heeft(deel({ SMTP_HOST: 'smtp.rtg-proef.nl' }).fouten, /SMTP_HOST wordt niet door de verzendlaag gelezen/), true);
  const publiek = deel({ RTG_MAIL_PUBLIEK_BASIS: '.post.rtg-proef.nl.', RTF_MAIL_PUBLIEK_DOMEIN: 'rtf-proef.nl',
    MAIL_DOMEIN: 'ander-domein.nl', DKIM_PRIVATE_KEY: 'k', MAIL_INBOUND_PROVIDER: 'AWS-SES' });
  for (const re of [/zonder SMTP-provider/, /SES_INBOUND_SECRET/, /lijnen niet uit/, /Twee publieke afzenderdomeinen/])
    assert.equal(heeft(publiek.fouten, re), true, String(re));
  assert.equal(heeft(publiek.waarschuwingen, /live MX, SPF en DMARC/), true);
  const smtp = deel({ SMTP_URL: 'smtp://mail:587', RTG_MAIL_PUBLIEK_BASIS: 'rtg-proef.nl' });
  assert.equal(heeft(smtp.waarschuwingen, /ondertekent smarthost-mail niet zelf met DKIM/), true);
  assert.equal(heeft(smtp.fouten, /zonder inkomende mailroute/), true);
  assert.equal(heeft(smtp.fouten, /vereist provider-DKIM/), true);
  const provider = deel({ SMTP_URL: 'smtp://mail:587', MAIL_PROVIDER_DKIM: '1', RTG_MAIL_PUBLIEK_BASIS: 'rtg-proef.nl',
    MAIL_IN_POORT: '2525', RTG_HERSTEL_SMS_UIT_BEWUST: '1' });
  assert.equal(heeft(provider.fouten, /DKIM|mailroute|SMS-provider/), false);
  assert.equal(heeft(provider.waarschuwingen, /smarthost-mail/), false);
});
