'use strict';

/* Verse, alleen-lezen eigenaarsmeting op de autoritatieve productiedatabase.

   Deze module draait bewust NIET via accounts.startPostgres(): die startweg
   maakt schema's aan en reserveert id-blokken. Een releasecontrole hoort niets
   in productie te wijzigen. De speciale ownerproof-container heeft daarom
   alleen het productie-env, het PostgreSQL-secret en het interne datanetwerk;
   geen appvolume, geen releasevolume en geen publieke poort.

   De uitvoer bevat uitsluitend hashes. Het e-mailadres, databaseadres,
   PostgreSQL-snapshot en versleutelde accountvelden verlaten het proces niet. */

const crypto = require('node:crypto');

const SHA = /^[a-f0-9]{64}$/;
const IMAGE_ID = /^sha256:[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40,64}$/;
const NONCE = /^[A-Za-z0-9_-]{24,160}$/;
const hash = waarde => crypto.createHash('sha256').update(String(waarde)).digest('hex');

function sleutel(waarde, naam) {
  const s = String(waarde || '').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(s)) throw new Error(naam + ' moet 64 hex-tekens bevatten.');
  return Buffer.from(s, 'hex');
}

function kandidaatUit(env) {
  const commit = String(env.RTG_RELEASE_COMMIT || '').toLowerCase();
  const imageId = String(env.RTG_OWNER_IMAGE_ID || '');
  const imageImmutable = String(env.RTG_OWNER_IMAGE_IMMUTABLE || '');
  const candidateEvidenceSha256 = String(env.RTG_OWNER_CANDIDATE_SHA256 || '');
  const nonce = String(env.RTG_OWNER_PROOF_NONCE || '');
  if (!COMMIT.test(commit) || !IMAGE_ID.test(imageId) ||
      !/@sha256:[a-f0-9]{64}$/.test(imageImmutable) ||
      !SHA.test(candidateEvidenceSha256) || !NONCE.test(nonce))
    throw new Error('Commit, immutable image, kandidaatbewijs of eenmalige uitdaging is ongeldig.');
  return { commit, imageId, imageImmutable, candidateEvidenceSha256, nonce };
}

function databaseDoel(url) {
  let u;
  try { u = new URL(String(url || '')); }
  catch (_) { throw new Error('DATABASE_URL is geen geldige PostgreSQL-URL.'); }
  if (!/^postgres(?:ql)?:$/.test(u.protocol) || !u.hostname || !u.pathname || u.pathname === '/')
    throw new Error('DATABASE_URL wijst niet aantoonbaar naar PostgreSQL en een database.');
  return [u.protocol, u.hostname.toLowerCase(), u.port || '5432', u.pathname].join('|');
}

function zetKluissleutels(env) {
  const S = require('../../server/accounts/state');
  const vault = sleutel(env.RTG_VAULT_KEY, 'RTG_VAULT_KEY');
  const ring = [];
  for (const deel of String(env.RTG_VAULT_RING || '').split(',')) {
    const schoon = deel.trim();
    if (!schoon) continue;
    const k = sleutel(schoon, 'RTG_VAULT_RING');
    if (!ring.some(x => x.equals(k))) ring.push(k);
  }
  if (!ring.some(x => x.equals(vault))) ring.push(vault);
  S.VAULT = vault;
  S.RING = ring;
}

async function queryEen(pool, sql, params) {
  const antwoord = await pool.query(sql, params);
  if (!antwoord || !Array.isArray(antwoord.rows) || antwoord.rows.length !== 1)
    throw new Error('PostgreSQL gaf niet exact één verwachte bewijsrij terug.');
  return antwoord.rows[0];
}

