/* REGISTRATIE DICHT -- server/accounts/registratie.js (RTG_REGISTRATIE_DICHT).

   Wat hier vastligt, en het kan allemaal zakken:
   1. met de vlag aan weigert de ACCOUNTLAAG zelf (createUser en createUserSync):
      503, code REGISTRATIE_DICHT, en er komt geen rij in `users` bij. Daar lopen
      registreren, de SSO-binnenkomst en SCIM alle drie doorheen;
   2. op een echte server met de vlag aan: /api/auth/register geeft 503 met de
      reden, het adres bestaat daarna niet (inloggen ermee faalt), en een
      bestaand account logt gewoon in, vraagt een herstel aan en komt bij het
      techniekbord;
   3. op een echte server ZONDER de vlag werkt registreren zoals voorheen, en de
      handmatige zekering op het techniekbord sluit hem met reden `zekering`;
   4. een met de hand getrokken zekering houdt geen `tot` van een eerdere
      noodrem over, en dooft dus niet vanzelf;
   5. de vlag faalt DICHT: alleen leeg en een expliciete 0 zijn open, elke
      andere waarde (true, yes, ja, 01, `1 # commentaar`) is dicht, en een
      waarde die geen 0 of 1 is geeft een configuratiewaarschuwing;
   6. besluit en zekering samen: het antwoord noemt ze ALLEBEI, met een `hoe`,
      zodat een reset van de zekering niet leest als heropenen; en
      /api/techniek/status toont het besluit alleen-lezen naast de zekering;
   7. het eigenaarsscript maakt het eigenaarsaccount OOK met de vlag aan, langs
      de gevel -- en die weg is van geen enkele route te bereiken: 7b meet bij
      het opstarten wie accounts/users.js laadt (precies index.js en staff.js),
      7c scant de bron op ook dynamische vormen;
   8. SSO geeft bij een dichte registratie de reden door in plaats van een
      kale 401, en de publieke `hoe` noemt geen interne variabele;
   9. npm run golive leest het envbestand met de lezer van de server;
   10. de takken die de eerste rondes niet liepen (de dekkingsvloer zakte):
      het zekeringknopje (404, 400, reset, afkappen), het doven van een
      zekering, het statusbord dat de uitleg uit de STANDAARD neemt en niet uit
      een oude rij, de SSO-weigeringen, de uitleg van het eigenaarsscript,
      golive bij een onleesbaar of ontbrekend envbestand, de databaseproef van
      golive (die viel om bij een onbereikbare database), en config.pasToe.
      Golive en het eigenaarsscript worden daarvoor NIET in een kind gedraaid:
      de dekkingsmeting telt per proces de blokken die daar anders liepen, en
      een kind dat het halve script doorloopt laat de rest als ongedekt staan.
      De delen die ertoe doen staan in scripts/lib/golive-env.js en draaien
      hier in hetzelfde proces.
      Mutaties: de spreidvolgorde in bord.js omdraaien -> 10c zakt (dat was de
      overlevende van de eerste ronde); de afkapgrens in knoppen.js -> 10a zakt.

   Mutaties van de tweede ronde, met de hand: in server/techniek.js een
   require(path.join(__dirname,'accounts','users')) of './accounts/'+'users'
   -> 7b en 7c zakken; './acc'+'ounts/us'+'ers' -> 7b zakt; een doorgeefmodule
   binnen server/accounts/ of een alias op de gevel -> 7b zakt; de oude lezer
   terug in golive.js -> 9 zakt.

   Mutaties, met de hand nagetrokken: de regel `registratie.eisOpen()` uit
   createUser gehaald -> toets 1 zakt; de vroege controle in de route weggehaald
   -> toets 2 houdt (de accountlaag vangt hem) maar de reden blijft `besluit`;
   `z.tot = null` uit de spring-tak van knoppen.js -> toets 4 zakt. En voor
   deze ronde: de vlag weer alleen op een letterlijke `1` lezen -> 5 en 6b
   zakken; de reden `zekering` laten vallen -> 2 en 6b zakken; het
   eigenaarsscript weer via de gevel laten schrijven -> 7 en 7b zakken; de
   SSO-tak voor REGISTRATIE_DICHT weghalen -> 8 zakt. De uitleg van FUSE-REG
   weer uit de opgeslagen rij nemen overleefde toets 2 (een verse datamap heeft
   geen oude tekst) en wordt nu door 10c gevangen. De liegpoort-meting staat in
   MUTATIES.json.

   Draai: node --test test/registratie-dicht.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');

const VLAG = 'RTG_REGISTRATIE_DICHT';

test('1. de accountlaag weigert zelf, voor elke schrijfactie', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regdicht-acc-'));
  const oud = { dir: process.env.RTG_DATA_DIR, env: process.env.NODE_ENV, vlag: process.env[VLAG] };
  process.env.RTG_DATA_DIR = TMP; process.env.NODE_ENV = 'test';
  try {
    const accounts = require('../server/accounts');
    accounts.init();
    const voor = accounts.count();
    process.env[VLAG] = '1';
    assert.equal(accounts.registratieDicht(), true);
    await assert.rejects(accounts.createUser({ email: 'dicht@voorbeeld.test', password: 'geheim1234', tier: 'rtg', realName: 'Proef' }),
      e => e.code === 'REGISTRATIE_DICHT' && e.status === 503);
    assert.throws(() => accounts.createUserSync({ email: 'dicht2@voorbeeld.test', password: 'geheim1234', tier: 'rtg', realName: 'Proef' }),
      e => e.code === 'REGISTRATIE_DICHT');
    assert.equal(accounts.count(), voor, 'er is geen account bijgekomen');
    assert.equal(accounts.findByLogin('dicht@voorbeeld.test'), null);
    delete process.env[VLAG];
    assert.equal(accounts.registratieDicht(), false);
    const u = await accounts.createUser({ email: 'open@voorbeeld.test', password: 'geheim1234', tier: 'rtg', realName: 'Proef' });
    assert.ok(u && u.id, 'met de vlag uit werkt aanmaken weer');
    assert.equal(accounts.count(), voor + 1);
  } finally {
    if (oud.vlag === undefined) delete process.env[VLAG]; else process.env[VLAG] = oud.vlag;
    if (oud.dir === undefined) delete process.env.RTG_DATA_DIR; else process.env.RTG_DATA_DIR = oud.dir;
    if (oud.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oud.env;
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ }
  }
});

async function post(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const nieuw = () => {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return { name: 'Dicht ' + u, email: 'regdicht-' + u + '@x.nl', password: 'geheim1234', geboortedatum: '1990-01-01', pasApp: 'rtg' };
};
const EIGENAAR = { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' };

test('2 en 3. op een echte server: dicht met de vlag, open zonder, en de zekering', async (t) => {
  const { startServer, stop } = require('./helper');

  await t.test('2. vlag aan: registreren geweigerd, bestaande accounts werken', async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regdicht-aan-'));
    const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, [VLAG]: '1' } });
    try {
      const n = nieuw();
      const r = await post(srv.base, '/api/auth/register', n);
      assert.equal(r.status, 503, JSON.stringify(r.body));
      assert.equal(r.body.code, 'REGISTRATIE_DICHT');
      assert.deepEqual(r.body.reden, ['besluit']);
      assert.match(String(r.body.hoe), /besluit van RTG/, 'de weigering zegt dat het een instelling is');
      assert.doesNotMatch(String(r.body.hoe), /RTG_REGISTRATIE_DICHT|herstart/, 'een anonieme aanroeper krijgt geen interne uitleg');
      assert.ok(!r.body.token, 'geen sessie');
      const l = await post(srv.base, '/api/auth/login', { login: n.email, password: n.password, pasApp: 'rtg' });
      assert.ok(!l.body.token && l.status >= 400, 'het adres bestaat niet: ' + l.status);

      const eig = await post(srv.base, '/api/auth/login', EIGENAAR);
      assert.ok(eig.body.token, 'een bestaand account logt in: ' + JSON.stringify(eig.body).slice(0, 120));
      const h = await post(srv.base, '/api/auth/forgot', { email: EIGENAAR.login });
      assert.equal(h.status, 200, 'wachtwoordherstel blijft open');
      const bord = await fetch(srv.base + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + eig.body.token } });
      assert.equal(bord.status, 200, 'de eigenaar komt bij het techniekbord');
      const st = await bord.json();
      assert.equal(st.registratie.dicht, true, 'het bord ziet het besluit');
      assert.equal(st.registratie.wijzigbaarHier, false);
      assert.match(st.registratie.hoe, /RTG_REGISTRATIE_DICHT/, 'de technische uitleg staat op het techniekbord');
      assert.deepEqual(st.registratie.paden.map(p => p.pad), ['/api/auth/register', '/api/sso/terug en /api/sso/saml/acs', '/api/scim/v2/Users']);
      const fuse = st.zekeringen.find(z => z.id === 'registratie');
      assert.deepEqual(fuse.dekt, ['/api/auth/register'], 'de zekering zegt dat hij alleen de route dekt');
      assert.match(fuse.uitleg, /SCIM vallen er NIET onder/);

      /* 6. besluit EN zekering: allebei in het antwoord, en na de reset nog dicht */
      const z = await post(srv.base, '/api/techniek/zekering', { id: 'registratie', actie: 'spring', reden: 'proef' }, eig.body.token);
      assert.equal(z.status, 200);
      const beide = await post(srv.base, '/api/auth/register', nieuw());
      assert.equal(beide.status, 503);
      assert.deepEqual(beide.body.reden, ['besluit', 'zekering']);
      await post(srv.base, '/api/techniek/zekering', { id: 'registratie', actie: 'reset' }, eig.body.token);
      const naReset = await post(srv.base, '/api/auth/register', nieuw());
      assert.equal(naReset.status, 503, 'een reset van de zekering heropent niets');
      assert.deepEqual(naReset.body.reden, ['besluit']);
    } finally { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } }
  });

  await t.test('3. vlag uit: registreren werkt, en de zekering sluit hem met de hand', async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regdicht-uit-'));
    const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, [VLAG]: '' } });
    try {
      const r = await post(srv.base, '/api/auth/register', nieuw());
      assert.ok(r.body.token, 'registreren werkt: ' + JSON.stringify(r.body).slice(0, 120));
      const eig = (await post(srv.base, '/api/auth/login', EIGENAAR)).body.token;
      const z = await post(srv.base, '/api/techniek/zekering', { id: 'registratie', actie: 'spring', reden: 'proef' }, eig);
      assert.equal(z.status, 200, JSON.stringify(z.body));
      const d = await post(srv.base, '/api/auth/register', nieuw());
      assert.equal(d.status, 503);
      assert.deepEqual(d.body.reden, ['zekering']);
      assert.match(String(d.body.hoe), /tijdelijk uitgeschakeld/);
      await post(srv.base, '/api/techniek/zekering', { id: 'registratie', actie: 'reset' }, eig);
      assert.ok((await post(srv.base, '/api/auth/register', nieuw())).body.token, 'na de reset weer open');
    } finally { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } }
  });
});

