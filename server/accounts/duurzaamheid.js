/* De productiegrens voor de identiteitscache.

   users/staff leven lokaal in SQLite als CACHE; PostgreSQL is de waarheid. In
   productie opent elke accountmutatie een request-lokale werkkopie
   (./transactie.js) die als deelnemer in dezelfde PostgreSQL-requestcommit
   landt als de collecties (../db/deelnemers.js). Pas na die COMMIT volgt de
   lokale cache. Tot 27 september 2026 was deze poort hard dicht
   (PG_ACCOUNTS_ATOMAIR_ONTBREEKT): zelfs registreren gaf 503.
   Replicatie VAN de gedeelde bron naar de lokale cache (internePublicatie)
   blijft de enige weg buiten de werkkopie om. */
'use strict';

const verzoekcontext = require('../db/verzoekcontext');
let interneDiepte = 0;
const BLOKKADECODE = 'PG_ACCOUNTS_ATOMAIR_ONTBREEKT';

function gesloten(env = process.env) {
  return String(env.NODE_ENV || '') === 'production' && !!(env.DATABASE_URL || env.PG_URL);
}

function eisMutatie(onderdeel) {
  if (!gesloten() || interneDiepte) return true;
  try {
    require('./transactie').begin();
    return true;
  } catch (e) {
    if (!e.onderdeel) e.onderdeel = String(onderdeel || 'accounts').slice(0, 80);
    const ctx = verzoekcontext.huidige();
    /* Ook als een oude route deze fout opvangt en een 2xx probeert te sturen,
       houdt de centrale responsegrens het antwoord dicht. */
    if (ctx && ctx.open) ctx.hardeFout = e;
    throw e;
  }
}

function transactieDatabase() {
  if (interneDiepte) return null;
  try { return require('./transactie').database(); } catch (e) { return null; }
}

function internePublicatie(fn) {
  if (typeof fn !== 'function') throw new TypeError('internePublicatie verwacht een synchrone functie');
  if (fn.constructor && fn.constructor.name === 'AsyncFunction') {
    const e = new Error('Interne accountpublicatie mag geen async-functie zijn.');
    e.code = 'PG_ACCOUNTS_INTERNE_ASYNC'; throw e;
  }
  interneDiepte++;
  try {
    const uit = fn();
    if (uit && typeof uit.then === 'function') {
      /* Een thenable kan na deze synchrone bypass verder schrijven. Slik een
         eventuele latere rejection om geen los procesalarm te maken, maar laat
         de aanroeper nooit denken dat dit een toegestane publicatie was. */
      Promise.resolve(uit).catch(() => {});
      const e = new Error('Interne accountpublicatie mag geen Promise teruggeven.');
      e.code = 'PG_ACCOUNTS_INTERNE_ASYNC'; throw e;
    }
    return uit;
  } finally { interneDiepte--; }
}

/* Niet aan het begin ankeren: `WITH ... UPDATE` is ook een schrijfzin. Een
   gequote of schema-gekwalificeerde tabelnaam moet dezelfde grens raken. De
   combinatie is bewust conservatief; een vals-positief sluit een mutatie,
   terwijl een vals-negatief accountwaarheid vóór PostgreSQL kan publiceren. */
const SCHRIJFBEWERKING = /\b(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\b/i;
const ACCOUNTTABEL = /(?:^|[^A-Za-z0-9_$])(?:["`\[]?(?:users|supplier_staff)["`\]]?)(?=$|[^A-Za-z0-9_$])/i;
const isAccountSchrijfzin = sql => {
  const zin = String(sql || '');
  return SCHRIJFBEWERKING.test(zin) && ACCOUNTTABEL.test(zin);
};

/* Machineleesbare releasewaarheid. Geen env-vlag kan dit groen maken: de
   stand wordt afgeleid uit de STRUCTUUR -- de verzoekcontext moet deelnemers
   aannemen en de commitlaag moet ze meenemen. Valt een van beide weg, dan is
   het weer de blokkade. */
function releaseStand() {
  let verbonden = false;
  try {
    verbonden = typeof verzoekcontext.registreerDeelnemer === 'function' &&
      typeof verzoekcontext.deelnemersMetWerk === 'function' &&
      typeof require('../db/deelnemers').pasToe === 'function' &&
      typeof require('../db/verzoekcommit') === 'function';
  } catch (e) { verbonden = false; }
  return verbonden
    ? { code: 'PG_ACCOUNTS_ATOMAIR_BEVESTIGD', gereed: true, transactioneel: true,
      productieMutaties: 'duurzaam', vereist: 'gedeelde-pg-requesttransactie' }
    : { code: BLOKKADECODE, gereed: false, transactioneel: false,
      productieMutaties: 'gesloten', vereist: 'gedeelde-pg-requesttransactie' };
}

/* Voor timers buiten de accountlaag (SCIM-herstelronde): staat er een
   werkkopie open, dan wacht S.db niet en slaat een ronde beter een beurt over. */
function werkkopieOpen() {
  try { return require('./transactie').bezet(); } catch (e) { return false; }
}

module.exports = { BLOKKADECODE, gesloten, eisMutatie, transactieDatabase, werkkopieOpen,
  internePublicatie, isAccountSchrijfzin, releaseStand };
