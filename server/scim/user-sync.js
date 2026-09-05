/* Duurzame SCIM-intrekking voor een persoon.

   Het RTG-account en de herstelopdracht worden in dezelfde SQLite-transactie
   dichtgezet. Werk OS wordt daarna direct bijgewerkt. Lukt die tweede opslag
   niet, dan blijft de opdracht staan en blokkeert de centrale liddeur het
   gekoppelde lid-token totdat een herstelronde de cascade heeft bevestigd. */
'use strict';

const crypto = require('crypto');
const S = require('../accounts/state');

const HERSTEL_MS = 15000;
const CLAIM_MS = 30000;
let schemaDb = null;

function zorgTabel(db) {
  const d = db || S.db;
  if (!d) throw new Error('accounts-database niet beschikbaar');
  if (schemaDb === d) return;
  d.exec(`CREATE TABLE IF NOT EXISTS scim_user_deprovision (
    org TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_at INTEGER NOT NULL DEFAULT 0,
    claim_token TEXT,
    claim_until INTEGER,
    last_error TEXT,
    PRIMARY KEY (org, user_id)
  )`);
  d.exec('CREATE INDEX IF NOT EXISTS idx_scim_user_deprovision_due ON scim_user_deprovision(next_at, claim_until)');
  schemaDb = d;
}

function markeer(db, org, userId, nu) {
  const iso = new Date(nu).toISOString();
  db.prepare(`INSERT INTO scim_user_deprovision
    (org, user_id, created_at, updated_at, next_at, claim_token, claim_until, last_error)
    VALUES (?, ?, ?, ?, 0, NULL, NULL, NULL)
    ON CONFLICT(org, user_id) DO UPDATE SET
      updated_at = excluded.updated_at, next_at = 0,
      claim_token = NULL, claim_until = NULL, last_error = NULL`)
    .run(String(org), String(userId), iso, iso);
}

function klaar(org, userId) {
  zorgTabel();
  S.db.prepare('DELETE FROM scim_user_deprovision WHERE org = ? AND user_id = ?')
    .run(String(org), String(userId));
}

function geblokkeerd(rtgKey, env) {
  const m = /^user-(\d+)$/.exec(String(rtgKey || ''));
  if (!m) return false;
  try {
    zorgTabel();
    return !!S.db.prepare('SELECT 1 AS x FROM scim_user_deprovision WHERE user_id = ? LIMIT 1').get(m[1]);
  } catch (_) {
    /* Zonder de intrekkingswaarheid mag productie een gekoppeld bedrijfstoken
       niet goedkeuren. Tests en losse ontwikkelschermen hebben vaak bewust
       geen accounts-database. */
    return String((env || process.env).NODE_ENV || '') === 'production';
  }
}

function pak(db, nu, limiet) {
  const token = crypto.randomUUID();
  const tot = nu + CLAIM_MS;
  db.exec('BEGIN IMMEDIATE');
  try {
    const ids = db.prepare(`SELECT org, user_id FROM scim_user_deprovision
      WHERE next_at <= ? AND (claim_until IS NULL OR claim_until < ?)
      ORDER BY created_at LIMIT ?`).all(nu, nu, limiet || 25);
    const neem = db.prepare(`UPDATE scim_user_deprovision
      SET claim_token = ?, claim_until = ?, updated_at = ?
      WHERE org = ? AND user_id = ?`);
    const iso = new Date(nu).toISOString();
    for (const r of ids) neem.run(token, tot, iso, r.org, r.user_id);
    db.exec('COMMIT');
    return ids.map(r => ({ org: String(r.org), userId: String(r.user_id), token }));
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw e;
  }
}

function fout(db, taak, oorzaak, nu) {
  const rij = db.prepare('SELECT attempts FROM scim_user_deprovision WHERE org = ? AND user_id = ?')
    .get(taak.org, taak.userId);
  if (!rij) return;
  const pogingen = Number(rij.attempts || 0) + 1;
  const wacht = Math.min(5 * 60000, 5000 * Math.pow(2, Math.min(pogingen, 6)));
  db.prepare(`UPDATE scim_user_deprovision SET attempts = ?, next_at = ?,
    claim_token = NULL, claim_until = NULL, last_error = ?, updated_at = ?
    WHERE org = ? AND user_id = ? AND claim_token = ?`)
    .run(pogingen, nu + wacht, String((oorzaak && oorzaak.message) || oorzaak || 'onbekend').slice(0, 240),
      new Date(nu).toISOString(), taak.org, taak.userId, taak.token);
}

module.exports = function maakGebruikerSync({ accounts, scim, cascade, log, klok } = {}) {
  const tijd = () => typeof klok === 'function' ? Number(klok()) : Date.now();
  zorgTabel();

  function zetActief(org, id, aan) {
    /* Eerst de organisatiegrens toetsen, daarna accountstand en outbox samen
       schrijven. Binnen een synchrone SQLite-transactie kan geen verzoek ertussen. */
    const bestaand = scim.lees(accounts, org, id);
    const db = S.db;
    db.exec('BEGIN IMMEDIATE');
    try {
      const user = accounts.zetActief(bestaand.id, !!aan);
      if (!user) throw new Error('SCIM-account kon niet worden bijgewerkt');
      if (aan) db.prepare('DELETE FROM scim_user_deprovision WHERE org = ? AND user_id = ?')
        .run(String(org), String(user.id));
      else markeer(db, org, user.id, tijd());
      db.exec('COMMIT');
      if (aan) return user;
      try {
        const uit = cascade(org, user);
        klaar(org, user.id);
        return user;
      } catch (e) {
        const taak = { org: String(org), userId: String(user.id), token: null };
        /* De directe poging heeft geen claim; alleen het foutspoor bijwerken.
           De rij zelf bestond al vóór de Werk OS-cascade. */
        try {
          db.prepare(`UPDATE scim_user_deprovision SET attempts = attempts + 1,
            next_at = ?, last_error = ?, updated_at = ? WHERE org = ? AND user_id = ?`)
            .run(tijd() + 5000, String((e && e.message) || e).slice(0, 240),
              new Date(tijd()).toISOString(), taak.org, taak.userId);
        } catch (spoorFout) {
          if (log && typeof log.error === 'function') log.error('scim.deprovisioning foutspoor mislukt', {
            org: taak.org, id: taak.userId, fout: String(spoorFout.message || spoorFout)
          });
        }
        throw e;
      }
    } catch (e) {
      if (db.inTransaction) {
        try { db.exec('ROLLBACK'); } catch (_) {}
      }
      throw e;
    }
  }

  function ronde() {
    const db = S.db;
    zorgTabel(db);
    const taken = pak(db, tijd(), 25);
    let hersteld = 0;
    for (const taak of taken) {
      try {
        const user = accounts.getUserById(Number(taak.userId));
        if (!user || user.actief !== 0) { klaar(taak.org, taak.userId); continue; }
        cascade(taak.org, user);
        klaar(taak.org, taak.userId);
        hersteld++;
      } catch (e) {
        fout(db, taak, e, tijd());
        if (log && typeof log.error === 'function') log.error('scim.deprovisioning herstel mislukt', {
          org: taak.org, id: taak.userId, fout: String((e && e.message) || e)
        });
      }
    }
    return { bekeken: taken.length, hersteld };
  }

  return { zetActief, ronde, klaar, geblokkeerd };
};

module.exports.zorgTabel = zorgTabel;
module.exports.geblokkeerd = geblokkeerd;
module.exports.HERSTEL_MS = HERSTEL_MS;
