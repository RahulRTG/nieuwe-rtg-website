'use strict';
/* Echte workers, bestaande fee-/Pay-kern en PG-requestcommit. Alleen de
   tariefconfiguratie is €7 en de wallet bevat synthetisch fixturegeld.
   Geen extern provider-, autorisatie- of werkelijk crashvensterbewijs. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop } = require('./helper');
async function sluitWorker(w) {
  if (!w || w.child.exitCode !== null || w.child.signalCode !== null) return;
  const klaar = new Promise(r => w.child.once('exit', r)); stop(w); await klaar;
}
const { vereist } = require('./infra');
const URL = process.env.DATABASE_URL || process.env.PG_URL;
const skip = vereist('pg', !!URL, 'assetfee-workers vereist echte PostgreSQL');
const wacht = ms => new Promise(r => setTimeout(r, ms));
test('assetfee: twee workers boeken één ticketjaar, retries en herstart behouden de kas', { skip, timeout: 180000 }, async t => {
  const iso = await require('./lib/living-world-pg-database')(URL);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-asset-workers-'));
  const { maakPg } = require('../server/pg');
  const pg = maakPg({ url: iso.url, merge3: require('../server/db/merge').merge3,
    kluis: require('../server/kluis'), log: { warn() {} } });
  const workers = [], barrier = path.join(tmp, 'barriere');
  const jaar = require('../server/kern/tijdzone').jaarIn();
  const env = { DATABASE_URL: iso.url, PG_URL: '', REDIS_URL: '', RTG_STORE: 'postgres',
    RTG_SIMULATIEBANK: '1', OFFICE_CODE: 'RTG-ASSET-PROEF', SMTP_URL: '',
    STRIPE_SECRET_KEY: '', MOLLIE_API_KEY: '', ADYEN_API_KEY: '' };
  async function api(w, pad, body = {}, token = w.token) {
    const r = await fetch(w.base + '/api/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    return { status: r.status, body: await r.json() };
  }
  async function start(naam, samen = false) {
    const w = await startServer({ script: path.join(__dirname, 'fixtures/assets-fee-worker.cjs'),
      env: { ...env, RTG_DATA_DIR: path.join(tmp, naam), RTG_ASSET_BARRIER: samen ? barrier : '' } });
    workers.push(w);
    const login = await api(w, 'office/login', { code: env.OFFICE_CODE }, null);
    assert.equal(login.status, 200, JSON.stringify(login)); w.token = login.body.token;
    return w;
  }
  async function controle() {
    const d = await pg.laadAlles();
    assert.equal(d.assetTickets.filter(t => t.id === 'fee-workers-ticket').length, 1);
    assert.equal(d.assetTickets[0].feeJaar, jaar);
    assert.equal(d.assetKas['sa-villa'], 700, 'één poolkasbijschrijving');
    const boekingen = d.payBoekingen.filter(b => b.soort === 'huis' && b.van === 'lid:FEE-PROEF');
    assert.equal(boekingen.length, 1, 'één echte Pay-huisboeking');
    assert.equal(d.paySaldi['lid:FEE-PROEF'], 9300);
    assert.equal(d.paySaldi['extern:treasury'], 700);
  }
  try {
    const warm = await start('warm');
    await pg.schema();
    await t.test('lege assettoestand initialiseert duurzaam zonder 500 of gefingeerde inning', async () => {
      const leeg = await api(warm, 'office/asset/fees');
      assert.equal(leeg.status, 200, JSON.stringify(leeg));
      assert.equal(leeg.body.geind, 0); assert.equal(leeg.body.totaal, 0);
      assert.equal(leeg.body.mislukt, 0);
      const opgeslagen = await pg.laadAlles();
      for (const key of ['assetTickets', 'assetGebruik', 'assetTerugkoop', 'assetWachtlijst'])
        assert.deepEqual(opgeslagen[key], [], 'lege collectie duurzaam: ' + key);
      assert.deepEqual(opgeslagen.assetKas, {});
      assert.ok(Array.isArray(opgeslagen.sharedAssets) && opgeslagen.sharedAssets.length > 0);
    });
    await sluitWorker(warm);
    const fixture = { assetTickets: [{ id: 'fee-workers-ticket', assetId: 'sa-villa',
      key: 'fixture-lid', codenaam: 'FEE-PROEF', status: 'actief', feeJaar: jaar - 1 }],
      assetKas: {}, assetGebruik: [], assetTerugkoop: [], assetWachtlijst: [],
      sharedAssets: [{ id: 'sa-villa', naam: 'Synthetische proefvilla', entiteit: 'Fixturepool', waarde: 6000000 }],
      paySaldi: { 'lid:FEE-PROEF': 10000, 'extern:treasury': 0 }, payBoekingen: [] };
    // De voorrangsbaan schrijft uitsluitend haar eigen (financiële) sleutels.
    // Assets horen bij de gewone baan; beide moeten vóór workerstart vaststaan.
    await pg.flushVoorrang(fixture);
    await pg.flush(fixture, true);
    const ingezaaid = await pg.laadAlles();
    for (const [key, value] of Object.entries(fixture)) assert.deepEqual(ingezaaid[key], value, 'fixture duurzaam: ' + key);
    const a = await start('a', true), b = await start('b', true);
    assert.notEqual(a.child.pid, b.child.pid);
    const beide = Promise.all([api(a, 'office/asset/fees'), api(b, 'office/asset/fees')]);
    const eind = Date.now() + 15000;
    while (![a, b].every(w => fs.existsSync(barrier + '.' + w.child.pid))) {
      if (Date.now() > eind) throw new Error('niet beide fee-rondes bereikten de echte huisbetaling');
      await wacht(25);
    }
    fs.writeFileSync(barrier + '.vrij', 'ga');
    const antwoorden = await beide;
    assert.ok(antwoorden.some(r => r.status === 200 && r.body.geind === 1), JSON.stringify(antwoorden));
    assert.ok(antwoorden.every(r => [200, 409, 503].includes(r.status)), JSON.stringify(antwoorden));
    await controle();
    await sluitWorker(a); await sluitWorker(b);
    const vers = await start('vers');
    for (let i = 0; i < 2; i++) {
      const r = await api(vers, 'office/asset/fees');
      assert.equal(r.status, 200, JSON.stringify(r)); assert.equal(r.body.geind, 0);
      await controle();
    }
  } finally {
    for (const w of workers) await sluitWorker(w);
    await pg.pool.end(); await iso.close(); fs.rmSync(tmp, { recursive: true, force: true });
  }
});
