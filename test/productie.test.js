/* Tests voor de productie-hardening: config-validatie, duurzame opslag,
   betaal-naad (idempotentie + webhook-verificatie) en de logger.
   Draai: node --test test/productie.test.js
   NB: STRIPE_WEBHOOK_SECRET wordt hier gezet vóór het laden van betaal.js,
   omdat die de secret bij het inladen leest. */
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'test-webhook-secret';
process.env.RTG_DEMO = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const config = require('../server/config');
const betaal = require('../server/betaal');
const { schrijfDuurzaam } = require('../server/db');
const { middleware, foutMiddleware } = require('../server/log');

/* ---------- config-validatie ---------- */

test('config: onveilige productie geeft blokkerende fouten', () => {
  const r = config.valideer({ NODE_ENV: 'production', RTG_DEMO: '1', DEMO_PASS: 'Imran' });
  assert.ok(r.productie);
  assert.ok(r.fouten.length >= 3, 'demo aan, geen enc-key en standaard-wachtwoord moeten falen');
  assert.ok(r.fouten.some(f => /RTG_DEMO/.test(f)));
  assert.ok(r.fouten.some(f => /RTG_ENC_KEY/.test(f)));
});

test('config: veilige productie is foutloos', () => {
  const r = config.valideer({ NODE_ENV: 'production', RTG_ENC_KEY: 'a'.repeat(64),
    APP_URL: 'https://x', DATABASE_URL: 'postgresql://x', RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64),
    /* STRIPE_WEBHOOK_SECRET hoort hier sinds de poortwacht-ronde bij: een
       betaalsleutel zonder webhook-secret is gevaarlijker dan geen van beide,
       want dan komt de "is er betaald"-melding onondertekend binnen en kan wie
       het adres kent zelf "betaald" roepen. Een veilige productie heeft ze dus
       allebei -- deze opsomming is precies dat: hoe veilig eruitziet. */
    /* HIER STOND SENTRY_DSN, en dat maakte van deze toets een bevestiging van
       een fictie. Die variabele wordt door niets gelezen: er is geen
       Sentry-koppeling (zero dependencies) en server/foutmelder.js doet het werk
       op ERR_WEBHOOK_URL. Een "veilige productie" die SENTRY_DSN zet en
       ERR_WEBHOOK_URL niet, heeft in werkelijkheid GEEN externe alarmering --
       en deze toets zei dat dat foutloos was. */
    REDIS_URL: 'r', ERR_WEBHOOK_URL: 'https://haak.voorbeeld.test/rtg', SMTP_URL: 'm', OPENAI_API_KEY: 'test-ai-key',
    STRIPE_SECRET_KEY: 'k', STRIPE_WEBHOOK_SECRET: 'whsec_k',
    RTF_IBAN: 'NL11FOUND0000000001', RTG_MEDIA_BACKEND: 's3',
    RTG_HERSTEL_SMS_UIT_BEWUST: '1', STRIPE_UITGAAND_UIT_BEWUST: '1',
    OFFICE_TOTP_SECRET: 'JBSWY3DPEHPK3PXP',
    RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl' });
  assert.equal(r.fouten.length, 0);
  assert.equal(r.waarschuwingen.length, 0, 'geen enkele waarschuwing: ' + JSON.stringify(r.waarschuwingen));
});

test('config: herstel-SMS moet echt bestaan of bewust fail-closed staan', () => {
  const basis = { NODE_ENV: 'production', RTG_ENC_KEY: 'a'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64),
    RTG_SECRET_KEY: 's'.repeat(64), RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl', SMTP_URL: 'smtp://x',
    STRIPE_DEMO_BEWUST: '1' };
  const stil = config.valideer(basis);
  assert.ok(stil.fouten.some(f => /SMS-provider/.test(f)), 'zonder tweede kanaal hoort productie niet stil te starten');
  const bewust = config.valideer({ ...basis, RTG_HERSTEL_SMS_UIT_BEWUST: '1' });
  assert.ok(!bewust.fouten.some(f => /SMS-provider/.test(f)), 'de bewuste fail-closed stand is toegestaan');
});

/* De backoffice is de meest bevoorrechte deur van het huis: auditlog, tijdlijn
   met codenamen, export. Zonder tweede factor staat die achter alleen de
   statische OFFICE_CODE, en de officedeur telt mislukkingen per IP -- dus is
   verspreid raden er ook niet door gestopt. Dit was een waarschuwing, en een
   waarschuwing bij elke start leert iedereen wegkijken. */
