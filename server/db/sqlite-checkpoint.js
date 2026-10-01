'use strict';
/* WAL en afsluiten vormen samen de grens na de transactionele schrijver.
   De verbinding wordt pas bij gebruik gelezen: een nooit geopende opslag
   blijft ongemoeid. Backups moeten ook nog gewijzigde RAM bewaren. */
module.exports = ({ verbinding, saveSqlite }) => {
  function vouwWalSqlite() {
    if (!verbinding()) return false;
    try {
      const r = verbinding().prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
      return r?.busy === 0 && Number.isInteger(r.log) && Number.isInteger(r.checkpointed)
        && r.log >= 0 && r.checkpointed === r.log;
    }
    catch (e) { return false; } // andere lezer: de backup neemt de WAL mee
  }

  function checkpointSqlite() {
    if (!verbinding()) return false;
    try { saveSqlite(true); } catch (e) {}
    return vouwWalSqlite();
  }

  function afrondSqlite() {
    if (!verbinding()) return;
    try { saveSqlite(true); }
    catch (e) { console.warn('[db] laatste sqlite-save mislukt:', e.message); }
    vouwWalSqlite();
  }

  return { checkpointSqlite, vouwWalSqlite, afrondSqlite };
};
