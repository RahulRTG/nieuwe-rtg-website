/* Echte HTTP-workers delen alleen PostgreSQL. Alle data leeft in een verse
   testdatabase. Geen productie- of stroomuitvalclaim. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const crypto = require('node:crypto');
const ROOT = process.env.RTG_ONB_PROEF_ROOT || path.resolve(__dirname, '..');
const bron = require('node:module').createRequire(path.join(ROOT, 'test/onboarding-workers.pg.test.js'));
const { startServer, stopHard } = bron('./helper');
const URL = process.env.DATABASE_URL || process.env.PG_URL;
const skip = bron('./infra').vereist('pg', !!URL, 'vereist echte PostgreSQL voor ondertekeningen over workers en procescrashes');
async function checkpoint(pad) {
  for (let i = 0; i < 200; i++) {
    if (fs.existsSync(pad)) return JSON.parse(fs.readFileSync(pad));
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('Ondertekencheckpoint niet bereikt: ' + pad);
}
test('RTF ondertekening: twee workers, onveranderlijke versies en procescrashherstel', { skip, timeout: 180000 }, async t => {
  const iso = await bron('./lib/living-world-pg-database')(URL);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-onboarding-workers-'));
  const { Pool } = bron('../server/pgwire'), kluis = bron('../server/kluis');
  const pool = new Pool({ connectionString: iso.url, max: 1 });
  const ownerEmail = 'onboarding-owner@rtg-test.nl', workers = [];
  const env = { DATABASE_URL: iso.url, PG_URL: '', REDIS_URL: '', RTG_STORE: 'postgres',
    RTG_ENC_KEY: '', SMTP_URL: '', RTG_OWNER_EMAIL: ownerEmail, RTG_ONB_PROEF_ROOT: ROOT,
    RTG_VAULT_KEY: crypto.randomBytes(32).toString('hex'),
    RTG_SECRET_KEY: crypto.randomBytes(32).toString('hex') };
  async function start(naam, fase) {
    const w = await startServer({ script: path.join(__dirname, 'fixtures/onboarding-crash-worker.cjs'),
      env: { ...env, RTG_DATA_DIR: path.join(tmp, naam), RTG_ONB_PROEF_FASE: fase || '',
        RTG_ONB_PROEF_MARKER: fase ? path.join(tmp, naam + '.json') : '' } });
    workers.push(w); return w;
  }
  async function api(w, pad, body, token) {
    const r = await fetch(w.base + '/api/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body || {}), signal: AbortSignal.timeout(20000) });
    return { status: r.status, body: await r.json() };
  }
  async function lees() {
    const { rows } = await pool.query("SELECT val FROM kv WHERE key='onboarding' AND NOT weg");
    return rows.length ? JSON.parse(kluis.ontsleutel(rows[0].val)) : {};
  }
  const dood = w => stopHard(w.child);
  try {
    const a = await start('a');
    const b = await start('b');
    const gezin = await api(a, 'foundation/gezin/maak', { gezinsnaam: 'Ontvangstproef', naam: 'Sam Ouder', pin: '1234' });
    assert.equal(gezin.status, 200, JSON.stringify(gezin));
    const auth = { code: gezin.body.code, token: gezin.body.token };
    assert.ok(auth.code && auth.token);
    const st = await api(a, 'rtf/onboarding/status', auth);
    assert.equal(st.status, 200);
    const v1 = st.body.contract.versie, tekst1 = st.body.contract.tekst;
    const sign = (w, versie, naam = 'Sam Ouder', meer = {}) => api(w, 'rtf/onboarding/teken',
      { ...auth, naam, akkoord: true, expectedVersion: versie, ...meer });
    const ontvangsten = data => Object.values(data.profielen || {}).filter(p => p.ondertekeningen && p.ondertekeningen.rtg);
    const historie = data => {
      const p = ontvangsten(data); assert.equal(p.length, 1, 'één bevoegde profielhouder');
      return p[0].ondertekeningen.rtg;
    };
    let eerste;
    await t.test('parallel identiek akkoord houdt één eerste ontvangst; andere naam en anoniem weigeren', async () => {
      const race = await Promise.all([sign(a, v1), sign(b, v1)]);
      for (const r of race) assert.equal(r.status, 200, JSON.stringify(r));
      assert.equal(race[0].body.contract.ondertekendAt, race[1].body.contract.ondertekendAt);
      eerste = structuredClone(historie(await lees())[v1]);
      assert.equal(eerste.contract.tekst, tekst1);
      const ander = await sign(b, v1, 'Andere Naam');
      assert.equal(ander.status, 409); assert.equal(ander.body.code, 'name_conflict');
      for (const versie of [undefined, String(v1), v1 + 1]) assert.equal((await sign(b, versie)).status, 409);
      const anoniem = await sign(b, v1, 'Sam Ouder', { token: '' });
      assert.ok([401, 403, 404].includes(anoniem.status), JSON.stringify(anoniem));
      assert.deepEqual(historie(await lees())[v1], eerste);
    });
    const owner = (await api(a, 'auth/login', { login: ownerEmail, password: 'Imran', pasApp: 'business' })).body.token;
    assert.ok(owner, 'bestaande eigenaarsdeur');
    async function vernieuw(n) {
      const r = await api(a, 'onboarding/config/zet', { voorstel: { contract: {
        tekst: 'Overeenkomst ' + n + ': nieuwe afspraken vragen opnieuw expliciet akkoord.' } } }, owner);
      assert.equal(r.status, 200, JSON.stringify(r)); return r.body.config.contract.versie;
    }
    const v2 = await vernieuw(2);
    await t.test('nieuwe tekst weigert oude versie; commitfout bewaart geen ontvangst', async () => {
      assert.equal((await sign(b, v1)).status, 409);
      await pool.query("CREATE FUNCTION onb_weiger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.key='onboarding' THEN RAISE EXCEPTION 'test ondertekencommit geweigerd'; END IF; RETURN NEW; END $$");
      await pool.query('CREATE TRIGGER onb_weiger BEFORE INSERT OR UPDATE ON kv FOR EACH ROW EXECUTE FUNCTION onb_weiger()');
      try { assert.equal((await sign(b, v2)).status, 503); }
      finally { await pool.query('DROP TRIGGER onb_weiger ON kv'); await pool.query('DROP FUNCTION onb_weiger()'); }
      assert.equal(historie(await lees())[v2], undefined);
      assert.deepEqual(historie(await lees())[v1], eerste);
    });
    await t.test('SIGKILL vóór commit rolt ontvangst terug; retry op andere worker legt eenmaal vast', async () => {
      const c = await start('voor', 'voor-commit');
      const request = sign(c, v2).catch(e => ({ fout: e.name }));
      assert.equal((await checkpoint(path.join(tmp, 'voor.json'))).fase, 'voor-commit');
      await dood(c);
      assert.notEqual((await request).status, 200);
      assert.equal(historie(await lees())[v2], undefined);
      const retry = await sign(b, v2); assert.equal(retry.status, 200, JSON.stringify(retry));
      assert.equal(historie(await lees())[v2].at, retry.body.contract.ondertekendAt);
      assert.deepEqual(historie(await lees())[v1], eerste);
    });
    const v3 = await vernieuw(3);
    await t.test('SIGKILL na commit vóór antwoord bewaart eerste tijd; nieuw proces herhaalt dezelfde ontvangst', async () => {
      const c = await start('na', 'na-commit');
      const request = sign(c, v3).catch(e => ({ fout: e.name }));
      const punt = await checkpoint(path.join(tmp, 'na.json'));
      assert.equal(punt.fase, 'na-commit');
      assert.equal(historie(await lees())[v3].at, punt.at);
      await dood(c); assert.notEqual((await request).status, 200);
      const vers = await start('herstart');
      const retry = await sign(vers, v3); assert.equal(retry.status, 200, JSON.stringify(retry));
      assert.equal(retry.body.contract.ondertekendAt, punt.at);
      assert.deepEqual(Object.keys(historie(await lees())), [v1, v2, v3].map(String));
      assert.deepEqual(historie(await lees())[v1], eerste);
    });
  } finally {
    for (const w of workers) await dood(w);
    await pool.end(); await iso.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
