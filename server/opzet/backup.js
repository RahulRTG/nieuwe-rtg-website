/* ============================================================================
   DE DAGELIJKSE BACK-UP.

   Stond in server/server.js. Dit is geen bedrading maar een taak op zichzelf --
   de enige plek waar dit huis besluit WAT er bij een herstart terug moet komen
   -- en dat hoort niet verstopt tussen de opstartregels van een bestand van
   tweehonderd kilobyte.

   Draait bij de start en daarna elke vierentwintig uur; het cluster roept hem
   ook aan direct na een overname (zie de cluster-route in server.js), want een
   server die net het roer heeft gekregen hoort niet een dag te wachten.

   WAT ERIN HOORT staat in ./backup-lijst.js, op EEN plek. Die
   opsomming stond ooit twee keer letterlijk in backupData -- een keer voor de
   lokale kopie en een keer voor RTG_BACKUP_DIR -- en er ontbraken drie dingen
   in de tweede. Die uitleg staat hieronder waar hij hoort.

   Alleen de LEIDER maakt de backup (db.leider): anders trekken drie servers
   tegelijk aan dezelfde bestanden. Dat was db.writable, en dat viel samen zolang
   er precies een schrijvende server was; in spreidingsmodus schrijven ze
   allemaal en is de leider een aparte vlag (server/db/state.js).
   ========================================================================== */
'use strict';

const klok = require('../lib/klok');

