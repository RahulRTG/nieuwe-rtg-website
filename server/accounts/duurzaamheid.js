/* Tijdelijke, harde productiegrens voor de identiteitscache.

   users/staff leven lokaal in SQLite en worden nog met vertraging naar een
   aparte PostgreSQL-pool gespiegeld. Dat kan niet deelnemen aan de atomaire
   requestcommit van de gewone collecties. Tot die migratie klaar is mogen
   productieverzoeken dus wel lezen, maar geen accountwaarheid wijzigen.
   Replicatie VAN de gedeelde bron naar de lokale cache is de enige bypass. */
'use strict';

const verzoekcontext = require('../db/verzoekcontext');
let interneDiepte = 0;
const BLOKKADECODE = 'PG_ACCOUNTS_ATOMAIR_ONTBREEKT';

function gesloten(env = process.env) {
  return String(env.NODE_ENV || '') === 'production' && !!(env.DATABASE_URL || env.PG_URL);
}

function fout(onderdeel) {
  const e = new Error('Accountmutaties zijn gesloten totdat users en staff aan dezelfde PostgreSQL-requesttransactie deelnemen.');
  e.code = BLOKKADECODE; e.status = 503;
  e.onderdeel = String(onderdeel || 'accounts').slice(0, 80);
  return e;
}

function eisMutatie(onderdeel) {
  if (!gesloten() || interneDiepte) return true;
  try {
    require('./transactie').begin();
    return true;
  } catch (e) {
    const ctx = verzoekcontext.huidige();
    /* Ook als een oude route deze fout opvangt en een 2xx probeert te sturen,
       houdt de centrale responsegrens het antwoord dicht. */
    if (ctx) ctx.hardeFout = e;
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

/* Machineleesbare releasewaarheid. Geen env-vlag kan dit groen maken: pas een
   echte, gedeelde requesttransactie voor users/staff mag deze code vervangen.
   De server blijft ondertussen veilig bruikbaar in read-only/fail-closed vorm. */
function releaseStand() {
  return {
    code: BLOKKADECODE,
    gereed: false,
    transactioneel: false,
    productieMutaties: 'gesloten',
    vereist: 'gedeelde-pg-requesttransactie'
  };
}

module.exports = { BLOKKADECODE, gesloten, eisMutatie, transactieDatabase,
  internePublicatie, isAccountSchrijfzin, releaseStand };
