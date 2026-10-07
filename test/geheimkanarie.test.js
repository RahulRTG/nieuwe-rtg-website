'use strict';
/* DE GEHEIMKANARIE -- de echte server start met herkenbare nepgeheimen, elke
   route wordt aangeroepen (ook met kapotte invoer en vreemde koppen), en
   daarna wordt ALLES wat het proces naar buiten gaf doorzocht: stdout, stderr,
   elk antwoord met zijn koppen, en elke melding die de foutmelder naar zijn
   webhook stuurde. Staat er één kanarie in, dan zakt de toets met de regel
   erbij. Een geheimlek is een releaseblokkade (zie scripts/lib/geheimkanarie.js
   voor de lijst kanaries en de scanner die CI hiervoor gebruikt).

   Drie standen, want een lek zit vaak in het pad dat je niet loopt:
     1. opslag onbereikbaar: REDIS_URL en DATABASE_URL met wachtwoord naar een
        dichte poort -- het foutpad van de verbindingen;
     2. gewone start: de hele routetabel, met nep-Bearer, nep-Cookie en een
        lichaam vol nep-wachtwoorden;
     3. productie zonder geldige configuratie: de startweigering.

   En de meter moet kunnen uitslaan: een proces dat met opzet een geheim naar
   de console schrijft, moet door de centrale redactie schoon naar buiten komen,
   en de scanner moet een kanarie vinden als hij er wel staat. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { kanaries, scan } = require('../scripts/lib/geheimkanarie');

const ROOT = path.join(__dirname, '..');
const K = kanaries();

function vrijePoort() {
  return new Promise(res => { const s = http.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}

/* Een ontvanger op de eigen machine voor de foutmelder-webhook: wat het huis
   verlaat, wordt ook doorzocht. */
function ontvanger() {
  const lijven = [];
  const s = http.createServer((req, res) => { let b = ''; req.on('data', d => { b += d; }); req.on('end', () => { lijven.push(JSON.stringify(req.headers) + '\n' + b); res.end('ok'); }); });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r({ poort: s.address().port, lijven, sluit: () => s.close() })));
}

async function start(env, { wacht = true } = {}) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kanarie-'));
  const poort = await vrijePoort();
  const uit = [];
  const kind = spawn(process.execPath, ['server/server.js'], { cwd: ROOT,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(poort), RTG_DATA_DIR: data, RTG_BIND: '127.0.0.1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'] });
  kind.stdout.on('data', d => uit.push(String(d)));
  kind.stderr.on('data', d => uit.push(String(d)));
  const klaar = new Promise(r => kind.on('exit', code => r(code)));
  const basis = 'http://127.0.0.1:' + poort;
  if (wacht) {
    const tot = Date.now() + 60000;
    while (Date.now() < tot) {
      try { const r = await fetch(basis + '/api/health', { signal: AbortSignal.timeout(2000) }); if (r.status < 600) break; } catch (e) { /* nog niet */ }
      if (kind.exitCode != null) break;
      await new Promise(r => setTimeout(r, 300));
    }
  }
  return { basis, uit, kind, klaar, stop: async () => { if (kind.exitCode == null) kind.kill('SIGTERM'); await Promise.race([klaar, new Promise(r => setTimeout(r, 5000))]); if (kind.exitCode == null) kind.kill('SIGKILL'); fs.rmSync(data, { recursive: true, force: true }); } };
}

const KOPPEN = { Authorization: 'Bearer ' + K.verzoek.bearer, Cookie: 'rtg=' + K.verzoek.cookie, 'X-Api-Key': K.verzoek.apikey };
const LIJF = JSON.stringify({ password: K.verzoek.wachtwoord, token: K.verzoek.token, url: 'redis://x:' + K.verzoek.url + '@h/' });

async function roep(basis, methode, pad, lijf) {
  const opts = { method: methode, headers: { ...KOPPEN }, signal: AbortSignal.timeout(10000) };
  if (!['GET', 'HEAD', 'DELETE'].includes(methode)) { opts.headers['Content-Type'] = 'application/json'; opts.body = lijf; }
  try { const r = await fetch(basis + pad, opts); return { status: r.status, tekst: await r.text(), koppen: JSON.stringify([...r.headers]) }; }
  catch (e) { return { status: 0, tekst: '', koppen: '' }; }
}

function eisSchoon(naam, stukken) {
  const treffers = scan(stukken.join('\n'), K.alle);
  assert.deepEqual(treffers, [], naam + ': geheim teruggevonden in de uitvoer:\n' + treffers.map(t => '  ' + t.kanarie + ' in: ' + t.context).join('\n'));
}

test('de meter slaat uit: de scanner vindt een kanarie, en de console van de server redigeert hem', () => {
  assert.equal(scan('x ' + K.env.STRIPE_SECRET_KEY + ' y', K.alle).length, 1);
  const r = spawnSync(process.execPath, ['-e', `require('./server/log-redactie').bewaakConsole();
    console.error('verbinding redis://u:' + process.argv[1] + '@h:1 mislukt'); console.log({ wachtwoord: process.argv[2] });
    console.warn(new Error('sleutel ' + process.argv[3]));`, K.env.RTG_SECRET_KEY, K.verzoek.wachtwoord, K.env.STRIPE_SECRET_KEY],
  { cwd: ROOT, encoding: 'utf8' });
  eisSchoon('console-redactie', [r.stdout, r.stderr]);
  // zonder bewaking had het er wel gestaan: de proef is niet leeg
  const zonder = spawnSync(process.execPath, ['-e', 'console.error("redis://u:" + process.argv[1] + "@h")', K.env.RTG_SECRET_KEY], { encoding: 'utf8' });
  assert.equal(scan(zonder.stderr, K.alle).length, 1);
});