test('4. een handmatige zekering erft geen einde van een eerdere noodrem', () => {
  const routes = {};
  const app = { post: (pad, ...fns) => { routes[pad] = fns[fns.length - 1]; } };
  const zekeringen = { registratie: { naam: 'Nieuwe registraties', aan: true, tot: Date.now() - 1000 } };
  require('../server/routes/techniek/knoppen')({ app, kern: {}, accounts: {}, staat: () => ({ zekeringen }),
    save: () => {}, log: {}, beveilig: null, techAuth: null, eigenaarAlleen: null });
  let uit = null;
  routes['/api/techniek/zekering']({ body: { id: 'registratie', actie: 'spring', reden: 'besluit eigenaar' } },
    { json: (b) => { uit = b; }, status() { return this; } });
  assert.equal(uit.ok, true);
  const z = zekeringen.registratie;
  assert.equal(z.tot, null, 'geen oud einde');
  assert.equal(require('../server/techniek').zekeringGesprongen(z), true, 'hij blijft eruit');
});

test('5. de vlag faalt dicht: alleen leeg en 0 zijn open', () => {
  const r = require('../server/accounts/registratie');
  /* [waarde, dicht, waarschuwing] */
  const tabel = [
    [undefined, false, false], ['', false, false], ['   ', false, false],
    ['0', false, false], [' 0 ', false, false], ['0 # open sinds #587', false, false],
    ['1', true, false], [' 1 ', true, false], ['1 # dicht tot #587', true, false],
    ['true', true, true], ['TRUE', true, true], ['yes', true, true], ['on', true, true],
    ['ja', true, true], ['01', true, true], ['false', true, true], ['nee', true, true],
    ['#1', true, true], ['00', true, true], ['2', true, true]
  ];
  for (const [w, dicht, waarsch] of tabel) {
    const env = w === undefined ? {} : { [VLAG]: w };
    assert.equal(r.dicht(env), dicht, JSON.stringify(w) + ' hoort ' + (dicht ? 'dicht' : 'open') + ' te zijn');
    assert.equal(r.onbekend(env), waarsch, JSON.stringify(w) + ': waarschuwing ' + waarsch);
    const ws = []; r.keur(env, ws);
    assert.equal(ws.length, waarsch ? 1 : 0);
  }
  /* en via de echte configuratiekeuring, die bij het opstarten logt */
  const config = require('../server/config');
  const v = config.valideer({ [VLAG]: 'true' });
  assert.ok(v.waarschuwingen.some(w => w.startsWith(VLAG + '="true"') && /DICHT/.test(w)), 'config.valideer waarschuwt');
  assert.ok(!config.valideer({ [VLAG]: '1' }).waarschuwingen.some(w => w.startsWith(VLAG)), '1 is bekend');
  /* en de accountlaag leest dezelfde regel */
  const oud = process.env[VLAG];
  try {
    process.env[VLAG] = 'true';
    assert.throws(() => r.eisOpen(), e => e.code === 'REGISTRATIE_DICHT' && e.hoe === r.HOE);
  } finally { if (oud === undefined) delete process.env[VLAG]; else process.env[VLAG] = oud; }
});

