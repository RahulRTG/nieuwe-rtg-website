/* De goedkope voorcheck van de SQLite-opslag (server/db/sqlite.js).

   Verandering opsporen kostte een JSON.stringify van ELKE collectie bij ELKE
   save; op de echte store (164 collecties, 1,0 MB, waarvan `sessions` 780 KB)
   was dat onder last 42% van alle server-CPU. De voorcheck slaat die stringify
   over voor GROTE collecties waarvan het aantal items gelijk is -- maar hooguit
   RTG_SQLITE_GROOT_MS, en nooit voor geld.

   Deze toets legt precies die grenzen vast, want ze zijn een belofte:
   1. geld wordt ALTIJD exact nagekeken (namenlijst en naam-vangnet);
   2. toevoegen/verwijderen verandert het aantal en landt dus meteen;
   3. een overgeslagen collectie blijft niet hangen (naronde na het venster);
   4. netjes afsluiten kijkt alles na en vouwt de WAL dicht;
   5. onder de grens verandert er niets aan het oude gedrag.
   Draai los:
   node --experimental-sqlite --test test/opslag-voorcheck.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const WORTEL = path.join(__dirname, '..');
const wacht = ms => new Promise(r => setTimeout(r, ms));

/* Elke toets krijgt een eigen datamap EN een eigen modulecache: db/sqlite houdt
   verbinding en maten in modulescope, dus een schone lei per scenario. */
function verseOpslag(env) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-voorcheck-'));
  const oud = {};
  const zet = (k, v) => { oud[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = String(v); };
  zet('RTG_DATA_DIR', TMP); zet('RTG_STORE', 'sqlite');
  zet('DATABASE_URL', ''); zet('PG_URL', ''); zet('REDIS_URL', '');
  for (const [k, v] of Object.entries(env || {})) zet(k, v);
  for (const k of Object.keys(require.cache)) if (k.startsWith(path.join(WORTEL, 'server'))) delete require.cache[k];
  const dbmod = require(path.join(WORTEL, 'server/db'));
  const kluis = require(path.join(WORTEL, 'server/kluis'));
  dbmod.load();
  // Lees een collectie zoals ze ECHT op schijf staat (los van het geheugen).
  const opSchijf = (naam) => {
    const d = new DatabaseSync(path.join(TMP, 'store.db'));
    try {
      const rij = d.prepare('SELECT val FROM kv WHERE key = ?').get(naam);
      return rij ? JSON.parse(kluis.ontsleutel(rij.val)) : null;
    } finally { d.close(); }
  };
  const walBytes = () => { const w = path.join(TMP, 'store.db-wal'); return fs.existsSync(w) ? fs.statSync(w).size : 0; };
  const op = () => { for (const [k, v] of Object.entries(oud)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } fs.rmSync(TMP, { recursive: true, force: true }); };
  return { dbmod, db: dbmod.db, TMP, opSchijf, walBytes, op };
}
// Een collectie die zeker boven RTG_SQLITE_GROOT_BYTES uitkomt.
function grootBlok(n, extra) {
  const uit = {};
  for (let i = 0; i < n; i++) uit['t' + i] = { nr: i, gezien: 1000 + i, vul: 'x'.repeat(200), ...(extra || {}) };
  return uit;
}

test('geld wordt altijd exact nagekeken, ook boven de grens', async () => {
  const o = verseOpslag({ RTG_SQLITE_GROOT_MS: 60000 }); // venster ruim: alleen de regel telt
  try {
    // paySaldi staat op de namenlijst, betaalTegoed valt onder het naam-vangnet
    o.db.data.paySaldi = grootBlok(3000);
    o.db.data.betaalTegoed = grootBlok(3000);
    o.db.data.sessions = grootBlok(3000);
    o.dbmod.save();
    assert.equal(o.opSchijf('paySaldi').t0.gezien, 1000, 'eerste save schrijft alles');

    // wijziging-op-zijn-plaats: aantal blijft gelijk, dus de voorcheck ZOU mogen wachten
    o.db.data.paySaldi.t0.gezien = 4242;
    o.db.data.betaalTegoed.t0.gezien = 4242;
    o.db.data.sessions.t0.gezien = 4242;
    o.dbmod.save();

    assert.equal(o.opSchijf('paySaldi').t0.gezien, 4242, 'geld op de namenlijst landt meteen');
    assert.equal(o.opSchijf('betaalTegoed').t0.gezien, 4242, 'geld op de naam landt meteen');
    assert.equal(o.opSchijf('sessions').t0.gezien, 1000, 'een grote niet-geldcollectie mag even wachten');
  } finally { o.op(); }
});