test('opslag onbereikbaar: de verbindingsfouten noemen nooit het wachtwoord', async t => {
  const s = await start({ ...K.env, REDIS_URL: 'redis://rtg:' + K.opslag.redis + '@127.0.0.1:1/0',
    DATABASE_URL: 'postgresql://rtg:' + K.opslag.pg + '@127.0.0.1:1/rtg' });
  t.after(() => s.stop());
  const antwoorden = [];
  for (const [m, p] of [['GET', '/api/health'], ['POST', '/api/login'], ['GET', '/api/notifications'], ['POST', '/api/pay/terug']])
    antwoorden.push(await roep(s.basis, m, p, LIJF));
  await new Promise(r => setTimeout(r, 1500));
  eisSchoon('onbereikbare opslag', [...s.uit, ...antwoorden.map(a => a.tekst + a.koppen)]);
});

test('gewone start: de hele routetabel met kapotte en vijandige invoer lekt niets', async t => {
  const webhook = await ontvanger();
  t.after(() => webhook.sluit());
  const s = await start({ ...K.env, ERR_WEBHOOK_URL: 'http://127.0.0.1:' + webhook.poort + '/fout' });
  t.after(() => s.stop());
  const routes = require('../ROUTEBRON.json').alleRoutes;
  assert.ok(routes.length > 1000, 'de routetabel is leeg; dan bewijst deze toets niets');
  const rij = routes.slice();
  const antwoorden = [];
  let nr = 0;
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (rij.length) {
      const [m, p0] = rij.shift().split(' ');
      const pad = p0.replace(/:[A-Za-z_]+/g, 'kanariepad').replace(/\*/g, 'x');
      const a = await roep(s.basis, m, pad, (nr++ % 2) ? '{"kapot":' : LIJF);
      if (a.status) antwoorden.push(m + ' ' + pad + ' ' + a.status + '\n' + a.koppen + '\n' + a.tekst);
    }
  }));
  assert.ok(antwoorden.length > routes.length * 0.9, 'te weinig routes gaven antwoord: ' + antwoorden.length);
  await new Promise(r => setTimeout(r, 1000));
  eisSchoon('routetabel', [...s.uit, ...antwoorden, ...webhook.lijven]);
});

test('productie met alleen geheimen en verder niets: de weigering noemt namen, nooit waarden', async t => {
  const s = await start({ ...K.env, NODE_ENV: 'production', REDIS_URL: 'redis://rtg:' + K.opslag.redis + '@127.0.0.1:1/0',
    DATABASE_URL: 'postgresql://rtg:' + K.opslag.pg + '@127.0.0.1:1/rtg', APP_URL: 'https://rtg.example' }, { wacht: false });
  t.after(() => s.stop());
  const code = await Promise.race([s.klaar, new Promise(r => setTimeout(() => r('loopt'), 30000))]);
  assert.notEqual(code, 0, 'een productieserver zonder geldige configuratie hoort te weigeren');
  eisSchoon('productieweigering', s.uit);
});

/* A-P1-01 LETTERLIJK, zoals de audit hem reproduceerde: FAKE-AUDIT-SECRET in de
   Redis-URL, tegen een ECHTE Redis die een wachtwoord eist (dus het AUTH-foutpad,
   niet alleen een dichte poort), en dezelfde klasse voor de database- en
   provider-URL's. Nergens in stdout of stderr mag de string staan. */
test('A-P1-01: FAKE-AUDIT-SECRET in Redis-, database- en provider-URLs komt nergens in de uitvoer', async t => {
  const GEHEIM = 'FAKE-AUDIT-SECRET';
  const redisPoort = await vrijePoort();
  const redis = spawn('redis-server', ['--port', String(redisPoort), '--bind', '127.0.0.1', '--requirepass', 'het-echte-wachtwoord',
    '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
  t.after(() => redis.kill('SIGKILL'));
  await new Promise(r => setTimeout(r, 400));
  assert.equal(redis.exitCode, null, 'redis-server is vereist voor deze proef en startte niet');
  const s = await start({ REDIS_URL: 'redis://default:' + GEHEIM + '@127.0.0.1:' + redisPoort + '/0',
    DATABASE_URL: 'postgresql://rtg:' + GEHEIM + '@127.0.0.1:1/rtg',
    SMTP_URL: 'smtps://post:' + GEHEIM + '@127.0.0.1:1', LOCAL_AI_URL: 'http://tok:' + GEHEIM + '@127.0.0.1:1', LOCAL_AI_MODEL: 'x',
    ERR_WEBHOOK_URL: 'http://hook:' + GEHEIM + '@127.0.0.1:1/fout' });
  t.after(() => s.stop());
  const antwoorden = [];
  for (const [m, p] of [['GET', '/api/health'], ['POST', '/api/auth/forgot'], ['POST', '/api/chat'], ['GET', '/api/notifications']])
    antwoorden.push(await roep(s.basis, m, p, '{"email":"a@b.nl","bericht":"hoi"}'));
  await new Promise(r => setTimeout(r, 2500));
  const alles = [...s.uit, ...antwoorden.map(a => a.tekst + a.koppen)].join('\n');
  assert.ok(alles.length > 0, 'de server gaf geen uitvoer; dan is er niets gemeten');
  assert.match(alles, /WRONGPASS/, 'het Redis-AUTH-foutpad werd niet geraakt; dan bewijst deze proef niets over A-P1-01');
  const i = alles.indexOf(GEHEIM);
  assert.equal(i, -1, 'FAKE-AUDIT-SECRET gelekt: ' + alles.slice(Math.max(0, i - 120), i + 40));
});
