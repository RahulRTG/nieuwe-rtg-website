/* Accounts, deel "mirror": de PostgreSQL-spiegel (alleen met DATABASE_URL).
   SQLite blijft de synchrone lokale cache; elke wijziging wordt (gecoalesceerd)
   naar Postgres doorgeschreven, en bij het opstarten trekken we de gedeelde
   staat uit Postgres. Zonder DATABASE_URL is dit alles inert. Afgesplitst uit
   accounts.js; de SQLite-handle komt live uit ./state. */
const S = require('./state');

const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_URL || null;
const PGMODE = !!DATABASE_URL;

let pg = null, pgKlaar = false, idBlok = null, idRefillBezig = false, externCb = null;
const pgLog = { warn: (m, v) => console.warn('[pgaccounts]', m, v || '') };
const vuileUsers = new Set(), vuileStaff = new Set(), verwijderdeUsers = new Set();
let mirrorTimer = null;

function rawUser(id) { return S.db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null; }
function rawStaff(id) { return S.db.prepare('SELECT * FROM supplier_staff WHERE id = ?').get(id) || null; }

function nieuwId() {
  if (!PGMODE || !idBlok) return null;              // buiten PG of vóór reservering: SQLite-autoincrement
  if (idBlok.volgende > idBlok.eind) { refillBlok(); return null; }
  const id = idBlok.volgende++;
  if (idBlok.eind - idBlok.volgende < 100) refillBlok(); // ruim op tijd bijvullen
  return id;
}
async function refillBlok() {
  if (idRefillBezig || !pg) return;
  idRefillBezig = true;
  try { idBlok = await pg.reserveerBlok(); }
  catch (e) { pgLog.warn('id-blok reserveren mislukt', { fout: e.message }); }
  finally { idRefillBezig = false; }
}

function planMirror() { if (!PGMODE || !pgKlaar || mirrorTimer) return; mirrorTimer = setTimeout(flushMirror, 150); if (mirrorTimer.unref) mirrorTimer.unref(); }
async function flushMirror() {
  mirrorTimer = null;
  if (!pg || !pgKlaar) return;
  const us = [...vuileUsers]; vuileUsers.clear();
  const ss = [...vuileStaff]; vuileStaff.clear();
  const del = [...verwijderdeUsers]; verwijderdeUsers.clear();
  for (const id of del) { try { await pg.deleteUser(id); } catch (e) { verwijderdeUsers.add(id); } }
  for (const id of us) { const r = rawUser(id); if (r) { try { await pg.upsertUser(r); } catch (e) { vuileUsers.add(id); } } }
  for (const id of ss) { const r = rawStaff(id); if (r) { try { await pg.upsertStaff(r); } catch (e) { vuileStaff.add(id); } } }
  if (vuileUsers.size || vuileStaff.size || verwijderdeUsers.size) planMirror();
}
function markUser(id) { if (PGMODE && id != null) { vuileUsers.add(Number(id)); planMirror(); } }
function markStaff(id) { if (PGMODE && id != null) { vuileStaff.add(Number(id)); planMirror(); } }
function markDelete(id) { if (PGMODE && id != null) { verwijderdeUsers.add(Number(id)); vuileUsers.delete(Number(id)); planMirror(); } }

// Trek een enkele, door NOTIFY gemelde rij van een ander proces in de lokale cache.
function upsertLocalUser(r) {
  const cols = pg.USER_COLS;
  S.db.prepare(`INSERT OR REPLACE INTO users (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
    .run(...cols.map(c => r[c] === undefined ? null : r[c]));
}
function upsertLocalStaff(r) {
  const cols = pg.STAFF_COLS;
  S.db.prepare(`INSERT OR REPLACE INTO supplier_staff (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
    .run(...cols.map(c => r[c] === undefined ? null : r[c]));
}
async function pullEen(payload) {
  try {
    const [soort, idStr] = String(payload).split(':'); const id = Number(idStr);
    if (soort === 'user') {
      const { rows } = await pg.pool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (rows.length) upsertLocalUser(rows[0]); else S.db.prepare('DELETE FROM users WHERE id = ?').run(id);
      if (externCb) externCb();
    } else if (soort === 'staff') {
      const { rows } = await pg.pool.query('SELECT * FROM supplier_staff WHERE id = $1', [id]);
      if (rows.length) upsertLocalStaff(rows[0]);
    }
  } catch (e) {}
}

/* Start de Postgres-spiegel: schema klaarzetten, gedeelde staat ophalen
   (Postgres wint), lokale rijen die nog niet gedeeld zijn erheen duwen (eerste
   migratie), een id-blok reserveren en live meeluisteren. */
async function startPostgres() {
  if (!PGMODE) return false;
  pg = require('../pgaccounts').maakPgAccounts({ url: DATABASE_URL, log: pgLog });
  await pg.schema();
  const { users, staff } = await pg.pullAlles();
  for (const r of users) upsertLocalUser(r);   // Postgres wint
  for (const r of staff) upsertLocalStaff(r);
  // Lokale rijen die (nog) niet in Postgres staan: eenmalig erheen duwen.
  const pgUserIds = new Set(users.map(r => Number(r.id)));
  const pgStaffIds = new Set(staff.map(r => Number(r.id)));
  for (const r of S.db.prepare('SELECT id FROM users').all()) if (!pgUserIds.has(Number(r.id))) markUser(r.id);
  for (const r of S.db.prepare('SELECT id FROM supplier_staff').all()) if (!pgStaffIds.has(Number(r.id))) markStaff(r.id);
  idBlok = await pg.reserveerBlok();
  pgKlaar = true;
  planMirror(); // duw eventuele lokaal-only rijen nu weg
  await pg.luister(pullEen);
  console.log('[accounts] PostgreSQL-spiegel actief (gedeelde accounts over instances).');
  return true;
}
function onExternalChange(cb) { externCb = cb; }
async function flushBijAfsluiten() { if (PGMODE && pg && pgKlaar) { try { await flushMirror(); } catch (e) {} } }

module.exports = {
  PGMODE, rawUser, rawStaff, nieuwId, markUser, markStaff, markDelete,
  startPostgres, onExternalChange, flushBijAfsluiten
};
