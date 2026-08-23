/* DE BACK-UPBEWERING HING AAN EEN MAPNAAM.

   Twee plekken besloten "er is een dagback-up" op grond van EEN ding: dat er
   een map bestond die YYYY-MM-DD heette. De BAK-01-check in server/techniek.js
   deed het zo, en de bewering "Dagelijkse back-up" in de tenantstand ook. Een
   lege map las als groen. Een backup die halverwege afbrak las als groen. Een
   db.json van nul bytes las als groen.

   Dat is precies de vorm waar de bewijslaag tegen is: een bewering waarvan het
   enige bewijs is dat er iets STAAT dat eruitziet als bewijs. De naam van een
   map is geen back-up.

   Vijf beweringen:

   1. Een lege of half weggeschreven backup is NIET compleet, en er staat bij
      wat eraan mankeert.
   2. Een db.json die niet opent, wordt gezien. Dat is het verschil tussen een
      bestand van 40 MB en een bestand van 40 MB dat is afgekapt.
   3. Een LEEG -wal-bestand is de GEZONDE toestand en geen fout. Deze regel
      staat er omdat de eerste versie van deze meter meteen drie lege
      wal-bestanden als kapot meldde -- een vals alarm dat mensen leren negeren.
   4. Er wordt vergeleken met wat er LEEFT en niet met de volle lijst: een
      backup verwijten dat hij iets mist wat nergens bestaat, is hetzelfde
      valse alarm.
   5. Ontbreekt de lijst, dan is er GEEN oordeel -- `compleet: null` met de
      reden, en geen stilzwijgende ja.

   Draai los: node --test test/backupstand.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bs = require('../server/backupstand');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bstand-'));
test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let n = 0;
/* Een datamap met een backup erin, precies zoals server/opzet/backup.js hem
   achterlaat: de levende bestanden in de wortel, een kopie in backups/<dag>. */
function huis({ leeft, kopie, dag, marker }) {
  const wortel = path.join(TMP, 'h' + (++n));
  const d = dag || new Date().toISOString().slice(0, 10);
  const bdir = path.join(wortel, 'backups', d);
  fs.mkdirSync(bdir, { recursive: true });
  for (const [naam, inhoud] of Object.entries(leeft || {})) fs.writeFileSync(path.join(wortel, naam), inhoud);
  for (const [naam, inhoud] of Object.entries(kopie || {})) fs.writeFileSync(path.join(bdir, naam), inhoud);
  /* De schrijver zet deze marker als de dag af is en wisselt de map dan pas
     atomisch naar zijn plek (server/opzet/backup.js). Zonder marker hoort een
     map dus nooit zichtbaar te zijn -- en telt hij hier ook niet. */
  if (marker !== false) fs.writeFileSync(path.join(bdir, '.complete'),
    JSON.stringify(marker || { dag: d, klaar: new Date().toISOString(), bestanden: Object.keys(kopie || {}).length }));
  return wortel;
}
const GOED = { 'db.json': '{"a":1}', 'rtg.db': 'xx' };

test('1. een lege back-upmap is niet compleet, en zegt wat er mist', () => {
  const b = bs.lees(huis({ leeft: GOED, kopie: {} }));
  assert.equal(b.er, true, 'de map bestaat wel -- daar ging het nu juist mis');
  assert.equal(b.compleet, false);
  assert.deepEqual(b.mist.sort(), ['db.json', 'rtg.db']);
  assert.match(b.reden, /mist db.json, rtg.db/);

  /* En een bestand van nul bytes telt ook niet. Een half weggeschreven backup
     is geen backup. */
  const half = bs.lees(huis({ leeft: GOED, kopie: { 'db.json': '{"a":1}', 'rtg.db': '' } }));
  assert.equal(half.compleet, false);
  assert.deepEqual(half.leeg, ['rtg.db']);
});

test('2. een db.json die niet opent wordt gezien', () => {
  const b = bs.lees(huis({ leeft: GOED, kopie: { 'db.json': '{"a":1', 'rtg.db': 'xx' } }));
  assert.equal(b.compleet, false);
  assert.match(b.jsonFout, /opent niet/);
  assert.deepEqual(b.mist, [], 'het bestand IS er -- daar zat de blinde vlek');
  assert.deepEqual(b.leeg, [], 'en het is niet leeg');

  const geenObject = bs.lees(huis({ leeft: GOED, kopie: { 'db.json': '"tekst"', 'rtg.db': 'xx' } }));
  assert.match(geenObject.jsonFout, /geen object/);
});

