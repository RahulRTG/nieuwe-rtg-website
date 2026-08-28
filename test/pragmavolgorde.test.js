/* DE OMSCHAKELING NAAR WAL OP EEN BEZETTE DATABASE.

   `PRAGMA busy_timeout` zegt: kom je een bezet bestand tegen, wacht dan even in
   plaats van te weigeren. Bij `PRAGMA journal_mode=WAL` geldt dat NIET -- dat is
   een van de weinige statements die meteen weigeren, en juist die omschakeling
   vraagt zelf even een exclusief slot. Een tweede proces viel daarmee om op
   "database is locked", op precies de regel die de crash hoorde te voorkomen.

   De wachttijd vooropzetten repareert dat dus niet; dat is beproefd en het hielp
   niet. Wat wel werkt is dat de stand PERSISTENT is: eerst kijken, alleen
   schakelen als het nog niet in WAL staat, en bij een bezet bestand kort wachten
   en opnieuw kijken -- meestal heeft de ander het dan al gedaan.

   Dat is hier echt gebeurd, bij het gelijktijdig opstarten van drie servers op
   een verse database. Met processen is het niet betrouwbaar na te spelen -- het
   hangt van de timing af -- dus staat het hier deterministisch: een ANDER proces
   houdt het schrijfslot vast en laat het na een tel los, en de vraag is of onze
   verbinding dat uitzit of erop stukloopt.

   Het slot moet uit een ander proces komen. node:sqlite is synchroon: houdt
   dezelfde node het slot vast, dan komt zijn eigen timer nooit aan de beurt
   zolang wij staan te wachten, en dan wacht de toets zichzelf dood.

   Draai los: node --experimental-sqlite --test test/pragmavolgorde.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const accounts = require('../server/accounts');

/* Het kind: pakt het schrijfslot, meldt dat, en laat het na 400 ms weer los. */
const KIND = `
const { DatabaseSync } = require('node:sqlite');
const d = new DatabaseSync(process.argv[1]);
d.exec('CREATE TABLE IF NOT EXISTS t (n INTEGER)');
d.exec('BEGIN IMMEDIATE');
d.prepare('INSERT INTO t (n) VALUES (?)').run(1);
process.stdout.write('vast\\n');
setTimeout(() => { d.exec('COMMIT'); d.close(); }, 400);
`;

test('de gelijktijdigheidsstand wacht een bezette database uit in plaats van erop stuk te lopen', async () => {
  /* Een VERSE database, want alleen daar schakelt WAL werkelijk om; op een
     database die al in WAL staat is die regel een lege huls en bewijst hij
     niets. */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pragma-'));
  const bestand = path.join(TMP, 'proef.db');
  let kind = null, tweede = null;
  try {
    kind = spawn(process.execPath, ['--experimental-sqlite', '-e', KIND, bestand],
      { stdio: ['ignore', 'pipe', 'ignore'] });
    await new Promise((res, rej) => {
      const op = setTimeout(() => rej(new Error('het kind pakte het slot niet')), 15000);
      kind.stdout.on('data', (b) => { if (String(b).includes('vast')) { clearTimeout(op); res(); } });
      kind.on('exit', () => { clearTimeout(op); rej(new Error('het kind stopte voortijdig')); });
    });

    tweede = new DatabaseSync(bestand);
    accounts.zetGelijktijdigheid(tweede); // zonder de herhaalde poging: "database is locked"

    assert.equal(tweede.prepare('PRAGMA journal_mode').get().journal_mode, 'wal',
      'de omschakeling naar WAL is gelukt, ondanks het slot van het andere proces');
    assert.equal(tweede.prepare('PRAGMA busy_timeout').get().timeout, 5000,
      'en de wachttijd staat');
  } finally {
    if (tweede) try { tweede.close(); } catch (e) {}
    if (kind) try { kind.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