test('6b. de weigering noemt alle redenen die gelden', () => {
  const r = require('../server/accounts/registratie');
  assert.equal(r.weigering(false, {}), null);
  assert.deepEqual(r.weigering(true, {}).reden, ['zekering']);
  assert.deepEqual(r.weigering(false, { [VLAG]: '1' }).reden, ['besluit']);
  const beide = r.weigering(true, { [VLAG]: 'ja' });
  assert.deepEqual(beide.reden, ['besluit', 'zekering']);
  assert.equal(beide.hoe, r.HOE, 'publiek een korte hoe');
  assert.doesNotMatch(beide.hoe, /RTG_REGISTRATIE_DICHT|FUSE-REG|herstart/);
});

test('7. het eigenaarsscript maakt het eigenaarsaccount ook met de vlag aan', () => {
  const { execFileSync } = require('node:child_process');
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regdicht-eig-'));
  try {
    let tekst = '', code = 0;
    try {
      tekst = execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'eigenaar-aanmaken.js'),
        '--maak', '--naam=Proef Eigenaar', '--geboren=1990-01-31'], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, RTG_DATA_DIR: TMP, NODE_ENV: '', DATABASE_URL: '', PG_URL: '', [VLAG]: '1' }
      });
    } catch (e) { code = e.status == null ? 1 : e.status; tekst = String(e.stdout || '') + String(e.stderr || ''); }
    assert.equal(code, 0, tekst);
    assert.match(tekst, /AANGEMAAKT/);
    assert.match(tekst, /geldt niet voor dit eigenaarsscript/);
    assert.doesNotMatch(tekst, /tweede schrijver/);
  } finally { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } }
});

