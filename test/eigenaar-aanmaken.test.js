/* scripts/eigenaar-aanmaken.js: maakt het script het eigenaarsaccount, en gaat
   de kantoordeur daar werkelijk van open?

   DE TWEEDE HELFT IS HET PUNT. Dat er een rij in de kluis komt te staan is
   goedkoop te toetsen en bewijst niets: het doel van dit script is dat
   eigenaar.isEigenaar() voortaan waar is en dat kern/eenaccount/afgeleid.js
   daardoor een kantoorsleutel AFLEIDT. Die keten loopt over drie modules en een
   sessie, dus wordt hij hier tegen een ECHTE server gelopen en niet nagebouwd.

   EN ER STAAT EEN TEGENPROEF NAAST. Zonder die tegenproef is de goedkoopste
   implementatie "geef iedereen een kantoorsleutel" en staat deze toets groen
   terwijl het huis openstaat -- dezelfde les als MENSNETWERK.md par. 4b. Een
   tweede, gewoon account doet in dezelfde server dezelfde aanroep en hoort 404
   te krijgen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { startServer, stop } = require('./helper');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'eigenaar-aanmaken.js');
const ADRES = 'roellie.i@gmail.com';   // de standaard uit server/eigenaar.js

function versDatamap() {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-eigenaar-'));
  return map;
}

/* Het script draait als een EIGEN proces, en dat is geen omslachtigheid maar de
   kern van de zaak: het opent de kluis zelf, laadt de sleutels zelf en sluit de
   Postgres-spiegel zelf af. In-proces aanroepen zou precies dat overslaan. */
function draai(datamap, args, env) {
  const uit = { code: 0, tekst: '' };
  try {
    uit.tekst = execFileSync(process.execPath, [SCRIPT, ...args], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, RTG_DATA_DIR: datamap, NODE_ENV: '', DATABASE_URL: '', PG_URL: '', ...(env || {}) }
    });
  } catch (e) {
    uit.code = e.status == null ? 1 : e.status;
    uit.tekst = String(e.stdout || '') + String(e.stderr || '');
  }
  return uit;
}

// De kluis van een datamap openen zoals de server dat doet, om NA te kijken wat
// het script werkelijk heeft geschreven in plaats van wat het zegt.
function kluisVan(datamap) {
  const oud = process.env.RTG_DATA_DIR;
  process.env.RTG_DATA_DIR = datamap;
  for (const k of Object.keys(require.cache)) {
    if (k.includes(path.join('server', 'accounts')) || k.includes(path.join('server', 'migraties'))) delete require.cache[k];
  }
  const accounts = require('../server/accounts');
  accounts.init();
  process.env.RTG_DATA_DIR = oud;
  return accounts;
}

test('zonder --maak verandert er niets en zegt het script dat er geen eigenaar is', () => {
  const map = versDatamap();
  const r = draai(map, []);
  assert.equal(r.code, 0, r.tekst);
  assert.match(r.tekst, /GEEN -- er staat niets op dit adres/);
  assert.match(r.tekst, /0 in de kluis/);
  // en na afloop nog steeds nul: een toonstand die schrijft is geen toonstand
  assert.match(draai(map, []).tekst, /0 in de kluis/);
});

/* DE DIAGNOSE MOET HET OORDEEL VAN DE DEUR HERHALEN, NIET EEN EIGEN VERSIE.

   Deze twee toetsen bestaan omdat het script anders een geruststelling wordt: met
   een account op het adres zegt hij JA, en met een overgedragen eigenaarschap --
   de stille manier waarop de eigenaar zichzelf buitensluit, want die overdracht
   overleeft een herstart en wint van RTG_OWNER_EMAIL -- hoort hij NEE te zeggen
   MET de herkomst erbij. Zonder die tweede is de eerste een dooddoener. */
test('de diagnose bevestigt het eigenaarschap op een account dat er hoort te zijn', () => {
  const map = versDatamap();
  assert.equal(draai(map, ['--maak', '--naam=Rahul Imran Ismail', '--geboren=1990-01-31']).code, 0);
  const r = draai(map, []);
  assert.match(r.tekst, /isEigenaar\(\)\s+JA/);
  assert.match(r.tekst, /kantoorsleutel\s+afgeleid/);
  // de pas staat er los van, en dat hoort het scherm te zeggen
  assert.match(r.tekst, /uw PAS is rtg en niet business of lifestyle/);
  // en nooit een ja/nee op een tekstkolom: `verified` is standaard 'unverified'
  assert.match(r.tekst, /identiteit unverified/);
});

