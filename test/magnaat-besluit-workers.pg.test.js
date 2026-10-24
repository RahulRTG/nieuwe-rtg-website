/* Twee echte processen en één PostgreSQL-waarheid. Bewijst dat een economisch
   besluit met lening over workers en herstart heen één zakelijke handeling
   blijft, terwijl dezelfde clientsleutel van een andere actor een eigen
   opdracht is. Alle bedragen en accounts zijn synthetische testdata. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const { vereist } = require('./infra');
const URL = process.env.DATABASE_URL || process.env.PG_URL;
const skip = vereist('pg', !!URL, 'Magnaat-besluitworkers vereisen echte PostgreSQL');

async function sluit(w) {
  if (!w || w.child.exitCode !== null || w.child.signalCode !== null) return;
  const klaar = new Promise(resolve => w.child.once('exit', resolve));
  stop(w); await klaar;
}

test('Magnaat-besluit: twee workers, herstart, conflict en actorisolatie', { skip, timeout: 180000 }, async () => {
  const iso = await require('./lib/living-world-pg-database')(URL);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-magnaat-besluit-'));
  const workers = [];
  const env = { DATABASE_URL: iso.url, PG_URL: '', REDIS_URL: '', RTG_STORE: 'postgres',
    SMTP_URL: '', RTG_SIMULATIEBANK: '1', STRIPE_SECRET_KEY: '', MOLLIE_API_KEY: '', ADYEN_API_KEY: '' };
  async function api(w, pad, body = {}, token = w.token) {
    const res = await fetch(w.base + '/api/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    return { status: res.status, body: await res.json() };
  }
  async function start(naam) {
    const w = await startServer({ env: { ...env, RTG_DATA_DIR: path.join(tmp, naam) } });
    workers.push(w); return w;
  }
  async function demo(w, tier) {
    const r = await api(w, 'login', { tier }, null);
    assert.equal(r.status, 200, JSON.stringify(r)); return r.body.token;
  }
  try {
    const a = await start('a');
    a.token = await demo(a, 'rtg');
    const b = await start('b');
    b.token = await demo(b, 'rtg');

    const opdracht = { lening: 1000, idem: 'workers-lening-1' };
    const tegelijk = await Promise.all([api(a, 'member/magnaat/economie/beslis', opdracht), api(b, 'member/magnaat/economie/beslis', opdracht)]);
    assert.ok(tegelijk.every(r => [200, 409, 503].includes(r.status)), JSON.stringify(tegelijk));
    assert.ok(tegelijk.some(r => r.status === 200), JSON.stringify(tegelijk));
    for (const r of tegelijk.filter(r => r.status !== 200)) {
      const herstel = await api(r === tegelijk[0] ? a : b, 'member/magnaat/economie/beslis', opdracht);
      assert.equal(herstel.status, 200, JSON.stringify(herstel));
    }

    await sluit(a); await sluit(b);
    const vers = await start('vers');
    vers.token = await demo(vers, 'rtg');
    const replay = await api(vers, 'member/magnaat/economie/beslis', opdracht);
    assert.equal(replay.status, 200, JSON.stringify(replay));
    assert.equal(replay.body.herhaald, true);
    assert.equal(replay.body.strategie.schuld, 100000, 'één lening van €1.000 in centen');
    const conflict = await api(vers, 'member/magnaat/economie/beslis', { lening: 1001, idem: opdracht.idem });
    assert.equal(conflict.status, 409, JSON.stringify(conflict));

    vers.token = await demo(vers, 'business');
    const eigen = await api(vers, 'member/magnaat/economie/beslis', opdracht);
    assert.equal(eigen.status, 200, JSON.stringify(eigen));
    assert.equal(eigen.body.herhaald, false);
    assert.equal(eigen.body.strategie.schuld, 200000, 'dezelfde clientsleutel van een andere actor is een tweede opdracht');
  } finally {
    for (const w of workers) await sluit(w);
    await iso.close(); fs.rmSync(tmp, { recursive: true, force: true });
  }
});