/* 7b. DE ENIGE BEWAKER VAN DE UITZONDERING, en daarom in twee helften.

   De eerste versie was een regex op `require('...accounts/users')`, en een
   tegenlezing liet vier vormen groen staan: path.join(__dirname,'accounts',
   'users'), een template string, './accounts/'+'users' en './accounts/users/'.
   Bovendien was heel server/accounts/ vrijgesteld, dus een module daarbinnen die
   createUser doorgaf kwam er stil doorheen.

   HELFT 1 IS EEN RUNTIMEMETING en geen tekstzoektocht: een kindproces laadt de
   echte server met een haak op Module._resolveFilename en noteert ELKE module
   die accounts/users.js oplost, in welke vorm ook. Die lijst moet precies
   {accounts/index.js, accounts/staff.js} zijn -- dus ook binnen accounts/ mag er
   geen derde lader bij komen zonder dat iemand deze toets aanpast. Wat de meting
   niet ziet: een require die pas TIJDENS een verzoek gebeurt. Daarvoor is
   helft 2.

   HELFT 2 SCANT server/ en scripts/ zonder commentaar op ELKE plek waar
   `accounts` en `users` vlak naast elkaar staan (ook met ',' of '+' of '/'
   ertussen) -- de vier vormen hierboven alle vier. Daarvan mag alleen
   scripts/eigenaar-aanmaken.js de module laden; twee bestanden noemen het pad
   als TEKST, en op hun treffende regels mag geen require, import, join of
   resolve staan. Een naam die volledig wordt uitgerekend ('us'+'ers') ziet
   een tekstscan niet; die vangt helft 1 zodra hij bij het opstarten laadt. */
