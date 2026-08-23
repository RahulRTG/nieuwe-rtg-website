/* HET SEEDVENSTER, EN WAAROM HET DICHT MOET.

   De demoseed hashte bij elke serverstart 220 wachtwoorden met scrypt -- voor
   VIER verschillende woorden ('5678', '1234', 'werk', 'Imran'), die alle vier
   in deze repository staan. Dat kostte 9,1 van de 13,6 seconden van een boot,
   en de suite start 647 servers. Sinds accounts/kluis.js delen gelijke
   seed-wachtwoorden binnen EEN demostart hetzelfde zout: 220 rondes werden er 5.

   Dat is een snelheidstruc met een scherpe rand, dus staat hier wat hem
   tegenhoudt. Drie grendels, en elk van de drie heeft hieronder een toets die
   zakt zodra je hem weghaalt:

   1. alleen met RTG_DEMO=1  (in productie een blokkerende startfout)
   2. alleen buiten NODE_ENV=production
   3. alleen TOT app.listen -- daarna krijgt elk account weer een vers zout

   De derde is de belangrijkste en wordt daarom niet in-proces getoetst maar op
   een ECHTE server: twee registraties met hetzelfde wachtwoord moeten na de
   start een verschillende hash in de database hebben staan. Een venster dat per
   ongeluk openblijft, is in-proces niet te zien maar hier wel.

   Draai los: node --experimental-sqlite --test test/seedvenster.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop } = require('./helper');

const WORTEL = path.join(__dirname, '..');
const zoutVan = (h) => String(h || '').split(':')[0];

/* Een verse module-instantie in een EIGEN proces, met een eigen omgeving. Het
   venster wordt bij het laden van kluis.js vastgesteld, dus binnen dit proces
   opnieuw require'n zou de oude stand houden -- en een toets die de vlag niet
   echt kan omzetten, toetst de vlag niet (LAT-regel 9). */
function inProces(env, code) {
  return execFileSync(process.execPath, ['-e', code], {
    cwd: WORTEL, encoding: 'utf8',
    env: { ...process.env, RTG_DEMO: '', NODE_ENV: '', ...env }
  }).trim();
}
const DRIE_HASHES = `
  const k = require('./server/accounts/kluis');
  console.log(JSON.stringify({
    open: k.seedvensterOpen(),
    a: k.hashPasswordSync('zelfde'), b: k.hashPasswordSync('zelfde'),
    na: (k.sluitSeedvenster(), [k.hashPasswordSync('zelfde'), k.hashPasswordSync('zelfde')])
  }));`;

test('grendel 1+3: met RTG_DEMO=1 delen gelijke seedwachtwoorden een zout, na het sluiten niet meer', () => {
  const r = JSON.parse(inProces({ RTG_DEMO: '1', NODE_ENV: 'test' }, DRIE_HASHES));
  assert.equal(r.open, true, 'in demostand hoort het venster open te staan');
  assert.equal(r.a, r.b, 'binnen het venster hergebruikt de seed het zout -- dat is de hele besparing');
  assert.notEqual(zoutVan(r.na[0]), zoutVan(r.na[1]), 'na het sluiten krijgt elk account een VERS zout');
  assert.notEqual(zoutVan(r.na[0]), zoutVan(r.a), 'het gesloten venster hergebruikt ook het oude zout niet');
});

test('grendel 1: zonder RTG_DEMO=1 deelt niets een zout, ook niet voor het sluiten', () => {
  const r = JSON.parse(inProces({ RTG_DEMO: '', NODE_ENV: 'test' }, DRIE_HASHES));
  assert.equal(r.open, false, 'zonder demovlag hoort het venster dicht te zijn');
  assert.notEqual(zoutVan(r.a), zoutVan(r.b), 'buiten de demostand krijgt elk wachtwoord een vers zout');
});

test('grendel 2: NODE_ENV=production houdt het venster dicht, ook mét RTG_DEMO=1', () => {
  const r = JSON.parse(inProces({ RTG_DEMO: '1', NODE_ENV: 'production' }, DRIE_HASHES));
  assert.equal(r.open, false, 'productie is het tweede slot op dezelfde deur');
  assert.notEqual(zoutVan(r.a), zoutVan(r.b), 'in productie deelt niets een zout');
});

