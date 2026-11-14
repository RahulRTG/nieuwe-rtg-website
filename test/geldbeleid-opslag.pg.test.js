'use strict';
/* Echte HTTP-responsepoort en onafhankelijke PG-lezer. Alleen synthetische
   oormerken; geen geldprovider en uitsluitend een eigen tijdelijke database. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stopHard } = require('./helper');
const { vereist } = require('./infra');
const bron = process.env.DATABASE_URL || process.env.PG_URL;
const skip = vereist('pg', !!bron, 'geldbeleid-opslag vereist echte PostgreSQL');
test('PG bevestigt pot en log vóór antwoord, behoudt retry na herstart en weigert opslagfouten', { skip, timeout: 120000 }, async () => {
  const iso = await require('./lib/living-world-pg-database')(bron);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-beleid-pg-'));
  const { Pool } = require('../server/pgwire');
  const pool = new Pool({ connectionString: iso.url, max: 1 });
  const env = { RTG_DATA_DIR: dir, DATABASE_URL: iso.url, PG_URL: '', REDIS_URL: '',
    RTG_STORE: 'postgres', RTG_ENC_KEY: '', SMTP_URL: '', MAIL_DIRECT: '' };
  let srv, token;
  async function api(pad, body) {
    const r = await fetch(srv.base + '/api/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body || {}), signal: AbortSignal.timeout(30000) });
    return { status: r.status, body: await r.json() };
  }
  const lees = async () => {
    const { rows } = await pool.query("SELECT val FROM kv WHERE key='geldbeleid' AND NOT weg");
    assert.equal(rows.length, 1); return JSON.parse(rows[0].val);
  };
  try {
    srv = await startServer({ env });
    const reg = await api('auth/register', { name: 'Beleid Proef', email: 'beleid@voorbeeld.test',
      phone: '0612345678', password: 'ProefGeheim123!', geboortedatum: '1990-05-05',
      geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
    assert.equal(reg.status, 200, JSON.stringify(reg)); token = reg.body.token; assert.ok(token);
    const body = { naam: 'Reis', doelCenten: 10000, idem: 'vaste-pot' };
    const eerste = await api('geld/pot/zet', body); assert.equal(eerste.status, 200, JSON.stringify(eerste));
    const vast = await lees(), lid = Object.values(vast.perLid).find(r => r.potten.some(p => p.id === eerste.body.pot.id));
    assert.ok(lid); assert.equal(lid.potten.length, 1); assert.equal(lid.log.length, 1);
    assert.equal((await api('geld/pot/zet', body)).body.herhaald, true); assert.deepEqual(await lees(), vast);
    await stopHard(srv.child); srv = await startServer({ env }); token = null;
    const login = await api('auth/login', { login: 'beleid@voorbeeld.test', password: 'ProefGeheim123!' });
    assert.equal(login.status, 200, JSON.stringify(login)); token = login.body.token; assert.ok(token);
    assert.equal((await api('geld/pot/zet', body)).body.herhaald, true); assert.deepEqual(await lees(), vast);
    await pool.query('CREATE SEQUENCE beleidsfout_geraakt');
    await pool.query(`CREATE FUNCTION weiger_geldbeleid() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.key='geldbeleid' THEN PERFORM nextval('beleidsfout_geraakt');
        RAISE EXCEPTION 'beleidsproef weigert write'; END IF; RETURN NEW; END $$`);
    await pool.query('CREATE TRIGGER weiger_geldbeleid BEFORE INSERT OR UPDATE ON kv FOR EACH ROW EXECUTE FUNCTION weiger_geldbeleid()');
    assert.equal((await pool.query('SELECT is_called FROM beleidsfout_geraakt')).rows[0].is_called, false);
    const fout = await api('geld/pot/zet', { naam: 'Buffer', doelCenten: 2000, idem: 'tweede-pot' });
    assert.equal(fout.status, 503, JSON.stringify(fout)); assert.deepEqual(await lees(), vast);
    assert.equal((await pool.query('SELECT is_called FROM beleidsfout_geraakt')).rows[0].is_called, true,
      'de echte write-trigger moet geraakt zijn; een vooraf gesloten poort bewijst niets');
    await pool.query('DROP TRIGGER weiger_geldbeleid ON kv');
    // De responsepoort sluit na een echte commitfout terecht tot resync.
    // Een verse worker bewijst herstel vanaf PG, niet vanaf de mislukte RAM.
    await stopHard(srv.child); srv = await startServer({ env }); token = null;
    const herlogin = await api('auth/login', { login: 'beleid@voorbeeld.test', password: 'ProefGeheim123!' });
    assert.equal(herlogin.status, 200, JSON.stringify(herlogin)); token = herlogin.body.token;
    const retry = await api('geld/pot/zet', { naam: 'Buffer', doelCenten: 2000, idem: 'tweede-pot' });
    assert.equal(retry.status, 200, JSON.stringify(retry));
    const na = Object.values((await lees()).perLid).find(r => r.potten.some(p => p.id === eerste.body.pot.id));
    assert.equal(na.potten.length, 2); assert.equal(na.log.length, 2);
  } finally {
    if (srv) await stopHard(srv.child);
    await pool.end(); await iso.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});