const LADERS_SCRIPT = `
  const Module = require('module'); const path = require('path');
  const root = process.argv[1]; const doel = path.join(root, 'server', 'accounts', 'users.js');
  const ouders = new Set(); const orig = Module._resolveFilename;
  Module._resolveFilename = function (req, parent, ...r) {
    const uit = orig.call(this, req, parent, ...r);
    if (uit === doel && parent && parent.filename) ouders.add(path.relative(root, parent.filename).split(path.sep).join('/'));
    return uit;
  };
  require(path.join(root, 'server', 'server.js'));
  setTimeout(() => {
    for (const m of Object.values(require.cache))
      if (m.children.some(c => c.id === doel)) ouders.add(path.relative(root, m.id).split(path.sep).join('/'));
    process.stdout.write('OUDERS=' + JSON.stringify([...ouders].sort()) + '\\n'); process.exit(0);
  }, 4000);`;

test('7b. de ongegrendelde schrijver is van geen route te bereiken (runtime: wie laadt accounts/users.js)', () => {
  const { execFileSync } = require('node:child_process');
  const ROOT = path.join(__dirname, '..');
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regdicht-laders-'));
  try {
    const uit = execFileSync(process.execPath, ['-e', LADERS_SCRIPT, ROOT], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000,
      env: { ...process.env, RTG_DATA_DIR: TMP, PORT: '0', HOST: '127.0.0.1', SMTP_URL: '', NODE_ENV: 'test', DATABASE_URL: '', REDIS_URL: '' }
    });
    const m = /OUDERS=(.*)/.exec(uit);
    assert.ok(m, 'de meting gaf geen uitslag: ' + uit.slice(-300));
    assert.deepEqual(JSON.parse(m[1]), ['server/accounts/index.js', 'server/accounts/staff.js'],
      'alleen de gevel en staff.js mogen accounts/users.js laden');
  } finally { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } }

  const accounts = require('../server/accounts');
  const users = require('../server/accounts/users');
  /* en de gevel draagt geen ongegrendelde createUser onder een andere naam */
  for (const [k, v] of Object.entries(accounts))
    assert.ok(v !== users.createUser && v !== users.createUserSync, 'de gevel geeft de ongegrendelde schrijver door als ' + k);
});

test('7c. de ongegrendelde schrijver is van geen route te bereiken (bron: ook dynamische vormen)', () => {
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const ROOT = path.join(__dirname, '..');
  const NAAST = /accounts\W{0,8}users\b/;
  const LADER = 'scripts/eigenaar-aanmaken.js';
  const ALS_TEKST = new Set(['server/kern/identiteit/gegevenssoorten.js', 'scripts/check.js']);
  const treffers = [];
  const loop = (dir) => {
    for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, n.name);
      if (n.isDirectory()) { if (n.name !== 'node_modules' && n.name !== 'data') loop(f); continue; }
      if (!/\.(js|cjs|mjs)$/.test(n.name)) continue;
      const rel = path.relative(ROOT, f).split(path.sep).join('/');
      if (rel.startsWith('server/accounts/')) continue;   // die dekt de runtimemeting (7b)
      const code = zonderCommentaar(fs.readFileSync(f, 'utf8'));
      if (!NAAST.test(code)) continue;
      treffers.push(rel);
      if (ALS_TEKST.has(rel)) {
        for (const r of code.split('\n').filter(r => NAAST.test(r)))
          assert.doesNotMatch(r, /require|import|join|resolve|Module/, rel + ' noemt het pad niet alleen als tekst: ' + r.trim());
      }
    }
  };
  loop(path.join(ROOT, 'server')); loop(path.join(ROOT, 'scripts'));
  assert.deepEqual(treffers.filter(r => !ALS_TEKST.has(r)), [LADER],
    'alleen het offline eigenaarsscript mag de grendel omzeilen; gevonden: ' + treffers.join(', '));
  assert.match(fs.readFileSync(path.join(ROOT, LADER), 'utf8'), /require\('\.\.\/server\/accounts\/users'\)\.createUser\(/);
});

test('8. SSO noemt een dichte registratie in plaats van een kale 401', () => {
  const { foutAntwoord } = require('../server/sso/binnenkomst');
  const r = require('../server/accounts/registratie');
  const oud = process.env[VLAG];
  let fout;
  try { process.env[VLAG] = '1'; try { r.eisOpen(); } catch (e) { fout = e; } }
  finally { if (oud === undefined) delete process.env[VLAG]; else process.env[VLAG] = oud; }
  const a = foutAntwoord(fout);
  assert.equal(a.status, 503);
  assert.equal(a.code, 'REGISTRATIE_DICHT');
  assert.match(a.bericht, /registraties zijn gesloten/);
  assert.equal(foutAntwoord(new Error('verkeerd domein')).status, 401, 'een gewone weigering blijft een 401');
});