test('een overgedragen eigenaarschap wint, en de diagnose wijst het aan', async () => {
  const map = versDatamap();
  assert.equal(draai(map, ['--maak', '--naam=Rahul Imran Ismail', '--geboren=1990-01-31']).code, 0);

  // de overdracht zetten zoals de boardroom dat doet: in de operationele opslag
  const zet = execFileSync(process.execPath, ['-e', `
    const dbm = require(${JSON.stringify(path.join(__dirname, '..', 'server', 'db'))});
    (async () => { await dbm.load();
      dbm.db.data.techniek = dbm.db.data.techniek || {};
      dbm.db.data.techniek.eigenaarEmail = 'iemand.anders@example.com';
      await dbm.save(); process.exit(0); })();
  `], { encoding: 'utf8', env: { ...process.env, RTG_DATA_DIR: map, NODE_ENV: '', DATABASE_URL: '', PG_URL: '' } });
  assert.equal(typeof zet, 'string');

  const r = draai(map, []);
  assert.match(r.tekst, /iemand\.anders@example\.com/, 'het overgedragen adres wordt niet gelezen');
  assert.match(r.tekst, /overgedragen vanuit de boardroom/, 'de herkomst wordt niet gemeld');
  assert.match(r.tekst, /GEEN -- er staat niets op dit adres/);
  // en het account van de oude eigenaar staat er nog gewoon
  assert.equal(kluisVan(map).count(), 1);
});

/* DE NEE-KANT MET EEN BESTAAND ACCOUNT, en die ontbrak.

   Zonder deze toets overleeft de goedkoopste fout van een diagnose: `klopt = true`
   hardcoderen. De twee toetsen hierboven vangen dat niet -- de ene loopt over de
   JA-kant en de andere over een adres waar helemaal geen account staat.

   Wat hier wordt nagebootst is de storing die het verraderlijkst is: de e-mail in
   de kluis is niet meer te lezen terwijl INLOGGEN nog werkt. Dat kan echt, want
   inloggen zoekt op `email_hash` en het eigenaarschap leest `enc_email`; bij een
   kluissleutel die niet meer bij de waarde past valt alleen dat tweede weg. Het
   huis weet dan niet meer wie u bent terwijl u gewoon binnenkomt. */
test('een onleesbare kluiswaarde geeft NEE met de kluis als reden, niet een geruststelling', () => {
  const map = versDatamap();
  assert.equal(draai(map, ['--maak', '--naam=Rahul Imran Ismail', '--geboren=1990-01-31']).code, 0);

  const { DatabaseSync } = require('node:sqlite');
  const d = new DatabaseSync(path.join(map, 'rtg.db'));
  // RTGV2: is het merk van een aan zijn rij gebonden kluiswaarde; de rest is
  // onleesbaar, precies zoals bij een sleutel die niet meer past.
  d.prepare('UPDATE users SET enc_email = ? WHERE id = 1').run('RTGV2:' + 'a'.repeat(64));
  d.close();

  const r = draai(map, []);
  assert.match(r.tekst, /isEigenaar\(\)\s+NEE/, 'de diagnose beweert eigenaarschap dat er niet is');
  assert.match(r.tekst, /NIET UIT DE KLUIS TE LEZEN/, 'de reden wordt niet genoemd');
  /* HIER STOND /vault\.key/, EN DAT WAS EEN ASSERTIE DIE MEELIEP MET ELKE TEKST.

     Het script zegt over die sleutel inmiddels precies het tegenovergestelde
     ("een veranderde vault.key verklaart dit dus NIET"), en de oude assertie
     bleef daar gewoon groen op staan -- ze toetste dat het WOORD er stond, niet
     wat erover beweerd werd. Nu wordt de redenering zelf getoetst.

     Met een account in de kluis kan de telling de twee oorzaken niet uit elkaar
     houden, en dat hoort het script te ZEGGEN in plaats van er een te kiezen. */
  assert.match(r.tekst, /op zijn E-MAILADRES gevonden/, 'de vindweg wordt niet gemeld, terwijl de hele redenering eraan hangt');
  assert.match(r.tekst, /veranderde vault\.key verklaart dit dus NIET/, 'de lezer wordt nog steeds naar de gepinde sleutel gestuurd');
  assert.match(r.tekst, /1 rijen -- 0 gebonden, 0 ongebonden, 1 ONLEESBAAR/, 'de stand van de kluis wordt niet geteld');
  assert.match(r.tekst, /kan de twee mogelijke\n\s+oorzaken NIET uit elkaar houden/, 'met een rij wordt er alsnog een oorzaak gekozen');
});

