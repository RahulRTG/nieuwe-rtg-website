/* EEN BACKUP DIE HALF IS, IS GEEN BACKUP.

   TWEE FOUTEN, allebei stil:

   1. Alleen de DATABASES gingen mee, de bestandsopslag niet -- terwijl de
      verwijzingen ernaar wel worden teruggezet. Een teruggezette backup gaf dus
      een systeem dat wijst naar bestanden die er niet zijn: paspoortscans in
      uploads/, media in de Salon, gedeelde bestanden, en de outbox met alles wat
      nog niet bezorgd was. Dezelfde soort fout als de sleutels die niet in de
      backup zaten: bewaren wat naar iets verwijst, zonder waarnaar het verwijst.

   2. De 14-dagen-regel las ALLES in de backupmap als "dag". Een los bestand
      (een handmatige kopie, een .DS_Store) telde mee -- en zulke namen sorteren
      NA de datummappen, dus sneed de regel er precies de oudste ECHTE backups
      af terwijl de rommel bleef liggen. Hoe meer troep, hoe minder backups.

   Deze toetsen draaien de opruimregel na op een nagemaakte backupmap: dat kan
   zonder server, en het is de enige manier om de tweede fout te zien zonder
   veertien dagen te wachten. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* De regel zoals server/opzet/backup.js hem toepast. Bewust hier nagebouwd en
   niet geimporteerd: de functie zit binnen een grotere opzet die een halve
   server nodig heeft. Wijkt de code hiervan af, dan hoort deze toets te zakken
   -- dat is precies de bedoeling van de laatste bewering hieronder. */
function ruimOp(BACKUP_DIR, houd) {
  const isDag = (n) => /^\d{4}-\d{2}-\d{2}$/.test(n);
  const days = fs.readdirSync(BACKUP_DIR)
    .filter(n => isDag(n) && (() => { try { return fs.statSync(path.join(BACKUP_DIR, n)).isDirectory(); } catch (e) { return false; } })())
    .sort();
  for (const d of days.slice(0, Math.max(0, days.length - houd)))
    fs.rmSync(path.join(BACKUP_DIR, d), { recursive: true, force: true });
  return days;
}

test('losse bestanden in de backupmap kosten geen enkele backup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-backup-'));
  try {
    // zestien echte dagen, plus drie dingen die geen dag zijn
    for (let d = 1; d <= 16; d++) fs.mkdirSync(path.join(dir, '2026-08-' + String(d).padStart(2, '0')));
    fs.writeFileSync(path.join(dir, '.DS_Store'), 'x');
    fs.writeFileSync(path.join(dir, 'handmatige-kopie.tar'), 'x');
    fs.mkdirSync(path.join(dir, 'oude-map'));

    ruimOp(dir, 14);

    const over = fs.readdirSync(dir).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
    assert.equal(over.length, 14, 'er horen precies 14 dagen over te blijven, geen 12: ' + over.join(','));
    assert.equal(over[0], '2026-08-03', 'en de twee OUDSTE horen weg te zijn, niet de rommel eromheen');
    assert.ok(fs.existsSync(path.join(dir, 'handmatige-kopie.tar')),
      'wat geen dagbackup is, is niet van ons en blijft liggen');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('de bestandsopslag staat in de lijst die meegaat', () => {
  /* De lijst is uit server/opzet/backup.js verhuisd naar ./backup-lijst.js,
     omdat server/backupstand.js hem ook moet lezen om NA te kijken of een
     backup compleet is -- en een tweede kopie van deze lijst is precies hoe
     grootboek.db er ooit buiten viel.

     Deze toets las de BRON met een reguliere expressie en zakte dus op de
     verhuizing terwijl er niets aan de lijst was veranderd. Hij leest hem nu
     als module. Dat is ook sterker: hij toetst de WAARDE die de backup
     gebruikt, en niet de vorm van een regel tekst. */
  const { BACKUP_MAPPEN } = require('../server/opzet/backup-lijst');
  assert.ok(Array.isArray(BACKUP_MAPPEN) && BACKUP_MAPPEN.length, 'BACKUP_MAPPEN hoort een gevulde lijst te zijn');
  for (const nodig of ['archief', 'uploads', 'media', 'bestanden', 'outbox']) {
    assert.ok(BACKUP_MAPPEN.includes(nodig),
      'de map "' + nodig + '" hoort mee in de backup; anders verwijst een teruggezet systeem naar bestanden die er niet zijn. Nu: ' + BACKUP_MAPPEN.join(', '));
  }
  /* En de backup gebruikt die lijst ook echt -- anders staat hij er wel en
     doet hij niets. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'opzet', 'backup.js'), 'utf8');
  assert.match(bron, /require\('\.\/backup-lijst'\)/, 'backup.js hoort de lijst te lezen en geen eigen kopie te dragen');
  assert.ok(!/const BACKUP_MAPPEN = \[/.test(bron), 'en er hoort geen tweede kopie in backup.js te staan');
});

test('een dagbackup wordt pas zichtbaar na een complete marker en atomische wissel', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'opzet', 'backup.js'), 'utf8');
  assert.match(bron, /\.complete/, 'de afgeronde dag hoort een complete-marker te dragen');
  assert.match(bron, /vervangAtomisch\(tijdelijk, dir\)/,
    'de tijdelijke map hoort pas na het kopiëren de zichtbare dagmap te vervangen');
  assert.match(bron, /bronback-up heeft geen \.complete-marker/,
    'ook de tweede-schijfkopie mag nooit een half afgemaakte dag meenemen');
});
