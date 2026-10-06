/* ============================================================================
   DE WERKPLEKINLOG REMT MET DE EMMERS VAN DE GEWONE INLOG -- regressie voor N28
   uit de V1-audit.

   DE FOUT: stap een van POST /api/supplier/mijn/login remde alleen per ADRES
   ('mijn:'+adres). /api/auth/login heeft drie emmers: adres plus account (10),
   het adres (50) en het account (25, een vertraging van twee seconden en geen
   slot). De eindkeuring van ronde 5 zag het zelf: dertig foute wachtwoorden op
   een account vanaf dertig adressen werden op de werkdeur niet geremd. En wat
   daar gegokt werd, telde bij de gewone inlog niet mee: elke deur gaf opnieuw
   tien gokken (de les van C3).

   DE FIX (besluit van de eigenaar): de remlogica van /api/auth/login staat nu in
   server/kern/identiteit/wachtwoordrem.js, en beide deuren gebruiken haar op
   dezelfde emmernamen. Wat dit bestand vastlegt, en alles kan zakken:

     1. een verspreide aanval op de werkdeur wordt vertraagd, nooit met een slot,
        en de eigenaar komt daarna zonder wachten binnen;
     2. de accountemmer is GEDEELD: gokken op de ene deur vertragen de andere;
     3. de emmer van adres plus account is gedeeld: negen gokken op de ene deur
        en een op de andere zetten het adres dicht, ook voor het JUISTE
        wachtwoord, in beide richtingen;
     4. een geslaagde inlog leegt nooit de adresemmer (de les van N4): een
        aanvaller met een eigen account zet de grens van 50 per adres niet terug;
     5. en de tegenproef bij 3: een geslaagde inlog leegt de emmer van adres
        plus account wel, ook voor de andere deur.

   Waarom de tijd wordt gemeten en niet alleen de status: het account krijgt met
   opzet een VERTRAGING en geen slot (test/inlogrem.test.js). Een trage machine
   maakt een gemeten duur alleen langer, nooit korter, dus de ondergrens kan niet
   omslaan in een valse groene.

   WAAROM 3 EN 4 VANAF EEN LOKAAL ADRES GOKKEN. Gaat een emmer dicht, dan meldt
   hij brute force, en trede 1 van de noodrem zet het adres van die poging in
   quarantaine: daarna geeft het schild 403 voor ELK verzoek van dat adres. Die
   403 dekt een ontbrekende rem toe. Gemeten: zonder `dicht()` op de werkdeur
   bleef toets 3 groen zolang hij vanaf een vreemd adres gokte. Het schild laat
   lokale adressen door (server/kern/schild.js), dus vanaf 127.0.0.1 en ::1 is
   de ECHTE 429 van de rem te zien, en die wordt hier geeist.

   Elke toets krijgt een eigen server: de noodrem telt aanvallende adressen per
   server, en vanaf drie gaat de registratie dicht.

   Draai los: node --test test/werkplek-rem.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const NORA = 'nora@rtg.example', NORA_WW = 'werk';   // zaaiset: twee werkplekken
const WERK = '/api/supplier/mijn/login', GEWOON = '/api/auth/login';
/* Ruim boven een gewoon antwoord (tientallen tot honderden ms) en ruim onder de
   vertraging van twee seconden. */
const VERTRAAGD_MS = 1500;

async function metServer(werk) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkrem-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir, SMTP_URL: '', RTG_OWNER_EMAIL: '' } });
  /* Elke poging draagt haar eigen adres. De voordeurketen vertrouwt een hop
     (RTG_PROXY_HOPS, standaard 1), dus dit is wat een botnet doet. */
  const poging = async (pad, ip, login, password) => {
    const t = Date.now();
    const r = await fetch(srv.base + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ login, password }) });
    const body = await r.json().catch(() => ({}));
    return { status: r.status, ms: Date.now() - t, body };
  };
  try { await werk({ srv, poging }); }
  finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
  }
}

