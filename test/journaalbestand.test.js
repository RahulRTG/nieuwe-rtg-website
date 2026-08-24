/* HET JOURNAAL OP SCHIJF (server/kern/journaalbestand.js).

   Het doorgeefjournaal woonde in db.data.doorgeefjournaal: één array van 20.000
   regels, dus één blob in één rij van de opslag. Elke save() ergens in de
   applicatie serialiseerde die hele lijst opnieuw om er één regel bij te zetten.
   Gemeten kostte dat gemiddeld 32,9 ms per save met een piek van 101 ms,
   synchroon op de event-loop.

   Het staat nu in een bestand waar achteraan geschreven wordt. Deze toets legt
   vast wat daarbij niet mag sneuvelen -- en dat is meer dan "het schrijft":

   1. wat erin gaat komt er in dezelfde volgorde weer uit;
   2. het bestand roteert en de schijf blijft begrensd;
   3. een geroteerd bestand blijft leesbaar (rotatie is geen weggooien);
   4. een verminkte regel wordt OVERGESLAGEN en niet gegooid -- een halve regel
      na een stroomstoring mag het hele journaal niet onleesbaar maken;
   5. met een sleutel staat er cijfertekst op schijf, en is het toch te lezen;
   6. de rechten zijn besloten (map 0700, bestand 0600), want er staan codenamen
      en paden in;
   7. een bestaande installatie raakt zijn geschiedenis niet kwijt bij het
      bijwerken -- de oude collectie verhuist en verdwijnt daarna;
   8. het journaal staat in de backuplijst. Dat is geen detail: server/opzet/
      backup-lijst.js bestaat juist omdat grootboek.db en papieren.json ooit
      buiten de backup vielen door precies deze verhuizing-naar-buiten-de-
      database.

   Draai los: node --test test/journaalbestand.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { maakJournaalbestand } = require('../server/kern/journaalbestand.js');

/* De mappen worden aan het EIND opgeruimd, met EEN hook die hier bovenaan staat.
   Een test.after() registreren VANUIT een lopende test laat de runner hangen --
   geen foutmelding, geen uitvoer, hij staat er alleen maar. Dat kostte hier een
   half uur om te vinden, dus het staat opgeschreven. */
const mappen = [];
function verseMap() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-journaal-'));
  mappen.push(d);
  return d;
}
test.after(() => { for (const d of mappen) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} } });
const regel = (i) => ({ t: '2026-08-24T00:00:00.000Z', richting: 'in', wat: '/api/x' + i, nr: i, mislukt: false });

test('1. wat erin gaat komt er in dezelfde volgorde weer uit', () => {
  const map = verseMap();
  const b = maakJournaalbestand({ dir: map });
  for (let i = 0; i < 50; i++) b.noteerRegel(regel(i));
  b.spoelNu();
  const uit = b.lees(1000);
  assert.equal(uit.length, 50);
  assert.deepEqual(uit.map(r => r.nr), Array.from({ length: 50 }, (_, i) => i), 'oudste eerst');
  assert.equal(b.aantal(), 50);
});

test('2. de laatste N regels, ook als er meer staan', () => {
  const map = verseMap();
  const b = maakJournaalbestand({ dir: map });
  for (let i = 0; i < 200; i++) b.noteerRegel(regel(i));
  b.spoelNu();
  const uit = b.lees(5);
  assert.deepEqual(uit.map(r => r.nr), [195, 196, 197, 198, 199], 'de NIEUWSTE vijf, oudste eerst');
});

test('3. het bestand roteert, en een geroteerd bestand blijft leesbaar', () => {
  const map = verseMap();
  /* maxBestanden staat hier RUIM, want deze toets gaat over "rotatie is geen
     weggooien". Het snoeien tot een begrensd aantal is een andere belofte en
     staat in de volgende toets; ze in een proef mengen maakt allebei onduidelijk. */
  const b = maakJournaalbestand({ dir: map, maxBytes: 1500, maxBestanden: 100 });
  for (let i = 0; i < 200; i++) { b.noteerRegel(regel(i)); b.spoelNu(); }
  const geroteerd = fs.readdirSync(map).filter(n => /^\d{13}\.log$/.test(n));
  assert.ok(geroteerd.length >= 1, 'er is geroteerd (' + geroteerd.length + ' bestanden)');
  /* De kern van deze toets: rotatie mag geen weggooien zijn. De oudste regel
     staat in een geroteerd bestand en moet er nog steeds uit komen. */
  const alles = b.lees(1000);
  assert.equal(alles.length, 200, 'alle 200 regels zijn nog te lezen, over de bestanden heen');
  assert.equal(alles[0].nr, 0, 'ook de allereerste, die in een geroteerd bestand staat');
});

