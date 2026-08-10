/* DE TWEEDE KOPIE VAN DE BACKUP -- die naar een ANDERE schijf.

   `test/herstelproef.test.js` zet een backup echt terug, en dat is de proef die
   telt. Maar hij loopt over de LOKALE backup (`server/data/backups/`), en de
   kop van server/opzet/backup.js belooft nog iets: met `RTG_BACKUP_DIR` gaat er
   een tweede kopie naar een andere schijf of mount, "zodat een backup ook een
   crash van de app-schijf overleeft".

   Die belofte was nooit nagegaan. Dat is precies de vorm die deze ronde twee
   keer een echt defect opleverde (eerlijkheidspunt 6.19 en 6.21): iets achter een
   omgevingsvariabele, met een `catch` erom die "[backup] mislukt" naar het log
   schrijft -- een regel die niemand leest, op een machine waar die variabele
   meestal niet staat. Zou de tweede kopie stil niets doen, dan merk je dat op de
   enige dag waarop het uitmaakt.

   WAT HIER WORDT VASTGELEGD:

   1. de tweede kopie bestaat, en bevat DEZELFDE dingen als de lokale -- niet een
      deel. Dat is geen theoretisch punt: volgens de kop van backup.js stond de
      opsomming ooit twee keer letterlijk in dat bestand, en er ontbraken drie
      dingen in de tweede (het transactiegrootboek, het archief en papieren.json).
      Deze toets vergelijkt de twee mappen met elkaar en niet met een lijstje
      hier, zodat hij niet kan verouderen als er iets bij komt.
   2. ook de MAPPEN gaan mee (archief/), en niet alleen de losse bestanden.
   3. zonder `RTG_BACKUP_DIR` gebeurt er niets extra's -- en dat is geen fout.

   Op moduleniveau, want dit is een functie van zijn invoer: een datamap erin, twee
   mappen eruit. Geen server, geen database.

   Draai los: node --experimental-sqlite --test test/backup-tweede-schijf.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const maakBackup = require('../server/opzet/backup.js');
const DAG = () => new Date().toISOString().slice(0, 10);

/* Een datamap met van elke soort iets: een los bestand, het bestand dat bewust
   buiten de database leeft (papieren.json), en een map. */
function verseDatamap() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bk-data-'));
  fs.writeFileSync(path.join(d, 'db.json'), JSON.stringify({ leden: 1 }));
  fs.writeFileSync(path.join(d, 'papieren.json'), JSON.stringify({ kvk: 'toets' }));
  fs.mkdirSync(path.join(d, 'archief'), { recursive: true });
  fs.writeFileSync(path.join(d, 'archief', 'oud.json'), JSON.stringify({ weg: true }));
  return d;
}
const maak = (DATA_DIR) => maakBackup({
  fs, path, DATA_DIR,
  db: { writable: true, data: {} }, accounts: {},
  checkpointSqlite: () => {}, checkpointGrootboek: () => {}
});
// wat er in een map staat, mappen als "naam/" zodat een map en een bestand verschillen
const inhoud = (dir) => fs.readdirSync(dir).sort()
  .map(n => (fs.statSync(path.join(dir, n)).isDirectory() ? n + '/' : n));

test('1. met RTG_BACKUP_DIR staat er een tweede kopie, met dezelfde inhoud als de lokale', () => {
  const DATA = verseDatamap();
  const OFF = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bk-off-'));
  const oud = process.env.RTG_BACKUP_DIR;
  process.env.RTG_BACKUP_DIR = OFF;
  try {
    maak(DATA).backupData();
    const lokaal = path.join(DATA, 'backups', DAG());
    const elders = path.join(OFF, DAG());
    assert.ok(fs.existsSync(lokaal), 'de lokale backup staat er');
    assert.ok(fs.existsSync(elders), 'en de tweede kopie op de andere schijf ook');

    /* DE TWEE MAPPEN NAAST ELKAAR, en niet naast een lijstje hier. Zo kan deze
       toets niet verouderen als er een bestand bij komt -- en dat is precies wat
       er eerder is misgegaan: de opsomming stond twee keer, en de tweede miste
       drie dingen. */
    assert.deepEqual(inhoud(elders), inhoud(lokaal),
      'de tweede kopie bevat hetzelfde als de lokale, niet een deel ervan');

    // en de MAP is echt meegekopieerd, met zijn inhoud
    assert.deepEqual(inhoud(path.join(elders, 'archief')), ['oud.json'], 'het archief gaat mee');
    assert.equal(fs.readFileSync(path.join(elders, 'archief', 'oud.json'), 'utf8'),
      fs.readFileSync(path.join(DATA, 'archief', 'oud.json'), 'utf8'), 'en met dezelfde inhoud');
    // het bestand dat bewust buiten de database leeft, staat er ook
    assert.ok(fs.existsSync(path.join(elders, 'papieren.json')),
      'papieren.json (het datalek-belschema) staat in de tweede kopie');
  } finally {
    if (oud === undefined) delete process.env.RTG_BACKUP_DIR; else process.env.RTG_BACKUP_DIR = oud;
    fs.rmSync(DATA, { recursive: true, force: true });
    fs.rmSync(OFF, { recursive: true, force: true });
  }
});

test('2. ZONDER RTG_BACKUP_DIR is er alleen de lokale backup, en dat is geen fout', () => {
  /* De tegenproef. Zonder deze zou een backupData() die ALTIJD naar dezelfde
     plek schrijft er hierboven precies zo uitzien. */
  const DATA = verseDatamap();
  const OFF = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bk-off2-'));
  const oud = process.env.RTG_BACKUP_DIR;
  delete process.env.RTG_BACKUP_DIR;
  try {
    maak(DATA).backupData();
    assert.ok(fs.existsSync(path.join(DATA, 'backups', DAG())), 'de lokale backup staat er gewoon');
    assert.deepEqual(fs.readdirSync(OFF), [], 'en er is niets naar een tweede schijf gegaan');
  } finally {
    if (oud === undefined) delete process.env.RTG_BACKUP_DIR; else process.env.RTG_BACKUP_DIR = oud;
    fs.rmSync(DATA, { recursive: true, force: true });
    fs.rmSync(OFF, { recursive: true, force: true });
  }
});
