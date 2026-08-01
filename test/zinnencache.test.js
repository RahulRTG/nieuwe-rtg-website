/* DE ZINNENCACHE (server/accounts/state.js -> S.zin).

   node:sqlite is SYNCHROON. Elke prepare parst de SQL en bouwt het plan midden in
   de event-loop, terwijl de hele server wacht. De accounts-laag deed dat inline,
   bij elke aanroep opnieuw: op het warme pad (POST /api/state, 8 lezers, 1166
   req/s) was prepare 8.7% van alle zelf-tijd. S.zin() doet het een keer per zin.

   Wat hier wordt getoetst is niet "gaat het sneller" -- dat is gemeten en staat
   in state.js. Hier staat wat er STUK kan gaan door zo'n cache:

     1. hergebruik moet echt hergebruik zijn (anders is de cache decor);
     2. een hergebruikt statement moet met NIEUWE parameters het juiste antwoord
        geven (een cache die het eerste antwoord vasthoudt is erger dan geen);
     3. en de scherpste: wordt de database OPNIEUW GEOPEND, dan zijn de oude
        statements van de oude handle. Zonder de handle-controle zou de cache ze
        blijven uitdelen en dan lees je uit een database die je niet meer hebt.

   Draai los: node --experimental-sqlite --test test/zinnencache.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Verse, geisoleerde datamap VOOR de modules worden geladen.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zinnen-'));
process.env.RTG_DATA_DIR = TMP;

const accounts = require('../server/accounts');
accounts.init();
const S = require('../server/accounts/state');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let n = 0;
const maakLid = (naam) => accounts.createUser({
  email: 'zin' + (++n) + '@voorbeeld.test', password: 'geheim12', tier: 'rtg',
  realName: naam, phone: '+3161112' + String(1000 + n)
});

test('dezelfde zin levert exact hetzelfde statement, een tweede zin telt er een bij', () => {
  const voor = S.zinnen();
  const a = S.zin('SELECT count(*) AS n FROM users');
  const b = S.zin('SELECT count(*) AS n FROM users');
  assert.equal(a, b, 'twee keer dezelfde SQL hoort hetzelfde object te geven');
  assert.equal(S.zinnen(), voor + 1, 'een herhaling mag er geen zin bij zetten');

  S.zin('SELECT id FROM users ORDER BY id ASC LIMIT 1');
  assert.equal(S.zinnen(), voor + 2, 'een ANDERE zin hoort er wel een bij te zetten');
});

test('een hergebruikt statement antwoordt op de NIEUWE parameters', async () => {
  const u1 = await maakLid('Anna Aalders');
  const u2 = await maakLid('Bram Bakker');
  const zin = 'SELECT id, codename FROM users WHERE id = ?';

  const r1 = S.zin(zin).get(u1.id);
  const r2 = S.zin(zin).get(u2.id);
  assert.equal(r1.id, u1.id);
  assert.equal(r2.id, u2.id, 'het tweede antwoord hoort bij het tweede id, niet bij het eerste');
  assert.notEqual(r1.codename, r2.codename);

  // en terug: geen volgorde-effect
  assert.equal(S.zin(zin).get(u1.id).id, u1.id);
});

/* Het warme pad, geteld bij de BRON. Een eerdere versie van deze toets keek naar
   S.zinnen() en dat is niet hetzelfde: de cache kan netjes een zin groot blijven
   terwijl er honderd keer wordt voorbereid. Precies dat gebeurde bij de mutatie
   waarin de cache nooit raak leest -- de toets bleef groen. Dus tellen we hier
   wat er werkelijk gebeurt: elke prepare op de handle. */
test('het warme pad bereidt EEN keer voor, ook na honderd lezingen', async () => {
  const u = await maakLid('Carla Cornelis');
  accounts.saveMemberState(u.id, { proef: 1 });

  const echte = S.db;
  let voorbereid = 0;
  const teller = new Proxy(echte, {
    get(t, p) {
      if (p === 'prepare') return (sql) => { voorbereid++; return t.prepare(sql); };
      const v = t[p];
      return typeof v === 'function' ? v.bind(t) : v;
    }
  });
  try {
    S.db = teller;                       // andere handle: de cache begint leeg
    for (let i = 0; i < 100; i++) assert.equal(accounts.getMemberState(u.id).proef, 1);
  } finally {
    S.db = echte;
  }
  assert.equal(voorbereid, 1, 'honderd lezingen, een prepare');
});