test('config: productie start niet zonder tweede factor op de backoffice', () => {
  const basis = { NODE_ENV: 'production', RTG_ENC_KEY: 'a'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64),
    RTG_SECRET_KEY: 's'.repeat(64), RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl', SMTP_URL: 'smtp://x',
    RTG_HERSTEL_SMS_UIT_BEWUST: '1', STRIPE_DEMO_BEWUST: '1' };
  const zonder = config.valideer(basis);
  assert.ok(zonder.fouten.some(f => /OFFICE_TOTP_SECRET/.test(f)),
    'zonder tweede factor hoort productie te weigeren, niet te waarschuwen');
  assert.ok(!zonder.waarschuwingen.some(f => /OFFICE_TOTP_SECRET/.test(f)),
    'en het hoort geen waarschuwing meer te zijn, anders staat dezelfde eis op twee sterktes');

  /* Een geheim dat te kort is om een tweede factor te zijn is geen tweede
     factor. Anders haalt "OFFICE_TOTP_SECRET=x" de eis met een letter. */
  const kort = config.valideer({ ...basis, OFFICE_TOTP_SECRET: 'JBSWY3DP' });
  assert.ok(kort.fouten.some(f => /OFFICE_TOTP_SECRET/.test(f)), 'acht tekens is geen tweede factor');

  const goed = config.valideer({ ...basis, OFFICE_TOTP_SECRET: 'JBSWY3DPEHPK3PXP' });
  assert.ok(!goed.fouten.some(f => /OFFICE_TOTP_SECRET/.test(f)), 'een bruikbaar base32-geheim is genoeg');
});

test('config: een ongebruikte SMTP_HOST doet zich niet voor als werkende mailroute', () => {
  const basis = { NODE_ENV: 'production', RTG_ENC_KEY: 'a'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64),
    RTG_SECRET_KEY: 's'.repeat(64), RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl',
    STRIPE_DEMO_BEWUST: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1' };
  const schijn = config.valideer({ ...basis, SMTP_HOST: 'smtp.example.test' });
  assert.ok(schijn.fouten.some(f => /SMTP_HOST.*niet.*gelezen/.test(f)),
    'een instelling die mail.js niet leest mag productie niet groen maken');
  const echt = config.valideer({ ...basis, SMTP_URL: 'smtps://smtp.example.test:465' });
  assert.ok(!echt.fouten.some(f => /mailroute|mailprovider/.test(f)),
    'de route die mail.js werkelijk gebruikt wordt wel herkend');
});

/* De twee kanten van de dode variabele, apart vastgelegd. Zonder deze toets kan
   iemand SENTRY_DSN in de keuring terugzetten zonder dat er iets klaagt, en dan
   staat de val er weer: een beheerder die de checklist volgt zet hem, vinkt af,
   en gaat live zonder alarmering. */