test('4. de schijf blijft begrensd: nooit meer dan het afgesproken aantal bestanden', () => {
  const map = verseMap();
  const b = maakJournaalbestand({ dir: map, maxBytes: 800, maxBestanden: 3 });
  for (let i = 0; i < 400; i++) { b.noteerRegel(regel(i)); b.spoelNu(); }
  const geroteerd = fs.readdirSync(map).filter(n => /^\d{13}\.log$/.test(n));
  assert.ok(geroteerd.length <= 3, 'hooguit 3 geroteerde bestanden, gevonden: ' + geroteerd.length);
  assert.ok(b.lees(10).length > 0, 'en er is nog steeds iets te lezen');
});

test('5. een VERMINKTE regel wordt overgeslagen, niet gegooid', () => {
  /* Een stroomstoring midden in een schrijfactie laat een halve regel achter.
     Als het lezen daarop gooit, is het hele journaal onleesbaar -- precies op
     het moment dat je het nodig hebt. */
  const map = verseMap();
  const b = maakJournaalbestand({ dir: map });
  b.noteerRegel(regel(1)); b.noteerRegel(regel(2));
  b.spoelNu();
  fs.appendFileSync(path.join(map, 'huidig.log'), '{"t":"halve reg');   // afgekapt
  const b2 = maakJournaalbestand({ dir: map });
  const uit = b2.lees(100);
  assert.deepEqual(uit.map(r => r.nr), [1, 2], 'de gave regels komen er gewoon uit');
  assert.equal(b2.stand().overgeslagen, 1, 'en de verminkte is geteld, niet verzwegen');
});

test('6. met een sleutel staat er cijfertekst op schijf, en is het toch te lezen', () => {
  const map = verseMap();
  const oud = process.env.RTG_ENC_KEY;
  process.env.RTG_ENC_KEY = 'a'.repeat(64);
  /* De HELE journaalgroep uit de cache, niet alleen het hoofdbestand: de kluis
     wordt ook door ./journaallezen.js vastgehouden, en een lezer die nog de oude
     (sleutelloze) kluis draagt kan niet ontsleutelen wat de schrijver versleutelde.
     Dat brak deze toets precies op het moment dat lezen een eigen module werd. */
  const versKern = () => {
    for (const k of Object.keys(require.cache))
      if (/server[\/\\](kluis|kern[\/\\]journaal)/.test(k)) delete require.cache[k];
  };
  versKern();
  try {
    const mod = require('../server/kern/journaalbestand.js');
    const b = mod.maakJournaalbestand({ dir: map });
    b.noteerRegel({ wat: '/api/geheim', wie: 'codenaam-42' });
    b.spoelNu();
    const rauw = fs.readFileSync(path.join(map, 'huidig.log'), 'utf8');
    assert.ok(!rauw.includes('/api/geheim'), 'het pad staat NIET leesbaar op schijf');
    assert.ok(!rauw.includes('codenaam-42'), 'de codenaam ook niet');
    assert.match(rauw, /^RTGENC1:/, 'het is versleuteld met de bekende kop');
    assert.equal(b.lees(10)[0].wat, '/api/geheim', 'en het is gewoon terug te lezen');
  } finally {
    if (oud === undefined) delete process.env.RTG_ENC_KEY; else process.env.RTG_ENC_KEY = oud;
    versKern();
  }
});

test('7. de rechten zijn besloten: map 0700, bestand 0600 -- op BEIDE schrijfwegen', async () => {
  /* Er staan paden en codenamen in. Dezelfde regel als voor de rest van de
     datamap (zie server/db/opslag.js).

     BEIDE WEGEN, en dat is niet overdreven. Deze toets keek eerst alleen naar
     spoelNu() -- de synchrone weg, die alleen bij het afsluiten wordt gebruikt.
     De weg die in bedrijf ELKE regel schrijft is de asynchrone spoeling, en die
     stond er niet in: een mutatie die daar 0o644 van maakte, kwam er ongemerkt
     doorheen. Een toets die de zeldzame weg dekt en de normale niet, meet het
     verkeerde ding. */
  const sync = verseMap();
  const a = maakJournaalbestand({ dir: sync });
  a.noteerRegel(regel(1)); a.spoelNu();
  assert.equal(fs.statSync(sync).mode & 0o777, 0o700, 'de map is alleen voor de eigenaar');
  assert.equal(fs.statSync(path.join(sync, 'huidig.log')).mode & 0o777, 0o600,
    'bestand via de synchrone spoeling (afsluiten)');

  const asyncMap = verseMap();
  const b = maakJournaalbestand({ dir: asyncMap, vensterMs: 10 });
  b.noteerRegel(regel(1));
  const pad = path.join(asyncMap, 'huidig.log');
  for (let i = 0; i < 100 && !fs.existsSync(pad); i++) await new Promise(r => setTimeout(r, 20));
  assert.ok(fs.existsSync(pad), 'de asynchrone spoeling heeft geschreven');
  assert.equal(fs.statSync(asyncMap).mode & 0o777, 0o700, 'de map ook op deze weg');
  assert.equal(fs.statSync(pad).mode & 0o777, 0o600,
    'bestand via de asynchrone spoeling -- de weg die in bedrijf elke regel schrijft');
});