/* ---- DE HANDLE-CONTROLE ----
   Dit is de reden dat de cache niet drie regels is. We hangen S.db om naar een
   TWEEDE, verse database met dezelfde tabel maar andere inhoud, en vragen exact
   dezelfde SQL op. Komt het antwoord van de oude handle, dan deelt de cache
   statements uit die bij een database horen die deze module niet meer gebruikt.

   MUTATIE-BEWIJS: haal de regel `if (_cacheDb !== module.exports.db)` uit
   state.js weg en deze toets zakt op de tweede assert (5 bleef 2). Met de regel
   erin slaagt hij. */
test('een HERopende database begint met een lege cache en leest uit de nieuwe handle', () => {
  const echte = S.db;
  const tweede = new DatabaseSync(path.join(TMP, 'tweede.db'));
  tweede.exec('CREATE TABLE users (id TEXT PRIMARY KEY, codename TEXT)');
  for (let i = 0; i < 5; i++) tweede.prepare('INSERT INTO users (id, codename) VALUES (?, ?)').run('t' + i, 'T' + i);

  const zin = 'SELECT count(*) AS n FROM users';
  const inEchte = S.zin(zin).get().n;
  assert.ok(inEchte > 0, 'de echte database heeft leden (anders bewijst de vergelijking niets)');
  assert.notEqual(inEchte, 5, 'de twee databases moeten verschillen, anders kan deze toets niet zakken');

  try {
    S.db = tweede;
    assert.equal(S.zinnen(), 0, 'een andere handle hoort de cache leeg te maken');
    assert.equal(S.zin(zin).get().n, 5, 'het antwoord hoort uit de NIEUWE database te komen');
  } finally {
    S.db = echte;
    tweede.close();
  }

  // en terug naar de echte handle: opnieuw leeg, opnieuw het juiste antwoord
  assert.equal(S.zinnen(), 0, 'terugwisselen hoort de cache van de tweede handle te wissen');
  assert.equal(S.zin(zin).get().n, inEchte);
});

/* ---- DE BRONREGEL ----
   Een cache die je op vijf plekken invoert en op de zesde vergeet, is een cache
   met een gat dat niemand ziet. Deze toets houdt de accounts-laag eraan.

   onderhoud.js is de gedocumenteerde uitzondering: daar wordt de SQL
   SAMENGESTELD uit de kolommen die een rij toevallig nodig heeft, dus cachen op
   de tekst zou de cache met de gegevens laten meegroeien. Dat staat als reden in
   het bestand en wordt hier vastgezet, zodat het een BESLUIT blijft en geen
   vergetelheid wordt. */
test('geen enkele accounts-module bereidt nog inline voor (behalve onderhoud.js, met reden)', () => {
  const map = path.join(__dirname, '..', 'server', 'accounts');
  const overtreders = [];
  for (const f of fs.readdirSync(map)) {
    if (!f.endsWith('.js') || f === 'onderhoud.js' || f === 'state.js') continue;
    const bron = fs.readFileSync(path.join(map, f), 'utf8');
    bron.split('\n').forEach((r, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(r)) return;             // commentaar telt niet
      if (/\bS\.db\.prepare\s*\(/.test(r)) overtreders.push(f + ':' + (i + 1) + ' ' + r.trim().slice(0, 80));
    });
  }
  assert.deepEqual(overtreders, [], 'deze regels horen via S.zin() te lopen');
});

test('onderhoud.js mag inline voorbereiden, maar moet zeggen waarom', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'accounts', 'onderhoud.js'), 'utf8');
  assert.match(bron, /S\.zin/, 'de uitzondering hoort de cache bij naam te noemen');
  assert.match(bron, /samengesteld/i, 'en te zeggen dat de SQL wordt samengesteld');
});
