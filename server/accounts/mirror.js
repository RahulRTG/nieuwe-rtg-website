/* Accounts, deel "mirror": de PostgreSQL-spiegel (alleen met DATABASE_URL).
   SQLite blijft de synchrone lokale cache; elke wijziging wordt (gecoalesceerd)
   naar Postgres doorgeschreven, en bij het opstarten trekken we de gedeelde
   staat uit Postgres. Zonder DATABASE_URL is dit alles inert. Afgesplitst uit
   accounts.js; de SQLite-handle komt live uit ./state. */
const S = require('./state');
const duurzaamheid = require('./duurzaamheid');

const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_URL || null;
const PGMODE = !!DATABASE_URL;

let pg = null, pgKlaar = false, idBlok = null, idRefillBezig = false, externCb = null;
let startBezig = null, herstelTimer = null, herstelPoging = 0, gestopt = false;
const pgLog = { warn: (m, v) => console.warn('[pgaccounts]', m, v || '') };
const vuileUsers = new Set(), vuileStaff = new Set(), verwijderdeUsers = new Set();
let mirrorTimer = null;

function planAccountHerstel(err, bron) {
  if (!PGMODE || gestopt) return;
  pgKlaar = false;
  if (err) pgLog.warn('accountauthority ongezond' + (bron ? ' (' + bron + ')' : ''), { fout: err.message });
  if (herstelTimer || startBezig) return;
  const basis = Math.max(50, Number(process.env.PG_HERKANS_MS || 1000));
  const wacht = Math.min(30000, basis * Math.pow(2, Math.min(herstelPoging++, 5)));
  herstelTimer = setTimeout(() => {
    herstelTimer = null;
    startPostgres().catch(e => planAccountHerstel(e, 'herstart'));
  }, wacht);
  if (herstelTimer.unref) herstelTimer.unref();
}

function rawUser(id) { return S.zin('SELECT * FROM users WHERE id = ?').get(id) || null; }
function rawStaff(id) { return S.zin('SELECT * FROM supplier_staff WHERE id = ?').get(id) || null; }

