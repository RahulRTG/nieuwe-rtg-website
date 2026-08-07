/* ============================================================================
   DE DAGELIJKSE BACK-UP.

   Stond in server/server.js. Dit is geen bedrading maar een taak op zichzelf --
   de enige plek waar dit huis besluit WAT er bij een herstart terug moet komen
   -- en dat hoort niet verstopt tussen de opstartregels van een bestand van
   tweehonderd kilobyte.

   Draait bij de start en daarna elke vierentwintig uur; het cluster roept hem
   ook aan direct na een overname (zie de cluster-route in server.js), want een
   server die net het roer heeft gekregen hoort niet een dag te wachten.

   WAT ERIN HOORT staat in BACKUP_BESTANDEN en BACKUP_MAPPEN, op EEN plek. Die
   opsomming stond ooit twee keer letterlijk in backupData -- een keer voor de
   lokale kopie en een keer voor RTG_BACKUP_DIR -- en er ontbraken drie dingen
   in de tweede. Die uitleg staat hieronder waar hij hoort.

   Standby-servers slaan de backup over (db.writable): anders trekken drie
   servers tegelijk aan dezelfde bestanden.
   ========================================================================== */
'use strict';

module.exports = function maakBackup(deps) {
  const { fs, path, DATA_DIR, db, accounts, checkpointSqlite, checkpointGrootboek } = deps;

  const BACKUP_DIR = path.join(DATA_DIR, 'backups');
  /* WAT ER IN EEN BACKUP HOORT -- OP EEN PLEK.

     Deze opsomming stond twee keer letterlijk in backupData (een keer voor de
     lokale kopie, een keer voor RTG_BACKUP_DIR), en er ontbraken drie dingen die
     er alle drie in horen:

     - grootboek.db: het transactiegrootboek (db/tx/sqliteachter.js) is een EIGEN
       sqlite-bestand, niet store.db. In de standaardopslag liggen daar de
       bestellingen en boekingen in. Die stonden dus in geen enkele backup.
     - archief/: alles wat buiten het RAM-venster is geveegd (archief.js). Juist
       de oudste gegevens -- de enige die je niet meer uit het geheugen kunt
       halen -- werden niet bewaard.
     - papieren.json: het datalek-belschema en de AVG-antwoorden. Dat bestand
       staat bewust buiten de database EN in .gitignore, dus een backup was de
       enige plek waar het kon overleven. Sinds de eigenaar het in de boardroom
       invult, is dat geen theorie meer.

     Twee lijsten van hetzelfde lopen uiteen zodra iemand er een aanraakt; dat is
     precies hoe grootboek.db erbuiten kon vallen. Vandaar een. */
  const BACKUP_BESTANDEN = ['db.json', 'rtg.db', 'rtg.db-wal', 'store.db', 'store.db-wal',
    'grootboek.db', 'grootboek.db-wal', 'papieren.json'];
  /* DE BESTANDSOPSLAG HOORT ER OOK BIJ.

     Hier stond alleen 'archief'. De database ging mee, de BESTANDEN niet -- en
     de verwijzingen ernaar wel. Een teruggezette backup gaf dus een systeem dat
     naar bestanden wijst die er niet zijn: paspoortscans, media in de Salon,
     gedeelde bestanden, en de outbox met alles wat nog niet bezorgd was.

     Dit is dezelfde soort fout als de sleutels die niet in de backup zaten:
     bewaren wat naar iets verwijst, zonder te bewaren waarnaar het verwijst.

     'uploads' draagt ook de identiteitsscans, dus deze mappen staan met dezelfde
     rechten (0700/0600) in de backup als daarbuiten -- zie kopieerMap. */
  const BACKUP_MAPPEN = ['archief', 'uploads', 'media', 'bestanden', 'outbox'];

  /* Een map kopieren, plat en zonder verrassingen: alleen gewone bestanden, een
     niveau diep per submap. Het archief is een map met maandbestanden, geen boom
     van symlinks, dus dit is genoeg -- en het weigert netjes wat het niet kent
     in plaats van er iets van te maken. */
  function kopieerMap(van, naar) {
    let namen;
    try { namen = fs.readdirSync(van, { withFileTypes: true }); } catch (e) { return; }
    try { fs.mkdirSync(naar, { recursive: true, mode: 0o700 }); } catch (e) {}
    for (const d of namen) {
      const bron = path.join(van, d.name), doel = path.join(naar, d.name);
      try {
        if (d.isDirectory()) kopieerMap(bron, doel);
        else if (d.isFile()) { fs.copyFileSync(bron, doel); try { fs.chmodSync(doel, 0o600); } catch (e) {} }
      } catch (e) { /* een enkel bestand mag de rest van de backup niet ophouden */ }
    }
  }

  function backupData() {
    if (!db.writable) return; // standby-servers maken geen backups, dat doet de actieve
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

      const day = new Date().toISOString().slice(0, 10);
      const dir = path.join(BACKUP_DIR, day);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      try { fs.chmodSync(dir, 0o700); } catch (e) {}
      /* De -wal-bestanden gaan mee als vangnet: lukt het checkpointen niet omdat
         een ander proces nog leest, dan is de kopie samen met zijn WAL alsnog
         compleet. SQLite leest een database met bijbehorende -wal gewoon uit. */
      for (const f of BACKUP_BESTANDEN) {
        const from = path.join(DATA_DIR, f);
        if (fs.existsSync(from)) { const doel = path.join(dir, f); fs.copyFileSync(from, doel); try { fs.chmodSync(doel, 0o600); } catch (e) {} }
      }
      for (const m of BACKUP_MAPPEN) kopieerMap(path.join(DATA_DIR, m), path.join(dir, m));
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
        const off = path.join(process.env.RTG_BACKUP_DIR, day);
        fs.mkdirSync(off, { recursive: true });
        for (const f of BACKUP_BESTANDEN) {
          const from = path.join(DATA_DIR, f);
          if (fs.existsSync(from)) fs.copyFileSync(from, path.join(off, f));
        }
        for (const m of BACKUP_MAPPEN) kopieerMap(path.join(DATA_DIR, m), path.join(off, m));
      }
    } catch (e) { console.warn('[backup] mislukt:', e.message); }
  }

  return { backupData, BACKUP_DIR };
};
