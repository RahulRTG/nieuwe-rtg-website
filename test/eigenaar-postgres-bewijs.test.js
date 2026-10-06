'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const bewijs = require('../scripts/lib/eigenaar-postgres-bewijs');

const COMMIT = 'a'.repeat(40);
const IMAGE = 'sha256:' + 'b'.repeat(64);
const IMMUTABLE = 'ghcr.io/rtg/platform:candidate-' + 'a'.repeat(12) + '-1@sha256:' + 'c'.repeat(64);

function omgeving(extra = {}) {
  return { DATABASE_URL:'postgresql://rtg:geheim@postgres:5432/rtg',
    RTG_VAULT_KEY:'d'.repeat(64), RTG_OWNER_EMAIL:'owner@example.test',
    RTG_RELEASE_COMMIT:COMMIT, RTG_OWNER_IMAGE_ID:IMAGE,
    RTG_OWNER_IMAGE_IMMUTABLE:IMMUTABLE,
    RTG_OWNER_CANDIDATE_SHA256:'e'.repeat(64),
    RTG_OWNER_PROOF_NONCE:'n'.repeat(32), ...extra };
}

function poolMetEigenaar(env, opties = {}) {
  bewijs.zetKluissleutels(env);
  const accountKluis = require('../server/accounts/kluis');
  const gebonden = require('../server/accounts/gebonden');
  const id = 812;
  const rij = { id, email_hash:accountKluis.emailHash(env.RTG_OWNER_EMAIL), tier:'rtg',
    actief:opties.actief === undefined ? 1 : opties.actief,
    enc_email:gebonden.zegel('enc_email', id, env.RTG_OWNER_EMAIL),
    created_at:'2026-09-01T10:00:00.000Z', sessies_vanaf:0 };
  const queries = [];
  return { queries, async query(sql, params) {
    queries.push({ sql:String(sql), params });
    if (/current_database\(\)/.test(sql)) return { rows:[{ database_name:'rtg',
      database_user:'rtg', database_oid:'16384', server_version_num:'160010',
      transaction_snapshot:'918:918:', observed_at:new Date().toISOString() }] };
    if (/to_regclass/.test(sql)) return { rows:[{ kv_table:null }] };
    if (/FROM users WHERE email_hash/.test(sql))
      return { rows:opties.ontbreekt ? [] : [rij] };
    throw new Error('onverwachte query: ' + sql);
  }, async end() {} };
}

test('ownerproof leest alleen current PostgreSQL en publiceert uitsluitend gebonden hashes', async () => {
  const env = omgeving();
  const pool = poolMetEigenaar(env);
  const uit = await bewijs.meet(env, { pool });
  assert.equal(uit.formaat, 'rtg-owner-postgres-readback-v2');
  assert.equal(uit.commit, COMMIT);
  assert.equal(uit.imageId, IMAGE);
  assert.equal(uit.imageImmutable, IMMUTABLE);
  assert.equal(uit.postgresReadback, true);
  assert.equal(uit.directReadOnly, true);
  assert.equal(uit.ownerAuthorized, true);
  for (const sleutel of ['ownerRefSha256', 'ownerEmailSha256', 'databaseTargetSha256',
    'databaseIdentitySha256', 'databaseSnapshotSha256'])
    assert.match(uit[sleutel], /^[a-f0-9]{64}$/, sleutel);
  const openbaar = JSON.stringify(uit);
  assert.doesNotMatch(openbaar, /owner@example\.test|geheim|postgres:5432|918:918/,
    'bewijs mag geen eigenaar, credentials, endpoint of rauwe transactiesnapshot lekken');
  assert.ok(pool.queries.length >= 3);
  assert.ok(pool.queries.every(q => /^\s*SELECT\b/i.test(q.sql)),
    'de productiemeting mag uitsluitend SELECT uitvoeren');
});

test('ownerproof valt dicht bij ontbrekende of inactieve eigenaar en ongebonden kandidaat', async () => {
  const env = omgeving();
  await assert.rejects(() => bewijs.meet(env, { pool:poolMetEigenaar(env, { ontbreekt:true }) }),
    /niet exact eenmaal/);
  await assert.rejects(() => bewijs.meet(env, { pool:poolMetEigenaar(env, { actief:0 }) }),
    /niet actief/);
  await assert.rejects(() => bewijs.meet(omgeving({ RTG_OWNER_IMAGE_IMMUTABLE:'latest' }), {
    pool:poolMetEigenaar(env) }), /immutable image/);
});