function nieuwId() {
  if (!PGMODE) return null;
  if (!idBlok || idBlok.volgende > idBlok.eind) {
    refillBlok();
    if (duurzaamheid.gesloten()) {
      const e = new Error('Geen gereserveerd PostgreSQL-id beschikbaar voor deze accountmutatie.');
      e.code = 'PG_ACCOUNTS_ID_ONZEKER'; e.status = 503; throw e;
    }
    return null;
  }
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
function transactioneleProductie() { return duurzaamheid.gesloten(); }
function markUser(id) {
  if (transactioneleProductie()) return; // de requestdeelnemer bezit deze commit
  if (PGMODE && id != null) { vuileUsers.add(Number(id)); planMirror(); }
}
function markStaff(id) {
  if (transactioneleProductie()) return;
  if (PGMODE && id != null) { vuileStaff.add(Number(id)); planMirror(); }
}
function markDelete(id) {
  if (transactioneleProductie()) return;
  if (PGMODE && id != null) { verwijderdeUsers.add(Number(id)); vuileUsers.delete(Number(id)); planMirror(); }
}

function authoriteitKlaar() { return !PGMODE || !!(pgKlaar && pg); }
async function commitAccountWijzigingen(client, wijzigingen) {
  if (!PGMODE || !pgKlaar || !pg || typeof pg.pasAccountWijzigingenToe !== 'function') {
    const e = new Error('De transactionele PostgreSQL-accountauthority is niet gereed.');
    e.code = 'PG_ACCOUNTS_NIET_KLAAR'; throw e;
  }
  return pg.pasAccountWijzigingenToe(client, wijzigingen);
}

function eisIntrekkingen() {
  if (!PGMODE) return null;
  if (!pgKlaar || !pg || !pg.intrekkingen) {
    const e = new Error('de gedeelde PostgreSQL-intrekkingsoutbox is niet gereed');
    e.code = 'INTREKOPSLAG_ONZEKER'; throw e;
  }
  return pg.intrekkingen;
}
async function bewaarIntrekking(rij) {
  const laag = eisIntrekkingen();
  return laag ? laag.bewaar(rij) : true;
}
async function gedeeldeIntrekkingen() {
  const laag = eisIntrekkingen();
  return laag ? laag.lijst(Date.now()) : [];
}
async function voltooiIntrekkingen(sleutels) {
  const laag = eisIntrekkingen();
  return laag ? laag.voltooi(sleutels) : true;
}

// Trek een enkele, door NOTIFY gemelde rij van een ander proces in de lokale cache.
function upsertLocalUser(r) {
  const cols = pg.USER_COLS;
  duurzaamheid.internePublicatie(() =>
    S.zin(`INSERT OR REPLACE INTO users (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map(c => r[c] === undefined ? null : r[c])));
}
function upsertLocalStaff(r) {
  const cols = pg.STAFF_COLS;
  duurzaamheid.internePublicatie(() =>
    S.zin(`INSERT OR REPLACE INTO supplier_staff (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map(c => r[c] === undefined ? null : r[c])));
}
async function pullEen(payload) {
  try {
    /* Onze eigen melding overslaan. Volgt dit proces zijn eigen NOTIFY, dan
       haalt het de rij op zoals die op DAT moment in Postgres staat en zet die
       met INSERT OR REPLACE over de lokale heen. Is er in de tussentijd lokaal
       nog iets aan diezelfde rij geschreven -- en dat gaatje is precies een
       Postgres-heen-en-weer breed -- dan gaat die schrijfactie verloren tot de
       volgende spoelronde. Zie server/pgaccounts.js voor de meting: op 100M
       leden reverteerde een net geuploade paspoortstand zichtbaar naar
       "unverified", waarna RTG Pay om een paspoort vroeg dat er al lag.

       Wij hebben de nieuwste stand al -- dat is waarom we de melding stuurden.
       Meldingen van een ANDERE instance blijven gewoon binnenkomen; daar is het
       hele kanaal voor. */
    if (pg && pg.vanMij && pg.vanMij(payload)) return;
    const [soort, idStr] = String(payload).split(':'); const id = Number(idStr);
    if (soort === 'user') {
      const { rows } = await pg.pool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (rows.length) upsertLocalUser(rows[0]);
      else duurzaamheid.internePublicatie(() => S.zin('DELETE FROM users WHERE id = ?').run(id));
      if (externCb) externCb();
    } else if (soort === 'staff') {
      const { rows } = await pg.pool.query('SELECT * FROM supplier_staff WHERE id = $1', [id]);
      if (rows.length) upsertLocalStaff(rows[0]);
    }
  } catch (e) {
    /* Een gemiste accountmelding kan een ingetrokken user/staff-binding lokaal
       actief laten lijken. Dat is een identity-storing, geen best-effort
       cachemisser: readiness dicht en eerst volledig opnieuw inlezen. */
    planAccountHerstel(e, 'notify-pull');
  }
}

/* Start de Postgres-spiegel: schema klaarzetten, gedeelde staat ophalen
   (Postgres wint), lokale rijen die nog niet gedeeld zijn erheen duwen (eerste
   migratie), een id-blok reserveren en live meeluisteren. */
async function startPostgresEenmaal() {
  if (!PGMODE) return false;
  gestopt = false; pgKlaar = false;
  const vorig = pg;
  const nieuw = require('../pgaccounts').maakPgAccounts({ url: DATABASE_URL, log: pgLog,
    onFout: (e, bron) => { if (pg === nieuw) planAccountHerstel(e, bron); } });
  pg = nieuw;
  if (vorig && vorig !== nieuw) { try { await vorig.sluit(); } catch (e) {} }
  await nieuw.schema();
  const { users, staff } = await nieuw.pullAlles();
  if (transactioneleProductie()) {
    /* Productie kent geen lokale oorsprong. Ook lokaal achtergebleven rijen die
       in PostgreSQL bewust zijn gewist moeten verdwijnen, anders kan een koude
       node een ingetrokken identiteit opnieuw laten binnenkomen. */
    duurzaamheid.internePublicatie(() => {
      S.db.exec('BEGIN IMMEDIATE');
      try {
        S.zin('DELETE FROM supplier_staff').run();
        S.zin('DELETE FROM users').run();
        for (const r of users) upsertLocalUser(r);
        for (const r of staff) upsertLocalStaff(r);
        S.db.exec('COMMIT');
      } catch (e) { try { S.db.exec('ROLLBACK'); } catch (x) {} throw e; }
    });
  } else {
    for (const r of users) upsertLocalUser(r);   // Postgres wint
    for (const r of staff) upsertLocalStaff(r);
    // Alleen buiten productie: eenmalige migratie van een lokale installatie.
    const pgUserIds = new Set(users.map(r => Number(r.id)));
    const pgStaffIds = new Set(staff.map(r => Number(r.id)));
    for (const r of S.zin('SELECT id FROM users').all()) if (!pgUserIds.has(Number(r.id))) markUser(r.id);
    for (const r of S.zin('SELECT id FROM supplier_staff').all()) if (!pgStaffIds.has(Number(r.id))) markStaff(r.id);
  }
  idBlok = await nieuw.reserveerBlok();
  await nieuw.luister(pullEen);
  pgKlaar = true;
  herstelPoging = 0;
  planMirror(); // buiten productie: duw eventuele lokaal-only rijen nu weg
  console.log('[accounts] PostgreSQL-spiegel actief (gedeelde accounts over instances).');
  return true;
}
function startPostgres() {
  if (!PGMODE) return Promise.resolve(false);
  if (startBezig) return startBezig;
  startBezig = startPostgresEenmaal();
  return startBezig.finally(() => { startBezig = null; });
}
function onExternalChange(cb) { externCb = cb; }
async function flushBijAfsluiten() {
  gestopt = true;
  if (herstelTimer) clearTimeout(herstelTimer);
  herstelTimer = null;
  if (PGMODE && pg && pgKlaar) { try { await flushMirror(); } catch (e) {} }
  if (pg) { try { await pg.sluit(); } catch (e) {} }
  pgKlaar = false;
}

module.exports = {
  PGMODE, rawUser, rawStaff, nieuwId, markUser, markStaff, markDelete,
  authoriteitKlaar, postgresKlaar: authoriteitKlaar, commitAccountWijzigingen,
  bewaarIntrekking, gedeeldeIntrekkingen, voltooiIntrekkingen,
  startPostgres, onExternalChange, flushBijAfsluiten
};