/* DE TWEE OORZAKEN UIT ELKAAR, EN DIT IS HET BEELD VAN DE ECHTE STORING.

   Inloggen blijft werken terwijl de kantoordeur dichtgaat -- dat klinkt als een
   tegenspraak en het is een ontwerp: email_hash is een HMAC met de GEPINDE
   sleutel en loopt niet mee in een rotatie (accounts/onderhoud.js roteer),
   terwijl enc_email met de RING wordt geopend. Raakt de ring kwijt, dan blijft
   de voordeur open en gaat de kluis dicht.

   Twee toetsen omdat het twee oorzaken zijn met hetzelfde symptoom, en een
   diagnose die ze niet scheidt stuurt de lezer de verkeerde kant op. */
test('een verdwenen sleutelring wijst naar de ring en niet naar deze ene rij', async () => {
  const map = versDatamap();
  assert.equal(draai(map, ['--maak', '--naam=Rahul Imran Ismail', '--geboren=1990-01-31']).code, 0);

  const accounts = kluisVan(map);
  await accounts.createUser({ email: 'iemand.anders@example.com', username: 'anders',
    password: 'ZeerGeheim123!', tier: 'rtg', realName: 'Iemand Anders' });
  const S = require('../server/accounts/state');
  require('../server/accounts/onderhoud').roteer(S.huidigeDb(), { schrijfRing: accounts.schrijfKluisRing });
  await accounts.flushBijAfsluiten();
  // de deploy die de datamap niet bewaart: de sleutels blijven, de ring niet
  fs.unlinkSync(path.join(map, 'vault.ring'));

  const r = draai(map, []);
  assert.match(r.tekst, /isEigenaar\(\)\s+NEE/);
  assert.match(r.tekst, /2 rijen -- 0 gebonden, 0 ongebonden, 2 ONLEESBAAR \(1 sleutel in de ring\)/,
    'de telling ziet de verdwenen ring niet');
  assert.match(r.tekst, /op zijn E-MAILADRES gevonden/, 'de vindweg wordt niet gemeld');
  assert.match(r.tekst, /Dat wijst op de RING en niet op deze rij/, 'de diagnose wijst de ring niet aan');
  assert.doesNotMatch(r.tekst, /Alleen DEZE rij staat dicht/, 'de diagnose wijst de verkeerde oorzaak aan');
});

test('een verplaatste kluiswaarde wijst naar de binding en niet naar de ring', async () => {
  const map = versDatamap();
  assert.equal(draai(map, ['--maak', '--naam=Rahul Imran Ismail', '--geboren=1990-01-31']).code, 0);

  const accounts = kluisVan(map);
  await accounts.createUser({ email: 'iemand.anders@example.com', username: 'anders',
    password: 'ZeerGeheim123!', tier: 'rtg', realName: 'Iemand Anders' });
  await accounts.flushBijAfsluiten();

  const { DatabaseSync } = require('node:sqlite');
  const d = new DatabaseSync(path.join(map, 'rtg.db'));
  /* Geen kapotte blob maar een ECHTE: die van de andere rij. Dat is precies
     waar de AAD voor is (accounts/gebonden.js), en het is de vorm die een
     herimport of een spiegel die rijen opnieuw invoegt achterlaat. */
  const twee = d.prepare('SELECT enc_email FROM users WHERE id = 2').get();
  d.prepare('UPDATE users SET enc_email = ? WHERE id = 1').run(twee.enc_email);
  d.close();

  const r = draai(map, []);
  assert.match(r.tekst, /isEigenaar\(\)\s+NEE/);
  assert.match(r.tekst, /2 rijen -- 1 gebonden, 0 ongebonden, 1 ONLEESBAAR/, 'de telling ziet de andere rij niet staan');
  assert.match(r.tekst, /op zijn E-MAILADRES gevonden/, 'de vindweg wordt niet gemeld');
  assert.match(r.tekst, /Alleen DEZE rij staat dicht/, 'de diagnose wijst de binding niet aan');
  assert.doesNotMatch(r.tekst, /Dat wijst op de RING/, 'de diagnose wijst de verkeerde oorzaak aan');
});

test('--maak levert een eigenaarsaccount op de RTG Pass, en nooit een betaalde pas', () => {
  const map = versDatamap();
  /* --tier=business gaat mee als argument. De parser neemt elk --x=y aan, dus
     als iemand dat veld ooit aan createUser knoopt, zakt deze toets -- en dat is
     precies de mutatie die de merkregel van CLAUDE.md bewaakt (Lifestyle en
     Business uitsluitend na een menselijk besluit). */
  const r = draai(map, ['--maak', '--naam=Rahul Imran Ismail', '--geboren=1990-01-31', '--tier=business']);
  assert.equal(r.code, 0, r.tekst);
  assert.match(r.tekst, /AANGEMAAKT/);
  assert.match(r.tekst, /eigenaar\?\s+ja/);

  const accounts = kluisVan(map);
  const u = accounts.findByLogin(ADRES);
  assert.ok(u, 'er staat geen account op het eigenaarsadres');
  assert.equal(u.tier, 'rtg', 'het script deelde een andere pas uit dan de RTG Pass');
  assert.equal(accounts.count(), 1);
  assert.equal(require('../server/eigenaar').isEigenaar(accounts, u), true);
  // de geboortedatum hoort in de ledenstaat en niet in de operationele data
  assert.equal((accounts.getMemberState(u.id) || {}).geboren, '1990-01-31');
});