test('1. dertig foute wachtwoorden vanaf dertig adressen op de werkdeur worden vertraagd, en de eigenaar komt erin', async () => {
  await metServer(async ({ poging }) => {
    const uit = [];
    for (let i = 0; i < 30; i++) uit.push(await poging(WERK, '198.51.100.' + i, NORA, 'fout' + i));
    assert.deepEqual([...new Set(uit.map(r => r.status))], [401],
      'elke foute gok is 401 en nooit een slot: ' + uit.map(r => r.status).join(','));
    const vertraagd = uit.filter(r => r.ms >= VERTRAAGD_MS).length;
    assert.ok(vertraagd >= 5,
      'na 25 mislukkingen op dit account hoort elke volgende gok twee seconden te kosten; vertraagd: '
      + vertraagd + ' (duren: ' + uit.map(r => r.ms).join(',') + ')');

    const eigenaar = await poging(WERK, '198.51.100.200', NORA, NORA_WW);
    assert.equal(eigenaar.status, 200, 'met het juiste wachtwoord komt de eigenaar binnen: ' + JSON.stringify(eigenaar.body).slice(0, 160));
    assert.ok(eigenaar.body.token, 'en hij krijgt zijn werksessie');
    assert.ok(eigenaar.ms < VERTRAAGD_MS,
      'zonder wachten: de vertraging hangt aan een MISLUKTE poging (' + eigenaar.ms + 'ms)');

    /* En zijn geslaagde inlog begint de telling op het account opnieuw, zoals
       bij de gewone inlog: een typefout daarna kost weer geen twee seconden. */
    const typefout = await poging(WERK, '198.51.100.201', NORA, 'wekr');
    assert.equal(typefout.status, 401);
    assert.ok(typefout.ms < VERTRAAGD_MS, 'na de geslaagde inlog is de accountemmer leeg (' + typefout.ms + 'ms)');
  });
});

test('2. de accountemmer is gedeeld: om en om op beide deuren gegokt, worden beide deuren vertraagd', async () => {
  await metServer(async ({ poging }) => {
    const uit = [];
    for (let i = 0; i < 30; i++) {
      const pad = i % 2 ? GEWOON : WERK;
      uit.push(Object.assign({ pad }, await poging(pad, '203.0.113.' + i, NORA, 'fout' + i)));
    }
    assert.ok(uit.every(r => r.status === 401), 'elke gok is 401: ' + uit.map(r => r.status).join(','));
    /* Vijftien per deur: met een emmer per deur haalt geen van beide de 25. */
    for (const pad of [WERK, GEWOON]) {
      const traag = uit.filter(r => r.pad === pad && r.ms >= VERTRAAGD_MS).length;
      assert.ok(traag >= 2, pad + ' hoort mee te tellen en mee te remmen; vertraagd op deze deur: ' + traag
        + ' (duren: ' + uit.map(r => r.ms).join(',') + ')');
    }
    // de eigenaar staat op geen van beide deuren buiten
    const werk = await poging(WERK, '203.0.113.200', NORA, NORA_WW);
    assert.equal(werk.status, 200, 'werkdeur: ' + JSON.stringify(werk.body).slice(0, 160));
    const gewoon = await poging(GEWOON, '203.0.113.201', NORA, NORA_WW);
    assert.equal(gewoon.status, 200, 'gewone inlog: ' + JSON.stringify(gewoon.body).slice(0, 160));
    assert.ok(werk.ms < VERTRAAGD_MS && gewoon.ms < VERTRAAGD_MS, 'en zonder wachten (' + werk.ms + ', ' + gewoon.ms + 'ms)');
  });
});

test('3. de emmer van adres plus account is gedeeld, in beide richtingen, en houdt dan ook het juiste wachtwoord tegen', async () => {
  await metServer(async ({ poging }) => {
    /* Werkdeur naar gewone inlog: negen op de werkdeur, de tiende op de gewone. */
    const A = '127.0.0.1';
    for (let i = 0; i < 9; i++) assert.equal((await poging(WERK, A, NORA, 'fout' + i)).status, 401);
    assert.equal((await poging(GEWOON, A, NORA, 'fout9')).status, 401, 'de tiende gok zelf is nog 401');
    const naWerk = await poging(GEWOON, A, NORA, NORA_WW);
    assert.equal(naWerk.status, 429,
      'na tien gokken over twee deuren hoort dit adres dicht te zijn voor dit account, ook met het juiste wachtwoord');

    /* Gewone inlog naar werkdeur, vanaf een ander adres. */
    const B = '::1';
    for (let i = 0; i < 9; i++) assert.equal((await poging(GEWOON, B, NORA, 'fout' + i)).status, 401);
    assert.equal((await poging(WERK, B, NORA, 'fout9')).status, 401);
    const naGewoon = await poging(WERK, B, NORA, NORA_WW);
    assert.equal(naGewoon.status, 429, 'en andersom: de werkdeur is dan ook dicht');
  });
});