test('toevoegen en verwijderen landen meteen: het aantal items verandert', async () => {
  const o = verseOpslag({ RTG_SQLITE_GROOT_MS: 60000 });
  try {
    o.db.data.sessions = grootBlok(3000);
    o.dbmod.save();
    o.db.data.sessions.nieuw = { nr: -1, gezien: 7 }; // nieuwe sessie: inloggen
    o.dbmod.save();
    assert.ok(o.opSchijf('sessions').nieuw, 'een nieuwe sessie staat direct op schijf');
    delete o.db.data.sessions.nieuw;                  // uitloggen
    o.dbmod.save();
    assert.equal(o.opSchijf('sessions').nieuw, undefined, 'een uitgelogde sessie is direct weg van schijf');
  } finally { o.op(); }
});

test('een overgeslagen collectie blijft niet hangen: na het venster komt er een naronde', async () => {
  const o = verseOpslag({ RTG_SQLITE_GROOT_MS: 150 }); // kort venster, zodat de toets snel blijft
  try {
    o.db.data.sessions = grootBlok(3000);
    o.dbmod.save();
    o.db.data.sessions.t0.gezien = 9999;
    o.dbmod.save();
    // geen enkel verzoek meer: de geplande naronde moet het alsnog wegschrijven
    for (let i = 0; i < 40 && o.opSchijf('sessions').t0.gezien !== 9999; i++) await wacht(50);
    assert.equal(o.opSchijf('sessions').t0.gezien, 9999, 'de naronde schrijft de uitgestelde wijziging weg');
  } finally { o.op(); }
});

test('netjes afsluiten kijkt alles na en vouwt de WAL dicht', async () => {
  const o = verseOpslag({ RTG_SQLITE_GROOT_MS: 60000 });
  try {
    o.db.data.sessions = grootBlok(3000);
    o.dbmod.save();
    o.db.data.sessions.t0.gezien = 1234;
    o.dbmod.save();
    assert.equal(o.opSchijf('sessions').t0.gezien, 1000, 'nog uitgesteld');
    await o.dbmod.flushBijAfsluiten();
    assert.equal(o.opSchijf('sessions').t0.gezien, 1234, 'afsluiten kijkt alles na');
    assert.equal(o.walBytes(), 0, 'de WAL is in het hoofdbestand gevouwen');
  } finally { o.op(); }
});

test('onder de grens verandert er niets: kleine collecties landen altijd meteen', async () => {
  const o = verseOpslag({ RTG_SQLITE_GROOT_MS: 60000 });
  try {
    o.db.data.notities = grootBlok(5); // ruim onder 512 KB
    o.dbmod.save();
    o.db.data.notities.t0.gezien = 555;
    o.dbmod.save();
    assert.equal(o.opSchijf('notities').t0.gezien, 555, 'kleine collectie: exact zoals vroeger');
  } finally { o.op(); }
});

test('de voorcheck maakt saven meetbaar goedkoper zonder geld los te laten', async () => {
  const meet = (grens) => {
    const o = verseOpslag({ RTG_SQLITE_GROOT_MS: 60000, RTG_SQLITE_GROOT_BYTES: grens });
    try {
      o.db.data.sessions = grootBlok(4000);
      o.db.data.paySaldi = {}; for (let i = 0; i < 100; i++) o.db.data.paySaldi['k' + i] = { centen: 1000 };
      o.dbmod.save();
      const t0 = process.hrtime.bigint();
      for (let i = 0; i < 60; i++) {
        o.db.data.sessions['t' + (i % 4000)].gezien = 5000 + i; // op zijn plaats
        o.db.data.paySaldi['k' + (i % 100)].centen += 1;         // geld
        o.dbmod.save();
      }
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      const geldGoed = o.opSchijf('paySaldi').k0.centen === o.db.data.paySaldi.k0.centen;
      return { ms, geldGoed };
    } finally { o.op(); }
  };
  const oud = meet(1e12);        // grens onbereikbaar = het gedrag van voor de voorcheck
  const nieuw = meet(512 * 1024); // de standaardgrens
  assert.equal(oud.geldGoed, true, 'oud gedrag: geld klopt');
  assert.equal(nieuw.geldGoed, true, 'met voorcheck: geld klopt nog steeds exact');
  // Ruime marge: dit is een prestatie-vangrail, geen benchmark. Gemeten winst
  // op deze last was ~5x; we falen pas als de winst helemaal weg is.
  assert.ok(nieuw.ms < oud.ms, 'de voorcheck is sneller (oud ' + oud.ms.toFixed(0) + ' ms, nieuw ' + nieuw.ms.toFixed(0) + ' ms)');
});

