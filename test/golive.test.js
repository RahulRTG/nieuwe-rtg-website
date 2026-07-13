/* De generale repetitie voor live gaan: start de server ECHT in productiestand
   en bewijs dat hij zich dan ook zo gedraagt (demo dicht, geen dev-lekken,
   registreren en de technische pagina werken), dat een onveilige start wordt
   geweigerd, en dat de go-live-keuring goed keurt en afkeurt.
   Draai los: node --experimental-sqlite --test test/golive.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 4300 + Math.floor(Math.random() * 60);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-golive-'));
const SERVER = path.join(__dirname, '..', 'server', 'server.js');

// een complete, veilige productieomgeving (zoals npm run sleutels die maakt)
const PROD_ENV = {
  ...process.env, NODE_ENV: 'production', PORT: String(PORT), RTG_DATA_DIR: TMP,
  RTG_ENC_KEY: 'e'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64),
  RTG_CLUSTER_KEY: 'c'.repeat(32), OFFICE_CODE: 'KEURING-CODE-12', DEMO_PASS: 'x'.repeat(16),
  RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl', APP_URL: 'https://rtg.example.com',
  SMTP_URL: '', DATABASE_URL: '', REDIS_URL: '', SENTRY_DSN: '', STRIPE_SECRET_KEY: ''
};

/* In productie dwingt de server https af (301 voor kaal http). De testsuite
   praat via localhost, dus we gedragen ons als de TLS-proxy ervoor en sturen
   X-Forwarded-Proto mee, precies zoals de echte hosting dat doet. */
const PROXY = { 'X-Forwarded-Proto': 'https' };
const haal = (pad) => fetch(BASE + pad, { headers: PROXY });
function post(pad, body) {
  return fetch(BASE + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', ...PROXY }, body: JSON.stringify(body || {}) });
}
let child;

test('een onveilige productiestart wordt geweigerd (fail-fast, echt proces)', async () => {
  const r = spawnSync(process.execPath, ['--experimental-sqlite', SERVER], {
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), RTG_DATA_DIR: TMP },
    timeout: 20000, encoding: 'utf8'
  });
  assert.equal(r.status, 1, 'zonder sleutels en eigenaar weigert de server te starten');
  assert.match(r.stderr + r.stdout, /RTG_OWNER_EMAIL/, 'en zegt precies waarom');
});

test('de veilige productiestart komt op en gedraagt zich als productie', async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', SERVER], { env: PROD_ENV, stdio: ['ignore', 'ignore', 'inherit'] });
  let op = false;
  for (let i = 0; i < 120; i++) {
    try { const r = await haal("/api/health"); if (r.ok) { op = true; break; } } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(op, 'de server start met de veilige configuratie');
  assert.equal((await haal("/api/ready")).status, 200, 'en meldt zich klaar voor verkeer');
  assert.equal((await haal("/")).status, 200, "de website wordt geserveerd");

  // demo is ECHT dicht op ELK portaal: geen pas-login zonder wachtwoord, en het
  // universele demo-account (naam/wachtwoord) werkt op geen enkele ingang meer
  assert.equal((await post('/api/login', { tier: 'business' })).status, 403, 'demo-pas-login is dicht');
  assert.equal((await post('/api/login', { username: 'Rahul', password: 'Imran' })).status, 403, 'het demo-account bestaat niet (leden)');
  assert.equal((await post('/api/supplier/login', { username: 'Rahul', password: 'Imran' })).status, 403, 'het demo-account bestaat niet (leveranciers)');
  assert.equal((await post('/api/staff', { username: 'Rahul', password: 'Imran' })).status, 403, 'het demo-account bestaat niet (personeel)');

  // en kaal http wordt onherroepelijk naar https gestuurd
  const kaal = await fetch(BASE + '/api/health', { redirect: 'manual' });
  assert.equal(kaal.status, 301, 'onbeveiligd http wordt doorgestuurd naar https');

  // echte registratie en inlog werken gewoon
  const reg = await post('/api/auth/register', { name: 'Eerste Lid', email: 'lid@echtdomein.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(reg.status, 200);
  const regData = await reg.json();
  assert.ok(regData.token);
  assert.ok(!regData.devVerifyUrl, 'productie lekt geen bevestigingslink in het antwoord');
  assert.equal((await post('/api/auth/login', { login: 'lid@echtdomein.nl', password: 'geheim123', pasApp: 'rtg' })).status, 200);

  // wachtwoord vergeten: de tweestapsflow draait, maar link en code blijven
  // in productie UIT het antwoord (die gaan per e-mail en telefoon)
  const forgot = await (await post('/api/auth/forgot', { email: 'lid@echtdomein.nl' })).json();
  assert.ok(forgot.ok && forgot.tweestaps);
  assert.ok(!forgot.devResetUrl && !forgot.devCode, 'productie lekt geen herstel-link of telefooncode');

  // de eigenaar registreert zijn echte adres en komt op de technische pagina
  await post('/api/auth/register', { name: 'De Eigenaar', email: 'eigenaar@echtdomein.nl', phone: '0687654321',
    password: 'eigenaar123', geboortedatum: '1980-01-01', tier: 'business', pasApp: 'business' });
  const tech = await (await post('/api/techniek/inloggen', { login: 'eigenaar@echtdomein.nl', wachtwoord: 'eigenaar123' })).json();
  assert.equal(tech.eigenaar, true, 'de echte eigenaar heeft de technische pagina');
  // en de backoffice draait op de eigen (niet-demo) code
  assert.equal((await post('/api/office/login', { code: 'RTG-OFFICE' })).status, 401, 'de demo-backofficecode werkt niet');
  assert.equal((await post('/api/office/login', { code: 'KEURING-CODE-12' })).status, 200, 'de eigen code wel');
});

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de go-live-keuring keurt af zonder geheimen en goed met de complete set', () => {
  const script = path.join(__dirname, '..', 'scripts', 'golive.js');
  const kaal = spawnSync(process.execPath, [script], {
    env: { PATH: process.env.PATH }, timeout: 20000, encoding: 'utf8'
  });
  assert.equal(kaal.status, 1, 'kale omgeving: niet klaar om live te gaan');
  assert.match(kaal.stdout, /NIET klaar/);
  const goed = spawnSync(process.execPath, [script], { env: PROD_ENV, timeout: 20000, encoding: 'utf8' });
  assert.equal(goed.status, 0, 'complete omgeving: klaar om live te gaan');
  assert.match(goed.stdout, /Klaar om live te gaan/);
});
