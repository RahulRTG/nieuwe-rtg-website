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
        plus account wel, ook voor de andere deur;
     6. een dichte emmer van adres plus account zet geen e-mailadres in de
        opslag. Zijn naam gaat als bron mee in de beveiligingsmelding, en die
        wordt bewaard. De oude emmer van de werkdeur ('mijn:'+adres) droeg geen
        inlognaam; de gedeelde droeg hem eerst in klare tekst;
     7. de werkdeur voedt de noodrem: na 25 gokken op een account staat het
        adres van de 25e poging in quarantaine, en dat van de 24e niet;
     8. een account is een emmer, in elke spelling: hoofdletters en witruimte
        rond de inlognaam geven geen verse gokken, op geen van beide deuren.
        findByLogin vindt het account in elke spelling, dus de rem hoort dat
        ook te doen.

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
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop, wachtOpWaarde } = require('./helper');

const NORA = 'nora@rtg.example', NORA_WW = 'werk';   // zaaiset: twee werkplekken
const WERK = '/api/supplier/mijn/login', GEWOON = '/api/auth/login';
/* Ruim boven een gewoon antwoord (tientallen tot honderden ms) en ruim onder de
   vertraging van twee seconden. */
const VERTRAAGD_MS = 1500;

async function metServer(werk, env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkrem-'));
  const srv = await startServer({ env: Object.assign({ RTG_DATA_DIR: dir, SMTP_URL: '', RTG_OWNER_EMAIL: '' }, env || {}) });
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
  try { await werk({ srv, poging, dir }); }
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

/* DE OPSLAG LEZEN ZOALS HIJ ERBIJ LIGT. Twee lezers, en ze vangen elkaars gat
   af. De rijen van store.db (een rij per collectie) zijn de betrouwbare: een
   ruwe zoektocht door de bestanden kan een tekst missen die SQLite over twee
   pagina's verdeelt. De ruwe zoektocht vangt wat buiten die rijen ligt (de
   WAL, een journaal, een ander bestand in de datamap). */
function kvRijen(dir) {
  const bestand = path.join(dir, 'store.db');
  if (!fs.existsSync(bestand)) return [];
  const kv = new DatabaseSync(bestand, { readOnly: true });
  try { return kv.prepare('SELECT key, val FROM kv').all(); } finally { kv.close(); }
}
function bruteForceVan(dir, ip) {
  const rij = kvRijen(dir).find(r => r.key === 'techniek');
  const lijst = rij ? ((JSON.parse(rij.val) || {}).beveiliging || []) : [];
  return lijst.filter(m => m.type === 'brute-force' && m.meta && m.meta.aanvaller === ip);
}
function bestandenMet(dir, patroon) {
  const raak = [];
  for (const naam of fs.readdirSync(dir, { recursive: true })) {
    let tekst;
    try { tekst = fs.readFileSync(path.join(dir, naam), 'latin1'); } catch (e) { continue; }   // map, of al weg
    if (patroon.test(tekst)) raak.push(naam);
  }
  return raak;
}

/* De opslag staat hier vast op SQLite, ook als de omgeving een PostgreSQL-URL
   meegeeft: de toets leest store.db, en een andere opslag zou hem stil laten
   wachten op een bestand dat er niet komt. */
test('6. een dichte emmer van adres plus account zet geen e-mailadres in de opslag', async () => {
  await metServer(async ({ poging, dir }) => {
    /* Een adres dat bij geen account hoort: zo kan het alleen via de rem in de
       opslag komen. Met hoofdletters, want de emmer rekent in kleine letters
       en de zoektocht hieronder kijkt naar allebei. */
    const mail = 'Geheim.Adres' + Date.now().toString().slice(-8) + '@Voorbeeld.test';
    const zoek = new RegExp(mail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    for (const [pad, ip] of [[WERK, '198.51.100.90'], [GEWOON, '198.51.100.91']]) {
      for (let i = 0; i < 10; i++) assert.equal((await poging(pad, ip, mail, 'fout' + i)).status, 401);
      /* TEGENPROEF: de emmer is echt dichtgegaan en zijn melding staat in de
         opslag. Zonder die melding is "geen e-mailadres" ook waar als er niets
         is gemeld. Gewacht wordt op die TOESTAND, de opslag schrijft na. */
      const meldingen = await wachtOpWaarde(() => {
        const m = bruteForceVan(dir, ip);
        return m.length ? m : null;
      }, { ms: 15000, wat: 'de brute-force-melding van ' + pad + ' in store.db' });
      assert.ok(meldingen.some(m => String(m.meta.bron).startsWith('auth:' + ip + ':')),
        pad + ': het is de emmer van adres plus account die dichtging: ' + JSON.stringify(meldingen.map(m => m.meta)));
      for (const m of meldingen) {
        assert.doesNotMatch(JSON.stringify(m), zoek, pad + ': de melding draagt het e-mailadres: ' + JSON.stringify(m));
      }
    }
    const rijen = kvRijen(dir).filter(r => zoek.test(String(r.val))).map(r => r.key);
    assert.deepEqual(rijen, [], 'geen collectie in store.db draagt het e-mailadres');
    assert.deepEqual(bestandenMet(dir, zoek), [], 'en geen bestand in de datamap, ook de WAL niet');
  }, { RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '' });
});

/* De noodrem hoort te zien wie er op de werkdeur gokt, net als op de gewone
   inlog: wie hier gokt kent het wachtwoord niet. Een eigen `soort` in
   noteFailedTry maakt van de melding een waarschuwing zonder noodrem (de vorm
   van de tweede stap, N4), en dan blijft het adres open. Vreemde adressen, want
   het schild zet een lokaal adres nooit in quarantaine. */
test('7. de werkdeur voedt de noodrem: na 25 gokken op een account staat het adres van de 25e in quarantaine', async () => {
  await metServer(async ({ poging }) => {
    for (let i = 1; i <= 25; i++) {
      assert.equal((await poging(WERK, '198.51.100.' + i, NORA, 'fout' + i)).status, 401, 'gok ' + i);
    }
    /* De accountemmer ging bij de 25e dicht en meldde brute force met dat adres
       als aanvaller. Gewacht op de toestand, want de quarantaine wordt
       vastgelegd; het juiste wachtwoord helpt dat adres dan niet meer. */
    const dader = await wachtOpWaarde(async () => {
      const r = await poging(WERK, '198.51.100.25', NORA, NORA_WW);
      return r.status === 403 ? r : null;
    }, { ms: 10000, wat: 'quarantaine (403) voor het adres van de 25e gok' });
    assert.match(String(dader.body.error), /quarantaine/, 'het is de quarantaine: ' + JSON.stringify(dader.body));
    /* TEGENPROEF: het adres van de 24e staat er niet in, en de eigenaar komt
       daar met het juiste wachtwoord gewoon binnen. Anders is "403" ook waar
       als alles dicht zit. */
    const ander = await poging(WERK, '198.51.100.24', NORA, NORA_WW);
    assert.equal(ander.status, 200, 'het adres van de 24e gok: ' + JSON.stringify(ander.body).slice(0, 160));
  });
});

/* Elke spelling een andere: hoofdletters volgens de bits van n (nooit allemaal
   klein), en bij een deel witruimte eromheen. findByLogin trimt en vergelijkt
   in kleine letters (accounts/kluis.js emailHash), dus allemaal hetzelfde
   account. */
function spelling(n) {
  let bit = 0;
  const s = NORA.replace(/[a-z]/g, c => ((n >> bit++) & 1 ? c.toUpperCase() : c));
  return ['', ' ', '\t', '  '][n % 4] + s + ['', '', ' ', '\t '][n % 4];
}

test('8. een account is een emmer, in elke spelling: hoofdletters en witruimte geven geen verse gokken', async () => {
  await metServer(async ({ poging }) => {
    /* Adres plus account, vanaf een lokaal adres (zie de kop: dan is de echte
       429 van de rem te zien en niet de quarantaine). Tien gokken in tien
       spellingen, om en om op beide deuren. */
    const A = '127.0.0.1';
    for (let i = 0; i < 10; i++) {
      const pad = i % 2 ? GEWOON : WERK;
      assert.equal((await poging(pad, A, spelling(i + 1), 'fout' + i)).status, 401, pad + ' in spelling ' + JSON.stringify(spelling(i + 1)));
    }
    for (const pad of [GEWOON, WERK]) {
      const r = await poging(pad, A, NORA, NORA_WW);
      assert.equal(r.status, 429, pad + ': tien gokken in tien spellingen zijn tien gokken op een account: ' + JSON.stringify(r.body).slice(0, 160));
    }

    /* Het account alleen: die tien tellen al mee, en vijftien gokken in nog
       vijftien spellingen vanaf vreemde adressen brengen de accountemmer op
       25. Daarna kost elke volgende gok twee seconden, in welke spelling ook. */
    for (let i = 0; i < 15; i++) {
      const pad = i % 2 ? WERK : GEWOON;
      assert.equal((await poging(pad, '203.0.113.' + (i + 1), spelling(i + 11), 'nogeens' + i)).status, 401);
    }
    for (const [n, pad] of [[26, WERK], [27, GEWOON]]) {
      const r = await poging(pad, '203.0.113.' + n, spelling(n), 'nogmaals');
      assert.equal(r.status, 401);
      assert.ok(r.ms >= VERTRAAGD_MS, pad + ' in spelling ' + JSON.stringify(spelling(n))
        + ' hoort na 25 mislukkingen op dit account vertraagd te zijn (' + r.ms + 'ms)');
    }
  });
});