async function effectieveEigenaar(pool, env) {
  let email = String(env.RTG_OWNER_EMAIL || '').trim().toLowerCase();
  const tabel = await queryEen(pool,
    "SELECT to_regclass('public.kv')::text AS kv_table");
  if (tabel.kv_table) {
    const antwoord = await pool.query(
      "SELECT val FROM kv WHERE key = $1 AND COALESCE(weg, false) = false", ['techniek']);
    if (antwoord.rows.length > 1) throw new Error('De techniekcollectie is niet uniek.');
    if (antwoord.rows.length === 1) {
      const rauw = require('../../server/kluis').ontsleutel(antwoord.rows[0].val);
      let techniek;
      try { techniek = JSON.parse(rauw); }
      catch (_) { throw new Error('De autoritatieve techniekcollectie is niet leesbaar.'); }
      const overgedragen = String(techniek && techniek.eigenaarEmail || '').trim().toLowerCase();
      if (overgedragen) email = overgedragen;
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    throw new Error('De effectieve eigenaar uit productie is ongeldig.');
  return email;
}

async function meet(env = process.env, afhankelijkheden = {}) {
  const kandidaat = kandidaatUit(env);
  const doel = databaseDoel(env.DATABASE_URL);
  zetKluissleutels(env);
  const Pool = afhankelijkheden.Pool || require('../../server/pgwire').Pool;
  const pool = afhankelijkheden.pool || new Pool({ connectionString:env.DATABASE_URL,
    max:1, connectionTimeoutMillis:5000, statement_timeout:10000, query_timeout:10000 });
  let eigenPool = !afhankelijkheden.pool;
  try {
    const database = await queryEen(pool, `SELECT current_database() AS database_name,
      current_user AS database_user,
      (SELECT oid::text FROM pg_database WHERE datname = current_database()) AS database_oid,
      current_setting('server_version_num') AS server_version_num,
      txid_current_snapshot()::text AS transaction_snapshot,
      clock_timestamp()::text AS observed_at`);
    const email = await effectieveEigenaar(pool, env);
    const accountKluis = require('../../server/accounts/kluis');
    const emailHash = accountKluis.emailHash(email);
    const antwoord = await pool.query(`SELECT id, email_hash, tier, actief, enc_email,
      created_at, sessies_vanaf FROM users WHERE email_hash = $1`, [emailHash]);
    if (!antwoord || antwoord.rows.length !== 1)
      throw new Error('De effectieve eigenaar staat niet exact eenmaal in productie-PostgreSQL.');
    const rij = antwoord.rows[0];
    const gelezenEmail = require('../../server/accounts/gebonden').emailOf(rij);
    if (String(gelezenEmail || '').trim().toLowerCase() !== email || Number(rij.actief) !== 1)
      throw new Error('Het productieaccount is niet actief of de kluisbinding bewijst de eigenaar niet.');

    const observedAt = new Date(database.observed_at).toISOString();
    const databaseIdentitySha256 = hash(JSON.stringify({ doel,
      database:String(database.database_name), user:String(database.database_user),
      oid:String(database.database_oid), version:String(database.server_version_num) }));
    const ownerRefSha256 = hash('owner:' + String(rij.id) + ':' + email);
    const ownerEmailSha256 = hash(email);
    const databaseSnapshotSha256 = hash(JSON.stringify({
      nonce:kandidaat.nonce, identity:databaseIdentitySha256,
      transactionSnapshot:String(database.transaction_snapshot), observedAt,
      owner:{ id:String(rij.id), emailHash:hash(String(rij.email_hash)), tier:String(rij.tier),
        actief:Number(rij.actief), createdAt:String(rij.created_at),
        sessiesVanaf:String(rij.sessies_vanaf == null ? 0 : rij.sessies_vanaf) }
    }));
    return { formaat:'rtg-owner-postgres-readback-v2', ...kandidaat,
      postgresReadback:true, directReadOnly:true, ownerAuthorized:true,
      ownerRefSha256, ownerEmailSha256,
      databaseTargetSha256:hash(doel), databaseIdentitySha256,
      databaseSnapshotSha256, observedAt };
  } finally {
    if (eigenPool) { try { await pool.end(); } catch (_) {} }
  }
}

module.exports = { SHA, IMAGE_ID, COMMIT, NONCE, hash, kandidaatUit,
  databaseDoel, zetKluissleutels, effectieveEigenaar, meet };
