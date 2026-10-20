/* Twee ECHTE serverprocessen, eigen geheugen/caches, één verse PostgreSQL.
   Alleen synthetisch geld. Bewijst requestcommit+Directpay+Betaalwaarheid,
   geen kernstub. De providercheckpointfixture maakt crashtiming expliciet.
   Geen bewijs voor een externe provider of productiecapaciteit. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = process.env.RTG_DP_PROEF_ROOT || path.resolve(__dirname, '..');
const bron = require('node:module').createRequire(path.join(ROOT, 'test/directpay-workers.pg.test.js'));
const { startServer, stop } = bron('./helper');
const { vereist } = bron('./infra');
const URL = process.env.DATABASE_URL || process.env.PG_URL;
const skip = vereist('pg', !!URL, 'vereist echte PostgreSQL voor twee Directpay-workers');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const bank = bron('../server/betaal/synthetisch')({ crypto, env: {}, echteRail: null });
function sleutel(naam) {
  for (let i = 0; i < 5000; i++) {
    const idem = naam + '-' + i;
    const id = 'BW-' + sha('dp:business|dp:business:' + idem).slice(0, 20).toUpperCase();
    if (bank.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === 'betaald') return { idem, id };
  }
  throw new Error('geen deterministische betaalsleutel');
}
const wacht = ms => new Promise(r => setTimeout(r, ms));
async function tot(fn, tekst) {
  for (let i = 0; i < 200; i++) { const r = await fn(); if (r) return r; await wacht(50); }
  throw new Error('checkpoint niet bereikt: ' + tekst);
}
test('Directpay: twee workers, conflicterende retries en echte procescrashes', { skip, timeout: 180000 }, async t => {
  const iso = await bron('./lib/living-world-pg-database')(URL);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deepgreen-directpay-'));
  const { Pool } = bron('../server/pgwire');
  const pool = new Pool({ connectionString: iso.url, max: 1 });
  const kluis = bron('../server/kluis');
  const workers = [];
  const env = { DATABASE_URL: iso.url, PG_URL: '', REDIS_URL: '', RTG_STORE: 'postgres',
    SMTP_URL: '', RTG_ENC_KEY: '', RTG_SIMULATIEBANK: '1', RTG_DP_PROEF_MARKER: '',
    RTG_DP_PROEF_ROOT: ROOT, DEMO_SUPPLIER: 'MAISON', STRIPE_SECRET_KEY: '', MOLLIE_API_KEY: '', ADYEN_API_KEY: '' };
  const api = async (w, pad, body, token = w.token) => {
    const res = await fetch(w.base + '/api/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body || {}), signal: AbortSignal.timeout(20000) });
    return { status: res.status, body: await res.json() };
  };
  async function start(naam, marker) {
    const w = await startServer({ script: path.join(__dirname, 'fixtures/directpay-crash-worker.cjs'),
      env: { ...env, RTG_DATA_DIR: path.join(tmp, naam), RTG_DP_PROEF_MARKER: marker || '' } });
    workers.push(w);
    w.token = (await api(w, 'login', { tier: 'business' }, null)).body.token;
    assert.ok(w.token, 'testaccount op worker ' + naam);
    return w;
  }
  const body = (k, meer = {}) => ({ supplierCode: 'MAISON', bedrag: 7.31, idem: k.idem, ...meer });
  const betaal = (w, k, meer) => api(w, 'betaal/direct', body(k, meer));
  async function opgeslagen(k) {
    const { rows } = await pool.query("SELECT key,val FROM kv WHERE key IN ('directBetalingen','directOntvangsten','betaalWaarheid') AND NOT weg");
    const d = Object.fromEntries(rows.map(r => [r.key, JSON.parse(kluis.ontsleutel(r.val))]));
    return { d, betalingen: (d.directBetalingen || []).filter(b => b.idem === 'dp:business:' + k.idem),
      waarheid: (d.betaalWaarheid || {})[k.id] };
  }
  function preciesEen(s) {
    assert.equal(s.betalingen.length, 1, 'één duurzame partnerboeking');
    assert.equal(s.betalingen[0].bedrag, 731);
    assert.ok(s.waarheid && s.waarheid.afgehandeldAt, 'duurzame afhandelbevestiging');
    const alle = (s.d.directBetalingen || []).filter(b => b.supplierCode === 'MAISON');
    assert.equal(s.d.directOntvangsten.MAISON.som, alle.reduce((n, b) => n + b.bedrag, 0), 'teller en boekingen blijven gelijk');
  }
  try {
    const a = await start('a'), b = await start('b');
    assert.notEqual(a.child.pid, b.child.pid);
    await t.test('geen sessie mag geen financiële toestand wijzigen', async () => {
      const k = sleutel('deepgreen-onbevoegd');
      const voor = await opgeslagen(k);
      assert.equal((await api(a, 'betaal/direct', body(k), null)).status, 401);
      assert.equal((await api(b, 'betaal/direct', body(k), 'ongeldige-sessie')).status, 401);
      assert.deepEqual(await opgeslagen(k), voor);
    });
    await t.test('zelfde sleutel over twee processen en conflicting payload', async () => {
      const k = sleutel('deepgreen-race');
      const uit = await Promise.all([betaal(a, k), betaal(b, k)]);
      assert.ok(uit.some(r => r.status === 200), JSON.stringify(uit));
      assert.ok(uit.every(r => [200, 409, 503].includes(r.status)), JSON.stringify(uit));
      const retry = await betaal(b, k);
      assert.equal(retry.status, 200, JSON.stringify(retry));
      preciesEen(await opgeslagen(k));
      assert.equal((await betaal(a, k, { bedrag: 8.31 })).status, 409);
      preciesEen(await opgeslagen(k));
    });
    await t.test('worker dood na providerantwoord, retry op andere worker', async () => {
      const k = sleutel('deepgreen-provider-crash'), marker = path.join(tmp, 'provider-checkpoint.json');
      const c = await start('crash', marker);
      const request = betaal(c, k).catch(e => ({ fout: e.name }));
      await tot(() => fs.existsSync(marker), 'provider heeft geantwoord');
      const punt = JSON.parse(fs.readFileSync(marker));
      assert.equal(punt.fase, 'provider-antwoord-voor-verwerking');
      assert.equal(punt.sleutel, 'waarheid:' + k.id);
      const exit = new Promise(r => c.child.once('exit', r));
      c.child.kill('SIGKILL'); await exit;
      const verloren = await request;
      assert.notEqual(verloren.status, 200, 'geen vals succesvol antwoord vóór verwerking');
      const retry = await betaal(b, k);
      assert.equal(retry.status, 200, JSON.stringify(retry));
      preciesEen(await opgeslagen(k));
    });
    await t.test('na bevestigde commit worker kwijt, retry uit vers proces', async () => {
      const k = sleutel('deepgreen-antwoordverlies');
      const betaald = await betaal(a, k); // commit bevestigd; bootst verlies aan de clientkant na
      assert.equal(betaald.status, 200, JSON.stringify(betaald));
      const exit = new Promise(r => a.child.once('exit', r));
      a.child.kill('SIGKILL'); await exit;
      const vers = await start('herstart');
      const retry = await betaal(vers, k);
      assert.equal(retry.status, 200, JSON.stringify(retry));
      assert.equal(retry.body.betaling.ref, betaald.body.betaling.ref);
      preciesEen(await opgeslagen(k));
    });
  } finally {
    for (const w of workers) await stop(w);
    await pool.end();
    await iso.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
