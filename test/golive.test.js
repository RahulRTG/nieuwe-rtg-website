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
const SENTINEL_TOKEN = path.join(TMP, 'sentinel.token');
fs.writeFileSync(SENTINEL_TOKEN, 'a'.repeat(64) + '\n', { mode: 0o600 });

// een complete, veilige productieomgeving (zoals npm run sleutels die maakt)
const PROD_ENV = {
  ...process.env, NODE_ENV: 'production', PORT: String(PORT), RTG_DATA_DIR: TMP,
  RTG_ENC_KEY: 'e'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64),
  RTG_CLUSTER_KEY: 'c'.repeat(32), OFFICE_CODE: 'KEURING-CODE-12', DEMO_PASS: 'x'.repeat(16),
  RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl', APP_URL: 'https://rtg.example.com',
  RTG_SENTINEL_TOKEN_FILE: SENTINEL_TOKEN,
  /* De eenmalige sleutel waarmee de eerste eigenaar zijn account claimt. Zonder
     deze komt het eigenaarsadres niet door de openbare registratie -- anders werd
     wie het adres als eerste intikte de eigenaar van het platform, en het adres
     is niet geheim. De beheerder zet hem bij de eerste start en haalt hem daarna
     weg. Zie server/routes/auth/account.js. */
  RTG_OWNER_BOOTSTRAP: 'proef-eenmalige-eigenaarssleutel',
  /* De eerste publieke stand kan bewust zonder AI en zonder betalen draaien.
     Anders dan STRIPE_DEMO_BEWUST is dit echt fail-closed: geen enkele demo- of
     echte rail mag een betaling bevestigen. */
  RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1',
  SMTP_URL: 'smtp://rtg:test@mail.voorbeeld.test:587',
  DATABASE_URL: '', REDIS_URL: '', SENTRY_DSN: '', STRIPE_SECRET_KEY: ''
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
  // ruime marge: op een zwaar belaste CI-runner (Postgres-container + veel
   // parallelle server-starts) mag een koude productiestart wat langer duren
  for (let i = 0; i < 400; i++) {
    try { const r = await haal("/api/health"); if (r.ok) { op = true; break; } } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(op, 'de server start met de veilige configuratie');
  const ready = await haal("/api/ready");
  assert.equal(ready.status, 200, 'en meldt zich klaar voor verkeer');
  const readyBody = await ready.json();
  assert.equal(readyBody.ready, true, 'de readiness-check bevestigt dat de opslag geladen is');
  assert.ok(typeof readyBody.store === 'string', 'de readiness-check meldt welke opslag actief is');
  assert.equal((await haal("/")).status, 200, "de website wordt geserveerd");

  // demo is ECHT dicht op ELK portaal: geen pas-login zonder wachtwoord, en het
  // universele demo-account (naam/wachtwoord) werkt op geen enkele ingang meer
  assert.equal((await post('/api/login', { tier: 'business' })).status, 403, 'demo-pas-login is dicht');
  assert.equal((await post('/api/login', { username: 'Rahul', password: 'Imran' })).status, 403, 'het demo-account bestaat niet (leden)');
  assert.equal((await post('/api/supplier/login', { username: 'Rahul', password: 'Imran' })).status, 403, 'het demo-account bestaat niet (leveranciers)');
  assert.equal((await post('/api/staff', { username: 'Rahul', password: 'Imran' })).status, 403, 'het demo-account bestaat niet (personeel)');

  /* En kaal http wordt onherroepelijk naar https gestuurd. Let op WELK adres
     we daarvoor nemen: een gewone pagina, niet /api/health. De prikken van de
     poortwachter (/api/health, /api/ready) en het interne clusterkanaal gaan
     bewust NIET door die omleiding -- zij praten http op de loopback, en een
     301 daarop betekende dat geen enkele server ooit gezond of actief werd en
     de site in productie altijd 503 gaf. Deze test gebruikte /api/health als
     voorbeeld en legde daarmee precies het verkeerde vast. Nu allebei de
     kanten, zodat geen van beide stilletjes kan omslaan. */
  const kaal = await fetch(BASE + '/', { redirect: 'manual' });
  assert.equal(kaal.status, 301, 'onbeveiligd http wordt doorgestuurd naar https');
  const prik = await fetch(BASE + '/api/health', { redirect: 'manual' });
  assert.equal(prik.status, 200, 'de gezondheidsprik wordt NIET omgeleid');
  const klaar = await fetch(BASE + '/api/ready', { redirect: 'manual' });
  assert.notEqual(klaar.status, 301, '/api/ready wordt NIET omgeleid');

  // echte registratie en inlog werken gewoon
  const reg = await post('/api/auth/register', { name: 'Eerste Lid', email: 'lid@echtdomein.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(reg.status, 200);
  const regData = await reg.json();
  assert.ok(regData.token);
  assert.ok(!regData.devVerifyUrl, 'productie lekt geen bevestigingslink in het antwoord');
  assert.equal((await post('/api/auth/login', { login: 'lid@echtdomein.nl', password: 'geheim123', pasApp: 'rtg' })).status, 200);
  const pay = await fetch(BASE + '/api/pay', { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + regData.token, ...PROXY
  }, body: '{}' });
  assert.equal(pay.status, 503, 'betalen blijft in deze publieke stand hard uit');
  assert.equal((await pay.json()).code, 'betalingen-uit');
  const direct = await fetch(BASE + '/api/betaal/direct', { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + regData.token, ...PROXY
  }, body: JSON.stringify({ supplierCode: 'geen', bedrag: 10 }) });
  assert.equal(direct.status, 503, 'ook een tweede betaalroute is centraal dicht');
  assert.equal((await direct.json()).code, 'betalingen-uit');

  // wachtwoord vergeten: de tweestapsflow draait, maar link en code blijven
  // in productie UIT het antwoord (die gaan per e-mail en telefoon)
  const forgot = await (await post('/api/auth/forgot', { email: 'lid@echtdomein.nl' })).json();
  assert.ok(forgot.ok && forgot.tweestaps);
  assert.ok(!forgot.devResetUrl && !forgot.devCode, 'productie lekt geen herstel-link of telefooncode');

  /* Het eigenaarsadres komt ALLEEN binnen met de eenmalige sleutel. Zonder die
     sleutel is dit precies het gat dat hier stond: wie het adres als eerste
     registreerde werd eigenaar van het platform -- technische pagina,
     hoofdzekering, boardroom. Allebei de kanten staan hier, zodat geen van
     beide stilletjes kan omslaan. */
  const zonderSleutel = await post('/api/auth/register', { name: 'Kaper', email: 'eigenaar@echtdomein.nl', phone: '0611111111',
    password: 'kaper12345', geboortedatum: '1980-01-01', tier: 'business', pasApp: 'business' });
  assert.equal(zonderSleutel.status, 409, 'zonder de eenmalige sleutel komt het eigenaarsadres er niet in');
  const verkeerd = await post('/api/auth/register', { name: 'Kaper', email: 'eigenaar@echtdomein.nl', phone: '0611111111',
    password: 'kaper12345', geboortedatum: '1980-01-01', tier: 'business', pasApp: 'business', eigenaarSleutel: 'x'.repeat(31) });
  assert.equal(verkeerd.status, 409, 'en met een verkeerde sleutel ook niet');

  // de eigenaar registreert zijn echte adres MET de sleutel en komt op de technische pagina
  await post('/api/auth/register', { name: 'De Eigenaar', email: 'eigenaar@echtdomein.nl', phone: '0687654321',
    password: 'eigenaar123', geboortedatum: '1980-01-01', tier: 'business', pasApp: 'business',
    eigenaarSleutel: 'proef-eenmalige-eigenaarssleutel' });
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

test('de go-live-keuring keurt af zonder geheimen, en met alle geheimen blijft het AVG-papierwerk de laatste poort', () => {
  const script = path.join(__dirname, '..', 'scripts', 'golive.js');
  const kaal = spawnSync(process.execPath, [script], {
    env: { PATH: process.env.PATH }, timeout: 20000, encoding: 'utf8'
  });
  assert.equal(kaal.status, 1, 'kale omgeving: niet klaar om live te gaan');
  assert.match(kaal.stdout, /NIET klaar/);
  // Met een complete secrets-/configset is de techniek in orde, maar de keuring
  // vult sinds de AVG-ronde ook het verwerkingsregister en het datalek-draaiboek
  // echt in (met de antwoorden die Rahul heeft uitgevraagd) en blokkeert zolang
  // daar plekken open staan. Dat is de bedoeling: zonder ingevuld papierwerk ga
  // je niet live. RTG_DATA_DIR wijst hier naar een verse map, dus alles staat open.
  const goed = spawnSync(process.execPath, [script], { env: PROD_ENV, timeout: 20000, encoding: 'utf8' });
  assert.match(goed.stdout, /Configuratie: geen blokkerende fouten/, 'de configuratie zelf is in orde');
  assert.equal(goed.status, 1, 'maar het AVG-papierwerk is de laatste, bewuste poort');
  assert.match(goed.stdout, /open plek\(ken\)/, 'de blokkade telt de open plekken in de AVG-documenten');
  assert.match(goed.stdout, /vragen staan nog open/, 'en wijst naar de vragen die Rahul nog moet stellen');
});