test('4. een geslaagde inlog leegt de adresemmer niet: een eigen account zet de grens van 50 niet terug', async () => {
  await metServer(async ({ poging, srv }) => {
    const eigen = 'eigen' + Date.now().toString().slice(-8) + '@voorbeeld.test', EIGEN_WW = 'mijneigenwachtwoord1';
    const reg = await fetch(srv.base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Eigen Proef', email: eigen, password: EIGEN_WW, geboortedatum: '1990-03-03' }) });
    assert.equal(reg.status, 200, 'het eigen account van de aanvaller bestaat');

    /* Zes slachtoffers, negen gokken per stuk (onder de tien per adres plus
       account en de 25 per account), en na elke negen een geslaagde inlog op
       het eigen account. Leegde die de adresemmer, dan kwam dit adres nooit aan
       de 50. */
    const D = '127.0.0.1';   // lokaal: zie de kop
    const statussen = [];
    for (let s = 0; s < 6; s++) {
      for (let i = 0; i < 9; i++) statussen.push((await poging(GEWOON, D, 'slachtoffer' + s + '@voorbeeld.test', 'fout' + i)).status);
      statussen.push((await poging(GEWOON, D, eigen, EIGEN_WW)).status);
    }
    /* De vijftigste mislukking is poging 55 (vijf rondes van tien, dan vijf
       gokken): tot en met die poging gewone antwoorden, daarna 429, ook voor
       het eigen account. */
    assert.ok(statussen.slice(0, 55).every(s => s === 401 || s === 200),
      'tot aan de grens gewone antwoorden: ' + statussen.join(','));
    assert.deepEqual([...new Set(statussen.slice(55))], [429],
      'na 50 mislukkingen vanaf een adres hoort dat adres dicht te gaan, ook als er tussendoor een eigen inlog slaagde: '
      + statussen.join(','));
  });
});

/* TEGENPROEF bij 3: een geslaagde inlog leegt de emmer van adres plus account,
   en omdat die gedeeld is, ook voor de ANDERE deur. Negen gokken op de ene deur,
   de juiste op de andere, en weer negen gokken laten het adres open. Zonder
   deze proef is "alles dicht" ook groen.

   Twee eigen accounts, een per richting: Nora zou na achttien gokken per
   richting de 25 per account halen, en de poging die dat doet zet haar adres in
   quarantaine (de noodrem). Deze accounts hebben geen werkplek, dus op de
   werkdeur geeft het juiste wachtwoord "nergens op het rooster". */
test('5. een geslaagde inlog op de ene deur begint de telling van adres plus account op de andere opnieuw', async () => {
  await metServer(async ({ poging, srv }) => {
    const geenWerkplek = (r) => r.status === 404 && /nergens op het rooster/.test(String(r.body.error));
    const kort = (r) => r.status + ' ' + JSON.stringify(r.body).slice(0, 160);
    const richtingen = [
      { gok: WERK, slaagt: GEWOON, ip: '192.0.2.30', klopt: (r) => r.status === 200 && !!r.body.token },
      { gok: GEWOON, slaagt: WERK, ip: '192.0.2.40', klopt: geenWerkplek }
    ];
    for (const [n, richting] of richtingen.entries()) {
      const mail = 'tegenproef' + n + Date.now().toString().slice(-8) + '@voorbeeld.test', ww = 'eenanderwachtwoord' + n;
      const reg = await fetch(srv.base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tegen Proef', email: mail, password: ww, geboortedatum: '1990-03-03' }) });
      assert.equal(reg.status, 200, 'het account voor de tegenproef bestaat');
      for (let i = 0; i < 9; i++) assert.equal((await poging(richting.gok, richting.ip, mail, 'fout' + i)).status, 401);
      const tussen = await poging(richting.slaagt, richting.ip, mail, ww);
      assert.ok(richting.klopt(tussen), richting.slaagt + ' na negen gokken op ' + richting.gok + ': ' + kort(tussen));
      for (let i = 0; i < 9; i++) {
        const r = await poging(richting.gok, richting.ip, mail, 'nogeens' + i);
        assert.equal(r.status, 401, 'na de geslaagde inlog begint de telling opnieuw (' + richting.gok + ', gok ' + (i + 1) + '): ' + kort(r));
      }
    }
  });
});