test('een tweede ronde weigert en laat het bestaande account onaangeraakt', async () => {
  const map = versDatamap();
  const eerste = draai(map, ['--maak', '--naam=Rahul Imran Ismail', '--geboren=1990-01-31']);
  const wachtwoord = /wachtwoord\s+(\S+)/.exec(eerste.tekst)[1];

  const tweede = draai(map, ['--maak', '--naam=Iemand Anders', '--geboren=1980-02-02'],
    { RTG_EIGENAAR_WACHTWOORD: 'een-heel-ander-wachtwoord' });
  assert.equal(tweede.code, 1, 'een tweede ronde hoort te zakken');
  assert.match(tweede.tekst, /GEWEIGERD/);

  const accounts = kluisVan(map);
  const u = accounts.findByLogin(ADRES);
  assert.equal(accounts.realNameOf(u), 'Rahul Imran Ismail', 'de naam is overschreven');
  /* HET WACHTWOORD IS DE SCHERPSTE: een opstarthulp die stilletjes een
     wachtwoord vervangt, is een achterdeur met een vriendelijke naam. */
  assert.equal(await accounts.verifyPassword(wachtwoord, u.password_hash), true,
    'het oorspronkelijke wachtwoord werkt niet meer');
});

test('op dit account gaat de kantoordeur open, en op een gewoon account niet', async () => {
  const map = versDatamap();
  const gemaakt = draai(map, ['--maak', '--naam=Rahul Imran Ismail', '--geboren=1990-01-31']);
  assert.equal(gemaakt.code, 0, gemaakt.tekst);
  const wachtwoord = /wachtwoord\s+(\S+)/.exec(gemaakt.tekst)[1];

  /* RTG_MAGNAAT_TEST LEEG, EN DAT IS DE HELE TOETS.

     startServer zet die vlag STANDAARD op '1' (zie test/helper.js: de meeste
     toetsen leunen op de demostand). In die stand draait zetEigenaarsAccount()
     uit server.js bij elke start, en die zet het wachtwoord van de eigenaar
     terug op de demo-waarde -- gemeten: de inlog hieronder gaf 401 met een
     wachtwoord dat buiten de server aantoonbaar klopte. Dan zou deze toets de
     DEMO-bootstrap beproeven in plaats van het script, en groen staan om de
     verkeerde reden. De stand die dit script bedient is juist de stand waarin
     die bootstrap NIET draait. */
  const srv = await startServer({ env: { RTG_DATA_DIR: map, RTG_MAGNAAT_TEST: '' } });
  try {
    const post = async (pad, lijf, token) => {
      const r = await fetch(srv.base + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify(lijf || {}) });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    };

    const inlog = await post('/api/auth/login', { login: ADRES, password: wachtwoord });
    assert.equal(inlog.status, 200, JSON.stringify(inlog.data));
    const lidToken = inlog.data.token;

    const rollen = await post('/api/account/rollen', {}, lidToken);
    const kantoor = (rollen.data.rollen || []).find(r => r.rol === 'kantoor');
    assert.ok(kantoor, 'de eigenaar ziet geen kantoorrol in zijn sleutelbos');
    assert.equal(kantoor.viaEigenaar, true, 'de kantoorsleutel is gekoppeld in plaats van afgeleid');

    const start = await post('/api/account/start', { rol: 'kantoor' }, lidToken);
    assert.equal(start.status, 200, JSON.stringify(start.data));
    assert.ok(start.data.token, 'er kwam geen kantoorsessie uit');
    // en die sessie doet echt iets achter de backofficedeur
    assert.equal((await post('/api/office/state', {}, start.data.token)).status, 200);

    /* DE TEGENPROEF. Zonder deze regel zou "iedereen mag het kantoor in" deze
       toets net zo goed groen houden. */
    const ander = await post('/api/auth/register', { name: 'Gewoon Lid', email: 'gewoon.lid@example.com',
      password: 'wachtwoord-van-een-lid', geboortedatum: '1991-03-03' });
    assert.equal(ander.status, 200, JSON.stringify(ander.data));
    const anderStart = await post('/api/account/start', { rol: 'kantoor' }, ander.data.token);
    assert.equal(anderStart.status, 404, 'een gewoon lid kreeg een kantoorsessie');
  } finally {
    await stop(srv);
  }
});
