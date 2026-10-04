/* Autoritatieve, uitsluitend lezende bron voor een runtime-evidence-export.

   Deze module laadt bewust NIET server/db: die opstartlaag initialiseert schema's,
   seed-data en synchronisatie. Een export mag geen productie-evidence wijzigen
   en opent daarom JSON/SQLite/PostgreSQL via een smalle read-only ingang. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const rtgjson = require('../../lib/rtgjson');
const { kiesStore } = require('../../db/keuze');

function fout(code, melding) { return Object.assign(new Error(melding), { code }); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

function eisKluis(kluis) {
  if (!kluis || kluis.AAN !== true || typeof kluis.ontsleutel !== 'function')
    throw fout('EVIDENCE_EXPORT_KEY_REQUIRED', 'Een actieve RTG_ENC_KEY is verplicht voor de export.');
}

function bestandVeilig(bestand, naam) {
  let stat;
  try { stat = fs.lstatSync(bestand); }
  catch (error) {
    if (error.code === 'ENOENT') throw fout('EVIDENCE_SOURCE_MISSING', naam + ' ontbreekt.');
    throw error;
  }
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1)
    throw fout('EVIDENCE_SOURCE_FILE_UNSAFE', naam + ' is geen enkel regulier bestand.');
  return stat;
}

function parseRoot(tekst, fullDatabase) {
  let document;
  try { document = rtgjson.parse(tekst, { maxDiepte: 512 }); }
  catch (error) { throw fout('EVIDENCE_SOURCE_INVALID', 'Trust-evidence kon niet veilig worden gelezen.'); }
  if (fullDatabase && (!document || typeof document !== 'object' || Array.isArray(document)))
    throw fout('EVIDENCE_SOURCE_INVALID', 'De database heeft geen geldige hoofdvorm.');
  const root = fullDatabase
    ? (document && Object.prototype.hasOwnProperty.call(document, 'trustEvidence') ? document.trustEvidence : {})
    : document;
  if (!root || typeof root !== 'object' || Array.isArray(root))
    throw fout('EVIDENCE_SOURCE_INVALID', 'Trust-evidence heeft geen geldige hoofdvorm.');
  return root;
}

function ontsleutelTekst(waarde, kluis) {
  let tekst;
  try { tekst = kluis.ontsleutel(waarde); }
  catch (error) { throw fout('EVIDENCE_SOURCE_DECRYPT_FAILED', 'Trust-evidence kon niet ontsleuteld worden.'); }
  if (typeof tekst !== 'string')
    throw fout('EVIDENCE_SOURCE_INVALID', 'Trust-evidence heeft geen tekstuele opslagvorm.');
  return tekst;
}

function leesJson(dataDirectory, kluis) {
  const bestand = path.join(dataDirectory, 'db.json'), voor = bestandVeilig(bestand, 'db.json');
  const fd = fs.openSync(bestand, 'r');
  let bytes, geopend;
  try { geopend = fs.fstatSync(fd); bytes = fs.readFileSync(fd); }
  finally { fs.closeSync(fd); }
  if (geopend.dev !== voor.dev || geopend.ino !== voor.ino || geopend.nlink !== 1)
    throw fout('EVIDENCE_SOURCE_FILE_UNSAFE', 'db.json wisselde tijdens het lezen.');
  const document = parseRoot(ontsleutelTekst(bytes.toString('utf8'), kluis), true);
  return { store: 'json', sourceRevision: sha256(bytes), trustEvidence: document };
}

function leesSqlite(dataDirectory, kluis) {
  const bestand = path.join(dataDirectory, 'store.db');
  bestandVeilig(bestand, 'store.db');
  const { DatabaseSync } = require('node:sqlite');
  let db;
  try {
    db = new DatabaseSync(bestand, { readOnly: true });
    const kolommen = db.prepare('PRAGMA table_info(kv)').all().map(x => x.name);
    if (!kolommen.includes('val') || !kolommen.includes('ver') || !kolommen.includes('deleted'))
      throw fout('EVIDENCE_SOURCE_SCHEMA_MISSING', 'SQLite mist het verwachte read-only kv-schema.');
    db.exec('BEGIN');
    let rij;
    try {
      rij = db.prepare('SELECT val, ver, deleted FROM kv WHERE key = ?').get('trustEvidence');
      db.exec('COMMIT');
    } catch (error) { try { db.exec('ROLLBACK'); } catch (rollbackError) {} throw error; }
    if (!rij || rij.deleted) return { store: 'sqlite', sourceRevision: null, trustEvidence: {} };
    const root = parseRoot(ontsleutelTekst(rij.val, kluis), false);
    return { store: 'sqlite', sourceRevision: Number(rij.ver), trustEvidence: root };
  } catch (error) {
    if (error && error.code && String(error.code).startsWith('EVIDENCE_')) throw error;
    throw fout('EVIDENCE_SOURCE_READ_FAILED', 'SQLite trust-evidence kon niet read-only worden gelezen.');
  } finally { if (db) try { db.close(); } catch (error) {} }
}

async function leesPostgres(env, kluis, opties) {
  const o = opties || {}, Pool = o.Pool || require('../../pgwire').Pool;
  const pool = o.pool || new Pool({ connectionString: env.DATABASE_URL || env.PG_URL,
    max: 1, connectionTimeoutMillis: Number(env.PG_CONNECT_MS || 5000),
    idleTimeoutMillis: Number(env.PG_IDLE_MS || 30000),
    statement_timeout: Number(env.PG_STATEMENT_MS || 30000),
    query_timeout: Number(env.PG_QUERY_MS || 30000) });
  const eigenPool = !o.pool;
  if (pool && typeof pool.on === 'function') pool.on('error', () => {});
  try {
    const resultaat = await pool.query('SELECT val, ver, weg FROM kv WHERE key = $1 LIMIT 1', ['trustEvidence']);
    const rij = resultaat && resultaat.rows && resultaat.rows[0];
    if (!rij || rij.weg) return { store: 'postgres', sourceRevision: null, trustEvidence: {} };
    const root = parseRoot(ontsleutelTekst(rij.val, kluis), false);
    return { store: 'postgres', sourceRevision: Number(rij.ver), trustEvidence: root };
  } catch (error) {
    if (error && error.code && String(error.code).startsWith('EVIDENCE_')) throw error;
    throw fout('EVIDENCE_SOURCE_READ_FAILED', 'PostgreSQL trust-evidence kon niet read-only worden gelezen.');
  } finally { if (eigenPool && pool) try { await pool.end(); } catch (error) {} }
}

async function lees(opties) {
  const o = opties || {}, env = o.env || process.env, kluis = o.kluis;
  eisKluis(kluis);
  const dataDirectory = path.resolve(env.RTG_DATA_DIR || path.join(__dirname, '..', '..', 'data'));
  const dbJson = path.join(dataDirectory, 'db.json');
  const store = o.store || kiesStore(env, fs.existsSync(dbJson));
  if (store === 'json') return { dataDirectory, ...(leesJson(dataDirectory, kluis)) };
  if (store === 'sqlite') return { dataDirectory, ...(leesSqlite(dataDirectory, kluis)) };
  if (store === 'postgres') return { dataDirectory,
    ...(await leesPostgres(env, kluis, o.postgres)) };
  throw fout('EVIDENCE_SOURCE_UNSUPPORTED', 'Opslagstand ' + String(store) + ' heeft geen bewezen read-only exportpad.');
}

module.exports = { lees, leesJson, leesSqlite, leesPostgres };
