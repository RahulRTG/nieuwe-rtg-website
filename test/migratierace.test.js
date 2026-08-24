/* TWEE PROCESSEN DIE TEGELIJK MIGREREN, EN ALLEBEI KOMEN ZE OP.

   WAAROM DIT BESTAAT. RTG draait in groepen (server/vloot.js): leden, kantoor
   en rtf zijn aparte processen op DEZELFDE databasemap. Ze migreren dus
   allemaal bij het opstarten, tegelijk.

   server/migraties/index.js las eerst welke migraties al gedraaid waren en
   draaide daarna wat ontbrak -- met dat lezen en schrijven BUITEN een gedeelde
   transactie. Twee processen zagen dus allebei "migratie 2 ontbreekt", allebei
   draaiden ze hem, en de verliezer liep vast op:

       UNIQUE constraint failed: schema_versie.n

   Die fout was fataal. De kantoor-groep viel om, de poortwachter gaf 502, en
   test/vloot.test.js zakte op "de vloot komt op binnen 120s" -- met een
   foutmelding die over een tijdslimiet ging en niets zei over een race. Vier
   ronden op dezelfde code gaven twee keer rood en twee keer groen: hij bijt
   alleen als de machine vol staat, en dat is precies wanneer je hem meet.

   WAT DEZE TOETS DOET. Zes processen openen dezelfde VERSE database en beginnen
   op hetzelfde moment aan de migratierij. Alle zes horen op te komen, en het
   grootboek hoort daarna elke migratie precies EEN keer te bevatten -- niet
   nul, niet twee.

   WAT HIJ NIET IS: een bewijs dat er geen race meer BESTAAT. Hij is een
   reproductie van deze race, met genoeg processen en een strak startsein om
   hem waarschijnlijk te maken. De reparatie zelf is een slot (BEGIN IMMEDIATE
   plus een tweede blik binnen de transactie), en dat slot is wat de garantie
   draagt; deze toets is wat hem heeft zien werken.

   Draai los: node --experimental-sqlite --test test/migratierace.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { DatabaseSync } = require('node:sqlite');

const WORTEL = path.join(__dirname, '..');
const MIGRATIES = path.join(WORTEL, 'server', 'migraties');
const { MIGRATIES: LIJST } = require('../server/migraties/lijst');

/* Het kind: open de database, wacht tot het afgesproken moment, migreer.
   Het startsein is een tijdstip en geen bestand -- zes processen die op
   dezelfde milliseconde beginnen, geven het breedste raam. */
const KIND = `
const { DatabaseSync } = require('node:sqlite');
const start = Number(process.argv[2]);
const db = new DatabaseSync(process.argv[1]);
db.exec('PRAGMA busy_timeout=5000');
db.exec('PRAGMA journal_mode=WAL');
const m = require(process.argv[3]);
while (Date.now() < start) { /* strak wachten tot het sein */ }
const uit = m.draai(db);
process.stdout.write(JSON.stringify({ gedraaid: uit.gedraaid.length, overgeslagen: (uit.overgeslagen || []).length }));
`;