/* 9. npm run golive leest .env.productie zoals de server dat doet. Zijn eigen
   lezer stripte geen aanhalingstekens en geen `export `, en keurde daardoor een
   andere stand dan de server draait: `"0"` las als een vreemde waarde (dicht),
   en `export ...=1` werd overgeslagen (open). De lezer en de registratieregel
   staan in scripts/lib/golive-env.js en worden hier in hetzelfde proces
   beproefd. Mutatie, met de hand: de oude lezer terug -> beide gevallen zakken. */
test('9. golive leest het envbestand met de lezer van de server', () => {
  const ge = require('../scripts/lib/golive-env');
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regdicht-golive-'));
  const lees = (regel) => { const f = path.join(TMP, 'env-' + Math.random().toString(36).slice(2)); fs.writeFileSync(f, regel + '\n'); return ge.leesEnvBestand(f); };
  try {
    const open = lees(VLAG + '="0"');
    assert.deepEqual(open, { [VLAG]: '0' }, 'de aanhalingstekens gaan eraf');
    assert.deepEqual(ge.registratieRegel(open), { teken: '✓', tekst: 'Registratie: open (RTG_REGISTRATIE_DICHT leeg of 0).' });
    const dicht = lees('export ' + VLAG + '=1');
    assert.deepEqual(dicht, { [VLAG]: '1' }, '`export ` gaat eraf');
    assert.equal(ge.registratieRegel(dicht).teken, '⚠');
    assert.match(ge.registratieRegel(dicht).tekst, /Registratie staat DICHT/);
    assert.equal(ge.registratieRegel({ [VLAG]: 'yes' }).teken, '⚠', 'ook golive leest fail-closed');
    /* golive.js gebruikt deze lezer, en geen eigen */
    const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'golive.js'), 'utf8');
    assert.match(bron, /require\('\.\/lib\/golive-env'\)/);
    assert.doesNotMatch(bron, /function leesEnvBestand/);
  } finally { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } }
});

/* 10. DE TAKKEN DIE DE EERSTE RONDE NIET LIEP, elk met een uitkomst.
   Deze staan er omdat de dekkingsvloer van de volledige CI zakte: de grendel
   voegde takken toe die alleen in een echte server liepen (en die telt de
   dekking niet mee, want hij wordt met SIGKILL gestopt), of die geen enkele
   toets ooit nam. Geen aanroep zonder bewering. */
test('10a. het zekeringknopje: onbekend, verkeerde actie, reset en het prototype', () => {
  const routes = {};
  const app = { post: (pad, ...fns) => { routes[pad] = fns[fns.length - 1]; } };
  const zekeringen = { registratie: { naam: 'Nieuwe registraties', aan: false, reden: 'oud', sindsGesprongen: 1, tot: Date.now() + 60000 } };
  let opgeslagen = 0;
  require('../server/routes/techniek/knoppen')({ app, kern: {}, accounts: {}, staat: () => ({ zekeringen }),
    save: () => { opgeslagen++; }, log: {}, beveilig: null, techAuth: null, eigenaarAlleen: null });
  const roep = (body) => {
    const uit = { status: 200, body: null };
    routes['/api/techniek/zekering']({ body }, { status(s) { uit.status = s; return this; }, json(b) { uit.body = b; } });
    return uit;
  };
  assert.equal(roep({ id: 'bestaat-niet', actie: 'spring' }).status, 404);
  assert.equal(roep({ id: '__proto__', actie: 'spring' }).status, 404, 'het prototype is geen zekering');
  assert.equal(Object.prototype.aan, undefined);
  assert.equal(roep({}).status, 404, 'zonder id');
  const fout = roep({ id: 'registratie', actie: 'omdraaien' });
  assert.equal(fout.status, 400);
  assert.equal(opgeslagen, 0, 'een geweigerde handeling slaat niets op');
  const reset = roep({ id: 'registratie', actie: 'reset' });
  assert.deepEqual(reset.body, { ok: true, id: 'registratie', aan: true });
  const z = zekeringen.registratie;
  assert.equal(z.reden, null); assert.equal(z.tot, null); assert.equal(z.sindsGesprongen, null);
  const spring = roep({ id: 'registratie', actie: 'spring' });
  assert.equal(spring.body.aan, false);
  assert.equal(z.reden, 'handmatig uitgeschakeld', 'zonder reden een standaardreden');
  roep({ id: 'registratie', actie: 'spring', reden: 'x'.repeat(300) });
  assert.equal(z.reden.length, 120, 'de reden wordt afgekapt');
  assert.equal(opgeslagen, 3);
});

