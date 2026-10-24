/* Echte aanvraagroute en PostgreSQL, met procesverlies na beide writes en
   vóór/na COMMIT. Geen host-, stroomuitval- of volledige platformclaim. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stopHard } = require('./helper');
const URL = process.env.DATABASE_URL || process.env.PG_URL;
const skip = require('./infra').vereist('pg', !!URL, 'aanvraagcrash vereist echte PostgreSQL');
test('aanvraag: SIGKILL rond gezamenlijke COMMIT behoudt één intentie en eerste ontvangst',
  { skip, timeout: 180000 }, async t => {
  const iso = await require('./lib/living-world-pg-database')(URL), workers = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aanvraag-crash-'));
  const { Pool } = require('../server/pgwire'), pool = new Pool({ connectionString: iso.url, max: 1 });
  const env = { DATABASE_URL: iso.url, PG_URL: '', REDIS_URL: '', RTG_STORE: 'postgres', RTG_ENC_KEY: '',
    RTG_VAULT_KEY: crypto.randomBytes(32).toString('hex'), RTG_SECRET_KEY: crypto.randomBytes(32).toString('hex'),
    RTG_OWNER_EMAIL: 'aanvraag-crash@fixture.test', DEMO_PASS: 'AanvraagCrashFixture123!',
    SMTP_URL: '', STRIPE_SECRET_KEY: '', MOLLIE_API_KEY: '', ADYEN_API_KEY: '' };
  async function start(naam, fase = '') {
    const w = await startServer({ script: path.join(__dirname, 'fixtures/aanmelding-crash-worker.cjs'),
      env: { ...env, RTG_DATA_DIR: path.join(tmp, naam), RTG_AANVRAAG_CRASH_FASE: fase,
        RTG_AANVRAAG_CRASH_MARKER: path.join(tmp, naam + '.json') } });
    workers.push(w); return w;
  }
  async function vraag(w, body) {
    const r = await fetch(w.base + '/api/aanmelding/aanvraag', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': body.idem },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    return { status: r.status, body: await r.json() };
  }
  async function opgeslagen() {
    const { rows } = await pool.query("SELECT key,val FROM kv WHERE key IN ('aanmeldingen','aanmeldingOntvangsten') AND NOT weg ORDER BY key");
    return Object.fromEntries(rows.map(r => [r.key, JSON.parse(r.val)]));
  }
  async function checkpoint(naam) {
    const p = path.join(tmp, naam + '.json'), eind = Date.now() + 15000;
    while (Date.now() < eind) {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw Error('Aanvraag-COMMIT-checkpoint ontbreekt: ' + naam);
  }
  const ontvangsten = d => Object.values(d.aanmeldingOntvangsten?.ontvangsten || {});
  const nieuw = naam => ({ idem: crypto.randomUUID(), pas: 'rtg', naam, contact: 'crash@fixture.test' });
  function goed(r) {
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.deepEqual(Object.keys(r.body).sort(), ['ok', 'ontvangst']);
    assert.deepEqual(Object.keys(r.body.ontvangst).sort(), ['aanvraagId', 'at', 'id', 'status']);
    assert.equal(r.body.ontvangst.status, 'ontvangen'); return r.body;
  }
  try {
    const a = await start('a'), b = await start('b');
    assert.notEqual(a.child.pid, b.child.pid);
    const controle = nieuw('Positieve controle');
    assert.deepEqual(goed(await vraag(b, controle)), goed(await vraag(a, controle)));
    assert.equal((await opgeslagen()).aanmeldingen.length, 1);
    for (const fase of ['voor-commit', 'na-commit']) await t.test('SIGKILL ' + fase, async () => {
      const crash = await start(fase, fase), body = nieuw('Crash ' + fase);
      const voor = await opgeslagen(), voorReceipts = new Set(ontvangsten(voor).map(r => r.ontvangst.id));
      const pending = vraag(crash, body).catch(e => ({ netwerkfout: e.name }));
      const punt = await checkpoint(fase);
      assert.equal(punt.fase, fase);
      for (const k of ['aanmeldingen', 'aanmeldingOntvangsten']) assert.ok(punt.geschreven.includes(k));
      await stopHard(crash.child);
      assert.notEqual((await pending).status, 200, 'geen succesantwoord vóór procesverlies');
      const na = await opgeslagen(), effecten = na.aanmeldingen.filter(r => r.naam === body.naam);
      const toegevoegd = ontvangsten(na).filter(r => !voorReceipts.has(r.ontvangst.id));
      if (fase === 'voor-commit') assert.deepEqual(na, voor, 'beide writes zijn samen teruggedraaid');
      else {
        assert.equal(effecten.length, 1); assert.equal(toegevoegd.length, 1);
        assert.equal(toegevoegd[0].ontvangst.aanvraagId, effecten[0].id);
        assert.equal(toegevoegd[0].ontvangst.at, effecten[0].at);
      }
      const hervat = await start('herstart-' + fase), retry = goed(await vraag(hervat, body));
      if (fase === 'na-commit') assert.deepEqual(retry.ontvangst, toegevoegd[0].ontvangst,
        'eerste duurzame id, aanvraagId en tijd blijven na verloren antwoord');
      assert.deepEqual(goed(await vraag(a, body)), retry, 'andere worker geeft hetzelfde bewijs');
      assert.equal((await vraag(b, { ...body, naam: 'Gewijzigd' })).status, 409);
      const eind = await opgeslagen();
      assert.equal(eind.aanmeldingen.length, voor.aanmeldingen.length + 1);
      assert.equal(eind.aanmeldingen.filter(r => r.naam === body.naam).length, 1);
      assert.equal(ontvangsten(eind).length, ontvangsten(voor).length + 1);
      assert.equal(ontvangsten(eind).filter(r => r.ontvangst.id === retry.ontvangst.id).length, 1);
    });
  } finally {
    for (const w of workers) await stopHard(w.child);
    await pool.end(); await iso.close(); fs.rmSync(tmp, { recursive: true, force: true });
  }
});
