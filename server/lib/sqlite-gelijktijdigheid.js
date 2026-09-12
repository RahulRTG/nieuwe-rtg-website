'use strict';

/* De opstartinstellingen gelden voor elke SQLite-verbinding. busy_timeout
   wordt bij een mogelijke deadlock overgeslagen door SQLite; daarom wordt
   alleen de WAL-omschakeling begrensd herhaald. Er draait hier nog geen
   applicatietransactie of HTTP-server.
   https://www.sqlite.org/c3ref/busy_handler.html */
module.exports = function zetGelijktijdigheid(db) {
  db.exec('PRAGMA busy_timeout=5000');
  const tot = Date.now() + 5000;
  for (;;) {
    try {
      const stand = db.prepare('PRAGMA journal_mode').get();
      if (String(stand.journal_mode).toLowerCase() !== 'wal') db.exec('PRAGMA journal_mode=WAL');
      break;
    } catch (e) {
      const bezet = e.code === 'ERR_SQLITE_ERROR' && [5, 6].includes(e.errcode & 255);
      if (!bezet || Date.now() >= tot) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  db.exec('PRAGMA synchronous=NORMAL');
};