test('10b. de zekering dooft alleen met een verstreken einde', () => {
  const { zekeringGesprongen } = require('../server/techniek');
  assert.equal(zekeringGesprongen(null), false);
  assert.equal(zekeringGesprongen({ aan: true }), false);
  assert.equal(zekeringGesprongen({ aan: false }), true, 'handmatig: blijft eruit');
  assert.equal(zekeringGesprongen({ aan: false, tot: Date.now() + 60000 }), true, 'noodrem nog niet voorbij');
  const oud = { aan: false, reden: 'noodrem', sindsGesprongen: 1, tot: Date.now() - 1 };
  assert.equal(zekeringGesprongen(oud), false, 'noodrem voorbij: de stroom gaat erop');
  assert.deepEqual([oud.aan, oud.reden, oud.tot], [true, null, null]);
});

test('10c. het statusbord neemt naam en uitleg uit de standaard, niet uit een oude rij', async () => {
  const routes = {};
  const zet = (pad, ...fns) => { routes[pad] = fns[fns.length - 1]; };
  const app = { get: zet, post: zet, put: zet, delete: zet };
  const techniek = require('../server/techniek');
  /* een rij van vóór de correctie: de oude uitleg zei "geen nieuwe accounts" */
  const zekeringen = { registratie: { naam: 'Oude naam', code: 'FUSE-REG', aan: false, reden: 'proef', uitleg: 'Eraf = geen nieuwe accounts (bijv. bij misbruik).' },
    eigen: { naam: 'Zelfgemaakt', aan: true, uitleg: 'blijft zoals hij is' } };
  const bouw = (accounts) => require('../server/routes/techniek/bord')({
    techniek: { draaiChecks: async () => [{ status: 'ok' }, { status: 'fout' }], standaardZekeringen: techniek.standaardZekeringen },
    functies: { catalogus: () => [], DOELGROEPEN: [] }, eigenaar: {}, inzagelog: {}, log: { foutenSamenvatting: () => ({ totaal: 0 }) },
    accounts, archief: null, beveilig: null, db: { data: {} }, app, ctx: () => ({}),
    staat: () => ({ zekeringen, functieVerzoeken: [], toegang: [] }), isEigenaar: () => false, techAuth: null,
    bewaren: () => null, foutmelder: null, spelTelemetrie: null });
  const vraag = async () => { let b; await routes['/api/techniek/status']({ techUser: {} }, { json: (x) => { b = x; } }); return b; };

  bouw({ realNameOf: () => 'Proef', registratieStand: () => require('../server/accounts/registratie').stand({ [VLAG]: 'ja' }) });
  const st = await vraag();
  const reg = st.zekeringen.find(z => z.id === 'registratie');
  assert.match(reg.uitleg, /alleen.*\/api\/auth\/register|\/api\/auth\/register/, 'de gecorrigeerde uitleg');
  assert.doesNotMatch(reg.uitleg, /geen nieuwe accounts/);
  assert.equal(reg.naam, 'Nieuwe registraties');
  assert.deepEqual(reg.dekt, ['/api/auth/register']);
  assert.equal(reg.aan, false, 'de STAND komt wel uit de rij');
  assert.equal(reg.reden, 'proef');
  const eigen = st.zekeringen.find(z => z.id === 'eigen');
  assert.equal(eigen.uitleg, 'blijft zoals hij is', 'een zekering zonder standaard houdt zijn eigen tekst');
  assert.equal(st.registratie.dicht, true);
  assert.equal(st.registratie.onbekendeWaarde, true);
  assert.deepEqual(st.samenvatting, { ok: 1, waarschuwing: 0, fout: 1 });
  assert.equal(st.toegang, undefined, 'geen eigenaar: geen toegangslijst');

  bouw({ realNameOf: () => 'Proef' });
  assert.equal((await vraag()).registratie, null, 'een gevel zonder registratieStand zegt null en niet open');
});

test('10d. SSO-weigeringen: werksync, dicht zonder hoe, en de rest', () => {
  const { foutAntwoord } = require('../server/sso/binnenkomst');
  const w = foutAntwoord(Object.assign(new Error('x'), { code: 'SSO_WERKSYNC' }));
  assert.equal(w.status, 503); assert.equal(w.retryAfter, '30');
  const d = foutAntwoord(Object.assign(new Error('x'), { code: 'REGISTRATIE_DICHT' }));
  assert.equal(d.status, 503); assert.equal(d.hoe, null, 'zonder hoe wordt het null, nooit undefined');
  assert.equal(foutAntwoord(null).status, 401);
});

