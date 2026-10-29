'use strict';
/* PG-poort; geen HTTP- of crashproef. */
const test = require('node:test'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const url = process.env.DATABASE_URL || process.env.PG_URL;
const skip = require('./infra').vereist('pg', !!url, 'meervoudige collectietransactie vereist PG');
const kopie = v => JSON.parse(JSON.stringify(v));

test('getypeerde collectiepoort: PG-atomiciteit en versheid',
{ skip, timeout: 60000 }, async t => {
const iso = await require('./lib/living-world-pg-database')(url), instanties = [];
const { maakPg } = require('../server/pg'), { merge3 } = require('../server/db/merge');
const kluis = require('../server/kluis'), keten = require('../server/lib/keten');
function nieuw() {
  const pg = maakPg({ url: iso.url, merge3, kluis, log: { warn() {} } });
  instanties.push(pg); return pg;
}
const a = nieuw(), b = nieuw(), dataA = {}, dataB = {};
const type = { aanvragen: 'lijst', ontvangsten: 'kaart' }, idem = randomUUID(); let creaties = 0;
const ontvangst = { id: 'ontvangst-1', aanvraagId: 'aanvraag-1', at: '2026-10-22T12:00:00.000Z' };
function eenmaal(w) {
  assert.ok(Array.isArray(w.aanvragen));
  assert.equal(Array.isArray(w.ontvangsten), false);
  if (w.ontvangsten[idem]) return kopie(w.ontvangsten[idem]);
  assert.deepEqual(w.aanvragen, []); assert.deepEqual(w.ontvangsten, {});
  creaties++;
  w.aanvragen.push({ id: ontvangst.aanvraagId });
  w.ontvangsten[idem] = kopie(ontvangst); return kopie(ontvangst);
}
const ruw = async keys => (await a.pool.query(
  `SELECT key,val,ver,weg FROM kv WHERE key IN (${keys.map((_, i) => '$' + (i + 1))}) ORDER BY key`, keys)).rows;
async function lees(k) {
  const [r] = await ruw([k]); return r && !r.weg ? JSON.parse(kluis.ontsleutel(r.val)) : undefined;
}
const lokaal = (pg, data) => kopie({ data, toegepast: [...pg._staat.toegepast], json: [...pg._staat.laatsteJson] });
async function zet(k, v) {
  await a.pool.query(`INSERT INTO kv(key,val,ver) VALUES($1,$2,nextval('kv_ver_seq'))
    ON CONFLICT(key) DO UPDATE SET val=EXCLUDED.val,ver=EXCLUDED.ver,weg=false`,
  [k, kluis.versleutel(JSON.stringify(v))]);
}
async function wisTrigger() { await a.pool.query('DROP TRIGGER IF EXISTS meervoudig_fout ON kv'); }
try {
  await a.schema();
  assert.equal((await a.pool.query('SELECT key FROM kv')).rows.length, 0);

  await t.test('race: lege containers, één creatie en ontvangst', async () => {
    const slot = await a.pool.connect(); let lopend, gewacht = false;
    try {
      await slot.query('BEGIN');
      await slot.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', ['aanvragen']);
      lopend = Promise.allSettled([
        a.bewerkCollectie(type, dataA, eenmaal), b.bewerkCollectie(type, dataB, eenmaal)
      ]);
      const einde = Date.now() + 5000;
      while (Date.now() < einde) {
        const q = await a.pool.query(`SELECT count(*)::int AS n FROM pg_locks
          WHERE locktype='advisory' AND NOT granted
          AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`);
        if (q.rows[0].n >= 2) { gewacht = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally { await slot.query('ROLLBACK'); slot.release(); }
    const uit = await lopend;
    for (const r of uit) {
      assert.equal(r.status, 'fulfilled', r.reason && r.reason.stack);
      assert.deepEqual(r.value, ontvangst);
    }
    assert.equal(gewacht, true, 'beide transacties wachtten op het PG-slot');
    assert.equal(creaties, 1);
    assert.deepEqual(await lees('aanvragen'), [{ id: ontvangst.aanvraagId }]);
    assert.deepEqual(await lees('ontvangsten'), { [idem]: ontvangst });
    assert.deepEqual(dataA, dataB);
  });

  await t.test('onbekende cache leest beide actuele collecties', async () => {
    const c = nieuw(), data = {}, voor = await ruw(Object.keys(type));
    assert.equal(c._staat.laatsteJson.size, 0);
    assert.deepEqual(await c.bewerkCollectie(type, data, eenmaal), ontvangst);
    assert.equal(creaties, 1);
    assert.deepEqual(await ruw(Object.keys(type)), voor);
    assert.deepEqual(data.aanvragen, [{ id: ontvangst.aanvraagId }]);
    assert.deepEqual(data.ontvangsten, { [idem]: ontvangst });
  });

  await t.test('tweede write faalt: DB/RAM/caches ongewijzigd', async () => {
    const data = {}, vorm = { faalAanvragen: 'lijst', faalOntvangsten: 'kaart' };
    const voor = lokaal(a, data), dbVoor = await ruw(Object.keys(vorm));
    await a.pool.query(`CREATE OR REPLACE FUNCTION meervoudig_weiger() RETURNS trigger AS $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM kv WHERE key='faalAanvragen' AND NOT weg) THEN
          RAISE EXCEPTION 'eerste write niet bereikt';
        END IF;
        RAISE EXCEPTION 'meervoudig tweede write geweigerd';
      END $$ LANGUAGE plpgsql`);
    await a.pool.query(`CREATE TRIGGER meervoudig_fout BEFORE INSERT OR UPDATE ON kv
      FOR EACH ROW WHEN (NEW.key='faalOntvangsten') EXECUTE FUNCTION meervoudig_weiger()`);
    const werk = w => { w.faalAanvragen.push({ id: 'x' }); w.faalOntvangsten.x = { id: 'x' }; return 'vast'; };
    try {
      await assert.rejects(a.bewerkCollectie(vorm, data, werk), /meervoudig tweede write geweigerd/);
      assert.deepEqual(await ruw(Object.keys(vorm)), dbVoor);
      assert.deepEqual(lokaal(a, data), voor);
    } finally { await wisTrigger(); }
    assert.equal(await a.bewerkCollectie(vorm, data, werk), 'vast');
    assert.deepEqual(await lees('faalAanvragen'), [{ id: 'x' }]);
    assert.deepEqual(await lees('faalOntvangsten'), { x: { id: 'x' } });
  });

  await t.test('auditspoor: gezamenlijke commit of rollback', async () => {
    const data = {}, vorm = { auditAanvragen: 'lijst', auditOntvangsten: 'kaart' };
    await a.commitVerzoek(data, [{ sleutel: 'handelingLog', basisBestaat: false,
      basisJson: null, waardeBestaat: true, waardeJson: '[]' }]);
    function spoor(wat) {
      const lijst = kopie(data.handelingLog);
      keten.noteerIn(lijst, { at: '2026-10-22T12:00:00.000Z', wie: 'fixture',
        pad: '/api/collectieproef', stand: 'vastgelegd', wat }, 50000);
      return { geschreven: false, wijzigingen: [{ sleutel: 'handelingLog', basisBestaat: true,
        basisJson: JSON.stringify(data.handelingLog), waardeBestaat: true, waardeJson: JSON.stringify(lijst) }] };
    }
    const werk = id => w => { w.auditAanvragen.push({ id }); w.auditOntvangsten[id] = { id }; return id; };
    const goed = spoor('eerste');
    assert.equal(await a.bewerkCollectie(vorm, data, werk('eerste'), goed), 'eerste');
    assert.equal(goed.geschreven, true);
    assert.equal((await lees('handelingLog')).length, 1);
    assert.equal(keten.verifieer(await lees('handelingLog')).ok, true);
    const keys = [...Object.keys(vorm), 'handelingLog'];
    const dbVoor = await ruw(keys), voor = lokaal(a, data), fout = spoor('tweede');
    await a.pool.query(`CREATE OR REPLACE FUNCTION meervoudig_weiger() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'meervoudig audit geweigerd'; END $$ LANGUAGE plpgsql`);
    await a.pool.query(`CREATE TRIGGER meervoudig_fout BEFORE INSERT OR UPDATE ON kv
      FOR EACH ROW WHEN (NEW.key='handelingLog') EXECUTE FUNCTION meervoudig_weiger()`);
    try {
      await assert.rejects(a.bewerkCollectie(vorm, data, werk('tweede'), fout), /meervoudig audit geweigerd/);
      assert.equal(fout.geschreven, false);
      assert.deepEqual(await ruw(keys), dbVoor);
      assert.deepEqual(lokaal(a, data), voor);
    } finally { await wisTrigger(); }
    const herstel = spoor('tweede');
    assert.equal(await a.bewerkCollectie(vorm, data, werk('tweede'), herstel), 'tweede');
    assert.equal(herstel.geschreven, true);
    assert.equal((await lees('auditAanvragen')).length, 2);
    assert.equal(Object.keys(await lees('auditOntvangsten')).length, 2);
    assert.equal((await lees('handelingLog')).length, 2);
    assert.equal(keten.verifieer(await lees('handelingLog')).ok, true);
  });

  await t.test('grafsteen weigert ook oude live-data', async () => {
    await zet('gewist', { oud: true }); await a.wisCollectie('gewist');
    const data = { gewist: { oud: true } }, vorm = { grafAanvragen: 'lijst', gewist: 'kaart' };
    const voor = lokaal(b, data), dbVoor = await ruw(Object.keys(vorm)); let riep = false;
    await assert.rejects(b.bewerkCollectie(vorm, data, () => { riep = true; }), { code: 'COLLECTIE_VERWIJDERD' });
    assert.equal(riep, false);
    assert.deepEqual(await ruw(Object.keys(vorm)), dbVoor);
    assert.deepEqual(lokaal(b, data), voor);
  });

  await t.test('DB/live/callback-typefout zonder publicatie', async () => {
    for (const bron of ['db', 'live', 'callback']) {
      const lijst = bron + 'Lijst', kaart = bron + 'Kaart', vorm = { [lijst]: 'lijst', [kaart]: 'kaart' };
      const data = bron === 'live' ? { [lijst]: {} } : {};
      if (bron === 'db') await zet(lijst, {});
      const voor = lokaal(a, data), dbVoor = await ruw(Object.keys(vorm)); let riep = false;
      await assert.rejects(a.bewerkCollectie(vorm, data, w => {
        riep = true; w[kaart].x = 1; w[lijst] = {};
      }), { code: 'COLLECTIE_TYPE' });
      assert.equal(riep, bron === 'callback');
      assert.deepEqual(await ruw(Object.keys(vorm)), dbVoor);
      assert.deepEqual(lokaal(a, data), voor);
    }
  });

  await t.test('stringinterface krijgt de collectie zelf', async () => {
    const data = {};
    assert.deepEqual(await a.bewerkCollectie('enkelvoudig', data, w => {
      assert.deepEqual(w, {}); w.teller = 1; return { teller: w.teller };
    }), { teller: 1 });
    assert.deepEqual(await lees('enkelvoudig'), { teller: 1 });
    assert.equal(await b.bewerkCollectie('enkelvoudig', {}, w => ++w.teller), 2);
    assert.deepEqual(await lees('enkelvoudig'), { teller: 2 });
  });
} finally {
  await Promise.allSettled(instanties.map(pg => pg.sluit()));
  await iso.close();
}
});