test('3. een leeg -wal is de gezonde toestand', () => {
  /* Na een checkpoint is het write-ahead-log leeg, en dat is precies wat de
     backup vlak voor het kopieren doet. */
  const b = bs.lees(huis({
    leeft: { 'db.json': '{"a":1}', 'rtg.db': 'xx', 'rtg.db-wal': '' },
    kopie: { 'db.json': '{"a":1}', 'rtg.db': 'xx', 'rtg.db-wal': '' } }));
  assert.equal(b.compleet, true, b.reden);
  assert.deepEqual(b.leeg, []);

  /* Maar ONTBREKEN mag hij nog steeds niet: er is verschil tussen leeg en weg. */
  const weg = bs.lees(huis({
    leeft: { 'db.json': '{"a":1}', 'rtg.db-wal': '' }, kopie: { 'db.json': '{"a":1}' } }));
  assert.deepEqual(weg.mist, ['rtg.db-wal']);
});

test('4. wat hier niet leeft, wordt de back-up niet verweten', () => {
  /* store.db en grootboek.db bestaan alleen in sommige opstellingen. Een
     compleetheidsmelding over een bestand dat nergens bestaat, is een vals
     alarm -- en een meter die vals alarm geeft, wordt genegeerd. */
  const b = bs.lees(huis({ leeft: GOED, kopie: GOED }));
  assert.equal(b.compleet, true, b.reden);
  assert.equal(b.gecontroleerd, 2, 'alleen wat er echt is: ' + b.gecontroleerd);
  assert.match(b.reden, /2 bestand\(en\) aanwezig/);
  assert.match(b.reden, /afgerond volgens \.complete/, 'en het oordeel van de schrijver staat vooraan');
  assert.equal(b.klaar.bestanden, 2, 'de marker zelf komt mee');
});

test('5. geen map, geen dagmap, geen oordeel -- elk met zijn eigen reden', () => {
  const leeg = path.join(TMP, 'kaal');
  fs.mkdirSync(leeg, { recursive: true });
  const zonder = bs.lees(leeg);
  assert.equal(zonder.er, false);
  assert.match(zonder.reden, /nog geen back-upmap/);

  const alleenMap = path.join(TMP, 'alleenmap');
  fs.mkdirSync(path.join(alleenMap, 'backups'), { recursive: true });
  const geenDag = bs.lees(alleenMap);
  assert.equal(geenDag.er, false);
  assert.match(geenDag.reden, /geen enkele dagback-up/);

  /* Rommel in de backupmap is GEEN dagback-up. Dezelfde vormcontrole die
     server/opzet/backup.js gebruikt om te bepalen wat hij mag opruimen. */
  fs.writeFileSync(path.join(alleenMap, 'backups', 'aantekening.txt'), 'x');
  assert.equal(bs.lees(alleenMap).er, false, 'een los bestand is geen back-up');
});

test('6. de oudste back-ups tellen niet mee; de NIEUWSTE is het oordeel', () => {
  const wortel = huis({ leeft: GOED, kopie: GOED, dag: '2020-01-01' });
  const nieuw = path.join(wortel, 'backups', '2020-06-01');
  fs.mkdirSync(nieuw, { recursive: true });          // een lege, nieuwere
  const b = bs.lees(wortel);
  assert.equal(b.dag, '2020-06-01', 'de nieuwste bepaalt de stand');
  assert.equal(b.compleet, false, 'en die is leeg, dus niet compleet');
  assert.equal(b.bewaard, 2);
  assert.ok(b.ouderdom > 2000, 'de ouderdom wordt gerekend en niet aangenomen');
});

test('7. zonder .complete-marker is de dag nooit afgemaakt', () => {
  /* DIT STOND ER EERST NIET IN, en dat was een fout van dezelfde soort als het
     gat dat deze meter dicht: server/opzet/backup.js schrijft na afloop een
     `.complete` en wisselt de map dan pas atomisch naar zijn plek. Dat is het
     gezaghebbende "ik ben klaar" -- en er stond een eigen oordeel naast zonder
     dat het gelezen werd. Een tweede mening over hetzelfde is geen controle. */
  const b = bs.lees(huis({ leeft: GOED, kopie: GOED, marker: false }));
  assert.equal(b.er, true, 'de map staat er');
  assert.equal(b.compleet, false);
  assert.match(b.reden, /geen \.complete-marker/);
  assert.equal(b.gecontroleerd, 0, 'er wordt niet eens geteld: de map hoort er niet te zijn');

  const kapot = path.join(TMP, 'kapottemarker');
  fs.mkdirSync(path.join(kapot, 'backups', '2026-01-01'), { recursive: true });
  fs.writeFileSync(path.join(kapot, 'backups', '2026-01-01', '.complete'), '{niet');
  const k = bs.lees(kapot);
  assert.equal(k.compleet, false);
  assert.match(k.reden, /onleesbaar/);
});