test('config: de alarmering wijst naar de variabele die het werk doet', () => {
  const zonder = config.valideer({ NODE_ENV: 'production', RTG_ENC_KEY: 'a'.repeat(64),
    RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl' });
  assert.ok(zonder.waarschuwingen.some(w => /ERR_WEBHOOK_URL/.test(w)),
    'zonder webhook waarschuwt de keuring over ERR_WEBHOOK_URL: ' + JSON.stringify(zonder.waarschuwingen));
  assert.ok(!zonder.waarschuwingen.some(w => /^SENTRY_DSN niet gezet/.test(w)),
    'en stuurt niemand meer naar SENTRY_DSN');

  // wie hem tOch zet, hoort te horen dat het niets doet
  const misleid = config.valideer({ NODE_ENV: 'production', RTG_ENC_KEY: 'a'.repeat(64),
    RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl', SENTRY_DSN: 'https://sleutel@sentry.example/1' });
  assert.ok(misleid.waarschuwingen.some(w => /SENTRY_DSN.*door niets gelezen/.test(w)),
    'SENTRY_DSN zetten levert een waarschuwing dat hij niets doet: ' + JSON.stringify(misleid.waarschuwingen));
});

test('config: het voorbeeld-eigenaarsadres blokkeert de productiestart', () => {
  // met het voorbeeldadres zou iedereen die het registreert eigenaar van de
  // technische pagina worden; ontbreken of default = harde fout
  const zonder = config.valideer({ NODE_ENV: 'production', RTG_ENC_KEY: 'a'.repeat(64) });
  assert.ok(zonder.fouten.some(f => /RTG_OWNER_EMAIL/.test(f)));
  const standaard = config.valideer({ NODE_ENV: 'production', RTG_ENC_KEY: 'a'.repeat(64), RTG_OWNER_EMAIL: 'rahul@rtg.example' });
  assert.ok(standaard.fouten.some(f => /RTG_OWNER_EMAIL/.test(f)));
  // en een te korte backoffice-code ook
  const zwak = config.valideer({ NODE_ENV: 'production', RTG_ENC_KEY: 'a'.repeat(64), RTG_OWNER_EMAIL: 'e@x.nl', OFFICE_CODE: 'kort' });
  assert.ok(zwak.fouten.some(f => /OFFICE_CODE/.test(f)));
});

test('config: VUL-IN-plaatshouders blokkeren ook een directe productiestart', () => {
  const basis = { NODE_ENV: 'production', RTG_ENC_KEY: 'a'.repeat(64),
    RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64),
    RTG_HERSTEL_SMS_UIT_BEWUST: '1', STRIPE_DEMO_BEWUST: '1' };
  for (const [naam, waarde] of [
    ['RTG_OWNER_EMAIL', 'VUL-IN@JOUW-DOMEIN.NL'],
    ['APP_URL', 'https://VUL-IN.NL'],
    ['DATABASE_URL', 'postgresql://VUL-IN'],
    ['REDIS_URL', 'redis://VUL-IN'],
    ['SMTP_URL', 'smtps://VUL-IN']
  ]) {
    const r = config.valideer({ ...basis, RTG_OWNER_EMAIL: 'eigenaar@echt.nl', SMTP_URL: 'smtps://echt', [naam]: waarde });
    assert.ok(r.fouten.some(f => f.includes(naam) && /VUL-IN/.test(f)), naam + ' moet hard falen');
  }
});

test('config: de kluissleutels MOETEN uit de omgeving komen in productie', () => {
  /* Zonder RTG_VAULT_KEY/RTG_SECRET_KEY zet server/accounts ze als bestand in
     de datamap -- naast rtg.db. Wie de map steelt, heeft dan de database en de
     sleutel om hem te ontcijferen, en zijn de codenamen weer namen. Dat moet de
     start blokkeren, niet waarschuwen. */
  const basis = { NODE_ENV: 'production', RTG_ENC_KEY: 'a'.repeat(64), RTG_OWNER_EMAIL: 'e@x.nl' };
  const leeg = config.valideer(basis);
  assert.ok(leeg.fouten.some(f => /^RTG_VAULT_KEY ontbreekt/.test(f)));
  assert.ok(leeg.fouten.some(f => /^RTG_SECRET_KEY ontbreekt/.test(f)));

  // een te korte sleutel is net zo goed geen sleutel
  const kort = config.valideer({ ...basis, RTG_VAULT_KEY: 'kort', RTG_SECRET_KEY: 's'.repeat(64) });
  assert.ok(kort.fouten.some(f => /RTG_VAULT_KEY is te kort/.test(f)));
  assert.ok(!kort.fouten.some(f => /RTG_SECRET_KEY/.test(f)));

  // en met beide sleutels zwijgt de keuring erover -- ook geen waarschuwing meer
  const goed = config.valideer({ ...basis, RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64) });
  assert.ok(!goed.fouten.some(f => /RTG_VAULT_KEY|RTG_SECRET_KEY/.test(f)));
  assert.ok(!goed.waarschuwingen.some(w => /RTG_VAULT_KEY|RTG_SECRET_KEY/.test(w)));

  // buiten productie blokkeert het niets: lokaal werken blijft werken
  const lokaal = config.valideer({ NODE_ENV: 'development' });
  assert.equal(lokaal.fouten.length, 0);
});

test('config: ontbrekende enc-key mag met bewuste opt-out', () => {
  const r = config.valideer({ NODE_ENV: 'production', RTG_ALLOW_PLAINTEXT: '1', RTG_ENC_KEY: '' });
  assert.ok(!r.fouten.some(f => /RTG_ENC_KEY ontbreekt/.test(f)));
});

test('config: buiten productie nooit blokkeren', () => {
  const r = config.valideer({ NODE_ENV: 'development', RTG_DEMO: '1' });
  assert.equal(r.fouten.length, 0);
});

test('config: ongeldige PORT wordt afgekeurd', () => {
  const r = config.valideer({ NODE_ENV: 'development', PORT: '99999' });
  assert.ok(r.fouten.some(f => /PORT/.test(f)));
});

/* ---------- duurzame opslag ---------- */

test('db.schrijfDuurzaam: schrijft atomisch, laat geen .tmp achter, met 0600', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dur-'));
  const f = path.join(dir, 'data.json');
  schrijfDuurzaam(f, JSON.stringify({ a: 1 }), 0o600);
  assert.equal(fs.readFileSync(f, 'utf8'), '{"a":1}');
  assert.equal(fs.existsSync(f + '.tmp'), false);
  if (process.platform !== 'win32') assert.equal(fs.statSync(f).mode & 0o777, 0o600);
  // overschrijven vervangt de inhoud volledig
  schrijfDuurzaam(f, JSON.stringify({ b: 2 }), 0o600);
  assert.equal(fs.readFileSync(f, 'utf8'), '{"b":2}');
  fs.rmSync(dir, { recursive: true, force: true });
});

/* ---------- betaal-naad ---------- */

test('betaal: demo-provider bevestigt en is idempotent', async () => {
  const a = await betaal.maakBetaling({ bedrag: 1500, referentie: 'inv-9', idempotentieSleutel: 'sleutel-A' });
  assert.equal(a.aanbieder, 'demo');
  assert.equal(a.status, 'betaald');
  const b = await betaal.maakBetaling({ bedrag: 1500, referentie: 'inv-9', idempotentieSleutel: 'sleutel-A' });
  assert.equal(b.id, a.id, 'zelfde idempotentiesleutel geeft dezelfde betaling');
  assert.equal(b.herhaald, true);
});

test('betaal: zonder Stripe en zonder bewuste demo geeft de rail nooit fictief succes', () => {
  const proef = spawnSync(process.execPath, ['-e',
    "const b=require('./server/betaal'); b.maakBetaling({bedrag:100}).then(()=>process.exit(9)).catch(e=>{if(e.code!=='BETAALRAIL_UIT')process.exit(8)})"], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8',
    env: { ...process.env, RTG_DEMO: '', STRIPE_DEMO_BEWUST: '', STRIPE_SECRET_KEY: '' }
  });
  assert.equal(proef.status, 0, proef.stderr || proef.stdout);
});

