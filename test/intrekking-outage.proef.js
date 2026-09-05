/* Handmatige harde storingproef. Hij bestuurt bewust een eigen Redis-container:
   REDIS_URL=redis://127.0.0.1:6397 RTG_REDIS_CONTAINER=naam
     node --test test/intrekking-outage.proef.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop } = require('./helper');

const REDIS = process.env.REDIS_URL;
const POSTGRES = process.env.DATABASE_URL;
const CONTAINER = process.env.RTG_REDIS_CONTAINER;
const MAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-intrek-uitval-'));
const A_MAP = path.join(MAP, 'a'), B_MAP = path.join(MAP, 'b');
fs.mkdirSync(A_MAP); fs.mkdirSync(B_MAP);

function docker(actie) {
  const r = cp.spawnSync('docker', [actie, CONTAINER], { encoding: 'utf8', timeout: 10000 });
  if (r.status !== 0) throw new Error('docker ' + actie + ': ' + String(r.stderr || r.stdout).trim());
}
async function post(base, pad, token, ms = 5000, body = {}) {
  const r = await fetch(base + pad, { method: 'POST', signal: AbortSignal.timeout(ms),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function openStream(base, token) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  let r;
  try { r = await fetch(base + '/api/stream?token=' + encodeURIComponent(token), { signal: ac.signal }); }
  finally { clearTimeout(timer); }
  assert.equal(r.status, 200);
  const reader = r.body.getReader();
  let grens;
  const eerste = await Promise.race([reader.read(), new Promise((_, reject) => {
    grens = setTimeout(() => reject(new Error('geen eerste SSE-frame binnen 5s')), 5000);
  })]).finally(() => clearTimeout(grens));
  assert.match(Buffer.from(eerste.value || []).toString(), /event: hello/);
  return { ac, reader };
}
async function sluitBinnen(reader, ms) {
  let timer;
  const dicht = (async () => { for (;;) { const r = await reader.read(); if (r.done) return true; } })();
  return Promise.race([dicht, new Promise(resolve => { timer = setTimeout(() => resolve(false), ms); })])
    .finally(() => clearTimeout(timer));
}
async function wachtOutbox() {
  const db = new DatabaseSync(path.join(A_MAP, 'rtg.db'), { readOnly: true });
  try {
    for (let i = 0; i < 50; i++) {
      if (db.prepare('SELECT COUNT(*) AS n FROM intrekking_outbox').get().n > 0) return true;
      await new Promise(r => setTimeout(r, 50));
    }
    return false;
  } finally { db.close(); }
}
async function wachtReady(base) {
  for (let i = 0; i < 80; i++) {
    const r = await fetch(base + '/api/ready', { signal: AbortSignal.timeout(2000) }).catch(() => null);
    if (r && r.status === 200) return r.json();
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('instance werd niet gereed na Redis-herstel');
}

test('Redis-uitval tussen lokale intrekking en delen overleeft crash en herstel',
  { timeout: 180000 }, async () => {
    assert.ok(REDIS && POSTGRES && CONTAINER,
      'DATABASE_URL, REDIS_URL en RTG_REDIS_CONTAINER zijn verplicht; dit bewijs mag niet skippen');
    const basis = { REDIS_URL: REDIS, SMTP_URL: '', RTG_OWNER_EMAIL: 'intrekking-eigenaar@x.nl',
      RTG_SECRET_KEY: 's'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64),
      RTG_ISOLATIE_AFDWINGEN: '1', RTG_BUS_PING_MS: '1500' };
    let A, B, stroom, gepauzeerd = false;
    try {
      A = await startServer({ stderr: process.stderr, env: { ...basis, RTG_DATA_DIR: A_MAP } });
      B = await startServer({ stderr: process.stderr, env: { ...basis, RTG_DATA_DIR: B_MAP } });
      const login = await post(A.base, '/api/techniek/inloggen', null, 5000,
        { login: 'intrekking-eigenaar@x.nl', wachtwoord: 'Imran' });
      const token = login.body.token;
      assert.ok(token);
      stroom = await openStream(B.base, token);

      docker('pause'); gepauzeerd = true;
      const logout = post(A.base, '/api/logout', token, 2500).catch(e => ({ fout: e }));
      assert.equal(await wachtOutbox(), true, 'de lokale intrekking + outbox committen tijdens de storing');
      assert.equal(await sluitBinnen(stroom.reader, 5000), true,
        'de Redis-watchdog sluit B fail-closed zonder payload/heartbeatpolling');
      stop(A); A = null; await logout;

      docker('unpause'); gepauzeerd = false;
      await wachtReady(B.base);
      const opB = await post(B.base, '/api/state', token);
      assert.equal(opB.status, 401,
        'B reconcilieert de gedeelde PostgreSQL-outbox vóór readiness, zonder herstel van A');

      stop(B); B = await startServer({ stderr: process.stderr, env: { ...basis, RTG_DATA_DIR: B_MAP } });
      const naHerstart = await post(B.base, '/api/state', token);
      assert.equal(naHerstart.status, 401, 'B leest na herstart de vervallende Redis-intrekking terug');
    } finally {
      if (gepauzeerd) try { docker('unpause'); } catch (e) {}
      if (stroom) try { stroom.ac.abort(); } catch (e) {}
      if (A) stop(A); if (B) stop(B);
      try { fs.rmSync(MAP, { recursive: true, force: true }); } catch (e) {}
    }
  });