test('8. een bestaande installatie raakt zijn geschiedenis NIET kwijt', () => {
  /* Zonder verhuizing zou het bijwerken de bewaarde regels stil laten
     verdwijnen -- en niemand kijkt elke dag in het journaal, dus dat zou pas
     opvallen als je het nodig had. */
  const map = verseMap();
  const boek = maakJournaalbestand({ dir: map });
  const db = { data: { doorgeefjournaal: [regel(1), regel(2), regel(3)] } };
  let bewaard = 0;
  const { maakDoorgeefjournaal } = require('../server/kern/doorgeefjournaal.js');
  maakDoorgeefjournaal({ db, save: () => { bewaard++; }, bestand: boek });
  assert.equal(db.data.doorgeefjournaal, undefined, 'de oude collectie is weg uit de database');
  assert.ok(bewaard > 0, 'en dat is ook opgeslagen');
  assert.deepEqual(boek.lees(10).map(r => r.nr), [1, 2, 3], 'de drie regels staan in het bestand');
});

test('9. het journaal staat in de backuplijst', () => {
  /* server/opzet/backup-lijst.js bestaat omdat grootboek.db en papieren.json
     ooit buiten de backup vielen: iets verhuist naar buiten de database en valt
     stilzwijgend uit de backup. Het journaal is precies zo'n verhuizing. */
  const { BACKUP_MAPPEN } = require('../server/opzet/backup-lijst.js');
  assert.ok(BACKUP_MAPPEN.includes('journaal'),
    'de journaalmap hoort in de backup, anders is de geschiedenis na een herstel weg');
});

test('10. een journaal dat niet kan schrijven raakt het verzoek niet', () => {
  /* Een logboek dat de server omtrekt is zelf de storing geworden. */
  /* /dev/null is een BESTAND, dus er kan geen map onder: mkdir geeft netjes
     ENOTDIR. (Een pad onder /proc leek logischer maar laat mkdirSync in deze
     omgeving zelf hangen -- een onbruikbare proef, geen strengere.) */
  const b = maakJournaalbestand({ dir: '/dev/null/onmogelijk' });
  assert.doesNotThrow(() => { b.noteerRegel(regel(1)); b.spoelNu(); }, 'schrijven gooit nooit');
  assert.doesNotThrow(() => b.lees(10), 'lezen ook niet');
  assert.deepEqual(b.lees(10), [], 'en het levert gewoon niets op');
});

test('11. een MISLUKTE verhuizing gooit de oude collectie NIET weg', () => {
  /* De verhuizing schreef eerst weg en verwijderde daarna, zonder naar de
     uitkomst te kijken. Een volle schijf of een onschrijfbare map maakte er
     daarmee een VERWIJDERING van: weg uit de database, nooit in het bestand, en
     niets dat erover klaagde. Precies de storing waar dit journaal voor bestaat.

     De regel is: eerst bewijzen dat het geschreven is, dan pas weggooien. Dubbel
     werk bij de volgende start is niet erg; de geschiedenis kwijt wel. */
  const boek = maakJournaalbestand({ dir: '/dev/null/onmogelijk' });
  const db = { data: { doorgeefjournaal: [regel(1), regel(2), regel(3)] } };
  const { maakDoorgeefjournaal } = require('../server/kern/doorgeefjournaal.js');
  maakDoorgeefjournaal({ db, save: () => {}, bestand: boek });
  assert.ok(Array.isArray(db.data.doorgeefjournaal), 'de oude collectie staat er nog');
  assert.equal(db.data.doorgeefjournaal.length, 3, 'compleet, met alle drie de regels');
});
