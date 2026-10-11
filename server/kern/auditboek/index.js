/* ============================================================================
   HET AUDITBOEK -- duurzame, onherschrijfbare auditrijen in PostgreSQL met een
   anker buiten de database. Zie AUDITBOEK.md voor het ontwerp en de grenzen.

   Dit bestand is alleen de voordeur: het stelt pool, sinks en sleutels samen uit
   de omgeving en geeft de vijf handelingen een naam. De logica woont in de
   zusterbestanden en er is geen tweede schrijver naast `schrijver.js`.

   INSTELLINGEN
     RTG_AUDIT_DATABASE_URL        eigen verbinding/rol voor het boek (valt terug
                                   op DATABASE_URL)
     RTG_AUDIT_ANKER_DIRS          komma-gescheiden write-once mappen
     RTG_AUDIT_ANKER_URLS          komma-gescheiden https-sinks
     RTG_AUDIT_ANKER_TOKEN         bearer voor de https-sinks
     RTG_AUDIT_ANKER_SIGN_KEY      private Ed25519-sleutel (alleen waar wordt verankerd)
     RTG_AUDIT_ANKER_PUBLIC_KEY_FILE   publieke sleutel (anders deploy/audit-anker.pub)
     RTG_AUDIT_ANKER_MIN_SINKS     minimaal aantal bestemmingen (productie: 2, anders 1)
     RTG_AUDIT_ANKER_MAX_LEEFTIJD_MS   hoe oud het laatste anker mag zijn (6 uur)
   ========================================================================== */
'use strict';
const schema = require('./schema');
const schrijver = require('./schrijver');
const ankerMod = require('./anker');
const { verifieer } = require('./verifieer');
const { snoei, BEWAARDAGEN } = require('./bewaring');
const { sinksUitOmgeving } = require('./ankersink');

function boekInstellingen(env = process.env) {
  const prod = env.NODE_ENV === 'production';
  return { url: env.RTG_AUDIT_DATABASE_URL || env.DATABASE_URL || '',
    minSinks: Math.max(1, Number(env.RTG_AUDIT_ANKER_MIN_SINKS) || (prod ? 2 : 1)),
    maxAnkerLeeftijdMs: Number(env.RTG_AUDIT_ANKER_MAX_LEEFTIJD_MS) || 6 * 3600 * 1000 };
}

function maak({ pool, env = process.env, sinks, sleutels } = {}) {
  const cfg = boekInstellingen(env);
  let eigenPool = null;
  const p = () => {
    if (pool) return pool;
    if (!cfg.url) throw Object.assign(new Error('Geen DATABASE_URL: het auditboek heeft PostgreSQL nodig.'), { code: 'AUDIT_NIET_VASTGELEGD' });
    if (!eigenPool) {
      const { Pool } = require('../../pgwire');
      eigenPool = new Pool({ connectionString: cfg.url, max: Number(env.RTG_AUDIT_POOL_MAX || 4),
        connectionTimeoutMillis: Number(env.PG_CONNECT_MS || 5000), statement_timeout: Number(env.PG_STATEMENT_MS || 30000) });
      eigenPool.on('error', () => {});
    }
    return eigenPool;
  };
  const bestemmingen = () => sinks || sinksUitOmgeving(env);
  const sleutelpaar = () => sleutels || ankerMod.laadSleutels(env);
  let boekId = null;
  const klaar = async () => { if (!boekId) boekId = (await schema.init(p())).boekId; return boekId; };

  return {
    cfg, klaar,
    async noteer(inv, opties) { await klaar().catch(e => { throw schrijver.nietVastgelegd(e); }); return schrijver.noteer(p(), inv, opties); },
    /* Voor release-, promotie- en rollbackstappen: de regel EN het anker, of een fout.
       Wie dit aanroept gaat pas verder als beide er zijn (fail-closed). */
    async noteerEnAnker(inv, opties = {}) {
      const id = await klaar().catch(e => { throw schrijver.nietVastgelegd(e); });
      const regel = await schrijver.noteer(p(), inv, opties);
      const anker = await ankerMod.maakAnker({ pool: p(), sinks: bestemmingen(), sleutels: sleutelpaar(), boekId: id,
        nu: opties.nu, minSinks: cfg.minSinks, force: true });
      return { ...regel, ankerNr: anker.ankerNr };
    },
    async anker(opties = {}) { const id = await klaar(); return ankerMod.maakAnker({ pool: p(), sinks: bestemmingen(), sleutels: sleutelpaar(), boekId: id, minSinks: cfg.minSinks, ...opties }); },
    async verifieer(opties = {}) {
      await klaar();
      return verifieer({ pool: p(), sinks: bestemmingen(), sleutels: sleutelpaar(), minSinks: cfg.minSinks,
        maxAnkerLeeftijdMs: cfg.maxAnkerLeeftijdMs, ...opties });
    },
    async snoei(opties = {}) { await klaar(); return snoei({ pool: p(), sinks: bestemmingen(), sleutels: sleutelpaar(), minSinks: cfg.minSinks, ...opties }); },
    async sluit() { if (eigenPool) { const x = eigenPool; eigenPool = null; boekId = null; await x.end(); } }
  };
}

let gedeeld = null;
const deelbaar = () => gedeeld || (gedeeld = maak());
const actief = (env = process.env) => !!(env.DATABASE_URL || env.RTG_AUDIT_DATABASE_URL);

module.exports = { maak, deelbaar, actief, boekInstellingen, BEWAARDAGEN };
