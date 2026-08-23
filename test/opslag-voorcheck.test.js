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
