/* WAT ER IN EEN BACKUP HOORT -- OP EEN PLEK, EN NU OOK BUITEN DE BACKUP.

   Deze twee lijsten stonden in ./backup.js, binnen de fabrieksfunctie. Ze zijn
   hierheen gegaan toen server/backupstand.js ze nodig had om NA te kijken of
   een backup compleet is: dat bestand heeft geen fs, db of accounts en kan de
   fabriek dus niet optuigen. Ze daar opnieuw intypen zou precies de fout zijn
   die hieronder beschreven staat.
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
/* 'journaal' hoort hier sinds het doorgeefjournaal uit de database is gehaald
   (24 augustus 2026). Zolang het een collectie was, ging het vanzelf mee in
   store.db; als bestand doet het dat niet. Dit is letterlijk de fout die
   hierboven beschreven staat bij grootboek.db en papieren.json -- iets verhuist
   naar buiten de database en valt daarmee stilzwijgend uit de backup. */
const BACKUP_MAPPEN = ['archief', 'uploads', 'media', 'bestanden', 'outbox', 'journaal'];

module.exports = { BACKUP_BESTANDEN, BACKUP_MAPPEN };
