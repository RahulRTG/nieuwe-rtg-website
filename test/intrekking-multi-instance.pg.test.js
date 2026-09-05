/* Echte twee-instanceproef voor intrekking. De stream hangt op instance B;
   instance A trekt de credential in. Alleen het Redis-signaal kan B ruim voor
   de 25-seconden-heartbeat eventgedreven sluiten.

   Los: REDIS_URL=redis://127.0.0.1:6379 node --test test/intrekking-multi-instance.pg.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const OVERSLAAN = process.env.REDIS_URL ? false : 'vereist een echte REDIS_URL voor twee losse processen';
const OWNER = 'intrekking-eigenaar@x.nl';
const MAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-intrekking-cluster-'));
const MAP_A = path.join(MAP, 'a');
const MAP_B = path.join(MAP, 'b');
fs.mkdirSync(MAP_A); fs.mkdirSync(MAP_B);

async function post(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(5000) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function login(base) {
  const r = await post(base, '/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' });
  assert.ok(r.body.token, JSON.stringify(r.body).slice(0, 200));
  return r.body.token;
}

async function leesBinnen(reader, ac, ms) {
  let timer;
  try {
    return await Promise.race([
      reader.read(),
      new Promise((_, reject) => { timer = setTimeout(() => {
        ac.abort(); reject(new Error('timeout op eerste SSE-frame'));
      }, ms); })
    ]);
  } finally { clearTimeout(timer); }
}

async function openStream(base, token) {
  for (let poging = 0; poging < 80; poging++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5000);
    let res;
    try {
      res = await fetch(base + '/api/stream?token=' + encodeURIComponent(token), { signal: ac.signal });
    } finally { clearTimeout(timer); }
    if (res.status === 503) {
      ac.abort();
      await new Promise(r => setTimeout(r, 50));
      continue;                         // Redis-bus is nog aan het verbinden
    }
    assert.equal(res.status, 200);
    const reader = res.body.getReader();
    let tekst = '';
    for (let i = 0; i < 5 && !tekst.includes('event: hello'); i++) {
      const deel = await leesBinnen(reader, ac, 5000);
      if (deel.done) break;
      tekst += Buffer.from(deel.value).toString();
    }
    assert.match(tekst, /event: hello/);
    return { ac, reader };
  }
  throw new Error('de Redis-intrekkingsleiding werd niet gereed');
}

async function sluitBinnen(reader, ms) {
  let timer;
  const einde = (async () => {
    for (;;) {
      const deel = await reader.read();
      if (deel.done) return true;
    }
  })();
  const grens = new Promise(resolve => { timer = setTimeout(() => resolve(false), ms); });
  return Promise.race([einde, grens]).finally(() => clearTimeout(timer));
}

test('intrekking op A sluit een bestaande persoonlijke SSE op B via Redis',
  { skip: OVERSLAAN, timeout: 180000 }, async () => {
    const env = { SMTP_URL: '', RTG_OWNER_EMAIL: OWNER,
      RTG_SECRET_KEY: 's'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64),
      RTG_ISOLATIE_AFDWINGEN: '1' };
    const A = await startServer({ env: { ...env, RTG_DATA_DIR: MAP_A, RTG_SERVER: 'intrek-A' } });
    let B = await startServer({ env: { ...env, RTG_DATA_DIR: MAP_B, RTG_SERVER: 'intrek-B' } });
    let stroom;
    try {
      const token = await login(A.base);
      const klaar = await fetch(B.base + '/api/ready', { signal: AbortSignal.timeout(5000) }).then(r => r.json());
      assert.equal(klaar.redisGereed, true, 'readiness bewijst de leiding, niet alleen REDIS_URL');
      assert.equal(klaar.intrekking.soort, 'redis');
      stroom = await openStream(B.base, token);
      const uit = await post(A.base, '/api/logout', {}, token);
      assert.equal(uit.status, 200, JSON.stringify(uit.body));
      assert.equal(await sluitBinnen(stroom.reader, 5000), true,
        'B bleef open; dit zou pas bij de 25s-heartbeat sluiten en is dus geen directe Redis-intrekking');

      const na = await post(B.base, '/api/state', {}, token);
      assert.equal(na.status, 401,
        'B weigert ook met een eigen lokale accountsdatabase: dit antwoord komt uit het Redis-intrekkingssignaal');

      /* Een herstart heeft het Pub/Sub-bericht gemist en wist de RAM-cache.
         Alleen de Redis-sleutel met TTL kan dit nog bewijzen. */
      stop(B.child); B = null;
      const herstart = await startServer({ env: { ...env, RTG_DATA_DIR: MAP_B, RTG_SERVER: 'intrek-B2' } });
      B = herstart;
      const naHerstart = await post(B.base, '/api/state', {}, token);
      assert.equal(naHerstart.status, 401,
        'een herstart proces leest de duurzame intrekking terug vóór readiness');
    } finally {
      if (stroom) try { stroom.ac.abort(); } catch (e) {}
      stop(A.child); if (B) stop(B.child);
    }
  });

test.after(() => {
  try { fs.rmSync(MAP, { recursive: true, force: true }); } catch (e) {}
});