function raceRonde(aantal) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-migrace-'));
  const bestand = path.join(map, 'race.db');
  const start = Date.now() + 400;
  const kinderen = [];
  for (let i = 0; i < aantal; i++) {
    kinderen.push(cp.spawnSync(process.execPath,
      ['--experimental-sqlite', '-e', KIND, bestand, String(start), MIGRATIES],
      { encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL' }));
  }
  return { map, bestand, kinderen };
}

/* spawnSync is serieel, en dat zou de race juist WEGnemen. Dus starten we ze
   asynchroon en wachten we daarna op alle zes tegelijk. */
function raceParallel(aantal) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-migrace-'));
  const bestand = path.join(map, 'race.db');
  const start = Date.now() + 600;
  const wacht = [];
  for (let i = 0; i < aantal; i++) {
    wacht.push(new Promise((resolve) => {
      const k = cp.spawn(process.execPath,
        ['--experimental-sqlite', '-e', KIND, bestand, String(start), MIGRATIES],
        { stdio: ['ignore', 'pipe', 'pipe'] });
      let uit = '', fout = '';
      k.stdout.on('data', d => { uit += d; });
      k.stderr.on('data', d => { fout += d; });
      k.on('close', (code) => resolve({ code, uit, fout }));
      setTimeout(() => { try { k.kill('SIGKILL'); } catch (e) {} }, 60000).unref();
    }));
  }
  return { map, bestand, klaar: Promise.all(wacht) };
}

test('zes processen migreren tegelijk, en alle zes komen op', async () => {
  const { map, bestand, klaar } = raceParallel(6);
  try {
    const uit = await klaar;

    const omgevallen = uit.filter(r => r.code !== 0);
    assert.deepEqual(omgevallen.map(r => (r.fout || '').split('\n').find(l => /Migratie|Error/.test(l)) || 'onbekend'), [],
      omgevallen.length + ' van de 6 processen viel om tijdens het migreren. Dat is de race: lezen ' +
      'welke migraties al gedraaid zijn en daarna schrijven, zonder slot ertussen.');

    /* HET GROOTBOEK IS DE ECHTE UITSLAG. Alle zes groen zou ook kunnen als er
       niets gebeurde; hier staat of het schema er precies EEN keer op staat. */
    const db = new DatabaseSync(bestand);
    const rijen = db.prepare('SELECT n, naam FROM schema_versie ORDER BY n').all();
    db.close();
    assert.equal(rijen.length, LIJST.length,
      'het grootboek telt ' + rijen.length + ' migraties en de lijst er ' + LIJST.length);
    const nummers = rijen.map(r => r.n);
    assert.deepEqual(nummers, [...new Set(nummers)].sort((a, b) => a - b),
      'een migratie staat dubbel in het grootboek');

    /* EN PRECIES EEN PROCES HEEFT ZE ECHT GEDRAAID. De rest hoort niets te
       hebben gedaan -- of het nu kwam doordat ze het van tevoren al zagen, of
       doordat ze het slot verloren en binnen de transactie opnieuw keken. */
    const gedraaid = uit.map(r => { try { return JSON.parse(r.uit).gedraaid; } catch (e) { return -1; } });
    assert.equal(gedraaid.filter(n => n > 0).length, 1,
      'meer dan een proces zegt migraties te hebben gedraaid: ' + JSON.stringify(gedraaid));
  } finally {
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
});

test('een tweede ronde op dezelfde database doet niets meer', () => {
  /* De tegenproef bij de toets hierboven: als draai() op een gemigreerde
     database toch iets zou doen, dan zegt "precies een proces draaide ze" niets
     -- dan had elk proces gewoon alles opnieuw kunnen doen. */
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-migherhaal-'));
  try {
    const db = new DatabaseSync(path.join(map, 'x.db'));
    db.exec('PRAGMA journal_mode=WAL');
    const m = require(MIGRATIES);
    const eerst = m.draai(db);
    assert.equal(eerst.gedraaid.length, LIJST.length, 'de eerste ronde draait alles');
    const tweede = m.draai(db);
    assert.equal(tweede.gedraaid.length, 0, 'de tweede ronde hoort niets meer te doen');
    assert.equal(tweede.stand, eerst.stand);
    db.close();
  } finally {
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
});

test('het slot staat er ECHT, en niet alleen in het commentaar', () => {
  /* Zonder deze bewering kan iemand BEGIN IMMEDIATE terugzetten naar BEGIN en
     blijft de toets hierboven groen zolang de timing meezit -- en dat is
     precies hoe deze fout drie ronden lang onzichtbaar bleef (LAT.md regel 10).
     De race is niet betrouwbaar reproduceerbaar; het slot is wel te lezen. */
  const bron = fs.readFileSync(path.join(MIGRATIES, 'index.js'), 'utf8');
  assert.match(bron, /BEGIN IMMEDIATE/,
    'de migratie opent niet meer met een schrijfslot; dan schrijven twee processen er blind naast');
  assert.match(bron, /SELECT 1 AS x FROM schema_versie WHERE n = \?/,
    'er wordt binnen de transactie niet meer opnieuw gekeken; wachten alleen is niet genoeg, ' +
    'want na het wachten is de wereld veranderd');
  assert.match(bron, /busy_timeout/,
    'zonder geduld krijgt de verliezer meteen SQLITE_BUSY in plaats van te wachten');
});

test('overal geldt de wachttijd VOOR het aanzetten van WAL, en niet erna', () => {
  /* DRIE PLEKKEN OPENEN HIER EEN SQLITE-DATABASE, en ze deden het niet
     hetzelfde. server/db/sqlite.js zette de wachttijd vooraan en legde er een
     alinea bij uit waarom; server/accounts/index.js en server/db/tx/
     sqliteachter.js zetten hem er ACHTER. Het aanzetten van WAL neemt zelf een
     exclusief slot, dus zonder geduld ervoor krijgt het tweede proces meteen
     "database is locked" -- de crash die die regels juist moesten voorkomen.

     Dat is een waarheid op drie plekken waarvan er twee fout stonden (LAT.md
     regel 4), en niets hield dat tegen. Dit is wat het tegenhoudt. */
  const wortel = path.join(WORTEL, 'server');
  const bestanden = [];
  (function loop(d) {
    for (const n of fs.readdirSync(d)) {
      if (n === 'node_modules' || n === 'data') continue;
      const p = path.join(d, n);
      if (fs.statSync(p).isDirectory()) loop(p);
      else if (n.endsWith('.js')) bestanden.push(p);
    }
  })(wortel);

  const fout = [];
  let gezien = 0;
  for (const p of bestanden) {
    const bron = fs.readFileSync(p, 'utf8');
    /* Op de exec-AANROEP en niet op het losse woord: 'busy_timeout' staat ook in
       het commentaar boven die regels, en dat commentaar staat eerder in het
       bestand. Op het losse woord vond deze zeef dus altijd geduld-voor-WAL, hoe
       de code er ook bij stond -- de mutatieproef liet hem daarop AFSLAAN. */
    const wal = bron.search(/exec\(\s*['"`]PRAGMA journal_mode\s*=\s*WAL/i);
    if (wal < 0) continue;
    gezien++;
    const geduld = bron.search(/exec\(\s*['"`]PRAGMA busy_timeout/i);
    if (geduld < 0 || geduld > wal) fout.push(path.relative(WORTEL, p));
  }
  assert.ok(gezien >= 3,
    'nul of bijna nul plekken met journal_mode=WAL gevonden -- dan zoekt deze toets de verkeerde ' +
    'vorm en bewaakt hij niets (gezien: ' + gezien + ')');
  assert.deepEqual(fout, [],
    'hier staat de wachttijd NA het aanzetten van WAL, of helemaal niet. Twee processen die ' +
    'tegelijk opstarten botsen dan op "database is locked":\n  ' + fout.join('\n  '));
});

test('de eigenaarsbootstrap verdraagt een verloren race, en alleen die', () => {
  /* DE TWEEDE HELFT VAN DEZELFDE FLAKE. Toen het slot in de migratierij zat,
     zakte test/vloot.test.js nog steeds -- nu op

         UNIQUE constraint failed: users.username
           at zetEigenaarsAccount (server/server.js)

     Alle drie de groepen kijken of het eigenaarsaccount bestaat, alle drie
     zien ze van niet, alle drie maken ze het aan. Die functie is IDEMPOTENT
     bedoeld ("zorg dat de eigenaar bestaat"), dus een botsing op de unieke
     sleutel betekent dat een ander proces sneller was: opnieuw kijken en
     doorlopen.

     Waarom dit een BRONtoets is en geen race-toets: de bootstrap draait bij het
     laden van server.js, dus reproduceren kost drie echte servers en dat is
     precies de flakiness die we kwijt wilden. test/vloot.test.js is het
     end-to-end-bewijs; deze bewering houdt de reparatie vast. */
  const bron = fs.readFileSync(path.join(WORTEL, 'server', 'server.js'), 'utf8');
  assert.match(bron, /function zetEigenaarsAccountEens\(\)/,
    'de bootstrap is niet meer opgesplitst; dan is er niets om opnieuw te proberen');
  assert.match(bron, /UNIQUE constraint failed: users\\\./,
    'de botsing op de unieke sleutel wordt niet meer herkend als een verloren race');
  assert.match(bron, /if \(!\/UNIQUE constraint failed: users\\\.\/\.test\(bericht\)\) throw e;/,
    'elke ANDERE fout hoort te blijven staan; een kale catch maakt van deze reparatie ' +
    'een doofpot voor fouten die niets met drukte te maken hebben');

  /* EN DE TWEEDE POGING ZELF. Zonder deze bewering blijft de toets groen als
     iemand de herlezing vervangt door een throw -- dan herkent hij de race nog
     steeds, en valt hij er alsnog op om. De mutatieproef liet hem daarop
     AFSLAAN. */
  const wachter = bron.indexOf('if (!/UNIQUE constraint failed: users');
  const opnieuw = bron.indexOf('return zetEigenaarsAccountEens();', wachter);
  assert.ok(wachter > 0 && opnieuw > wachter && opnieuw - wachter < 200,
    'na het herkennen van de race wordt er niet opnieuw gekeken; herkennen alleen ' +
    'lost niets op');
});