test('betaal: bedrag moet positief zijn', async () => {
  await assert.rejects(() => betaal.maakBetaling({ bedrag: 0 }));
  await assert.rejects(() => betaal.maakBetaling({ bedrag: -5 }));
  await assert.rejects(() => betaal.maakBetaling({ bedrag: 'tien' }));
});

test('betaal: webhook accepteert geldige en weigert ongeldige handtekening', () => {
  const body = Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded', id: 'evt_1' }));
  const sig = betaal.tekenDemo(body);
  const evt = betaal.verifieerWebhook(body, sig);
  assert.equal(evt.type, 'payment_intent.succeeded');
  assert.throws(() => betaal.verifieerWebhook(body, 'onzin'), /handtekening/i);
  assert.throws(() => betaal.verifieerWebhook(body, sig.slice(0, -2) + '00'), /handtekening/i);
});

/* ---------- logger-middleware ---------- */

test('log.middleware: zet een X-Request-Id op het antwoord', () => {
  const headers = {};
  const req = { headers: {}, method: 'GET', path: '/x' };
  const res = { set: (k, v) => { headers[k] = v; }, on: () => {} };
  middleware()(req, res, () => {});
  assert.ok(req.id, 'req.id gezet');
  assert.equal(headers['X-Request-Id'], req.id);
});

test('log.foutMiddleware: geeft nette 500 met id, lekt geen details', () => {
  let code = 0, payload = null;
  const req = { id: 'abc', path: '/kapot' };
  const res = { headersSent: false, status(c) { code = c; return this; }, json(o) { payload = o; return this; } };
  foutMiddleware()(new Error('interne details'), req, res, () => {});
  assert.equal(code, 500);
  assert.equal(payload.id, 'abc');
  assert.ok(!/interne details/.test(JSON.stringify(payload)), 'interne foutmelding mag niet lekken');
});
