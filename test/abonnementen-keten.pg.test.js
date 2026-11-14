/* Echte PostgreSQL + productie-accounttransacties + responsecommit, gelezen
   via een tweede verbinding. Provider/fonds zijn synthetisch; dit bewijst geen
   live Stripe, volledige auth/routerketen, fondsboekhouding of stroomuitval. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const crypto = require('node:crypto'), { fork } = require('node:child_process');
const url = process.env.DATABASE_URL || process.env.PG_URL;
const skip = require('./infra').vereist('pg', !!url, 'abonnementketen vereist echte PostgreSQL');

test('PG-abonnement: specifiek tekenen, verloren commitantwoord, activering en herstartretry',
  { skip, timeout: 120000 }, async t => {
  const iso = await require('./lib/living-world-pg-database')(url);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-abonnement-pg-'));
  const { Pool } = require('../server/pgwire'), pool = new Pool({ connectionString: iso.url, max: 1 });
  const workers = [], vault = crypto.randomBytes(32).toString('hex');
  const env = { ...process.env, NODE_ENV: 'production', DATABASE_URL: iso.url, PG_URL: '',
    RTG_STORE: 'postgres', REDIS_URL: '', RTG_ENC_KEY: '', RTG_KLOK: '', RTG_VAULT_KEY: vault,
    RTG_VAULT_RING: '', RTG_SECRET_KEY: crypto.randomBytes(32).toString('hex'),
    SMTP_URL: '', STRIPE_SECRET_KEY: '', MOLLIE_API_KEY: '', ADYEN_API_KEY: '' };
  async function start(naam) {
    const child = fork(path.join(__dirname, 'fixtures/abonnementen-keten-pg.cjs'), [], {
      cwd: path.join(__dirname, '..'), env: { ...env, RTG_DATA_DIR: path.join(tmp, naam) },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    workers.push(child); let log = '';
    child.stdout.on('data', b => { log += b; }); child.stderr.on('data', b => { log += b; });
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('PG-keten startte niet: ' + log)), 30000);
      const klaar = fn => x => { clearTimeout(timer); fn(x); };
      child.once('error', klaar(reject));
      child.once('exit', klaar(c => reject(Error('PG-keten stopte (' + c + '): ' + log))));
      child.once('message', klaar(m => resolve(m)));
    });
    return { child, base: 'http://127.0.0.1:' + port.port, accountId: port.accountId, log: () => log };
  }
  async function stop(child) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGKILL'); });
  }
  async function api(w, actie, body = {}, verlies = false) {
    const r = await fetch(w.base + '/' + actie, { method: 'POST', headers: {
      'content-type': 'application/json', ...(verlies ? { 'x-proef-antwoordverlies': '1' } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    return { status: r.status, body: await r.json() };
  }
  async function inspectie(w) { return (await fetch(w.base + '/inspectie')).json(); }
  async function lees(accountId) {
    const { rows } = await pool.query("SELECT key,val FROM kv WHERE key IN ('contracten','onboarding','betaalWaarheid','lidmaatschapBetalingen') AND NOT weg");
    const d = Object.fromEntries(rows.map(r => [r.key, JSON.parse(r.val)]));
    const u = (await pool.query('SELECT id,tier,member_state FROM users WHERE id=$1', [accountId])).rows[0];
    assert.ok(u); assert.match(u.member_state, /^RTGV2:/, 'eigen factuurdossier blijft versleuteld');
    // Onafhankelijke lezer kent alleen de testkey en het bestaande gebonden formaat.
    const b = Buffer.from(u.member_state.slice(6), 'base64');
    const dec = crypto.createDecipheriv('aes-256-gcm', Buffer.from(vault, 'hex'), b.subarray(0, 12));
    dec.setAAD(Buffer.from('rtg-kluis-v2|users|member_state|' + u.id)); dec.setAuthTag(b.subarray(12, 28));
    return { ...d, tier: u.tier, md: JSON.parse(Buffer.concat([dec.update(b.subarray(28)), dec.final()]).toString()) };
  }
  function goed(r) { assert.equal(r.status, 200, JSON.stringify(r)); return r.body; }
  let w, id, bwId, invoiceId, accountId;
  try {
    w = await start('eerste'); accountId = w.accountId;
    assert.ok(Number.isInteger(accountId)); assert.equal((await inspectie(w)).accountsTransactioneel, true);
    await t.test('aanbod en specifieke handtekening staan vóór betaling duurzaam vast', async () => {
      const b = { pas: 'rtg', frequentie: 'maand', idempotencyKey: crypto.randomUUID() };
      const r = goed(await api(w, 'aanbod', b)); id = r.contract.id;
      assert.equal(goed(await api(w, 'aanbod', b)).contract.id, id);
      const teken = { contractId: id, aanbodHash: r.contract.aanbod.hash,
        naam: 'PG ketenproef', akkoord: true, doorlopendeBetalingAkkoord: true };
      assert.equal((await api(w, 'teken', { ...teken, aanbodHash: '0'.repeat(64) })).status, 409);
      goed(await api(w, 'teken', teken));
      const d = await lees(accountId); assert.equal(d.contracten.find(c => c.id === id).status, 'GEACCEPTEERD');
      assert.ok(d.onboarding.profielen['user-' + accountId].ondertekend['abonnement:' + id]);
      assert.equal(d.tier, 'guest'); assert.equal(d.md.invoices.length, 0);
      assert.equal((await inspectie(w)).providerCalls, 0);
    });
    await t.test('verloren antwoord na echte voorbereidingscommit start geen provider en retry behoudt één BW', async () => {
      const r = await api(w, 'betaal', { contractId: id }, true);
      assert.equal(r.status, 503); assert.match(r.body.error, /echte COMMIT/);
      const d = await lees(accountId), betalingen = Object.values(d.betaalWaarheid);
      assert.equal(betalingen.length, 1); bwId = betalingen[0].id;
      assert.equal(betalingen[0].start.terugkerend.modus, 'vastleggen');
      assert.equal(d.md.invoices.length, 0); assert.equal(d.tier, 'guest');
      assert.equal((await inspectie(w)).providerCalls, 0);
      assert.equal(goed(await api(w, 'betaal', { contractId: id })).status, 'WACHT_OP_KLANT');
      const na = await lees(accountId); assert.equal(na.md.invoices.length, 1); invoiceId = na.md.invoices[0].id;
      assert.equal(Object.values(na.betaalWaarheid).length, 1); assert.ok(na.betaalWaarheid[bwId]);
      assert.equal(na.tier, 'guest'); assert.equal((await inspectie(w)).providerCalls, 1);
    });
    await t.test('bevestigde providerfixture activeert en herhaalt zonder tweede factuur of inning', async () => {
      goed(await api(w, 'provider/bevestig'));
      assert.equal(goed(await api(w, 'herstel', { contractId: id })).status, 'ACTIEF');
      assert.equal(goed(await api(w, 'herstel', { contractId: id })).status, 'ACTIEF');
      const d = await lees(accountId); assert.equal(d.tier, 'rtg'); assert.equal(d.md.invoices.length, 1);
      assert.equal(d.md.invoices[0].id, invoiceId); assert.equal(d.md.invoices[0].status, 'paid');
      assert.equal(d.md.invoices[0].betaalBewijzen.length, 1);
      assert.equal(d.betaalWaarheid[bwId].status, 'BEVESTIGD'); assert.ok(d.betaalWaarheid[bwId].afgehandeldAt);
      assert.equal(d.contracten.find(c => c.id === id).status, 'ACTIEF');
      assert.equal((await inspectie(w)).providerCalls, 1);
    });
    await t.test('SIGKILL en koude cache lezen dezelfde ontvangst; retry doet geen nieuwe providerstart', async () => {
      const voor = await lees(accountId); await stop(w.child); w = await start('herstart');
      assert.equal(w.accountId, accountId);
      assert.equal(goed(await api(w, 'herstel', { contractId: id })).status, 'ACTIEF');
      assert.deepEqual(await lees(accountId), voor);
      assert.equal((await inspectie(w)).providerCalls, 0, 'nieuwe worker start geen tweede Checkout');
    });
  } finally {
    for (const child of workers) await stop(child);
    await pool.end(); await iso.close(); fs.rmSync(tmp, { recursive: true, force: true });
  }
});