module.exports = function maakBackup(deps) {
  const { fs, path, DATA_DIR, db, accounts, checkpointSqlite, checkpointGrootboek } = deps;

  const BACKUP_DIR = path.join(DATA_DIR, 'backups');
  // De twee lijsten staan in ./backup-lijst.js; server/backupstand.js leest ze ook.
  const { BACKUP_BESTANDEN, BACKUP_MAPPEN } = require('./backup-lijst');

  /* Een map kopieren, plat en zonder verrassingen: alleen gewone bestanden, een
     niveau diep per submap. Het archief is een map met maandbestanden, geen boom
     van symlinks, dus dit is genoeg -- en het weigert netjes wat het niet kent
     in plaats van er iets van te maken. */
  function kopieerMap(van, naar) {
    let namen;
    try { namen = fs.readdirSync(van, { withFileTypes: true }); }
    catch (e) { if (e && e.code === 'ENOENT') return 0; throw e; }
    fs.mkdirSync(naar, { recursive: true, mode: 0o700 });
    let aantal = 0;
    for (const d of namen) {
      const bron = path.join(van, d.name), doel = path.join(naar, d.name);
      if (d.isDirectory()) aantal += kopieerMap(bron, doel);
      else if (d.isFile()) {
        fs.copyFileSync(bron, doel);
        try { fs.chmodSync(doel, 0o600); } catch (e) {}
        aantal++;
      }
    }
    return aantal;
  }

  /* Een dagmap wordt pas zichtbaar als alles erin staat. Vroeger schreef de
     server rechtstreeks naar backups/2026-08-14; een sidecar of beheerder kon
     die map midden in het kopiëren pakken en hield dan een keurige maar halve
     back-up over. De .complete-marker en de rename maken "bestaat" nu gelijk
     aan "afgerond". */
  function vervangAtomisch(tijdelijk, doel) {
    const oud = doel + '.vorige';
    // Herstel eerst een onderbroken wissel van een vorige procescrash.
    if (!fs.existsSync(doel) && fs.existsSync(oud)) fs.renameSync(oud, doel);
    fs.rmSync(oud, { recursive: true, force: true });
    if (fs.existsSync(doel)) fs.renameSync(doel, oud);
    try {
      fs.renameSync(tijdelijk, doel);
      fs.rmSync(oud, { recursive: true, force: true });
    } catch (e) {
      if (!fs.existsSync(doel) && fs.existsSync(oud)) fs.renameSync(oud, doel);
      throw e;
    }
  }

  function vulDagmap(dir, day) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    let aantal = 0;
    for (const f of BACKUP_BESTANDEN) {
      const from = path.join(DATA_DIR, f);
      if (fs.existsSync(from)) {
        const doel = path.join(dir, f);
        fs.copyFileSync(from, doel);
        try { fs.chmodSync(doel, 0o600); } catch (e) {}
        aantal++;
      }
    }
    for (const m of BACKUP_MAPPEN) aantal += kopieerMap(path.join(DATA_DIR, m), path.join(dir, m));
    if (!aantal) throw new Error('geen enkel databestand gevonden; lege back-up wordt geweigerd');
    fs.writeFileSync(path.join(dir, '.complete'), JSON.stringify({ dag: day, klaar: klok.datum().toISOString(), bestanden: aantal }) + '\n', { mode: 0o600 });
  }

  function kopieerVoltooideDag(bron, basis, day) {
    fs.mkdirSync(basis, { recursive: true, mode: 0o700 });
    const tijdelijk = path.join(basis, '.' + day + '-' + process.pid + '-' + klok.nu());
    const doel = path.join(basis, day);
    fs.rmSync(tijdelijk, { recursive: true, force: true });
    try {
      kopieerMap(bron, tijdelijk);
      if (!fs.existsSync(path.join(tijdelijk, '.complete')))
        throw new Error('bronback-up heeft geen .complete-marker');
      vervangAtomisch(tijdelijk, doel);
    } catch (e) {
      fs.rmSync(tijdelijk, { recursive: true, force: true });
      throw e;
    }
  }

  function backupData() {
    if (!db.leider) return; // alleen de leider maakt backups; standby en meelopende servers niet
    try {
      /* EERST de WAL leegdrukken, dan pas kopieren.

         SQLite draait hier in WAL-modus: verse gegevens staan NIET in rtg.db of
         store.db maar in het bijbehorende -wal-bestand, tot een checkpoint ze
         overhevelt. Zonder deze twee regels kopieerde de backup dus bestanden
         zonder de recentste data -- en op een verse installatie letterlijk twee
         lege bestanden van 4 KB, terwijl alles in een WAL van megabytes stond.
         De backup zag er elke nacht keurig uit en was leeg. Gevonden met
         test/herstelproef.test.js, die de hele ronde echt doorloopt. */
      try { accounts.checkpoint(); } catch (e) {}
      try { checkpointSqlite(); } catch (e) {}
      // en het transactiegrootboek, dat een EIGEN sqlite-bestand met eigen WAL is
      try { checkpointGrootboek(); } catch (e) {}

      const day = klok.datum().toISOString().slice(0, 10);
      fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
      const tijdelijk = path.join(BACKUP_DIR, '.' + day + '-' + process.pid + '-' + klok.nu());
      const dir = path.join(BACKUP_DIR, day);
      fs.rmSync(tijdelijk, { recursive: true, force: true });
      /* De -wal-bestanden gaan mee als vangnet: lukt het checkpointen niet omdat
         een ander proces nog leest, dan is de kopie samen met zijn WAL alsnog
         compleet. SQLite leest een database met bijbehorende -wal gewoon uit. */
      try {
        vulDagmap(tijdelijk, day);
        vervangAtomisch(tijdelijk, dir);
      } catch (e) {
        fs.rmSync(tijdelijk, { recursive: true, force: true });
        throw e;
      }
      /* Hooguit 14 dagen bewaren -- en dan ook echt alleen DAGEN.

         Hier stond `fs.readdirSync(BACKUP_DIR).sort()` over ALLES wat er lag.
         Ligt er iets anders in die map (een los bestand, een handmatige kopie,
         een .DS_Store), dan telde dat mee als "dag". Erger: zulke namen sorteren
         NA de datummappen, dus `slice(0, lengte - 14)` sneed er precies de
         oudste ECHTE backups af terwijl de rommel bleef staan. Hoe meer troep,
         hoe minder backups -- en niets zei dat.

         Een datummap herkennen we aan zijn vorm, en we kijken of het een map is.
         Wat daar niet aan voldoet telt niet mee en wordt ook niet weggegooid:
         het is niet van ons. */
      const isDag = (n) => /^\d{4}-\d{2}-\d{2}$/.test(n);
      const days = fs.readdirSync(BACKUP_DIR)
        .filter(n => isDag(n) && (() => { try { return fs.statSync(path.join(BACKUP_DIR, n)).isDirectory(); } catch (e) { return false; } })())
        .sort();
      for (const d of days.slice(0, Math.max(0, days.length - 14)))
        fs.rmSync(path.join(BACKUP_DIR, d), { recursive: true, force: true });
      // extra kopie naar een tweede schijf/mount (RTG_BACKUP_DIR), zodat een
      // backup ook een crash van de app-schijf overleeft.
      if (process.env.RTG_BACKUP_DIR) {
        const offBasis = path.resolve(process.env.RTG_BACKUP_DIR);
        if (offBasis === path.resolve(BACKUP_DIR))
          throw new Error('RTG_BACKUP_DIR wijst naar de lokale backupmap; een tweede kopie moet elders staan');
        kopieerVoltooideDag(dir, offBasis, day);
      }
    } catch (e) { console.warn('[backup] mislukt:', e.message); }
  }

  return { backupData, BACKUP_DIR, BACKUP_BESTANDEN, BACKUP_MAPPEN };
};
