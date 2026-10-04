'use strict';
/* Opslagdowngrade, uitsluitend met gestopte schrijvers. De oude release leest
   KV; materialiseer daarom dezelfde bytes/volgorde voordat hij weer start.
   Tijdens rijbedrijf kan een oude schrijver niet stil een tweede waarheid maken. */
function bewaak(kv) {
  for (const event of ['INSERT', 'UPDATE']) kv.exec(`CREATE TRIGGER IF NOT EXISTS audit_geen_kv_${event.toLowerCase()}
    BEFORE ${event} ON kv WHEN EXISTS (SELECT 1 FROM audit_meta WHERE naam=NEW.key)
    BEGIN SELECT RAISE(ABORT, 'Auditrijopslag actief; stop oude schrijvers.'); END`);
}
function materialiseer(kv, kluis) {
  if (!kv.prepare("SELECT 1 FROM sqlite_master WHERE name='audit_meta'").get()) return { collecties: 0, regels: 0 };
  kv.exec('BEGIN IMMEDIATE');
  try {
    const metas = kv.prepare('SELECT * FROM audit_meta ORDER BY naam').all();
    for (const event of ['insert', 'update']) kv.exec('DROP TRIGGER IF EXISTS audit_geen_kv_' + event);
    const zet = kv.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET val=excluded.val,ver=excluded.ver');
    const lees = kv.prepare('SELECT waarde FROM audit_rij WHERE naam=? ORDER BY nr');
    let regels = 0;
    for (const m of metas) {
      const vorm = require('./audit-vorm'); vorm.eis(m.naam);
      const lijst = lees.all(m.naam).map(r => JSON.parse(kluis.ontsleutel(r.waarde)));
      regels += lijst.length;
      if (vorm.eis(m.naam).omgekeerd) lijst.reverse();
      const waarde = vorm.pak(m.naam, lijst, m.totaal, JSON.parse(kluis.ontsleutel(m.extra)));
      kv.exec("UPDATE meta SET v=v+1 WHERE k='ver'");
      const versie = kv.prepare("SELECT v FROM meta WHERE k='ver'").get().v;
      zet.run(m.naam, kluis.versleutel(JSON.stringify(waarde)), versie);
    }
    kv.exec('DROP TABLE audit_rij'); kv.exec('DROP TABLE audit_meta');
    kv.exec('COMMIT');
    return { collecties: metas.length, regels };
  } catch (e) { try { kv.exec('ROLLBACK'); } catch (x) {} throw e; }
}
module.exports = { bewaak, materialiseer };