test('het formaat en de controle veranderen niet: een gedeeld zout blijft gewoon verifieerbaar', async () => {
  const k = require('../server/accounts/kluis');
  const h = k.hashPasswordSync('wachtwoord-uit-de-seed');
  const [zout, hash] = h.split(':');
  assert.equal(zout.length, 32, 'zout blijft 16 bytes hex');
  assert.equal(hash.length, 128, 'hash blijft 64 bytes hex');
  assert.equal(await k.verifyPassword('wachtwoord-uit-de-seed', h), true);
  assert.equal(await k.verifyPassword('iets anders', h), false);
});

/* DE ECHTE PROEF. Een draaiende server, twee verse registraties met hetzelfde
   wachtwoord. Blijft het venster per ongeluk openstaan, dan krijgen die twee
   dezelfde hash -- en dat is precies wat hier niet mag. */
test('op een draaiende server krijgen twee accounts met hetzelfde wachtwoord een verschillend zout', async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-seedvenster-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  t.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

  const post = (pad, body) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).then(r => r.json());

  const WACHTWOORD = 'zelfdewachtwoord9';
  const een = await post('/api/auth/register', { name: 'Zout Een', email: 'zout1@voorbeeld.test',
    phone: '0612345601', password: WACHTWOORD, geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const twee = await post('/api/auth/register', { name: 'Zout Twee', email: 'zout2@voorbeeld.test',
    phone: '0612345602', password: WACHTWOORD, geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(een.token, 'eerste registratie moet slagen: ' + JSON.stringify(een).slice(0, 200));
  assert.ok(twee.token, 'tweede registratie moet slagen: ' + JSON.stringify(twee).slice(0, 200));

  /* De hashes uit de kluis lezen; via de API komen ze er nooit uit (en dat
     hoort ook zo -- publicUser laat password_hash weg). We zoeken de twee
     accounts op hun e-mail-hash op, precies zoals de server dat doet: HMAC met
     de kluissleutel uit deze datamap. Een `ORDER BY id DESC LIMIT n` zou hier
     niet deugen -- dan lopen de DEMOSEED-accounts mee, en die horen juist wel
     een zout te delen omdat ze binnen het venster zijn gemaakt. */
  const vault = fs.readFileSync(path.join(TMP, 'vault.key'));
  const emailHash = (e) => require('crypto').createHmac('sha256', vault)
    .update(String(e).trim().toLowerCase()).digest('hex');

  const db = new DatabaseSync(path.join(TMP, 'rtg.db'), { readOnly: true });
  t.after(() => { try { db.close(); } catch (e) {} });
  const zoek = db.prepare('SELECT password_hash FROM users WHERE email_hash = ?');
  const a = zoek.get(emailHash('zout1@voorbeeld.test'));
  const b = zoek.get(emailHash('zout2@voorbeeld.test'));
  assert.ok(a && a.password_hash, 'het eerste verse account hoort in de kluis te staan');
  assert.ok(b && b.password_hash, 'het tweede verse account hoort in de kluis te staan');

  assert.notEqual(zoutVan(a.password_hash), zoutVan(b.password_hash),
    'twee NA de start geregistreerde accounts delen een zout: het seedvenster stond nog open toen de server luisterde');
  assert.notEqual(a.password_hash, b.password_hash, 'en dus ook niet dezelfde hash');
});

/* En de andere kant op: de besparing moet er ook ECHT zijn. Zonder deze toets
   kan iemand het venster dichtplakken "voor de zekerheid" en dan is de suite
   weer negen seconden per boot kwijt zonder dat iets klaagt (LAT-regel 10). */
test('de besparing bestaat: een demostart hergebruikt tientallen seedhashes', () => {
  const uit = inProces({ RTG_DEMO: '1', NODE_ENV: 'test' }, `
    const k = require('./server/accounts/kluis');
    for (const w of ['1234', '5678', 'werk', '1234', '5678']) k.hashPasswordSync(w);
    console.log(JSON.stringify(k.sluitSeedvenster()));`);
  const u = JSON.parse(uit);
  assert.equal(u.stondOpen, true);
  assert.equal(u.woorden, 3, 'drie unieke woorden');
  assert.equal(u.hergebruikt, 2, 'twee herhalingen horen hergebruikt te zijn, niet opnieuw gerekend');
});