/* ============================================================================
   HET RESETCONTRACT -- fase C van de verificatie-runtime.

   647 serverstarts kosten een derde van alle toetstijd. Hergebruik mag pas als
   van elke muteerbare wortel BEWEZEN is dat hij terug kan naar zijn beginstand.
   Deze module heeft er vier: drie maten (laatsteGrootte, laatsteLengte,
   laatsteCheck) en de naronde-timer. Ze staan in STATE.json als `herstelbaar`
   met terugNaarVers() als reset; scripts/staat.js leest die belofte na in de
   bron, en dit is het gedragsbewijs erbij.

   DE TIMER IS HET PUNT. vergeet(k) in een lus wist alle drie de maten en laat
   de timer staan -- en die vuurt daarna alsnog, met de save-functie van de
   VORIGE eigenaar in de hand. In een gedeelde server is dat een schrijfactie
   van de ene toets die tijdens de volgende landt: geen fout, een verkeerd
   antwoord. Vandaar dat dit contract niet alleen "de maten zijn weg" toetst.
   ========================================================================== */
test('resetcontract: na terugNaarVers() antwoordt de module als een verse kopie', async () => {
  const o = verseOpslag({ RTG_SQLITE_GROOT_MS: 60 });
  try {
    /* TWEE ECHTE KOPIEEN van dezelfde module. `vers` wordt nooit aangeraakt en
       is dus per definitie de beginstand; `werk` wordt vuilgemaakt en gereset.
       Daarna moeten ze op ELKE invoer hetzelfde antwoorden. Dat is de eigenschap
       die hergebruik van een server veilig maakt, en hij is sterker dan "de
       maten zijn weg": een reset die er twee van de drie wist komt hier boven
       water, en dat deed hij ook -- de eerste versie van deze toets bleef groen
       bij een terugNaarVers() die alleen laatsteCheck leegde (LAT-regel 9). */
    const pad = require.resolve(path.join(WORTEL, 'server/db/voorcheck'));
    delete require.cache[pad]; const vers = require(pad);
    delete require.cache[pad]; const werk = require(pad);
    assert.notEqual(vers, werk, 'dit moeten twee losse kopieen zijn, anders vergelijkt de toets zichzelf');

    const waarde = grootBlok(4000);
    const bytes = werk.GROOT_BYTES + 1;
    /* Een batterij invoeren, met opzet ook vlak na nul: daar valt het verschil
       tussen "alles vergeten" en "alleen de laatste controle vergeten" op. */
    const invoeren = [];
    for (const k of ['sessions', 'saldi', 'iets']) {
      for (const nu of [1, 10, 59, 61, 1000, 5000]) {
        for (const force of [false, true]) invoeren.push([k, nu, force]);
      }
    }
    const antwoorden = (m) => invoeren.map(([k, nu, force]) => m.magOverslaan(k, waarde, force, nu));

    /* Eerst aantonen dat vuilmaken echt iets verandert -- anders is de
       vergelijking hieronder groen om de verkeerde reden. */
    const schoon = antwoorden(werk);
    assert.deepEqual(schoon, antwoorden(vers), 'twee verse kopieen horen gelijk te antwoorden');
    werk.onthoud('sessions', bytes, waarde, 5);
    werk.onthoud('iets', bytes, waarde, 5);
    assert.notDeepEqual(antwoorden(werk), schoon, 'de mutatie moet echt iets doen, anders bewijst de reset niets');

    werk.terugNaarVers();
    assert.deepEqual(antwoorden(werk), antwoorden(vers),
      'na terugNaarVers() hoort deze module op elke invoer te antwoorden als een kopie die nooit iets heeft gezien');

    /* WAT DEZE VERGELIJKING WEL EN NIET DEKT, want dat is nagemeten en niet
       aangenomen. Van de drie maten is alleen laatsteGrootte hier zichtbaar:
       magOverslaan() leest hem als EERSTE en kort af zodra hij leeg is, dus
       laatsteLengte en laatsteCheck komen er dan niet meer aan te pas. Twee
       mutaties bevestigden dat -- een terugNaarVers() die laatsteLengte laat
       staan, en een die laatsteCheck laat staan, bleven allebei groen.

       Die twee worden gedekt door de BRONPOORT: STATE.json noemt terugNaarVers()
       als hun reset, en scripts/staat.js leest die functie uit de bron en eist
       dat ze er alle vier in geschreven worden (zie dekking() daar). Haal
       laatsteLengte.clear() weg en test/staatregister.test.js zakt met de naam
       van die wortel erbij. Waarneembaar gedrag hier, onwaarneembare toestand
       daar -- samen dekken ze alle vier. */

    /* En de timer, die geen enkele vergelijking van antwoorden laat zien.
       vergeet(k) in een lus wist alle maten en laat hem staan; hij vuurt daarna
       alsnog met de save-functie van de VORIGE eigenaar in de hand. In een
       gedeelde server is dat een schrijfactie van de ene toets die tijdens de
       volgende landt: geen fout, een verkeerd antwoord. */
    const gedraaid = [];
    werk.onthoud('sessions', bytes, waarde, 5);
    werk.planNaronde(() => gedraaid.push('vorige eigenaar'));
    werk.terugNaarVers();
    werk.planNaronde(() => gedraaid.push('nieuwe eigenaar'));
    await wacht(werk.GROOT_MS + 120);
    assert.deepEqual(gedraaid, ['nieuwe eigenaar'],
      'de naronde van voor de reset hoort afgezegd te zijn en die van erna hoort te vuren');

    werk.terugNaarVers(); vers.terugNaarVers();
  } finally { o.op(); }
});

