/* De blijvende naad tussen een SCIM-groepsmutatie en de Werk OS-rollen.

   Een create bestaat uit twee SQLite-feiten: de groep en de lijst mensen die
   nog door de tenantbrug moeten. Ze horen in EEN transactie. Een marker voor
   een groep die door validatie of uniqueness nooit ontstond, kan bij een later
   verzoek anders actuele rollen intrekken.

   De aparte create-retryrij onderscheidt een echte herhaling na onze 503 van
   een gewone dubbele POST. Alleen de eerste mag synchroniseren; een normale
   409 mag geen bijwerking hebben. */
'use strict';

const crypto = require('crypto');
const S = require('../accounts/state');
const { datum: klokDatum } = require('../lib/klok');

function zorgTabel(db) {
  const d = db || S.db;
  d.exec(`CREATE TABLE IF NOT EXISTS scim_groep_sync (
    org TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reden TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (org, user_id)
  )`);
  d.exec(`CREATE TABLE IF NOT EXISTS scim_groep_create_retry (
    org TEXT NOT NULL,
    groep_id INTEGER NOT NULL,
    vingerafdruk TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (org, groep_id)
  )`);
}

const idsVan = ids => [...new Set((ids || []).map(v => String(v || '').trim()).filter(Boolean))];

function markeer(org, ids, reden) {
  const q = S.db.prepare(`INSERT INTO scim_groep_sync (org, user_id, reden, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(org, user_id) DO UPDATE SET reden = excluded.reden`);
  const nu = klokDatum().toISOString();
  for (const id of idsVan(ids)) q.run(String(org), id, String(reden || '').slice(0, 120) || null, nu);
}

function wachtende(org) {
  return S.db.prepare('SELECT user_id FROM scim_groep_sync WHERE org = ? ORDER BY user_id')
    .all(String(org)).map(r => String(r.user_id));
}

function klaar(org, userId) {
  const o = String(org);
  S.db.prepare('DELETE FROM scim_groep_sync WHERE org = ? AND user_id = ?')
    .run(o, String(userId));
  /* Een SSO-inlog kan de laatste wachtende persoon herstellen zonder dat de
     IdP zijn POST herhaalt. Zodra niemand meer wacht, zijn ook alle create-
     retries van deze org afgerond; laat anders een toekomstige gewone
     duplicate ten onrechte als herstelverzoek lezen. */
  const over = S.db.prepare('SELECT 1 AS x FROM scim_groep_sync WHERE org = ? LIMIT 1').get(o);
  if (!over) S.db.prepare('DELETE FROM scim_groep_create_retry WHERE org = ?').run(o);
}

function vingerafdruk(naam, leden, externeId) {
  const vorm = JSON.stringify({ naam: String(naam || '').trim(),
    leden: idsVan(leden).sort(), externeId: externeId == null ? null : String(externeId) });
  return crypto.createHash('sha256').update(vorm).digest('hex');
}

/* `schrijfGroep` draait synchroon op dezelfde accounts-SQLite-handle en geeft
   het nieuwe id terug. Geen await binnen deze transactie: er bestaat dus geen
   venster waarin een ander verzoek op dezelfde verbinding ertussen komt. */
function maakAtomair(org, leden, afdruk, schrijfGroep) {
  S.db.exec('BEGIN IMMEDIATE');
  try {
    const id = Number(schrijfGroep());
    markeer(org, leden, 'groep gemaakt');
    S.db.prepare(`INSERT INTO scim_groep_create_retry
      (org, groep_id, vingerafdruk, created_at) VALUES (?, ?, ?, ?)`)
      .run(String(org), id, String(afdruk), klokDatum().toISOString());
    S.db.exec('COMMIT');
    return id;
  } catch (e) {
    try { S.db.exec('ROLLBACK'); } catch (_) {}
    throw e;
  }
}

function isCreateRetry(org, groepId, afdruk) {
  const r = S.db.prepare(`SELECT 1 AS x FROM scim_groep_create_retry
    WHERE org = ? AND groep_id = ? AND vingerafdruk = ?`)
    .get(String(org), Number(groepId), String(afdruk));
  return !!r;
}

function createKlaar(org, groepId) {
  S.db.prepare('DELETE FROM scim_groep_create_retry WHERE org = ? AND groep_id = ?')
    .run(String(org), Number(groepId));
}

module.exports = { zorgTabel, markeer, wachtende, klaar, vingerafdruk,
  maakAtomair, isCreateRetry, createKlaar };