test('10e. de uitleg van het eigenaarsscript noemt alleen wat de fout aanwijst', () => {
  const { aanmaakUitleg } = require('../scripts/eigenaar-aanmaken');
  const dicht = aanmaakUitleg(Object.assign(new Error('x'), { code: 'REGISTRATIE_DICHT' })).join(' ');
  assert.match(dicht, /RTG_REGISTRATIE_DICHT/);
  assert.doesNotMatch(dicht, /tweede schrijver/);
  const grendel = aanmaakUitleg(Object.assign(new Error('x'), { code: require('../server/accounts/duurzaamheid').BLOKKADECODE })).join(' ');
  assert.match(grendel, /NODE_ENV=production en DATABASE_URL/);
  const anders = aanmaakUitleg(new Error('iets')).join(' ');
  assert.match(anders, /geen herkende reden/);
  assert.match(aanmaakUitleg(null).join(' '), /geen herkende reden/);
});

test('10f. een envbestand dat de server niet kan lezen gooit, een ontbrekend is null', () => {
  const ge = require('../scripts/lib/golive-env');
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regdicht-golive2-'));
  try {
    const slecht = path.join(TMP, 'slecht.env');
    fs.writeFileSync(slecht, '1VERKEERD=ja\n');
    assert.throws(() => ge.leesEnvBestand(slecht), /ongeldige variabelenaam/);
    assert.equal(ge.leesEnvBestand(path.join(TMP, 'bestaat-niet.env')), null);
    /* en golive blokkeert op de eerste, met de reden */
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'golive.js'), 'utf8'),
      /catch \(e\) \{ blokkeer\(path\.basename\(envPad\) \+ ' is niet te lezen zoals de server hem leest: '/);
  } finally { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } }
});

test('10g. config.pasToe logt de waarschuwing bij een onbekende waarde', () => {
  const config = require('../server/config');
  const regels = [];
  const log = { warn: (s) => regels.push(['warn', s]), error: (s) => regels.push(['error', s]), info: (s) => regels.push(['info', s]) };
  const r = config.pasToe({ [VLAG]: 'yes', NODE_ENV: 'development' }, log);
  assert.equal(r.productie, false);
  assert.ok(regels.some(([n, s]) => n === 'warn' && s.startsWith('[config] ' + VLAG + '="yes"')), JSON.stringify(regels).slice(0, 300));
  const stil = [];
  config.pasToe({ [VLAG]: '1', NODE_ENV: 'development' }, { warn: (s) => stil.push(s), error: (s) => stil.push(s), info: () => {} });
  assert.ok(!stil.some(s => s.includes(VLAG)), '1 is bekend en geeft geen regel');
});

/* 10h. DE DATABASEPROEF VAN GOLIVE, die bij een onbereikbare database omviel.
   De pgwire-client zendt een verbindingsfout ook als 'error' uit; zonder
   luisteraar was dat een onafgevangen fout en kwam er geen rapport. Nu: een
   uitslag met een gemaskeerde reden. Mutatie, met de hand: de luisteraar
   weghalen -> deze toets valt om (het proces gooit). */
test('10h. golive: een onbereikbare database blokkeert met een gemaskeerde reden en valt niet om', async () => {
  const { beproefPostgres } = require('../scripts/lib/golive-env');
  const geheim = 'geheim-wachtwoord-' + Date.now();
  const uit = await beproefPostgres({ DATABASE_URL: 'postgresql://rtg:' + geheim + '@rtg-bestaat-niet.invalid:5432/rtg' });
  assert.equal(uit.ok, false);
  assert.match(uit.reden, /ENOTFOUND|getaddrinfo|EAI_AGAIN/);
  assert.ok(!uit.reden.includes(geheim), 'geen wachtwoord in de reden');
  /* en de goede kant, met een nagespeelde driver: verbinden, SELECT 1, sluiten */
  const EventEmitter = require('events');
  const gezien = [];
  class Nep extends EventEmitter {
    constructor(cfg) { super(); gezien.push(cfg.connectionString); }
    async connect() { gezien.push('connect'); }
    async query(q) { gezien.push(q); }
    async end() { gezien.push('end'); }
  }
  const goed = await beproefPostgres({ DATABASE_URL: 'postgresql://x@y/z' }, { pgwire: { Client: Nep } });
  assert.equal(goed.ok, true);
  assert.equal(typeof goed.ms, 'number');
  assert.deepEqual(gezien, ['postgresql://x@y/z', 'connect', 'SELECT 1', 'end']);
});