/* ============================================================================
   HETZELFDE CONTRACT VOOR DE SNAPSHOT-OPSLAG (server/db/snapshot.js).

   Zes wortels: de timer, de vuil-vlag, en vier merken. Het waarneembare verschil
   tussen vers en gebruikt zit in planSnapshot(): bij een verse module staat
   saveKlaar op -Infinity, dus de eerste plan schrijft METEEN; is er net
   geschreven, dan plant hij een venster in. Precies dat verschil mag een toets
   die na een andere draait niet merken.
   ========================================================================== */
test('resetcontract: snapshot.terugNaarVers() maakt het plangedrag weer dat van een verse start', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-snapreset-'));
  const oud = { d: process.env.RTG_DATA_DIR, s: process.env.RTG_STORE, ms: process.env.RTG_SAVE_MS };
  process.env.RTG_DATA_DIR = TMP; process.env.RTG_STORE = 'json'; process.env.RTG_SAVE_MS = '120';
  try {
    for (const k of Object.keys(require.cache)) if (k.startsWith(path.join(WORTEL, 'server'))) delete require.cache[k];
    const snap = require(path.join(WORTEL, 'server/db/snapshot'));
    const DB_FILE = require(path.join(WORTEL, 'server/db/opslag')).DB_FILE;
    const erIs = () => fs.existsSync(DB_FILE);
    const weg = () => { try { fs.rmSync(DB_FILE); } catch (e) {} };

    /* 1. Vers: de eerste plan schrijft meteen. Zonder deze regel zou stap 3
       groen zijn om de verkeerde reden. */
    weg();
    snap.planSnapshot();
    assert.equal(erIs(), true, 'een verse module hoort bij de eerste planSnapshot() meteen te schrijven');

    /* 2. Gebruikt: er is net geschreven, dus nu plant hij een venster in in
       plaats van te schrijven -- en blijft vuil. */
    weg();
    snap.planSnapshot();
    assert.equal(erIs(), false, 'vlak na een schrijfactie hoort planSnapshot() een venster in te plannen');
    assert.equal(snap.snapshotVuil(), true, 'en er staat dan werk open');

    /* 3. Reset. Het openstaande werk hoort NIET verloren te gaan -- een reset
       die gegevens weggooit is geen schone lei maar dataverlies. */
    snap.terugNaarVers();
    assert.equal(erIs(), true, 'terugNaarVers() hoort openstaand werk eerst weg te schrijven');
    assert.equal(snap.snapshotVuil(), false, 'en daarna niets meer open te hebben staan');

    /* 4. En het plangedrag is weer dat van stap 1. */
    weg();
    snap.planSnapshot();
    assert.equal(erIs(), true, 'na de reset hoort de eerste planSnapshot() weer meteen te schrijven, net als vers');

    /* 5. De afgezegde timer uit stap 2 mag niet alsnog vuren. Die stond op ~120
       ms; na het venster hoort er geen tweede schrijfactie meer te komen.

       EERLIJK OVER WAT DIT WEL EN NIET AANTOONT. Een reset die de timer alleen
       op null zet in plaats van hem af te zeggen, blijft hier groen -- ik heb
       het nagelopen. De reden is de flush in stap 3: die zet saveVuil op false,
       en dan doet de wees bij het vuren niets meer. In dit ontwerp is een
       niet-afgezegde timer dus niet met gedrag te betrappen. Dat gat zit sinds
       die mutatie in de BRONPOORT: bij een wortel met vorm `timer` eist
       scripts/staat.js een echte clearTimeout/clearInterval en niet alleen een
       schrijfactie (zie dekking() daar, gebrek `timerNietAfgezegd`). */
    weg();
    await wacht(300);
    assert.equal(erIs(), false, 'de timer van voor de reset hoort afgezegd te zijn, niet alsnog te schrijven');

    snap.terugNaarVers();
  } finally {
    for (const [k, v] of [['RTG_DATA_DIR', oud.d], ['RTG_STORE', oud.s], ['RTG_SAVE_MS', oud.ms]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
